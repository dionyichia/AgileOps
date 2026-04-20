"""
Async background job execution for pipeline scripts.

Design notes:
- Job DB rows are created synchronously in the route handler (so job_id is
  returned immediately in the HTTP response).
- Actual script execution runs as a FastAPI BackgroundTask in a separate
  coroutine, which must open its own DB session — never reuse the request
  session after the response has been sent.
- Scripts are invoked via asyncio.create_subprocess_exec (non-blocking).
- All pipeline file I/O goes through Supabase Storage. Before spawning a
  script, required inputs are downloaded to a temp directory; after the
  script completes, outputs are uploaded back to Storage. The temp directory
  is always cleaned up regardless of success or failure.
"""

import asyncio
import json
import logging
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import async_session
from backend.api.models.db import Job, JobStatus, JobType, SimulationResult, Transcript, ToolEvaluation
from backend.api.services import data_io, simulation_matrix, ws_manager

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[3]


# ── Job creation ───────────────────────────────────────────────────────────────

async def create_job(db: AsyncSession, project_id: str, job_type: JobType) -> Job:
    """Insert a pending Job row and return it. Called inside the route handler."""
    job = Job(project_id=project_id, job_type=job_type)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


# ── DB update helpers ──────────────────────────────────────────────────────────

async def _update_job(job_id: str, **fields) -> None:
    async with async_session() as db:
        job = await db.get(Job, job_id)
        if job is None:
            logger.error("_update_job: job %s not found", job_id)
            return
        for key, value in fields.items():
            setattr(job, key, value)
        await db.commit()


async def _progress(job_id: str, pct: int, step: str) -> None:
    await _update_job(job_id, status=JobStatus.running, progress_pct=pct, current_step=step)
    await ws_manager.broadcast(job_id, {"type": "progress", "pct": pct, "step": step})


async def _complete(job_id: str, result_data: dict) -> None:
    await _update_job(
        job_id,
        status=JobStatus.completed,
        progress_pct=100,
        current_step="Done",
        result_data=result_data,
        completed_at=datetime.now(timezone.utc),
    )
    await ws_manager.broadcast(job_id, {"type": "completed", "summary": result_data})
    await ws_manager.close_all(job_id)


async def _fail(job_id: str, error: str) -> None:
    await _update_job(
        job_id,
        status=JobStatus.failed,
        error_message=error,
        completed_at=datetime.now(timezone.utc),
    )
    await ws_manager.broadcast(job_id, {"type": "failed", "error": error})
    await ws_manager.close_all(job_id)


async def _update_tool_eval(tool_evaluation_id: str, **fields) -> None:
    async with async_session() as db:
        tool_eval = await db.get(ToolEvaluation, tool_evaluation_id)
        if tool_eval is None:
            logger.error("_update_tool_eval: tool evaluation %s not found", tool_evaluation_id)
            return
        for key, value in fields.items():
            setattr(tool_eval, key, value)
        await db.commit()


# ── Script runner ──────────────────────────────────────────────────────────────

async def _run_script(args: list[str]) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(_PROJECT_ROOT),
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode(), stderr.decode()


# ── Background jobs ────────────────────────────────────────────────────────────

async def run_transcript_job(job_id: str, transcript_id: str, project_id: str) -> None:
    """
    Parse a transcript with transcript_to_tasks.py and merge into all_tasks.json.

    Downloads the transcript text from Storage (falls back to DB raw_text field),
    runs the script in a temp directory, then uploads the updated all_tasks.json
    back to Storage.
    """
    await _update_job(job_id, status=JobStatus.running, started_at=datetime.now(timezone.utc))
    tmp = tempfile.mkdtemp()
    tmp_path = Path(tmp)
    try:
        await _progress(job_id, 10, "Reading transcript")

        # Download transcript text from Storage; fall back to DB raw_text
        transcript_bytes = await data_io._download(
            data_io.PIPELINE_BUCKET,
            f"{project_id}/transcripts/{transcript_id}.txt",
        )
        if transcript_bytes is None:
            async with async_session() as db:
                t = await db.get(Transcript, transcript_id)
                transcript_bytes = t.raw_text.encode("utf-8") if t else b""

        transcript_path = tmp_path / f"{transcript_id}.txt"
        transcript_path.write_bytes(transcript_bytes)

        # Seed existing tasks so the script can merge incrementally
        tasks_path = tmp_path / "all_tasks.json"
        existing = await data_io.read_tasks_json(project_id)
        if existing:
            tasks_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")

        await _progress(job_id, 30, "Sending to Claude for extraction")

        rc, _, stderr = await _run_script([
            "backend/scripts/transcript_to_tasks.py",
            "--transcript", str(transcript_path),
            "--tasks",      str(tasks_path),
        ])
        if rc != 0:
            raise RuntimeError(stderr or f"transcript_to_tasks.py exited {rc}")

        await _progress(job_id, 80, "Updating task graph")

        tasks = json.loads(tasks_path.read_text(encoding="utf-8"))
        await data_io.write_tasks_json(project_id, tasks)

        async with async_session() as db:
            transcript = await db.get(Transcript, transcript_id)
            if transcript:
                transcript.tasks_extracted = len(tasks)
                transcript.tasks_updated   = len(tasks)
                transcript.processed_at    = datetime.now(timezone.utc)
                await db.commit()

        await _complete(job_id, {"tasks_in_graph": len(tasks)})

    except Exception as exc:  # noqa: BLE001
        logger.exception("Transcript job %s failed", job_id)
        await _fail(job_id, str(exc))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


async def run_pipeline_job(job_id: str, project_id: str) -> None:
    """
    Run the full pipeline: syth_data_gen → markov_builder → sim.

    Downloads inputs from Storage to a temp directory, runs the three pipeline
    scripts, then uploads all output files back to Storage under the project prefix.
    """
    await _update_job(job_id, status=JobStatus.running, started_at=datetime.now(timezone.utc))
    tmp = tempfile.mkdtemp()
    tmp_path = Path(tmp)
    try:
        prefix = await data_io.active_data_prefix(project_id)

        tasks_bytes = await data_io._download(
            data_io.PIPELINE_BUCKET, f"{prefix}/all_tasks.json"
        )
        if not tasks_bytes:
            raise RuntimeError("all_tasks.json not found — process a transcript first.")

        tasks_path      = tmp_path / "all_tasks.json"
        telemetry_path  = tmp_path / "telemetry.json"
        transition_path = tmp_path / "transition_matrix.json"
        simulation_path = tmp_path / "monte_carlo_results_original_workflow.json"

        tasks_path.write_bytes(tasks_bytes)

        steps = [
            (10, "Generating synthetic telemetry", [
                "backend/scripts/syth_data_gen.py",
                "--output_dir",  str(tmp_path),
                "--tasks_path",  str(tasks_path),
            ]),
            (40, "Building Markov transition matrix", [
                "backend/scripts/markov_builder.py",
                "--telemetry_path", str(telemetry_path),
                "--output_path",    str(transition_path),
            ]),
            (70, "Running Monte Carlo simulation", [
                "backend/scripts/sim.py",
                "--telemetry_path", str(transition_path),
                "--output_path",    str(simulation_path),
            ]),
        ]

        for pct, step_name, cmd in steps:
            await _progress(job_id, pct, step_name)
            rc, _, stderr = await _run_script(cmd)
            if rc != 0:
                raise RuntimeError(f"{cmd[0]} failed: {stderr}")

        for filename in [
            "telemetry.json",
            "transition_matrix.json",
            "monte_carlo_results_original_workflow.json",
        ]:
            file_path = tmp_path / filename
            if file_path.exists():
                await data_io._upload(
                    data_io.PIPELINE_BUCKET,
                    f"{project_id}/{filename}",
                    file_path.read_bytes(),
                    "application/json",
                )

        await _complete(job_id, {"pipeline": "completed", "project_id": project_id})

    except Exception as exc:  # noqa: BLE001
        logger.exception("Pipeline job %s failed", job_id)
        await _fail(job_id, str(exc))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


async def run_simulation_job(
    job_id: str,
    project_id: str,
    tool_evaluation_id: str,
    sim_kwargs: dict,
) -> None:
    """
    Run parser_scraper → classifier → sim for a given tool evaluation.

    Downloads shared pipeline inputs from Storage, runs the three simulation
    scripts in a temp directory, uploads all intermediate and output files back
    to Storage, and persists a SimulationResult DB row on completion.
    """
    await _update_job(job_id, status=JobStatus.running, started_at=datetime.now(timezone.utc))
    await _update_tool_eval(
        tool_evaluation_id,
        status="running",
        latest_job_id=job_id,
        latest_job_status=JobStatus.running.value,
        latest_job_progress_pct=0,
        latest_job_step="Starting simulation…",
        last_error=None,
        completed_at=None,
    )
    tmp = tempfile.mkdtemp()
    tmp_path = Path(tmp)
    try:
        async with async_session() as db:
            tool_eval = await db.get(ToolEvaluation, tool_evaluation_id)
            if not tool_eval:
                raise RuntimeError("Tool evaluation not found")
            tool_name = tool_eval.tool_name
            website_url = tool_eval.website_url or ""

        tool_slug = re.sub(r"[^a-z0-9]+", "_", tool_name.lower()).strip("_")

        scraped_path = tmp_path / f"scraped_{tool_slug}.json"
        features_path = tmp_path / f"tool_features_{tool_slug}.json"
        simulation_path = tmp_path / f"monte_carlo_results_{tool_slug}.json"
        tool_matrix_path = tmp_path / f"transition_matrix_{tool_slug}.json"

        for filename in ["all_tasks.json", "transition_matrix.json"]:
            storage_path = await data_io.resolve_data_path(project_id, filename)
            file_bytes = await data_io._download(data_io.PIPELINE_BUCKET, storage_path)
            if file_bytes:
                (tmp_path / filename).write_bytes(file_bytes)

        tasks_path = tmp_path / "all_tasks.json"
        transition_path = tmp_path / "transition_matrix.json"

        await _progress(job_id, 10, "Scraping product website…")
        await _update_tool_eval(
            tool_evaluation_id,
            latest_job_status=JobStatus.running.value,
            latest_job_progress_pct=10,
            latest_job_step="Scraping product website…",
        )
        rc, _, stderr = await _run_script([
            "backend/scripts/parser_scraper.py",
            "--tool", tool_name,
            "--url", website_url,
            "--output", str(scraped_path),
        ])
        if rc != 0:
            raise RuntimeError(f"parser_scraper.py failed: {stderr}")

        await _progress(job_id, 40, "Mapping features to workflow…")
        await _update_tool_eval(
            tool_evaluation_id,
            latest_job_status=JobStatus.running.value,
            latest_job_progress_pct=40,
            latest_job_step="Mapping features to workflow…",
        )
        rc, stdout, stderr = await _run_script([
            "backend/scripts/classifier.py",
            "--scraped", str(scraped_path),
            "--tasks", str(tasks_path),
            "--output", str(features_path),
        ])
        if rc != 0:
            raise RuntimeError(f"classifier.py failed: {stderr or stdout}")

        await _progress(job_id, 55, "Building tool-adjusted workflow…")
        await _update_tool_eval(
            tool_evaluation_id,
            latest_job_status=JobStatus.running.value,
            latest_job_progress_pct=55,
            latest_job_step="Building tool-adjusted workflow…",
        )
        baseline_matrix = json.loads(transition_path.read_text(encoding="utf-8"))
        tool_features = json.loads(features_path.read_text(encoding="utf-8"))
        tool_transition_matrix = simulation_matrix.build_tool_transition_matrix(baseline_matrix, tool_features)
        workflow_diff = simulation_matrix.build_workflow_diff(baseline_matrix, tool_transition_matrix, tool_features)
        tool_matrix_path.write_text(json.dumps(tool_transition_matrix, indent=2), encoding="utf-8")

        await _progress(job_id, 65, "Running Monte Carlo simulation…")
        await _update_tool_eval(
            tool_evaluation_id,
            latest_job_status=JobStatus.running.value,
            latest_job_progress_pct=65,
            latest_job_step="Running Monte Carlo simulation…",
        )
        cmd = [
            "backend/scripts/sim.py",
            "--telemetry_path", str(transition_path),
            "--output_path", str(simulation_path),
            "--tool_features", str(features_path),
        ]
        for key, value in sim_kwargs.items():
            cmd += [f"--{key}", str(value)]
        rc, _, stderr = await _run_script(cmd)
        if rc != 0:
            raise RuntimeError(f"sim.py failed: {stderr}")

        for fname, fpath in [
            (f"scraped_{tool_slug}.json", scraped_path),
            (f"tool_features_{tool_slug}.json", features_path),
            (f"transition_matrix_{tool_slug}.json", tool_matrix_path),
            (f"monte_carlo_results_{tool_slug}.json", simulation_path),
        ]:
            if fpath.exists():
                await data_io._upload(
                    data_io.PIPELINE_BUCKET,
                    f"{project_id}/{fname}",
                    fpath.read_bytes(),
                    "application/json",
                )

        await _progress(job_id, 85, "Storing results")
        await _update_tool_eval(
            tool_evaluation_id,
            latest_job_status=JobStatus.running.value,
            latest_job_progress_pct=85,
            latest_job_step="Storing results…",
        )

        results = json.loads(simulation_path.read_text(encoding="utf-8"))
        week_final = results.get("summary", {}).get("week_final", {})
        work_saved = float(week_final.get("work_saved_pct", 0.0))
        throughput_lift = float(week_final.get("throughput_lift_pct", 0.0))

        async with async_session() as db:
            existing = await db.execute(
                select(SimulationResult).where(
                    SimulationResult.tool_evaluation_id == tool_evaluation_id
                )
            )
            sim_result = existing.scalar_one_or_none()
            if sim_result:
                sim_result.results_json = results
                sim_result.baseline_transition_matrix_json = baseline_matrix
                sim_result.tool_transition_matrix_json = tool_transition_matrix
                sim_result.workflow_diff_json = workflow_diff
                sim_result.final_work_saved_pct = work_saved
                sim_result.final_throughput_lift_pct = throughput_lift
            else:
                sim_result = SimulationResult(
                    tool_evaluation_id=tool_evaluation_id,
                    results_json=results,
                    baseline_transition_matrix_json=baseline_matrix,
                    tool_transition_matrix_json=tool_transition_matrix,
                    workflow_diff_json=workflow_diff,
                    final_work_saved_pct=work_saved,
                    final_throughput_lift_pct=throughput_lift,
                )
                db.add(sim_result)
            await db.commit()

        await _update_tool_eval(
            tool_evaluation_id,
            status="completed",
            latest_job_id=job_id,
            latest_job_status=JobStatus.completed.value,
            latest_job_progress_pct=100,
            latest_job_step="Done",
            last_error=None,
            completed_at=datetime.now(timezone.utc),
        )
        await _complete(job_id, {
            "work_saved_pct": work_saved,
            "throughput_lift_pct": throughput_lift,
        })

    except Exception as exc:  # noqa: BLE001
        logger.exception("Simulation job %s failed", job_id)
        await _update_tool_eval(
            tool_evaluation_id,
            status="failed",
            latest_job_id=job_id,
            latest_job_status=JobStatus.failed.value,
            latest_job_step="Simulation failed",
            last_error=str(exc),
        )
        await _fail(job_id, str(exc))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

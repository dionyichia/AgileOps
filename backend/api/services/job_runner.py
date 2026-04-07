"""
Async background job execution for pipeline scripts.

Design notes:
- Job DB rows are created synchronously in the route handler (so job_id is
  returned immediately in the HTTP response).
- Actual script execution runs as a FastAPI BackgroundTask in a separate
  coroutine, which must open its own DB session — never reuse the request
  session after the response has been sent.
- Scripts are invoked via asyncio.create_subprocess_exec (non-blocking).
"""

import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import async_session
from backend.api.models.db import Job, JobStatus, JobType, SimulationResult, Transcript
from backend.api.services import data_io, ws_manager

logger = logging.getLogger(__name__)

# Project root — scripts are invoked relative to this
_PROJECT_ROOT = Path(__file__).resolve().parents[3]


# ── Job creation ───────────────────────────────────────────────────────────────

async def create_job(db: AsyncSession, project_id: str, job_type: JobType) -> Job:
    """Insert a pending Job row and return it. Called inside the route handler."""
    job = Job(project_id=project_id, job_type=job_type)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


# ── DB update helper ───────────────────────────────────────────────────────────

async def _update_job(job_id: str, **fields) -> None:
    """Update job fields in a fresh session (safe to call from background tasks)."""
    async with async_session() as db:
        job = await db.get(Job, job_id)
        if job is None:
            logger.error("_update_job: job %s not found", job_id)
            return
        for key, value in fields.items():
            setattr(job, key, value)
        await db.commit()


async def _progress(job_id: str, pct: int, step: str) -> None:
    """Update job progress and broadcast to connected WebSocket clients."""
    await _update_job(
        job_id,
        status=JobStatus.running,
        progress_pct=pct,
        current_step=step,
    )
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


# ── Script runner ──────────────────────────────────────────────────────────────

async def _run_script(args: list[str]) -> tuple[int, str, str]:
    """
    Run a Python script as a subprocess.
    Returns (returncode, stdout, stderr).
    """
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
    Runs as a FastAPI BackgroundTask.
    """
    await _update_job(
        job_id,
        status=JobStatus.running,
        started_at=datetime.now(timezone.utc),
    )
    try:
        await _progress(job_id, 10, "Reading transcript")

        transcript_path = data_io.transcripts_dir(project_id) / f"{transcript_id}.txt"
        tasks_path = data_io.project_data_dir(project_id) / "all_tasks.json"

        await _progress(job_id, 30, "Sending to Claude for extraction")

        rc, stdout, stderr = await _run_script([
            "backend/scripts/transcript_to_tasks.py",
            "--transcript", str(transcript_path),
            "--tasks",      str(tasks_path),
        ])

        if rc != 0:
            raise RuntimeError(stderr or f"transcript_to_tasks.py exited {rc}")

        await _progress(job_id, 80, "Updating task graph")

        # Count extracted tasks from the updated file
        tasks = data_io.read_tasks_json(project_id)
        n_tasks = len(tasks)

        # Persist stats back on the Transcript row
        async with async_session() as db:
            transcript = await db.get(Transcript, transcript_id)
            if transcript:
                transcript.tasks_extracted = n_tasks
                transcript.tasks_updated   = n_tasks
                transcript.processed_at    = datetime.now(timezone.utc)
                await db.commit()

        await _complete(job_id, {"tasks_in_graph": n_tasks})

    except Exception as exc:  # noqa: BLE001
        logger.exception("Transcript job %s failed", job_id)
        await _fail(job_id, str(exc))


async def run_pipeline_job(job_id: str, project_id: str) -> None:
    """
    Run the full pipeline: syth_data_gen → markov_builder → sim.
    Runs as a FastAPI BackgroundTask.
    """
    await _update_job(
        job_id,
        status=JobStatus.running,
        started_at=datetime.now(timezone.utc),
    )
    data_dir = data_io.project_data_dir(project_id)
    telemetry_path     = data_dir / "telemetry.json"
    transition_path    = data_dir / "transition_matrix.json"
    simulation_path    = data_dir / "monte_carlo_results.json"

    steps = [
        (10,  "Generating synthetic telemetry", [
            "backend/scripts/syth_data_gen.py",
            "--output_dir",  str(data_dir),
            "--tasks_path",  str(data_dir / "all_tasks.json"),
        ]),
        (40,  "Building Markov transition matrix", [
            "backend/scripts/markov_builder.py",
            "--telemetry_path", str(telemetry_path),
            "--output_path",    str(transition_path),
        ]),
        (70,  "Running Monte Carlo simulation", [
            "backend/scripts/sim.py",
            "--telemetry_path", str(transition_path),
            "--output_path",    str(simulation_path),
        ]),
    ]

    try:
        for pct, step_name, cmd in steps:
            await _progress(job_id, pct, step_name)
            rc, _, stderr = await _run_script(cmd)
            if rc != 0:
                raise RuntimeError(f"{cmd[0]} failed: {stderr}")

        await _complete(job_id, {"pipeline": "completed", "project_id": project_id})

    except Exception as exc:  # noqa: BLE001
        logger.exception("Pipeline job %s failed", job_id)
        await _fail(job_id, str(exc))


async def run_simulation_job(
    job_id: str,
    project_id: str,
    tool_evaluation_id: str,
    sim_kwargs: dict,
) -> None:
    """
    Run sim.py only (assumes transition_matrix.json already exists).
    Stores a SimulationResult row on completion.
    Runs as a FastAPI BackgroundTask.
    """
    await _update_job(
        job_id,
        status=JobStatus.running,
        started_at=datetime.now(timezone.utc),
    )
    data_dir        = data_io.project_data_dir(project_id)
    transition_path = data_dir / "transition_matrix.json"
    simulation_path = data_dir / "monte_carlo_results.json"

    try:
        await _progress(job_id, 10, "Starting simulation")

        cmd = [
            "backend/scripts/sim.py",
            "--telemetry_path", str(transition_path),
            "--output_path",    str(simulation_path),
        ]
        for key, value in sim_kwargs.items():
            cmd += [f"--{key}", str(value)]

        await _progress(job_id, 30, "Running Monte Carlo simulation")
        rc, _, stderr = await _run_script(cmd)
        if rc != 0:
            raise RuntimeError(f"sim.py failed: {stderr}")

        await _progress(job_id, 85, "Storing results")

        results = data_io.read_simulation_results(project_id)
        work_saved     = float(results.get("summary", {}).get("work_saved_pct_p50", 0.0))
        throughput_lift = float(results.get("summary", {}).get("throughput_lift_pct_p50", 0.0))

        async with async_session() as db:
            # Upsert: replace any existing result for this tool eval
            from sqlalchemy import select
            existing = await db.execute(
                select(SimulationResult).where(
                    SimulationResult.tool_evaluation_id == tool_evaluation_id
                )
            )
            sim_result = existing.scalar_one_or_none()
            if sim_result:
                sim_result.results_json              = results
                sim_result.final_work_saved_pct      = work_saved
                sim_result.final_throughput_lift_pct = throughput_lift
            else:
                sim_result = SimulationResult(
                    tool_evaluation_id        = tool_evaluation_id,
                    results_json              = results,
                    final_work_saved_pct      = work_saved,
                    final_throughput_lift_pct = throughput_lift,
                )
                db.add(sim_result)
            await db.commit()

        await _complete(job_id, {
            "work_saved_pct":      work_saved,
            "throughput_lift_pct": throughput_lift,
        })

    except Exception as exc:  # noqa: BLE001
        logger.exception("Simulation job %s failed", job_id)
        await _fail(job_id, str(exc))

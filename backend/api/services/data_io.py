"""
Project-scoped Storage I/O helpers — Supabase Storage backend.

Pipeline JSON files live under:
  pipeline-data/{project_id}/...   (project-scoped)
  pipeline-data/_global/...        (fallback for projects without their own all_tasks.json)

User-uploaded documents live under:
  uploads/{project_id}/{uuid}_{filename}
"""

import json
from typing import Any

import anyio
from fastapi import HTTPException
from supabase import Client, create_client

from backend.api.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

PIPELINE_BUCKET = "pipeline-data"
UPLOADS_BUCKET = "uploads"
GLOBAL_PREFIX = "_global"

_client: Client | None = None


def _storage() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


# ── Low-level Storage helpers (sync SDK wrapped for async callers) ────────────

async def _download(bucket: str, path: str) -> bytes | None:
    def _do() -> bytes | None:
        try:
            return _storage().storage.from_(bucket).download(path)
        except Exception:
            return None
    return await anyio.to_thread.run_sync(_do)


async def _upload(
    bucket: str,
    path: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> None:
    def _do() -> None:
        _storage().storage.from_(bucket).upload(
            path=path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    await anyio.to_thread.run_sync(_do)


async def _delete(bucket: str, path: str) -> None:
    def _do() -> None:
        try:
            _storage().storage.from_(bucket).remove([path])
        except Exception:
            pass
    await anyio.to_thread.run_sync(_do)


async def _exists(bucket: str, path: str) -> bool:
    return await _download(bucket, path) is not None


async def _read_json(bucket: str, path: str) -> Any | None:
    data = await _download(bucket, path)
    if data is None:
        return None
    return json.loads(data.decode("utf-8"))


async def _write_json(bucket: str, path: str, obj: Any) -> None:
    payload = json.dumps(obj, indent=2).encode("utf-8")
    await _upload(bucket, path, payload, "application/json")


# ── Active prefix resolution ──────────────────────────────────────────────────

async def active_data_prefix(project_id: str) -> str:
    """Return the Storage prefix for pipeline I/O.

    Uses the project-scoped prefix when the project has its own all_tasks.json;
    otherwise falls back to the shared _global defaults.
    """
    has_tasks = await _exists(PIPELINE_BUCKET, f"{project_id}/all_tasks.json")
    return project_id if has_tasks else GLOBAL_PREFIX


async def resolve_data_path(project_id: str, filename: str) -> str:
    """Return the Storage object path for filename.

    Returns the project-scoped path if it exists, otherwise the _global fallback.
    """
    project_path = f"{project_id}/{filename}"
    if await _exists(PIPELINE_BUCKET, project_path):
        return project_path
    return f"{GLOBAL_PREFIX}/{filename}"


# ── Pipeline data accessors ───────────────────────────────────────────────────

async def read_tasks_json(project_id: str) -> list[dict]:
    result = await _read_json(PIPELINE_BUCKET, f"{project_id}/all_tasks.json")
    return result or []


async def write_tasks_json(project_id: str, tasks: list[dict]) -> None:
    await _write_json(PIPELINE_BUCKET, f"{project_id}/all_tasks.json", tasks)


async def clear_tasks_json(project_id: str) -> None:
    await _delete(PIPELINE_BUCKET, f"{project_id}/all_tasks.json")


async def clear_telemetry_json(project_id: str) -> None:
    await _delete(PIPELINE_BUCKET, f"{project_id}/telemetry.json")


async def read_transition_matrix(project_id: str) -> dict:
    path = await resolve_data_path(project_id, "transition_matrix.json")
    result = await _read_json(PIPELINE_BUCKET, path)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Transition matrix not found. Run the pipeline first.",
        )
    return result


async def read_simulation_results(project_id: str) -> dict:
    path = await resolve_data_path(project_id, "monte_carlo_results_original_workflow.json")
    result = await _read_json(PIPELINE_BUCKET, path)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Baseline simulation results not found. Run the full pipeline first.",
        )
    return result


async def read_tool_simulation_results(project_id: str, tool_slug: str) -> dict:
    prefix = await active_data_prefix(project_id)
    path = f"{prefix}/monte_carlo_results_{tool_slug}.json"
    result = await _read_json(PIPELINE_BUCKET, path)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Simulation results for '{tool_slug}' not found. Run the simulation first.",
        )
    return result


async def save_transcript_text(project_id: str, transcript_id: str, raw_text: str) -> str:
    """Upload raw transcript text to Storage. Returns the object path."""
    path = f"{project_id}/transcripts/{transcript_id}.txt"
    await _upload(PIPELINE_BUCKET, path, raw_text.encode("utf-8"), "text/plain")
    return path


# ── Upload helpers ────────────────────────────────────────────────────────────

def uploads_storage_path(project_id: str, dest_filename: str) -> str:
    """Return the Storage object path for an uploaded file."""
    return f"{project_id}/{dest_filename}"

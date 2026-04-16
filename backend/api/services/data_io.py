"""
Project-scoped file I/O helpers.

All pipeline scripts read/write JSON files under backend/data/{project_id}/.
This module centralises path construction and file access so routes stay clean.
"""

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from backend.api.config import DATA_DIR


def project_data_dir(project_id: str) -> Path:
    """Return the data directory for a project, creating it if needed."""
    path = DATA_DIR / project_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def uploads_dir(project_id: str) -> Path:
    """Return the uploads directory for a project, creating it if needed."""
    path = project_data_dir(project_id) / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def transcripts_dir(project_id: str) -> Path:
    """Return the transcripts directory for a project, creating it if needed."""
    path = project_data_dir(project_id) / "transcripts"
    path.mkdir(parents=True, exist_ok=True)
    return path


# ── JSON helpers ───────────────────────────────────────────────────────────────

def _read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Pipeline data accessors ────────────────────────────────────────────────────

def read_tasks_json(project_id: str) -> list[dict]:
    """Read all_tasks.json for a project. Returns [] if the file does not exist."""
    path = project_data_dir(project_id) / "all_tasks.json"
    if not path.exists():
        return []
    return _read_json(path)


def write_tasks_json(project_id: str, tasks: list[dict]) -> None:
    """Write all_tasks.json for a project, replacing existing content."""
    path = project_data_dir(project_id) / "all_tasks.json"
    _write_json(path, tasks)


def clear_tasks_json(project_id: str) -> None:
    """Delete all_tasks.json for a project (if it exists)."""
    path = project_data_dir(project_id) / "all_tasks.json"
    if path.exists():
        path.unlink()


def clear_telemetry_json(project_id: str) -> None:
    """Delete telemetry.json for a project (if it exists).

    Called after all_tasks.json is edited so the stale synthetic log
    is removed. The pipeline will regenerate it from the updated
    all_tasks.json on the next run.
    """
    path = project_data_dir(project_id) / "telemetry.json"
    if path.exists():
        path.unlink()


def read_transition_matrix(project_id: str) -> dict:
    """Read transition_matrix.json. Raises 404 if not yet generated."""
    path = project_data_dir(project_id) / "transition_matrix.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Transition matrix not found. Run the pipeline first.",
        )
    return _read_json(path)


def read_simulation_results(project_id: str) -> dict:
    """Read monte_carlo_results.json. Raises 404 if not yet generated."""
    path = project_data_dir(project_id) / "monte_carlo_results.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Simulation results not found. Run the pipeline first.",
        )
    return _read_json(path)


def scraped_tool_path(project_id: str, tool_slug: str) -> Path:
    """Return path for scraped_{slug}.json in the project directory."""
    return project_data_dir(project_id) / f"scraped_{tool_slug}.json"


def tool_features_path(project_id: str, tool_slug: str) -> Path:
    """Return path for tool_features_{slug}.json in the project directory."""
    return project_data_dir(project_id) / f"tool_features_{tool_slug}.json"


def save_transcript_text(project_id: str, transcript_id: str, raw_text: str) -> Path:
    """Persist raw transcript text to disk. Returns the file path."""
    dest = transcripts_dir(project_id) / f"{transcript_id}.txt"
    dest.write_text(raw_text, encoding="utf-8")
    return dest

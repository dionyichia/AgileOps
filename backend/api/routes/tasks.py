from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Project
from backend.api.schemas.api import TaskNodeOut
from backend.api.services import data_io

router = APIRouter(tags=["tasks"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/tasks", response_model=list[TaskNodeOut])
async def get_tasks(project_id: str, db: AsyncSession = Depends(get_db)):
    """
    Return the current task graph for a project.
    Returns an empty list if no transcripts have been processed yet.
    """
    await _get_project_or_404(project_id, db)
    return await data_io.read_tasks_json(project_id)


@router.put("/projects/{project_id}/tasks", response_model=list[TaskNodeOut])
async def update_tasks(
    project_id: str,
    tasks: List[TaskNodeOut],
    db: AsyncSession = Depends(get_db),
):
    """
    Replace all_tasks.json with the provided task list.
    Accepts the full list of task nodes (same shape as GET response).
    """
    await _get_project_or_404(project_id, db)
    raw = [t.model_dump() for t in tasks]
    await data_io.write_tasks_json(project_id, raw)
    await data_io.clear_telemetry_json(project_id)
    return raw


@router.post("/projects/{project_id}/tasks/reset", status_code=204)
async def reset_tasks(project_id: str, db: AsyncSession = Depends(get_db)):
    """Delete all_tasks.json for the project, resetting the task graph."""
    await _get_project_or_404(project_id, db)
    await data_io.clear_tasks_json(project_id)

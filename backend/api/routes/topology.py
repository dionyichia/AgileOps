from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Project
from backend.api.services import data_io

router = APIRouter(tags=["topology"])


class TopologyPayload(BaseModel):
    positions: dict[str, dict[str, float]]
    edges: list[dict[str, Any]]


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/topology")
async def get_topology(project_id: str, db: AsyncSession = Depends(get_db)):
    """Return saved ReactFlow topology (positions + edges) for a project."""
    await _get_project_or_404(project_id, db)
    return await data_io.read_topology(project_id)


@router.put("/projects/{project_id}/topology")
async def save_topology(
    project_id: str,
    body: TopologyPayload,
    db: AsyncSession = Depends(get_db),
):
    """Persist ReactFlow topology (positions + edges) for a project."""
    await _get_project_or_404(project_id, db)
    await data_io.write_topology(project_id, body.model_dump())
    return body

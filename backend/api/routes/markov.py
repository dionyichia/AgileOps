from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import Project
from backend.api.services import data_io

router = APIRouter(tags=["markov"])


@router.get("/projects/{project_id}/markov")
async def get_markov(project_id: str, db: AsyncSession = Depends(get_db)):
    """
    Return the transition matrix JSON for a project.

    The frontend's useMarkovData hook fetches this endpoint and transforms
    the data client-side into ReactFlow nodes and edges. The raw JSON shape
    matches what loadMarkovData() in dataLoader.ts expects.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # data_io raises 404 HTTPException if the file doesn't exist yet
    return await data_io.read_transition_matrix(project_id)

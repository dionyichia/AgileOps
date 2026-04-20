from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import AuthUser, get_current_user, get_db
from backend.api.models.db import Project
from backend.api.services import data_io
from backend.api.services.project_access import require_owned_project

router = APIRouter(tags=["markov"])


@router.get("/projects/{project_id}/markov")
async def get_markov(
    project_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the transition matrix JSON for a project.

    The frontend's useMarkovData hook fetches this endpoint and transforms
    the data client-side into ReactFlow nodes and edges. The raw JSON shape
    matches what loadMarkovData() in dataLoader.ts expects.
    """
    await require_owned_project(project_id, current_user, db)

    # data_io raises 404 HTTPException if the file doesn't exist yet
    return await data_io.read_transition_matrix(project_id)

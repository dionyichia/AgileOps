from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import SimulationResult, ToolEvaluation
from backend.api.schemas.api import RecommendationOut
from backend.api.services import recommendation as recommendation_service

router = APIRouter(tags=["recommendation"])


@router.get("/projects/{project_id}/recommendation/{eval_id}", response_model=RecommendationOut)
async def get_recommendation(
    project_id: str, eval_id: str, db: AsyncSession = Depends(get_db)
):
    """
    Derive and return the recommendation for a completed tool evaluation.
    Requires a SimulationResult to exist (run the simulation pipeline first).
    """
    tool_eval = await db.get(ToolEvaluation, eval_id)
    if not tool_eval or tool_eval.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tool evaluation not found")

    result = await db.execute(
        select(SimulationResult).where(SimulationResult.tool_evaluation_id == eval_id)
    )
    sim_result = result.scalar_one_or_none()
    if not sim_result:
        raise HTTPException(
            status_code=404,
            detail="Simulation results not found. Run the simulation pipeline first.",
        )

    return recommendation_service.derive(tool_eval, sim_result)

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import JobType, Project, ToolEvaluation
from backend.api.services import job_runner

router = APIRouter(tags=["pipeline"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


class SimulateRequest(BaseModel):
    tool_evaluation_id: str
    # Optional sim overrides — passed through to sim.py as CLI flags
    adoption_rate:    float | None = None
    learning_rate:    float | None = None
    n_simulations:    int | None   = None
    n_weeks:          int | None   = None
    pipeline_depth:   int | None   = None


@router.post("/projects/{project_id}/pipeline/run", response_model=dict)
async def run_pipeline(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Run the full pipeline (syth_data_gen → markov_builder → sim).
    Returns immediately with {job_id}; poll or subscribe via WebSocket.
    """
    await _get_project_or_404(project_id, db)

    job = await job_runner.create_job(db, project_id, JobType.pipeline_run)
    background_tasks.add_task(job_runner.run_pipeline_job, job.id, project_id)

    return {"job_id": job.id}


@router.post("/projects/{project_id}/pipeline/simulate", response_model=dict)
async def run_simulation(
    project_id: str,
    body: SimulateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Run sim.py only (assumes transition_matrix.json already exists).
    Accepts optional simulation parameter overrides.
    Returns {job_id}.
    """
    await _get_project_or_404(project_id, db)

    tool_eval = await db.get(ToolEvaluation, body.tool_evaluation_id)
    if not tool_eval or tool_eval.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tool evaluation not found")

    # Build kwargs dict for any sim overrides that were provided
    sim_kwargs = {
        k: v
        for k, v in {
            "adoption_rate":  body.adoption_rate,
            "learning_rate":  body.learning_rate,
            "n_simulations":  body.n_simulations,
            "n_weeks":        body.n_weeks,
            "pipeline_depth": body.pipeline_depth,
        }.items()
        if v is not None
    }

    job = await job_runner.create_job(db, project_id, JobType.simulation)
    background_tasks.add_task(
        job_runner.run_simulation_job,
        job.id,
        project_id,
        body.tool_evaluation_id,
        sim_kwargs,
    )

    return {"job_id": job.id}

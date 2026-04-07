from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.api.models.db import SimulationResult, ToolEvaluation
from backend.api.schemas.api import SimulationDataOut
from backend.api.services import data_io

router = APIRouter(tags=["simulation"])


@router.get("/projects/{project_id}/simulation/{eval_id}", response_model=SimulationDataOut)
async def get_simulation(
    project_id: str, eval_id: str, db: AsyncSession = Depends(get_db)
):
    """
    Return Monte Carlo simulation results for a tool evaluation.

    Priority:
      1. DB-stored SimulationResult (written by the simulation background job)
      2. Fallback: read monte_carlo_results.json from disk (manual pipeline runs)
    """
    tool_eval = await db.get(ToolEvaluation, eval_id)
    if not tool_eval or tool_eval.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tool evaluation not found")

    # Try DB first
    result = await db.execute(
        select(SimulationResult).where(SimulationResult.tool_evaluation_id == eval_id)
    )
    sim_result = result.scalar_one_or_none()

    if sim_result:
        results_json = sim_result.results_json
        work_saved   = sim_result.final_work_saved_pct
        throughput   = sim_result.final_throughput_lift_pct
    else:
        # Fallback to file on disk (e.g. after a manual pipeline run)
        results_json = data_io.read_simulation_results(project_id)
        summary      = results_json.get("summary", {})
        work_saved   = float(summary.get("work_saved_pct_p50", 0.0))
        throughput   = float(summary.get("throughput_lift_pct_p50", 0.0))

    metadata = results_json.get("metadata", {})

    return SimulationDataOut(
        results_json              = results_json,
        tool_name                 = tool_eval.tool_name,
        n_simulations             = int(metadata.get("n_simulations", 2000)),
        n_weeks                   = int(metadata.get("n_weeks", 12)),
        final_work_saved_pct      = work_saved,
        final_throughput_lift_pct = throughput,
    )

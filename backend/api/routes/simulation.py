import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import AuthUser, get_current_user, get_db
from backend.api.models.db import SimulationResult, ToolEvaluation
from backend.api.schemas.api import SimulationDataOut
from backend.api.services import data_io
from backend.api.services.project_access import require_owned_project

router = APIRouter(tags=["simulation"])


@router.get("/projects/{project_id}/simulation/{eval_id}", response_model=SimulationDataOut)
async def get_simulation(
    project_id: str,
    eval_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return Monte Carlo simulation results for a tool evaluation.

    Priority:
      1. DB-stored SimulationResult (written by the simulation background job)
      2. Fallback: read monte_carlo_results_{slug}.json from disk (manual pipeline runs)
    """
    await require_owned_project(project_id, current_user, db)
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
        baseline_transition_matrix_json = sim_result.baseline_transition_matrix_json
        tool_transition_matrix_json = sim_result.tool_transition_matrix_json
        workflow_diff_json = sim_result.workflow_diff_json
    else:
        # Fallback to tool-specific file on disk (e.g. after a manual pipeline run)
        tool_slug    = re.sub(r"[^a-z0-9]+", "_", tool_eval.tool_name.lower()).strip("_")
        results_json = await data_io.read_tool_simulation_results(project_id, tool_slug)
        baseline_transition_matrix_json = await data_io.read_transition_matrix(project_id)
        tool_transition_matrix_json = None
        workflow_diff_json = None
        week_final   = results_json.get("summary", {}).get("week_final", {})
        work_saved   = float(week_final.get("work_saved_pct", 0.0))
        throughput   = float(week_final.get("throughput_lift_pct", 0.0))

    metadata = results_json.get("metadata", {})

    return SimulationDataOut(
        results_json              = results_json,
        tool_name                 = tool_eval.tool_name,
        n_simulations             = int(metadata.get("n_simulations", 2000)),
        n_weeks                   = int(metadata.get("n_weeks", 12)),
        final_work_saved_pct      = work_saved,
        final_throughput_lift_pct = throughput,
        baseline_transition_matrix_json = baseline_transition_matrix_json,
        tool_transition_matrix_json = tool_transition_matrix_json,
        workflow_diff_json = workflow_diff_json,
    )

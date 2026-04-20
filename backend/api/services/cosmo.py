import json
from statistics import mean
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.config import ANTHROPIC_API_KEY, COSMO_MODEL
from backend.api.models.db import Project, SimulationResult, ToolEvaluation
from backend.api.schemas.api import RecommendationOut
from backend.api.services import data_io, recommendation as recommendation_service

_anthropic_client: AsyncAnthropic | None = None


def _client() -> AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        if not ANTHROPIC_API_KEY:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured on the server")
        _anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _anthropic_client


def _trim_text(value: str, limit: int = 240) -> str:
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


def _task_summary(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summary: list[dict[str, Any]] = []
    for task in tasks[:20]:
        duration = task.get("duration_distribution") or {}
        summary.append(
            {
                "node_id": task.get("node_id"),
                "label": task.get("label"),
                "description": _trim_text(str(task.get("description") or ""), 180),
                "mean_minutes": duration.get("mean_minutes"),
                "automatable_fraction": task.get("automatable_fraction"),
                "tools": task.get("app_cluster") or [],
            }
        )
    return summary


def _markov_summary(markov: dict[str, Any] | None) -> dict[str, Any] | None:
    if not markov:
        return None

    node_durations = markov.get("node_durations") or {}
    duration_summary = []
    for node_id, samples in node_durations.items():
        if not samples:
            continue
        duration_summary.append({"node_id": node_id, "mean_minutes": round(mean(samples), 1)})

    duration_summary.sort(key=lambda item: item["mean_minutes"], reverse=True)

    return {
        "metadata": markov.get("metadata") or {},
        "top_transitions": (markov.get("top_transitions") or [])[:10],
        "longest_steps": duration_summary[:8],
    }


def _simulation_summary(results_json: dict[str, Any] | None) -> dict[str, Any] | None:
    if not results_json:
        return None

    weekly_snapshots = results_json.get("weekly_snapshots") or []
    latest_week = weekly_snapshots[-1] if weekly_snapshots else None
    return {
        "tool_name": results_json.get("tool_name"),
        "summary": results_json.get("summary") or {},
        "topology_changes": (results_json.get("topology_changes") or [])[:8],
        "tool_node_impact": (results_json.get("tool_node_impact") or [])[:10],
        "tool_edge_impact": (results_json.get("tool_edge_impact") or [])[:10],
        "latest_week": latest_week,
    }


async def build_context(
    *,
    project: Project,
    db: AsyncSession,
    page: str,
    tool_evaluation_id: str | None,
) -> dict[str, Any]:
    tasks = await data_io.read_tasks_json(project.id)

    try:
        markov = await data_io.read_transition_matrix(project.id)
    except HTTPException:
        markov = None

    tool_eval: ToolEvaluation | None = None
    tool_results_json: dict[str, Any] | None = None
    recommendation_payload: RecommendationOut | None = None

    if tool_evaluation_id:
        tool_eval = await db.get(ToolEvaluation, tool_evaluation_id)
        if not tool_eval or tool_eval.project_id != project.id:
            raise HTTPException(status_code=404, detail="Tool evaluation not found")

        result = await db.execute(
            select(SimulationResult).where(SimulationResult.tool_evaluation_id == tool_evaluation_id)
        )
        sim_result = result.scalar_one_or_none()
        if sim_result:
            tool_results_json = sim_result.results_json
            recommendation_payload = recommendation_service.derive(tool_eval, sim_result)

    return {
        "project": {
            "id": project.id,
            "primary_role": project.primary_role,
            "team_size": project.team_size,
            "status": project.status,
        },
        "page": page,
        "workflow": {
            "task_count": len(tasks),
            "tasks": _task_summary(tasks),
            "markov": _markov_summary(markov),
        },
        "simulation": {
            "active_tool_evaluation": (
                {
                    "id": tool_eval.id,
                    "tool_name": tool_eval.tool_name,
                    "status": tool_eval.status,
                    "completed_at": tool_eval.completed_at.isoformat() if tool_eval.completed_at else None,
                }
                if tool_eval
                else None
            ),
            "results": _simulation_summary(tool_results_json),
            "recommendation": recommendation_payload.model_dump() if recommendation_payload else None,
        },
    }


async def generate_reply(
    *,
    project: Project,
    db: AsyncSession,
    page: str,
    tool_evaluation_id: str | None,
    messages: list[dict[str, str]],
) -> tuple[str, str]:
    context = await build_context(
        project=project,
        db=db,
        page=page,
        tool_evaluation_id=tool_evaluation_id,
    )
    return await generate_reply_from_context(context=context, messages=messages)


async def generate_reply_from_context(
    *,
    context: dict[str, Any],
    messages: list[dict[str, str]],
) -> tuple[str, str]:
    context_json = json.dumps(context, indent=2)

    response = await _client().messages.create(
        model=COSMO_MODEL,
        max_tokens=900,
        system=(
            "You are Cosmo, a client-facing workflow and simulation assistant for AgileOps. "
            "Only answer using the provided project context, which is limited to the client's workflow, "
            "Markov workflow model, simulation outputs, and recommendation summary for the active project. "
            "Never claim access to other projects, internal notes, uploads, admin tools, or external knowledge. "
            "If the user asks for something outside this scope, say that you only have access to their workflow "
            "and simulation context and invite them to ask about that. Be concise, clear, and helpful."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    "Project context for this conversation. Use it as the full source of truth.\n"
                    f"{context_json}"
                ),
            },
            *messages,
        ],
    )

    text_parts = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    reply = "\n\n".join(part.strip() for part in text_parts if part.strip())
    if not reply:
        raise HTTPException(status_code=502, detail="Cosmo returned an empty response")

    return reply, response.model

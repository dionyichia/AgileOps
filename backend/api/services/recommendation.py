"""
Derives a RecommendationOut from a SimulationResult + ToolEvaluation.

Pure computation — no DB calls, no file I/O.
"""

from backend.api.models.db import SimulationResult, ToolEvaluation
from backend.api.schemas.api import (
    CompanyImpact,
    EmployeeImpact,
    ImpactRange,
    RecommendationOut,
    UseCase,
)

# Average B2B SaaS tool cost per seat per year (placeholder)
_DEFAULT_TOOL_COST = 1200.0


def derive(tool_eval: ToolEvaluation, sim_result: SimulationResult) -> RecommendationOut:
    """
    Build a RecommendationOut from simulation results.

    p10 = conservative estimate (10th percentile of simulation runs)
    p70 = optimistic estimate  (70th percentile of simulation runs)

    Falls back to safe defaults when percentile arrays are absent so the
    endpoint never crashes on partial data.
    """
    results = sim_result.results_json
    summary = results.get("summary", {})

    work_saved_pct     = sim_result.final_work_saved_pct
    throughput_lift_pct = sim_result.final_throughput_lift_pct

    # ── Percentile ranges ──────────────────────────────────────────────────────
    # sim.py stores weekly series; use first/last to derive p10/p70 from summary
    ws_p10 = float(summary.get("work_saved_pct_p10",  work_saved_pct * 0.6))
    ws_p70 = float(summary.get("work_saved_pct_p70",  work_saved_pct * 1.1))
    tp_p10 = float(summary.get("throughput_lift_pct_p10", throughput_lift_pct * 0.6))
    tp_p70 = float(summary.get("throughput_lift_pct_p70", throughput_lift_pct * 1.1))

    # ── Confidence score ───────────────────────────────────────────────────────
    # Heuristic: penalise high variance (wide p10–p70 gap) and low magnitude
    spread = abs(ws_p70 - ws_p10)
    magnitude = min(work_saved_pct / 30.0, 1.0)  # normalise to 30% = confident
    variance_penalty = min(spread / 40.0, 0.4)
    confidence = round(max(0.1, min(0.95, magnitude - variance_penalty)), 2)

    # ── Summary string ─────────────────────────────────────────────────────────
    summary_text = (
        f"Adopting {tool_eval.tool_name} is projected to reduce workflow time by "
        f"{work_saved_pct:.0f}% and lift deal throughput by "
        f"{throughput_lift_pct:.0f}% over a 12-week adoption window."
    )

    # ── Employee impact ────────────────────────────────────────────────────────
    # Convert % work saved to hours/week (assuming 40h week, ~60% time on pipeline)
    pipeline_hours = 40 * 0.6
    time_saved_p10 = round(pipeline_hours * ws_p10 / 100, 1)
    time_saved_p70 = round(pipeline_hours * ws_p70 / 100, 1)

    # Velocity = deals completed faster; scale from throughput lift
    velocity_p10 = round(tp_p10 * 0.8, 1)
    velocity_p70 = round(tp_p70 * 0.8, 1)

    # Learning weeks: assume 2–4 weeks depending on tool complexity
    learning_weeks = "2–4 weeks"

    # ── Company impact ─────────────────────────────────────────────────────────
    # Tool cost pulled from sim results or a placeholder
    tool_cost = float(summary.get("tool_cost_per_seat_annual", _DEFAULT_TOOL_COST))

    # Revenue impact modelled as throughput lift * average deal value proxy
    avg_deal_value = float(summary.get("avg_deal_value", 50_000))
    revenue_p10 = round(avg_deal_value * tp_p10 / 100, -2)   # rounded to $100
    revenue_p70 = round(avg_deal_value * tp_p70 / 100, -2)

    # ── Use cases from automatable nodes ──────────────────────────────────────
    use_cases = _build_use_cases(results, tool_eval.tool_name)

    return RecommendationOut(
        tool_name        = tool_eval.tool_name,
        confidence_score = confidence,
        summary          = summary_text,
        employee_impact  = EmployeeImpact(
            time_saved     = ImpactRange(p10=time_saved_p10, p70=time_saved_p70),
            velocity_gain  = ImpactRange(p10=velocity_p10,   p70=velocity_p70),
            learning_weeks = learning_weeks,
        ),
        company_impact = CompanyImpact(
            throughput     = ImpactRange(p10=tp_p10,      p70=tp_p70),
            revenue_impact = ImpactRange(p10=revenue_p10, p70=revenue_p70),
            tool_cost      = tool_cost,
        ),
        use_cases = use_cases,
    )


def _build_use_cases(results: dict, tool_name: str) -> list[UseCase]:
    """
    Derive use-case bullets from the simulation's node impact data.
    Falls back to generic bullets when node data is absent.
    """
    node_impacts: dict = results.get("node_impacts", {})

    use_cases: list[UseCase] = []
    for node_id, impact in list(node_impacts.items())[:3]:
        label = node_id.replace("_", " ").title()
        reduction = impact.get("duration_reduction_pct", 0)
        use_cases.append(UseCase(
            title       = f"{label} Automation",
            description = (
                f"{tool_name} reduces time spent on {label.lower()} by ~{reduction:.0f}%, "
                "freeing reps to focus on high-value conversations."
            ),
        ))

    # Always have at least two bullets
    if not use_cases:
        use_cases = [
            UseCase(
                title       = "Workflow Automation",
                description = f"{tool_name} automates repetitive tasks across the sales pipeline.",
            ),
            UseCase(
                title       = "Deal Velocity",
                description = f"{tool_name} accelerates deal progression by reducing manual handoffs.",
            ),
        ]
    elif len(use_cases) == 1:
        use_cases.append(UseCase(
            title       = "Deal Velocity",
            description = f"{tool_name} accelerates deal progression by reducing manual handoffs.",
        ))

    return use_cases

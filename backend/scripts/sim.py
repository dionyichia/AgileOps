"""
05_monte_carlo.py
─────────────────────────────────────────────────────────────────────────────
Monte Carlo simulation of B2B sales pipeline.
Compares BASELINE rep behaviour vs GONG-augmented workflow.

Inputs  : transition_matrix.json  (from 02_markov_builder.py)
Params  : adoption_rate, learning_rate, n_simulations, n_weeks, ...
Outputs : monte_carlo_results.json + printed report

─────────────────────────────────────────────────────────────────────────────
ASSUMPTIONS (all explicit, all overridable in CONFIG)
─────────────────────────────────────────────────────────────────────────────
A1  Markov transitions are memoryless — next state depends only on current state
A2  Node durations are sampled from lognormal fit to observed duration_min data
A3  Edge dwell (async wait) is sampled from lognormal fit to observed dwell data
A4  Gong impact percentages are derived from published Gong benchmarks + our
    earlier research (Mission Andromeda, Oct 2025 MCP release)
A5  Adoption follows a logistic S-curve over weeks — early friction, then plateau
A6  Learning (per-rep proficiency) follows exponential saturation:
      effective_skill(t) = 1 - exp(-learning_rate * t)  ∈ [0, 1]
A7  Effective Gong reduction for a given rep at week t:
      reduction(t) = gong_impact * adoption_rate * effective_skill(t)
A8  Reps work 8h/day, 5 days/week (40h working week)
A9  A rep manages an average of 20 active deals simultaneously (pipeline depth)
A10 Deals are independent — no shared resource contention modelled
A11 Topology changes (node collapse, new edges) are applied structurally before
    sampling, not via duration reduction alone
A12 Win-rate is an emergent property of the transition matrix, not fixed
─────────────────────────────────────────────────────────────────────────────
"""

import json
import math
import numpy as np
import random
from collections import defaultdict
from dataclasses import dataclass, field, asdict
import argparse

random.seed(42)
np.random.seed(42)

# ═══════════════════════════════════════════════════════════════════════════════
# 0. CONFIG  — All tunable parameters in one place
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class SimConfig:
    # ── Run params ─────────────────────────────────────────────────────────────
    n_simulations:      int   = 2000    # Monte Carlo draw count (≥1000 for stable CIs)
    n_weeks:            int   = 12      # Simulation horizon (weeks)
    pipeline_depth:     int   = 20      # Avg concurrent deals per rep  [A9]

    # ── Calendar params ────────────────────────────────────────────────────────
    working_hours_day:  float = 8.0     # [A8]
    working_days_week:  int   = 5       # [A8]

    # ── Adoption / Learning params ─────────────────────────────────────────────
    adoption_rate:      float = 0.75    # Fraction of reps who ever adopt Gong  [0-1]
    learning_rate:      float = 0.30    # Exponential saturation rate per week  [A6]
                                        #   0.10 = slow ramp (~10wk to 63%)
                                        #   0.30 = moderate ramp (~3wk to 63%)
                                        #   0.70 = fast ramp (~1.5wk to 63%)
    adoption_midpoint:  float = 3.0     # Week at which 50% of adopters are on Gong [A5]
    adoption_steepness: float = 1.2     # Logistic curve steepness [A5]

    # ── Gong impact model  [A4] ────────────────────────────────────────────────
    # Two levers per affected node:
    #   node_reduction_pct  → % cut from active work time (duration_min)
    #   edge_reduction_pct  → % cut from async wait time on outgoing edges
    # Topology changes are handled separately in GONG_TOPOLOGY below
    GONG_NODE_IMPACT: dict = field(default_factory=lambda: {
        # node_id                    : reduction % on duration_min
        "prospect_research"          : 0.60,   # AI account brief, ICP scoring
        "draft_outreach"             : 0.65,   # AI Composer drafts personalised email
        "send_and_log"               : 0.40,   # Auto-log via MCP → Salesforce
        "follow_up_sequence"         : 0.70,   # AI Tasker manages cadence autonomously
        "response_triage"            : 0.55,   # AI classifies replies, scores urgency
        "discovery_call_prep"        : 0.62,   # Deep Researcher generates call brief
        "discovery_call_execution"   : 0.00,   # Human-essential, no reduction  [A4]
        "call_debrief_logging"       : 0.80,   # AI Data Extractor auto-fills CRM
        "stakeholder_mapping"        : 0.45,   # AI cross-references LinkedIn + CRM
        "demo_scheduling_and_prep"   : 0.35,   # Partial — demo customisation still manual
        "demo_delivery"              : 0.00,   # Human-essential  [A4]
        "objection_handling"         : 0.40,   # AI surfaces battlecards + coaching tips
        "proposal_drafting"          : 0.55,   # AI Composer + CPQ integration
        "contract_negotiation"       : 0.10,   # Light — legal review still human
        "deal_closure_and_handoff"   : 0.45,   # AI generates CS handoff doc
    })

    GONG_EDGE_IMPACT: dict = field(default_factory=lambda: {
        # (src, dst)                             : reduction % on transition_dwell
        ("send_and_log", "follow_up_sequence")   : 0.00,   # prospect reply time — not Gong's control
        ("follow_up_sequence", "response_triage"): 0.30,   # AI follow-up fires faster
        ("response_triage", "discovery_call_prep"): 0.25,  # faster routing of hot leads
        ("call_debrief_logging", "stakeholder_mapping"): 0.50,  # no manual debrief lag
        ("objection_handling", "proposal_drafting"): 0.35, # AI surfaces response faster
    })

    # ── Topology changes  [A11] ────────────────────────────────────────────────
    # "collapse"  : remove node, rewire its in-edges directly to its successor
    # "add_edge"  : inject a new transition (creates feedback/skip loops)
    # "boost_exit": increase probability of early exit (disqualify faster)
    GONG_TOPOLOGY: list = field(default_factory=lambda: [
        {
            "type"   : "collapse",
            "node"   : "call_debrief_logging",
            "reason" : "Gong auto-debrief runs during call; no separate logging step needed"
        },
        {
            "type"        : "add_edge",
            "from"        : "response_triage",
            "to"          : "END",
            "probability" : 0.38,   # AI disqualifies faster → higher early exit rate
            "reason"      : "AI triage catches unqualified leads earlier, raising early-exit probability"
        },
        {
            "type"        : "add_edge",
            "from"        : "objection_handling",
            "to"          : "discovery_call_prep",
            "probability" : 0.12,   # Gong coaching loop sends reps back to re-prep
            "reason"      : "Gong call review surfaces gaps → rep books second discovery"
        },
        {
            "type"   : "boost_exit",
            "node"   : "response_triage",
            "delta"  : 0.08,
            "reason" : "AI signal quality improvement raises P(disqualify) at triage"
        }
    ])

    # ── Tool identity ──────────────────────────────────────────────────────────
    tool_name: str = "Gong"         # overridden when --tool_features is supplied

    # ── Paths ──────────────────────────────────────────────────────────────────
    telemetry_path:   str = "backend/data/transition_matrix.json"
    output_path:      str = "backend/data/monte_carlo_results.json"
    max_path_length:  int = 60      # hard cap to prevent infinite loops in simulation


# ═══════════════════════════════════════════════════════════════════════════════
# 1. LOAD TRANSITION MATRIX
# ═══════════════════════════════════════════════════════════════════════════════

def load_tool_features(path: str, cfg: "SimConfig") -> None:
    """
    Load tool_features_{slug}.json produced by classifier.py and patch cfg
    in-place with the extracted node_impact, edge_impact, and topology_changes.

    Replaces the hardcoded GONG_* values so sim.py works for any tool.
    """
    with open(path) as f:
        feat = json.load(f)

    cfg.tool_name = feat.get("tool_name", path)

    if "node_impact" in feat:
        cfg.GONG_NODE_IMPACT = {
            nid: float(v) for nid, v in feat["node_impact"].items()
        }

    if "edge_impact" in feat:
        # classifier stores "src,dst" string keys; SimConfig uses (src, dst) tuples
        cfg.GONG_EDGE_IMPACT = {
            tuple(k.split(",", 1)): float(v)
            for k, v in feat["edge_impact"].items()
        }

    if "topology_changes" in feat:
        cfg.GONG_TOPOLOGY = feat["topology_changes"]

    print(f"  Loaded tool features: {cfg.tool_name}  ({path})")
    print(f"    node_impact entries  : {len(cfg.GONG_NODE_IMPACT)}")
    print(f"    edge_impact entries  : {len(cfg.GONG_EDGE_IMPACT)}")
    print(f"    topology changes     : {len(cfg.GONG_TOPOLOGY)}")


def load_matrix(path: str) -> dict:
    with open(path) as f:
        return json.load(f)

def build_duration_samplers(node_durations: dict) -> dict:
    """
    Fit lognormal params to observed duration_min samples.
    Fallback to (mean=30, sigma=0.4) if node has no observations.  [A2]
    Returns: node_id → callable() that returns a sampled duration in minutes
    """
    samplers = {}
    for node_id, samples in node_durations.items():
        if len(samples) < 2:
            samplers[node_id] = lambda: np.random.lognormal(math.log(30), 0.4)
            continue
        arr = np.array(samples, dtype=float)
        mu    = np.log(arr.mean())
        sigma = max(0.05, arr.std() / arr.mean())   # CV as proxy for log-sigma
        samplers[node_id] = (lambda m=mu, s=sigma: np.random.lognormal(m, s))
    return samplers

def build_dwell_samplers(transition_dwell: dict) -> dict:
    """
    Fit lognormal params to observed transition dwell samples (seconds).  [A3]
    Returns: "src,dst" → callable() that returns sampled dwell in hours
    """
    samplers = {}
    for edge_key, samples in transition_dwell.items():
        if len(samples) < 2:
            samplers[edge_key] = lambda: np.random.lognormal(math.log(3600), 0.6) / 3600
            continue
        arr = np.array(samples, dtype=float)
        arr = arr[arr > 0]    # drop zero-dwell entries
        if len(arr) < 2:
            samplers[edge_key] = lambda: 1.0
            continue
        mu    = np.log(np.median(arr))
        sigma = max(0.1, arr.std() / (arr.mean() + 1e-9))
        samplers[edge_key] = (lambda m=mu, s=sigma: np.random.lognormal(m, s) / 3600)
    return samplers


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ADOPTION & LEARNING CURVES
# ═══════════════════════════════════════════════════════════════════════════════

def adoption_curve(week: float, cfg: SimConfig) -> float:
    """
    Logistic S-curve: fraction of adopters who are actively using Gong by `week`.
    Shape: slow start → inflection at adoption_midpoint → plateau at adoption_rate.  [A5]
    """
    logistic = 1.0 / (1.0 + math.exp(-cfg.adoption_steepness * (week - cfg.adoption_midpoint)))
    return cfg.adoption_rate * logistic

def learning_curve(week: float, cfg: SimConfig) -> float:
    """
    Exponential saturation: per-rep skill level at week t.
    Approaches 1.0 asymptotically.  [A6]
    """
    return 1.0 - math.exp(-cfg.learning_rate * max(0.0, week))

def effective_reduction(base_reduction: float, week: float, cfg: SimConfig) -> float:
    """
    Actual reduction experienced = max_reduction × adoption × skill.  [A7]
    """
    return base_reduction * adoption_curve(week, cfg) * learning_curve(week, cfg)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GRAPH BUILDER — Baseline and Gong-modified
# ═══════════════════════════════════════════════════════════════════════════════

def build_transition_graph(matrix_data: dict) -> dict:
    """
    Returns adjacency dict: { state: [(next_state, probability), ...] }
    """
    states   = matrix_data["metadata"]["states"]
    P        = np.array(matrix_data["probability_matrix"])
    state_idx = matrix_data["metadata"]["state_index"]

    graph = defaultdict(list)
    for i, src in enumerate(states):
        row_sum = P[i].sum()
        if row_sum == 0:
            continue
        for j, dst in enumerate(states):
            if P[i][j] > 0:
                graph[src].append((dst, float(P[i][j])))
    return dict(graph)

def apply_gong_topology(graph: dict, cfg: SimConfig) -> dict:
    """
    Structurally modifies graph according to GONG_TOPOLOGY rules.
    Returns a new modified graph (does not mutate original).  [A11]
    """
    import copy
    g = copy.deepcopy(graph)

    for change in cfg.GONG_TOPOLOGY:

        if change["type"] == "collapse":
            node = change["node"]
            if node not in g:
                continue
            successors = g.pop(node)   # outgoing edges from collapsed node
            # rewire: any edge pointing TO node now points to node's successors
            for src, edges in g.items():
                new_edges = []
                for (dst, prob) in edges:
                    if dst == node:
                        # distribute this probability to node's successors
                        for (succ, succ_prob) in successors:
                            new_edges.append((succ, prob * succ_prob))
                    else:
                        new_edges.append((dst, prob))
                # re-normalise row
                total = sum(p for _, p in new_edges)
                if total > 0:
                    g[src] = [(d, p / total) for d, p in new_edges]

        elif change["type"] == "add_edge":
            src  = change["from"]
            dst  = change["to"]
            prob = change["probability"]
            if src not in g:
                g[src] = []
            # scale down existing edges to make room
            existing = g[src]
            scale = 1.0 - prob
            g[src] = [(d, p * scale) for d, p in existing] + [(dst, prob)]

        elif change["type"] == "boost_exit":
            node  = change["node"]
            delta = change["delta"]
            if node not in g:
                continue
            edges = g[node]
            # find existing END edge and boost it; scale others down
            has_end = any(d == "END" for d, _ in edges)
            if has_end:
                g[node] = [
                    (d, p + delta if d == "END" else p * (1 - delta / (1 - sum(p2 for d2, p2 in edges if d2 == "END") + 1e-9)))
                    for d, p in edges
                ]
            else:
                scale = 1.0 - delta
                g[node] = [(d, p * scale) for d, p in edges] + [("END", delta)]
            # re-normalise
            total = sum(p for _, p in g[node])
            if total > 0:
                g[node] = [(d, p / total) for d, p in g[node]]

    return g


# ═══════════════════════════════════════════════════════════════════════════════
# 4. SINGLE DEAL SIMULATION
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DealResult:
    path:               list            # sequence of visited nodes
    outcome:            str             # "won" | "lost" | "disqualified" | ...
    active_work_min:    float = 0.0     # total rep time actively working  (minutes)
    elapsed_hours:      float = 0.0     # total calendar time incl. async waits (hours)
    node_time_breakdown: dict = field(default_factory=dict)   # node → minutes spent
    steps:              int   = 0

def sample_path(graph: dict, cfg: SimConfig) -> list:
    """Walk the Markov chain until END or max_path_length."""
    state = "prospect_research"
    path  = [state]
    for _ in range(cfg.max_path_length):
        if state not in graph or state == "END":
            break
        nexts = graph[state]
        if not nexts:
            break
        states, probs = zip(*nexts)
        probs = np.array(probs)
        probs /= probs.sum()   # re-normalise guard
        state = np.random.choice(states, p=probs)
        path.append(state)
    return path

def classify_outcome(path: list) -> str:
    if "deal_closure_and_handoff" in path:
        return "won"
    if path[-2] == "response_triage" if len(path) > 1 else False:
        return "disqualified"
    return "lost"

def simulate_deal(
    graph: dict,
    duration_samplers: dict,
    dwell_samplers: dict,
    cfg: SimConfig,
    week: float,
    variant: str,          # "baseline" | "gong"
) -> DealResult:

    path   = sample_path(graph, cfg)
    result = DealResult(path=path, outcome=classify_outcome(path))
    result.steps = len(path)
    breakdown = {}

    for i, node in enumerate(path):
        if node == "END":
            break

        # ── Node active work time ──────────────────────────────────────────────
        sampler = duration_samplers.get(node)
        raw_dur = sampler() if sampler else np.random.lognormal(math.log(20), 0.4)
        raw_dur = max(1.0, raw_dur)

        if variant == "gong":
            base_reduction = cfg.GONG_NODE_IMPACT.get(node, 0.0)
            reduction      = effective_reduction(base_reduction, week, cfg)
            dur            = raw_dur * (1.0 - reduction)
        else:
            dur = raw_dur

        result.active_work_min += dur
        breakdown[node] = breakdown.get(node, 0.0) + dur

        # ── Edge async wait (dwell) ────────────────────────────────────────────
        if i < len(path) - 1:
            next_node = path[i + 1]
            if next_node == "END":
                continue
            edge_key = f"{node},{next_node}"
            dwell_sampler = dwell_samplers.get(edge_key)
            raw_dwell = dwell_sampler() if dwell_sampler else np.random.lognormal(math.log(2), 0.8)
            raw_dwell = max(0.0, raw_dwell)

            if variant == "gong":
                edge_tuple  = (node, next_node)
                edge_redpct = cfg.GONG_EDGE_IMPACT.get(edge_tuple, 0.0)
                edge_red    = effective_reduction(edge_redpct, week, cfg)
                dwell       = raw_dwell * (1.0 - edge_red)
            else:
                dwell = raw_dwell

            result.elapsed_hours += dwell

    # Active work converted to hours, added to elapsed
    result.elapsed_hours += result.active_work_min / 60.0
    result.node_time_breakdown = breakdown
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 5. MONTE CARLO RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class WeekSnapshot:
    week:                    int
    adoption_pct:            float
    learning_pct:            float
    effective_reduction_avg: float    # mean across all nodes

    baseline_latency_hrs:    float
    gong_latency_hrs:        float
    latency_delta_hrs:       float
    latency_delta_pct:       float

    baseline_work_min:       float
    gong_work_min:           float
    work_saved_min:          float
    work_saved_pct:          float

    baseline_throughput:     float   # deals completable per rep per week
    gong_throughput:         float
    throughput_lift_pct:     float

    win_rate_baseline:       float
    win_rate_gong:           float

    pipeline_velocity_base:  float   # throughput × win_rate
    pipeline_velocity_gong:  float

    # Confidence intervals (5th–95th percentile)
    ci_latency_gong:         tuple
    ci_work_saved:           tuple
    ci_throughput_gong:      tuple

    # Per-node time breakdown delta
    node_savings_min:        dict


def run_weekly_snapshot(
    week: int,
    graph_base: dict,
    graph_gong: dict,
    duration_samplers: dict,
    dwell_samplers: dict,
    cfg: SimConfig,
) -> WeekSnapshot:

    base_results = []

    # TODO: Uncomment to no recompute basline, need to also change bottom code from list to element
    # baseline_results = [
    #     simulate_deal(graph_base, duration_samplers, dwell_samplers, cfg, week=0, variant="baseline")
    #     for _ in range(cfg.n_simulations)
    # ]

    gong_results = []

    for _ in range(cfg.n_simulations):
        base_results.append(simulate_deal(graph_base, duration_samplers, dwell_samplers, cfg, week=0, variant="baseline"))
        gong_results.append(simulate_deal(graph_gong, duration_samplers, dwell_samplers, cfg, week=week, variant="gong"))

    def metric(results, attr):
        return np.array([getattr(r, attr) for r in results])

    base_lat   = metric(base_results, "elapsed_hours")
    gong_lat   = metric(gong_results, "elapsed_hours")
    base_work  = metric(base_results, "active_work_min")
    gong_work  = metric(gong_results, "active_work_min")

    # Throughput: a rep has (working_hours_week * pipeline_depth) capacity
    # Each deal consumes active_work_min minutes of rep time
    capacity_min = cfg.working_hours_day * cfg.working_days_week * 60.0

    def throughput(work_arr):
        # deals completable = capacity / mean_work_per_deal
        # clipped to pipeline_depth (can't run more deals than pipeline)
        mean_w = work_arr.mean()
        return min(cfg.pipeline_depth, capacity_min / mean_w if mean_w > 0 else 0)

    base_tp = throughput(base_work)
    gong_tp = throughput(gong_work)

    win_rate = lambda results: sum(1 for r in results if r.outcome == "won") / len(results)
    wr_base  = win_rate(base_results)
    wr_gong  = win_rate(gong_results)

    # Per-node savings
    node_ids = list(cfg.GONG_NODE_IMPACT.keys())
    node_savings = {}
    for node in node_ids:
        base_node = np.mean([r.node_time_breakdown.get(node, 0.0) for r in base_results])
        gong_node = np.mean([r.node_time_breakdown.get(node, 0.0) for r in gong_results])
        node_savings[node] = round(base_node - gong_node, 2)

    # Average effective reduction across all impacted nodes at this week
    avg_eff_red = np.mean([
        effective_reduction(v, week, cfg)
        for v in cfg.GONG_NODE_IMPACT.values() if v > 0
    ])

    work_saved = base_work - gong_work

    return WeekSnapshot(
        week                    = week,
        adoption_pct            = round(adoption_curve(week, cfg) * 100, 1),
        learning_pct            = round(learning_curve(week, cfg) * 100, 1),
        effective_reduction_avg = round(avg_eff_red * 100, 1),

        baseline_latency_hrs    = round(float(base_lat.mean()), 2),
        gong_latency_hrs        = round(float(gong_lat.mean()), 2),
        latency_delta_hrs       = round(float((base_lat - gong_lat).mean()), 2),
        latency_delta_pct       = round(float(((base_lat - gong_lat) / (base_lat + 1e-9)).mean() * 100), 1),

        baseline_work_min       = round(float(base_work.mean()), 2),
        gong_work_min           = round(float(gong_work.mean()), 2),
        work_saved_min          = round(float(work_saved.mean()), 2),
        work_saved_pct          = round(float((work_saved / (base_work + 1e-9)).mean() * 100), 1),

        baseline_throughput     = round(base_tp, 2),
        gong_throughput         = round(gong_tp, 2),
        throughput_lift_pct     = round(((gong_tp - base_tp) / (base_tp + 1e-9)) * 100, 1),

        win_rate_baseline       = round(wr_base * 100, 1),
        win_rate_gong           = round(wr_gong * 100, 1),

        pipeline_velocity_base  = round(base_tp * wr_base, 3),
        pipeline_velocity_gong  = round(gong_tp * wr_gong, 3),

        ci_latency_gong         = (round(float(np.percentile(gong_lat, 5)), 2),
                                   round(float(np.percentile(gong_lat, 95)), 2)),
        ci_work_saved           = (round(float(np.percentile(work_saved, 5)), 2),
                                   round(float(np.percentile(work_saved, 95)), 2)),
        ci_throughput_gong      = (round(float(np.percentile(capacity_min / (gong_work + 1e-9), 5)), 2),
                                   round(float(np.percentile(capacity_min / (gong_work + 1e-9), 95)), 2)),

        node_savings_min        = node_savings,
    )


def run_simulation(cfg: SimConfig) -> dict:
    print("\n" + "═"*60)
    print(f"  MONTE CARLO SIMULATION — {cfg.tool_name} vs Baseline")
    print("═"*60)
    print(f"  n_simulations  : {cfg.n_simulations}")
    print(f"  n_weeks        : {cfg.n_weeks}")
    print(f"  adoption_rate  : {cfg.adoption_rate*100:.0f}%")
    print(f"  learning_rate  : {cfg.learning_rate}  (λ in exp saturation)")
    print(f"  pipeline_depth : {cfg.pipeline_depth} deals/rep")
    print(f"  working_week   : {cfg.working_hours_day*cfg.working_days_week:.0f}h")
    print("─"*60)

    # Load data
    matrix_data = load_matrix(cfg.telemetry_path)

    node_durations   = matrix_data.get("node_durations", {})
    transition_dwell = matrix_data.get("transition_dwell", {})

    # Convert "src,dst" string keys back to tuple-keyed dict for dwell
    dwell_by_str = {k: v for k, v in transition_dwell.items()}

    duration_samplers = build_duration_samplers(node_durations)
    dwell_samplers    = build_dwell_samplers(dwell_by_str)

    # Build graphs
    graph_base = build_transition_graph(matrix_data)
    graph_gong = apply_gong_topology(graph_base, cfg)

    print(f"  Baseline graph edges : {sum(len(v) for v in graph_base.values())}")
    print(f"  {cfg.tool_name} graph edges  : {sum(len(v) for v in graph_gong.values())}")
    print("─"*60)

    # Run week-by-week
    snapshots = []
    for week in range(0, cfg.n_weeks + 1):
        snap = run_weekly_snapshot(week, graph_base, graph_gong, duration_samplers, dwell_samplers, cfg)
        snapshots.append(snap)
        if week % 2 == 0:
            print(
                f"  Week {week:02d} | adopt={snap.adoption_pct:5.1f}% | "
                f"skill={snap.learning_pct:5.1f}% | "
                f"work_saved={snap.work_saved_min:6.1f}min | "
                f"latency↓={snap.latency_delta_pct:5.1f}% | "
                f"throughput↑={snap.throughput_lift_pct:5.1f}%"
            )

    # ── Summary stats ──────────────────────────────────────────────────────────
    final = snapshots[-1]
    print("\n" + "═"*60)
    print(f"  RESULTS AT WEEK {cfg.n_weeks}")
    print("═"*60)
    print(f"  Adoption coverage      : {final.adoption_pct}%")
    print(f"  Rep skill level        : {final.learning_pct}%")
    print(f"  Effective reduction    : {final.effective_reduction_avg}% avg across nodes")
    print(f"\n  ── Latency (calendar time per deal) ─────────────")
    print(f"  Baseline               : {final.baseline_latency_hrs:.1f} hrs")
    print(f"  With {cfg.tool_name:<18s}: {final.gong_latency_hrs:.1f} hrs  (↓{final.latency_delta_pct}%)")
    print(f"  90% CI                 : [{final.ci_latency_gong[0]}, {final.ci_latency_gong[1]}] hrs")
    print(f"\n  ── Active Work Per Deal ─────────────────────────")
    print(f"  Baseline               : {final.baseline_work_min:.1f} min")
    print(f"  With {cfg.tool_name:<18s}: {final.gong_work_min:.1f} min")
    print(f"  Saved per deal         : {final.work_saved_min:.1f} min  (↓{final.work_saved_pct}%)")
    print(f"  90% CI                 : [{final.ci_work_saved[0]}, {final.ci_work_saved[1]}] min")
    print(f"\n  ── Throughput ───────────────────────────────────")
    print(f"  Baseline               : {final.baseline_throughput:.2f} deals/rep/week")
    print(f"  With {cfg.tool_name:<18s}: {final.gong_throughput:.2f} deals/rep/week  (↑{final.throughput_lift_pct}%)")
    print(f"\n  ── Pipeline Velocity (throughput × win rate) ────")
    print(f"  Baseline               : {final.pipeline_velocity_base:.3f}")
    print(f"  With {cfg.tool_name:<18s}: {final.pipeline_velocity_gong:.3f}")
    print(f"  Win rate  baseline     : {final.win_rate_baseline}%")
    print(f"  Win rate  with {cfg.tool_name:<12s}: {final.win_rate_gong}%")
    print(f"\n  ── Top Node Savings (min/deal at week {cfg.n_weeks}) ───")
    sorted_savings = sorted(final.node_savings_min.items(), key=lambda x: -x[1])
    for node, saved in sorted_savings[:8]:
        bar = "█" * int(saved / 2)
        print(f"  {node[:35]:35s}  {saved:6.1f} min  {bar}")
    print("═"*60)

    # ── Package output ─────────────────────────────────────────────────────────
    output = {
        "config": {
            "n_simulations"     : cfg.n_simulations,
            "n_weeks"           : cfg.n_weeks,
            "adoption_rate"     : cfg.adoption_rate,
            "learning_rate"     : cfg.learning_rate,
            "adoption_midpoint" : cfg.adoption_midpoint,
            "pipeline_depth"    : cfg.pipeline_depth,
            "working_hrs_week"  : cfg.working_hours_day * cfg.working_days_week,
        },
        "assumptions": [
            "A1: Markov transitions are memoryless",
            "A2: Node durations sampled from lognormal fit to observed data",
            "A3: Edge dwell sampled from lognormal fit; includes async calendar time",
            "A4: Gong impact percentages from published benchmarks + Mission Andromeda research",
            "A5: Adoption follows logistic S-curve over weeks",
            "A6: Per-rep skill follows exponential saturation: 1 - exp(-λt)",
            "A7: Effective reduction = max_reduction × adoption(t) × skill(t)",
            "A8: 8h/day, 5 days/week working schedule",
            "A9: 20 concurrent deals per rep",
            "A10: Deals are independent — no resource contention",
            "A11: Topology changes applied structurally before sampling",
            "A12: Win-rate emergent from transition probabilities, not fixed",
        ],
        "tool_name":        cfg.tool_name,
        "topology_changes": cfg.GONG_TOPOLOGY,
        "tool_node_impact": cfg.GONG_NODE_IMPACT,
        "tool_edge_impact": {f"{k[0]},{k[1]}": v for k, v in cfg.GONG_EDGE_IMPACT.items()},
        "weekly_snapshots": [asdict(s) for s in snapshots],
        "summary": {
            "week_0":  asdict(snapshots[0]),
            "week_final": asdict(final),
            "peak_work_saved_min": max(s.work_saved_min for s in snapshots),
            "peak_throughput_lift_pct": max(s.throughput_lift_pct for s in snapshots),
            "peak_latency_reduction_pct": max(s.latency_delta_pct for s in snapshots),
        }
    }

    with open(cfg.output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n  Saved → {cfg.output_path}\n")

    return output


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monte Carlo sales pipeline simulation")

    parser.add_argument("--adoption_rate",  type=float, default=0.75,
        help="Fraction of reps who ever fully adopt Gong [0-1] (default: 0.75)")
    parser.add_argument("--learning_rate",  type=float, default=0.30,
        help="Exponential saturation rate per week [0.1=slow, 0.7=fast] (default: 0.30)")
    parser.add_argument("--n_simulations",  type=int,   default=2000,
        help="Monte Carlo draws per week (default: 2000)")
    parser.add_argument("--n_weeks",        type=int,   default=12,
        help="Simulation horizon in weeks (default: 12)")
    parser.add_argument("--pipeline_depth", type=int,   default=20,
        help="Concurrent deals per rep (default: 20)")
    parser.add_argument("--adoption_midpoint", type=float, default=3.0,
        help="Week at which 50%% of adopters are on Gong (default: 3.0)")
    parser.add_argument("--telemetry_path", type=str, default="backend/data/transition_matrix.json")
    parser.add_argument("--output_path",    type=str, default="backend/data/monte_carlo_results.json")
    parser.add_argument("--tool_features",  type=str, default="",
        help="Path to tool_features_{slug}.json from classifier.py. "
             "Overrides the built-in Gong impact parameters with the specified tool's values.")

    args = parser.parse_args()

    cfg = SimConfig(
        adoption_rate     = args.adoption_rate,
        learning_rate     = args.learning_rate,
        n_simulations     = args.n_simulations,
        n_weeks           = args.n_weeks,
        pipeline_depth    = args.pipeline_depth,
        adoption_midpoint = args.adoption_midpoint,
        telemetry_path    = args.telemetry_path,
        output_path       = args.output_path,
    )

    if args.tool_features:
        load_tool_features(args.tool_features, cfg)

    run_simulation(cfg)
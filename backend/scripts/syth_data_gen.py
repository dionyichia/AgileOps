import argparse
import json
import random
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import uuid

random.seed(42)
np.random.seed(42)

# ── Hardcoded fallback node definitions (used when no --tasks_path provided) ───
_DEFAULT_NODES = {
    "prospect_research":       {"mean": 35, "std": 12, "dist": "lognormal", "apps": ["linkedin", "salesforce"], "automatable": "high"},
    "draft_outreach":          {"mean": 24, "std": 9,  "dist": "lognormal", "apps": ["gmail", "notion"], "automatable": "high"},
    "send_and_log":            {"mean": 8,  "std": 3,  "dist": "lognormal", "apps": ["gmail", "salesforce"], "automatable": "medium"},
    "follow_up_sequence":      {"mean": 18, "std": 7,  "dist": "lognormal", "apps": ["outreach", "gmail", "salesforce"], "automatable": "high"},
    "response_triage":         {"mean": 14, "std": 6,  "dist": "lognormal", "apps": ["gmail", "salesforce", "slack"], "automatable": "medium"},
    "discovery_call_prep":     {"mean": 42, "std": 15, "dist": "lognormal", "apps": ["salesforce", "notion", "linkedin", "google"], "automatable": "high"},
    "discovery_call_execution":{"mean": 38, "std": 10, "dist": "normal",    "apps": ["zoom", "gong", "calendly"], "automatable": "low"},
    "call_debrief_logging":    {"mean": 22, "std": 8,  "dist": "lognormal", "apps": ["gong", "salesforce", "notion"], "automatable": "high"},
    "stakeholder_mapping":     {"mean": 30, "std": 11, "dist": "lognormal", "apps": ["linkedin", "salesforce", "notion"], "automatable": "medium"},
    "demo_scheduling_and_prep":{"mean": 50, "std": 18, "dist": "lognormal", "apps": ["calendly", "zoom", "notion", "salesforce"], "automatable": "medium"},
    "demo_delivery":           {"mean": 52, "std": 12, "dist": "normal",    "apps": ["zoom", "gong", "notion"], "automatable": "low"},
    "objection_handling":      {"mean": 35, "std": 14, "dist": "lognormal", "apps": ["gmail", "notion", "salesforce", "slack"], "automatable": "medium"},
    "proposal_drafting":       {"mean": 65, "std": 22, "dist": "lognormal", "apps": ["google_docs", "salesforce", "notion", "gmail"], "automatable": "high"},
    "contract_negotiation":    {"mean": 90, "std": 45, "dist": "lognormal", "apps": ["docusign", "gmail", "google_docs", "salesforce"], "automatable": "low"},
    "deal_closure_and_handoff":{"mean": 28, "std": 10, "dist": "lognormal", "apps": ["salesforce", "notion", "slack", "docusign"], "automatable": "medium"},
}

_DEFAULT_DEAL_PATHS = {
    "won": [
        "prospect_research", "draft_outreach", "send_and_log", "follow_up_sequence",
        "response_triage", "discovery_call_prep", "discovery_call_execution",
        "call_debrief_logging", "stakeholder_mapping", "demo_scheduling_and_prep",
        "demo_delivery", "objection_handling", "proposal_drafting",
        "contract_negotiation", "deal_closure_and_handoff"
    ],
    "lost_early": [
        "prospect_research", "draft_outreach", "send_and_log", "follow_up_sequence",
        "response_triage"
    ],
    "lost_post_discovery": [
        "prospect_research", "draft_outreach", "send_and_log", "follow_up_sequence",
        "response_triage", "discovery_call_prep", "discovery_call_execution",
        "call_debrief_logging", "stakeholder_mapping"
    ],
    "lost_post_demo": [
        "prospect_research", "draft_outreach", "send_and_log", "follow_up_sequence",
        "response_triage", "discovery_call_prep", "discovery_call_execution",
        "call_debrief_logging", "stakeholder_mapping", "demo_scheduling_and_prep",
        "demo_delivery", "objection_handling"
    ],
    "ghosted_after_proposal": [
        "prospect_research", "draft_outreach", "send_and_log", "follow_up_sequence",
        "response_triage", "discovery_call_prep", "discovery_call_execution",
        "call_debrief_logging", "stakeholder_mapping", "demo_scheduling_and_prep",
        "demo_delivery", "objection_handling", "proposal_drafting"
    ],
}

# Interruption nodes (non-pipeline but realistic noise)
INTERRUPTION_NODES = {
    "team_standup":       {"mean": 20, "std": 5,  "apps": ["zoom", "slack"]},
    "admin_crm_cleanup":  {"mean": 18, "std": 6,  "apps": ["salesforce"]},
    "internal_meeting":   {"mean": 40, "std": 12, "apps": ["zoom", "slack", "notion"]},
    "manager_1on1":       {"mean": 30, "std": 8,  "apps": ["zoom", "notion"]},
    "pipeline_review":    {"mean": 35, "std": 10, "apps": ["salesforce", "zoom", "notion"]},
}

EMPLOYEES = [
    {"id": "emp_001", "role": "sdr",           "name": "Jordan Mills",    "tenure_months": 4,  "performance": "average"},
    {"id": "emp_002", "role": "sdr",           "name": "Casey Rivera",   "tenure_months": 11, "performance": "high"},
    {"id": "emp_003", "role": "sales_intern",  "name": "Alex Chen",      "tenure_months": 2,  "performance": "average"},
    {"id": "emp_004", "role": "sdr",           "name": "Morgan Patel",   "tenure_months": 7,  "performance": "low"},
    {"id": "emp_005", "role": "junior_ae",     "name": "Taylor Brooks",  "tenure_months": 14, "performance": "high"},
    {"id": "emp_006", "role": "sales_intern",  "name": "Sam Nguyen",     "tenure_months": 3,  "performance": "average"},
]

DEAL_ASSIGNMENTS = [
    ("emp_001", "won"),
    ("emp_001", "lost_post_discovery"),
    ("emp_001", "lost_early"),
    ("emp_001", "lost_post_demo"),
    ("emp_002", "won"),
    ("emp_002", "won"),
    ("emp_002", "ghosted_after_proposal"),
    ("emp_002", "lost_early"),
    ("emp_003", "lost_early"),
    ("emp_003", "lost_early"),
    ("emp_003", "lost_post_discovery"),
    ("emp_004", "lost_post_discovery"),
    ("emp_004", "lost_post_demo"),
    ("emp_004", "lost_early"),
    ("emp_005", "won"),
    ("emp_005", "ghosted_after_proposal"),
    ("emp_005", "lost_post_demo"),
    ("emp_005", "won"),
    ("emp_006", "lost_early"),
    ("emp_006", "lost_post_discovery"),
]

PERF_MODIFIER = {"high": 0.80, "average": 1.00, "low": 1.25}


# ── Dynamic node loading ───────────────────────────────────────────────────────

def load_nodes_from_tasks(tasks_path: str) -> tuple[dict, dict]:
    """
    Build NODES and DEAL_PATHS from a project's all_tasks.json.

    Node order in the file is used as pipeline order — earlier entries become
    earlier stages. Deal paths are derived by taking truncated prefixes of the
    full node sequence to model early/late exits.
    """
    with open(tasks_path, encoding="utf-8") as f:
        tasks = json.load(f)

    if not tasks:
        raise ValueError(f"all_tasks.json at {tasks_path} is empty — submit a transcript first")

    nodes = {}
    for task in tasks:
        nid = task["node_id"]
        dur = task.get("duration_distribution", {})
        nodes[nid] = {
            "mean": dur.get("mean_minutes", 20),
            "std":  dur.get("std_minutes", 5),
            "dist": dur.get("type", "lognormal"),
            "apps": task.get("app_cluster", []),
            "automatable": task.get("automatable_fraction", "medium"),
        }

    node_ids = [t["node_id"] for t in tasks]
    n = len(node_ids)

    # Truncated paths model deals that exit at different pipeline stages
    deal_paths = {
        "won":                  node_ids,
        "lost_early":           node_ids[:max(2, n // 4)],
        "lost_post_discovery":  node_ids[:max(3, n // 2)],
        "lost_post_demo":       node_ids[:max(4, int(n * 0.75))],
        "ghosted_after_proposal": node_ids[:max(5, int(n * 0.90))],
    }

    return nodes, deal_paths


# ── Simulation helpers ─────────────────────────────────────────────────────────

def sample_duration(node_name, nodes, performance="average"):
    cfg = nodes.get(node_name) or INTERRUPTION_NODES.get(node_name, {"mean": 20, "std": 5})
    mean, std = cfg["mean"], cfg["std"]
    mod = PERF_MODIFIER.get(performance, 1.0)
    dist = cfg.get("dist", "lognormal")
    if dist == "normal":
        dur = np.random.normal(mean * mod, std)
    else:
        mu = np.log(mean * mod)
        sigma = std / mean
        dur = np.random.lognormal(mu, sigma)
    return max(3, round(dur, 1))


def pick_apps(node_name, nodes):
    cfg = nodes.get(node_name) or INTERRUPTION_NODES.get(node_name, {"apps": ["slack"]})
    apps = cfg["apps"][:]
    if len(apps) > 1 and random.random() < 0.2:
        apps = random.sample(apps, len(apps) - 1)
    return apps


def next_business_ts(current_ts, duration_min, lunch_break=True):
    ts = current_ts + timedelta(minutes=duration_min)
    ts += timedelta(minutes=random.uniform(0, 8))
    if lunch_break and ts.hour == 12:
        ts = ts.replace(hour=13, minute=random.randint(0, 15))
    if ts.hour >= 17 and ts.minute >= 30:
        ts = ts + timedelta(days=1)
        ts = ts.replace(hour=8, minute=random.randint(30, 59))
    return ts


def maybe_insert_interruption(ts, day_event_count):
    interruptions = []
    if ts.hour == 9 and ts.minute < 35 and day_event_count == 0:
        dur = float(np.random.normal(20, 5))
        interruptions.append({
            "node_id": "team_standup",
            "duration_min": max(3, round(dur, 1)),
            "apps_used": ["zoom", "slack"],
            "is_pipeline_node": False,
        })
    if 13 <= ts.hour <= 15 and random.random() < 0.20:
        node = random.choice(["internal_meeting", "manager_1on1", "pipeline_review"])
        cfg = INTERRUPTION_NODES[node]
        dur = float(np.random.normal(cfg["mean"], cfg["std"]))
        interruptions.append({
            "node_id": node,
            "duration_min": max(3, round(dur, 1)),
            "apps_used": cfg["apps"][:],
            "is_pipeline_node": False,
        })
    return interruptions


def _is_async_waiting_node(node_id: str, path: list) -> bool:
    """
    True for nodes where reps typically wait days for a response (outreach,
    proposal, negotiation). Applied to nodes in the early ~25% or late ~85%+
    of the path, or if the node name suggests async waiting.
    """
    idx = path.index(node_id) if node_id in path else -1
    n = len(path)
    relative_pos = idx / n if n > 0 else 0
    async_keywords = ("outreach", "follow", "send", "proposal", "contract", "negotiation")
    name_suggests_async = any(kw in node_id.lower() for kw in async_keywords)
    return name_suggests_async or relative_pos <= 0.25 or relative_pos >= 0.85


def generate_deal_events(emp, deal_id, path_type, start_ts, nodes, deal_paths):
    path = deal_paths[path_type]
    events = []
    ts = start_ts
    day_event_count = 0
    prev_ts_day = ts.date()

    for node_id in path:
        if ts.date() != prev_ts_day:
            day_event_count = 0
            prev_ts_day = ts.date()

        interrupts = maybe_insert_interruption(ts, day_event_count)
        for intr in interrupts:
            dur = intr["duration_min"]
            events.append({
                "event_id": str(uuid.uuid4())[:8],
                "timestamp": ts.strftime("%Y-%m-%d %H:%M"),
                "employee_id": emp["id"],
                "role": emp["role"],
                "deal_id": deal_id,
                "node_id": intr["node_id"],
                "duration_min": dur,
                "apps_used": intr["apps_used"],
                "is_pipeline_node": False,
                "outcome": "completed",
                "next_node": node_id,
            })
            ts = next_business_ts(ts, dur)
            day_event_count += 1

        dur = sample_duration(node_id, nodes, emp["performance"])

        is_last = (node_id == path[-1])
        if is_last and path_type == "won":
            outcome = "closed_won"
            next_node = None
        elif is_last:
            outcome = "disqualified" if "early" in path_type else (
                "no_response" if "ghosted" in path_type else "lost"
            )
            next_node = None
        else:
            idx = path.index(node_id)
            next_node = path[idx + 1]
            outcome = "completed"

        # Rare retry on nodes that plausibly get re-done
        repeat = False
        idx_in_path = path.index(node_id) if node_id in path else -1
        n = len(path)
        is_mid_pipeline = 0.4 <= (idx_in_path / n) <= 0.7 if n > 0 else False
        if is_mid_pipeline and random.random() < 0.15:
            repeat = True

        events.append({
            "event_id": str(uuid.uuid4())[:8],
            "timestamp": ts.strftime("%Y-%m-%d %H:%M"),
            "employee_id": emp["id"],
            "role": emp["role"],
            "deal_id": deal_id,
            "node_id": node_id,
            "duration_min": dur,
            "apps_used": pick_apps(node_id, nodes),
            "is_pipeline_node": True,
            "outcome": outcome,
            "next_node": next_node,
            "repeated_node": repeat,
        })

        ts = next_business_ts(ts, dur)
        day_event_count += 1

        if repeat:
            dur2 = sample_duration(node_id, nodes, emp["performance"])
            events.append({
                "event_id": str(uuid.uuid4())[:8],
                "timestamp": ts.strftime("%Y-%m-%d %H:%M"),
                "employee_id": emp["id"],
                "role": emp["role"],
                "deal_id": deal_id,
                "node_id": node_id,
                "duration_min": dur2,
                "apps_used": pick_apps(node_id, nodes),
                "is_pipeline_node": True,
                "outcome": "retry",
                "next_node": next_node,
                "repeated_node": True,
            })
            ts = next_business_ts(ts, dur2)
            day_event_count += 1

        if _is_async_waiting_node(node_id, path):
            gap_days = random.randint(1, 4)
            ts += timedelta(days=gap_days)
            ts = ts.replace(hour=random.randint(8, 10), minute=random.randint(0, 59))
            day_event_count = 0

    return events


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic sales pipeline telemetry")
    parser.add_argument(
        "--output_dir",
        type=str,
        default="backend/data",
        help="Directory to write telemetry.json (default: backend/data)",
    )
    parser.add_argument(
        "--tasks_path",
        type=str,
        default=None,
        help="Path to all_tasks.json. When provided, node definitions and pipeline "
             "order are read from this file instead of the hardcoded defaults.",
    )
    args = parser.parse_args()

    # Choose node source
    if args.tasks_path and Path(args.tasks_path).exists():
        print(f"Loading nodes from {args.tasks_path}")
        nodes, deal_paths = load_nodes_from_tasks(args.tasks_path)
        print(f"  {len(nodes)} nodes loaded: {list(nodes.keys())}")
    else:
        if args.tasks_path:
            print(f"Warning: {args.tasks_path} not found — using hardcoded default nodes")
        nodes = _DEFAULT_NODES
        deal_paths = _DEFAULT_DEAL_PATHS

    emp_map = {e["id"]: e for e in EMPLOYEES}

    start_dates = [
        datetime(2024, 1, 8,  8, 45), datetime(2024, 1, 10, 9, 0),
        datetime(2024, 1, 15, 8, 30), datetime(2024, 1, 17, 9, 15),
        datetime(2024, 1, 22, 8, 55), datetime(2024, 1, 24, 9, 5),
        datetime(2024, 1, 29, 8, 40), datetime(2024, 2, 1,  9, 20),
        datetime(2024, 2, 5,  8, 50), datetime(2024, 2, 7,  9, 10),
        datetime(2024, 2, 12, 8, 35), datetime(2024, 2, 14, 9, 0),
        datetime(2024, 2, 19, 8, 45), datetime(2024, 2, 21, 9, 30),
        datetime(2024, 2, 26, 8, 30), datetime(2024, 2, 28, 9, 0),
        datetime(2024, 3, 4,  8, 55), datetime(2024, 3, 6,  9, 15),
        datetime(2024, 3, 11, 8, 40), datetime(2024, 3, 13, 9, 5),
    ]

    all_events = []
    for i, (emp_id, path_type) in enumerate(DEAL_ASSIGNMENTS):
        emp = emp_map[emp_id]
        deal_id = f"deal_{str(uuid.uuid4())[:6]}"
        start_ts = start_dates[i % len(start_dates)]
        events = generate_deal_events(emp, deal_id, path_type, start_ts, nodes, deal_paths)
        all_events.extend(events)

    all_events.sort(key=lambda e: (e["employee_id"], e["timestamp"]))

    output = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0.0",
            "description": (
                "Synthetic telemetry for B2B sales pipeline Markov chain modelling. "
                "Each event is one node visit. Use (employee_id, deal_id) to reconstruct "
                "sequences. next_node field encodes the observed transition."
            ),
            "schema": {
                "event_id":         "Unique event identifier (UUID prefix)",
                "timestamp":        "Wall-clock start time of the node visit (YYYY-MM-DD HH:MM)",
                "employee_id":      "Rep identifier",
                "role":             "sdr | junior_ae | sales_intern",
                "deal_id":          "Ties events to a single deal thread for sequence reconstruction",
                "node_id":          "Workflow node visited (matches node schema)",
                "duration_min":     "Actual time spent on node (minutes)",
                "apps_used":        "Tools open during this node",
                "is_pipeline_node": "False for interruptions like standups",
                "outcome":          "completed | closed_won | lost | disqualified | no_response | retry",
                "next_node":        "Observed successor node — key input for transition matrix",
                "repeated_node":    "True if this visit is a retry of the same node in the same deal",
            },
            "employees": EMPLOYEES,
            "total_events": len(all_events),
            "total_deals": len(DEAL_ASSIGNMENTS),
            "pipeline_nodes": list(nodes.keys()),
            "deal_outcome_counts": {
                path: sum(1 for _, p in DEAL_ASSIGNMENTS if p == path)
                for path in deal_paths
            },
        },
        "events": all_events,
    }

    out_path = Path(args.output_dir) / "telemetry.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Generated {len(all_events)} events across {len(DEAL_ASSIGNMENTS)} deals")
    print(f"Saved to {out_path}")

    from collections import Counter
    pipeline_events = [e for e in all_events if e["is_pipeline_node"] and e["next_node"]]
    transitions = [(e["node_id"], e["next_node"]) for e in pipeline_events]
    print("\nTop 15 transitions:")
    for (src, dst), count in Counter(transitions).most_common(15):
        print(f"  {src} -> {dst}: {count}")


if __name__ == "__main__":
    main()

import json
import random
import numpy as np
from datetime import datetime, timedelta
import uuid

random.seed(42)
np.random.seed(42)

# ── Node definitions with duration distributions and app clusters ──────────────
NODES = {
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

# Deal outcomes and paths
DEAL_PATHS = {
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

# Performance modifier: high performers are faster
PERF_MODIFIER = {"high": 0.80, "average": 1.00, "low": 1.25}

def sample_duration(node_name, performance="average"):
    cfg = NODES.get(node_name) or INTERRUPTION_NODES.get(node_name, {"mean": 20, "std": 5})
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

def pick_apps(node_name):
    cfg = NODES.get(node_name) or INTERRUPTION_NODES.get(node_name, {"apps": ["slack"]})
    apps = cfg["apps"][:]
    # Occasionally drop one app (rep skipped logging, etc.)
    if len(apps) > 1 and random.random() < 0.2:
        apps = random.sample(apps, len(apps) - 1)
    return apps

def next_business_ts(current_ts, duration_min, lunch_break=True):
    """Advance timestamp by duration, skip lunch 12-13h and end of day."""
    ts = current_ts + timedelta(minutes=duration_min)
    # Add inter-task gap (0-8 min distraction)
    ts += timedelta(minutes=random.uniform(0, 8))
    # Push past lunch
    if lunch_break and ts.hour == 12:
        ts = ts.replace(hour=13, minute=random.randint(0, 15))
    # Push to next day if past 17:30
    if ts.hour >= 17 and ts.minute >= 30:
        ts = ts + timedelta(days=1)
        ts = ts.replace(hour=8, minute=random.randint(30, 59))
    return ts

def maybe_insert_interruption(ts, events_today, day_event_count):
    """Probabilistically inject a standup or meeting based on time of day."""
    interruptions = []
    # Morning standup ~9:00-9:30
    if ts.hour == 9 and ts.minute < 35 and day_event_count == 0:
        dur = sample_duration("team_standup")
        interruptions.append({
            "node_id": "team_standup",
            "duration_min": dur,
            "apps_used": pick_apps("team_standup"),
            "is_pipeline_node": False,
        })
    # Random meeting (20% chance mid-afternoon)
    if 13 <= ts.hour <= 15 and random.random() < 0.20:
        node = random.choice(["internal_meeting", "manager_1on1", "pipeline_review"])
        dur = sample_duration(node)
        interruptions.append({
            "node_id": node,
            "duration_min": dur,
            "apps_used": pick_apps(node),
            "is_pipeline_node": False,
        })
    return interruptions

def generate_deal_events(emp, deal_id, path_type, start_ts):
    """Generate an ordered list of events for one deal thread."""
    path = DEAL_PATHS[path_type]
    events = []
    ts = start_ts
    day_event_count = 0
    prev_ts_day = ts.date()

    for node_id in path:
        # Reset day counter
        if ts.date() != prev_ts_day:
            day_event_count = 0
            prev_ts_day = ts.date()

        # Maybe inject interruption before pipeline node
        interrupts = maybe_insert_interruption(ts, events, day_event_count)
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

        # Pipeline node itself
        dur = sample_duration(node_id, emp["performance"])
        
        # Determine outcome
        is_last = (node_id == path[-1])
        if is_last and path_type == "won":
            outcome = "closed_won"
            next_node = None
        elif is_last:
            outcome = "disqualified" if "early" in path_type else ("no_response" if "ghosted" in path_type else "lost")
            next_node = None
        else:
            idx = path.index(node_id)
            next_node = path[idx + 1]
            outcome = "completed"

        # Rare retry on same node (e.g. re-prep after bad call)
        repeat = False
        if node_id in ("objection_handling", "discovery_call_prep") and random.random() < 0.15:
            repeat = True

        events.append({
            "event_id": str(uuid.uuid4())[:8],
            "timestamp": ts.strftime("%Y-%m-%d %H:%M"),
            "employee_id": emp["id"],
            "role": emp["role"],
            "deal_id": deal_id,
            "node_id": node_id,
            "duration_min": dur,
            "apps_used": pick_apps(node_id),
            "is_pipeline_node": True,
            "outcome": outcome,
            "next_node": next_node,
            "repeated_node": repeat,
        })

        ts = next_business_ts(ts, dur)
        day_event_count += 1

        # If repeated, add second visit
        if repeat:
            dur2 = sample_duration(node_id, emp["performance"])
            events.append({
                "event_id": str(uuid.uuid4())[:8],
                "timestamp": ts.strftime("%Y-%m-%d %H:%M"),
                "employee_id": emp["id"],
                "role": emp["role"],
                "deal_id": deal_id,
                "node_id": node_id,
                "duration_min": dur2,
                "apps_used": pick_apps(node_id),
                "is_pipeline_node": True,
                "outcome": "retry",
                "next_node": next_node,
                "repeated_node": True,
            })
            ts = next_business_ts(ts, dur2)
            day_event_count += 1

        # Multi-day gaps for async pipeline steps
        if node_id in ("send_and_log", "follow_up_sequence", "proposal_drafting", "contract_negotiation"):
            gap_days = random.randint(1, 4)
            ts += timedelta(days=gap_days)
            ts = ts.replace(hour=random.randint(8, 10), minute=random.randint(0, 59))
            day_event_count = 0

    return events

# ── Deal assignment per employee ───────────────────────────────────────────────
DEAL_ASSIGNMENTS = [
    # emp_001 - average SDR, mostly early losses
    ("emp_001", "won"),
    ("emp_001", "lost_post_discovery"),
    ("emp_001", "lost_early"),
    ("emp_001", "lost_post_demo"),

    # emp_002 - high performer, more wins
    ("emp_002", "won"),
    ("emp_002", "won"),
    ("emp_002", "ghosted_after_proposal"),
    ("emp_002", "lost_early"),

    # emp_003 - intern, mostly prospecting
    ("emp_003", "lost_early"),
    ("emp_003", "lost_early"),
    ("emp_003", "lost_post_discovery"),

    # emp_004 - low performer, slow and loses often
    ("emp_004", "lost_post_discovery"),
    ("emp_004", "lost_post_demo"),
    ("emp_004", "lost_early"),

    # emp_005 - junior AE, handles full cycle
    ("emp_005", "won"),
    ("emp_005", "ghosted_after_proposal"),
    ("emp_005", "lost_post_demo"),
    ("emp_005", "won"),

    # emp_006 - intern, some prospecting
    ("emp_006", "lost_early"),
    ("emp_006", "lost_post_discovery"),
]

emp_map = {e["id"]: e for e in EMPLOYEES}

all_events = []
# Stagger start dates across Jan-Feb 2024
start_dates = [
    datetime(2024, 1, 8,  8, 45),
    datetime(2024, 1, 10, 9, 0),
    datetime(2024, 1, 15, 8, 30),
    datetime(2024, 1, 17, 9, 15),
    datetime(2024, 1, 22, 8, 55),
    datetime(2024, 1, 24, 9, 5),
    datetime(2024, 1, 29, 8, 40),
    datetime(2024, 2, 1,  9, 20),
    datetime(2024, 2, 5,  8, 50),
    datetime(2024, 2, 7,  9, 10),
    datetime(2024, 2, 12, 8, 35),
    datetime(2024, 2, 14, 9, 0),
    datetime(2024, 2, 19, 8, 45),
    datetime(2024, 2, 21, 9, 30),
    datetime(2024, 2, 26, 8, 30),
    datetime(2024, 2, 28, 9, 0),
    datetime(2024, 3, 4,  8, 55),
    datetime(2024, 3, 6,  9, 15),
    datetime(2024, 3, 11, 8, 40),
    datetime(2024, 3, 13, 9, 5),
]

for i, (emp_id, path_type) in enumerate(DEAL_ASSIGNMENTS):
    emp = emp_map[emp_id]
    deal_id = f"deal_{str(uuid.uuid4())[:6]}"
    start_ts = start_dates[i % len(start_dates)]
    events = generate_deal_events(emp, deal_id, path_type, start_ts)
    all_events.extend(events)

# Sort all events by timestamp
all_events.sort(key=lambda e: (e["employee_id"], e["timestamp"]))

# ── Build final output ─────────────────────────────────────────────────────────
output = {
    "metadata": {
        "generated_at": datetime.now().isoformat(),
        "version": "1.0.0",
        "description": "Synthetic telemetry for B2B sales pipeline Markov chain modelling. Each event is one node visit. Use (employee_id, deal_id) to reconstruct sequences. next_node field encodes the observed transition.",
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
        "pipeline_nodes": list(NODES.keys()),
        "deal_outcome_counts": {
            path: sum(1 for _, p in DEAL_ASSIGNMENTS if p == path)
            for path in DEAL_PATHS
        }
    },
    "events": all_events
}

out_path = "/mnt/user-data/outputs/telemetry.json"
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"Generated {len(all_events)} events across {len(DEAL_ASSIGNMENTS)} deals")
print(f"Saved to {out_path}")

# Quick sanity: transition pairs
transitions = []
pipeline_events = [e for e in all_events if e["is_pipeline_node"] and e["next_node"]]
for e in pipeline_events:
    transitions.append((e["node_id"], e["next_node"]))

from collections import Counter
print("\nTop 15 transitions:")
for (src, dst), count in Counter(transitions).most_common(15):
    print(f"  {src} -> {dst}: {count}")
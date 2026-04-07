"""
02_markov_builder.py
────────────────────
Loads telemetry.json → reconstructs deal sequences → builds transition matrix.

Output:
  - transition_matrix.json   (raw counts + probabilities + metadata)
  - markov_graph.json        (networkx-ready edge list for script 04)
"""

import argparse
import json
import numpy as np
from collections import defaultdict, Counter
from pathlib import Path

# ── 0. PARAMS ───────────────────────────────────────────────────────────────────
INCLUDE_RETRIES = False   # flip to True if you want self-loop edges

# CLI args override defaults so the job_runner can pass project-scoped paths
_parser = argparse.ArgumentParser(description="Build Markov transition matrix from telemetry")
_parser.add_argument(
    "--telemetry_path",
    type=str,
    default="backend/data/telemetry.json",
    help="Path to telemetry.json (default: backend/data/telemetry.json)",
)
_parser.add_argument(
    "--output_path",
    type=str,
    default="backend/data/transition_matrix.json",
    help="Destination for transition_matrix.json (default: backend/data/transition_matrix.json)",
)
_args = _parser.parse_args()

TELEMETRY_PATH       = _args.telemetry_path
TRANSITION_MTX__PATH = _args.output_path

# ── 1. LOAD ───────────────────────────────────────────────────────────────────

dir = Path.cwd()
print(dir)

with open(TELEMETRY_PATH) as f:
    data = json.load(f)

events = data["events"]

# TODO: Load this from all_tasks.json
PIPELINE_NODES = data["metadata"]["pipeline_nodes"]

print(f"Loaded {len(events)} total events")

# ── 2. RECONSTRUCT SEQUENCES ──────────────────────────────────────────────────
# Group by (employee_id, deal_id), keep only pipeline nodes, sort by timestamp
from datetime import datetime

def get_time_diff(earlier_time, later_time, fmt="%Y-%m-%d %H:%M"):
    dt1 = datetime.strptime(earlier_time, fmt)
    dt2 = datetime.strptime(later_time, fmt)
    return (dt2 - dt1).total_seconds()
 
def get_sequences_and_transition_stats(events):
    """
    Returns a list of state sequences, one per deal thread.
    Each sequence is an ordered list of node_ids.
    
    Key decisions:
      - Filter out interruptions (is_pipeline_node == False)
      - Filter out retries so self-loops are a deliberate Markov choice, 
        not just an artifact. Set INCLUDE_RETRIES = True to keep them.
      - Sort by timestamp within each (employee_id, deal_id) group
    """

    # Group events
    deal_groups = defaultdict(list)

    # Dwell times for each transition
    transition_dwell = defaultdict(list)
    transition_counts = defaultdict(int)

    # Time within each node 
    node_durations = defaultdict(list) 
    
    for e in events:
        if not e["is_pipeline_node"]:
            continue
        if not INCLUDE_RETRIES and e.get("repeated_node") and e["outcome"] == "retry":
            continue
        key = (e["employee_id"], e["deal_id"])
        deal_groups[key].append(e)

    sequences = []
    for key, evts in deal_groups.items():
        sorted_evts = sorted(evts, key=lambda e: e["timestamp"])

        seq = []
        
        for i in range(len(sorted_evts)-1):

            src = sorted_evts[i]["node_id"]
            dst = sorted_evts[i+1]["node_id"]

            dwell = get_time_diff(earlier_time=sorted_evts[i]["timestamp"], later_time=sorted_evts[i+1]["timestamp"])

            transition_counts[(src,dst)] += 1
            transition_dwell[(src,dst)].append(dwell)

            if sorted_evts[i]["is_pipeline_node"]:
                node_durations[src].append(sorted_evts[i]["duration_min"])
            
            seq.append({
                "node": sorted_evts[i]["node_id"],
                "timestamp": sorted_evts[i]["timestamp"]       
            })
        
        # append final node
        last_evt = sorted_evts[-1]

        if last_evt["is_pipeline_node"]:
            node_durations[last_evt["node_id"]].append(last_evt["duration_min"])
            
        seq.append({
            "node": last_evt["node_id"],
            "timestamp": last_evt["timestamp"]
        })
        
        sequences.append({
            "key": key,
            "sequence": seq,
            "outcome": last_evt["outcome"],
            "length": len(seq),
        })

    return sequences, transition_counts, transition_dwell, node_durations

sequences, transition_counts, transition_dwell, node_durations = get_sequences_and_transition_stats(events)
print(f"Reconstructed {len(sequences)} deal sequences")
for s in sequences:
        print(
        f"  {s['key']} | outcome={s['outcome']} | length={s['length']} | "
        f"path={' → '.join(step['node'] for step in s['sequence'])}"
    )


# ── 3. COUNT TRANSITIONS ──────────────────────────────────────────────────────
# Add a synthetic END state so terminal nodes have an outgoing edge

ALL_STATES = PIPELINE_NODES + ["END"]

STATE_INDEX = {s: i for i, s in enumerate(ALL_STATES)}
N = len(ALL_STATES)

# Raw count matrix  C[i][j] = number of times we saw state_i → state_j
C = np.zeros((N, N), dtype=int)

transition_log = []   # keep individual pairs for inspection

for deal in sequences:
    seq = deal["sequence"]
    for i in range(len(seq) - 1):
        src = seq[i]["node"]
        dst = seq[i+1]["node"]
        if src in STATE_INDEX and dst in STATE_INDEX:
            C[STATE_INDEX[src]][STATE_INDEX[dst]] += 1
            transition_log.append((src, dst))
    # Last node → END
    last = seq[-1]["node"]
    if last in STATE_INDEX:
        C[STATE_INDEX[last]][STATE_INDEX["END"]] += 1

# ── 4. NORMALISE → PROBABILITY MATRIX ────────────────────────────────────────
# P[i][j] = C[i][j] / sum(C[i])   (row-stochastic)
# Rows with zero observations stay zero (unvisited states)

row_sums = C.sum(axis=1, keepdims=True)
# Avoid divide-by-zero for states that were never a source
P = np.where(row_sums > 0, C / row_sums, 0.0)

print(f"\nTransition matrix shape: {P.shape}  ({N} states × {N} states)")
print(f"Non-zero edges: {np.count_nonzero(P)}")


# ── 5. GET TRANSITION TIME STATS ──────────────────────────────────────────────────────

def compute_transition_time_stats(transition_dwell):
    """
    Convert dwell samples into summary statistics.
    """

    stats = {}

    for edge, samples in transition_dwell.items():

        arr = np.array(samples)

        stats[edge] = {
            "mean": float(arr.mean()),
            "median": float(np.median(arr)),
            "std": float(arr.std()),
            "p90": float(np.percentile(arr, 90)),
            "n": len(arr)
        }

    return stats

time_stats = compute_transition_time_stats(transition_dwell)

# ── 6. PACKAGE OUTPUT ─────────────────────────────────────────────────────────

def matrix_to_edge_list(P, states, time_stats, min_prob=0.0):

    edges = []

    for i, src in enumerate(states):
        for j, dst in enumerate(states):

            if P[i][j] > min_prob:

                edge = {
                    "source": src,
                    "target": dst,
                    "probability": round(float(P[i][j]),4),
                    "count": int(C[i][j]),
                }

                stat = time_stats.get((src,dst))

                if stat:
                    edge["time_stats"] = stat

                edges.append(edge)

    return edges


edge_list = matrix_to_edge_list(P, ALL_STATES, time_stats, min_prob=0.0)

# Transition frequency summary
top_transitions = Counter(transition_log).most_common(20)

output = {
    "metadata": {
        "states": ALL_STATES,
        "state_index": STATE_INDEX,
        "n_states": N,
        "n_sequences": len(sequences),
        "n_transitions_observed": int(C.sum()),
        "non_zero_edges": int(np.count_nonzero(P)),
        "include_retries": INCLUDE_RETRIES,
        "note": "P is row-stochastic. Each row sums to 1.0 (or 0 if state never observed as source).",
    },
    "count_matrix": C.tolist(),           # raw counts — useful for Laplace smoothing later
    "probability_matrix": P.tolist(),     # the actual Markov transition matrix
    "node_durations": node_durations,     # Time samples for how long employee stays at each node
    "transition_dwell": {                 # Time samples for how long employee takes to move along edge
        f"{src},{dst}": samples
        for (src, dst), samples in transition_dwell.items()
    },
    "edge_list": edge_list,               # networkx-ready for script 04
    "sequences": [
        {"deal": str(s["key"]), "outcome": s["outcome"], "sequence": s["sequence"]}
        for s in sequences
    ],
    "top_transitions": [
        {"from": src, "to": dst, "count": count}
        for (src, dst), count in top_transitions
    ],
    "graph": {
        src: [
            {
                "target": dst,
                "probability": edge["probability"],
                "time_samples": transition_dwell.get((src,dst), [])
            }
            for edge in edge_list if edge["source"] == src
        ]
        for src in ALL_STATES
    }
}

out_path = Path(TRANSITION_MTX__PATH)
out_path.parent.mkdir(parents=True, exist_ok=True)
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)

print("\nSaved → transition_matrix.json")


# ── 7. PRETTY-PRINT THE MATRIX ───────────────────────────────────────────────
print("\n── Transition Probability Matrix (non-zero rows only) ──\n")
col_labels = [s[:12].ljust(12) for s in ALL_STATES]
print("FROM \\ TO".ljust(28) + "  ".join(col_labels))
print("─" * (28 + 14 * N))

for i, src in enumerate(ALL_STATES):
    row = P[i]
    if row.sum() == 0:
        continue   # skip unvisited states
    row_str = "  ".join(
        f"{v:.2f}".ljust(12) if v > 0 else "  --        "
        for v in row
    )
    print(f"{src[:26].ljust(28)}{row_str}")

print("\n── Top observed transitions ──")
for t in output["top_transitions"]:
    print(f"  {t['from']:35s} → {t['to']:35s}  (n={t['count']})")
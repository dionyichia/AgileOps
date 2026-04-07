"""
classifier.py
─────────────────────────────────────────────────────────────────────────────
Classifies a scraped SaaS tool into pipeline-specific impact parameters
for use in the Monte Carlo simulation.

Reads:  backend/data/scraped_{slug}.json      (from parser_scraper.py)
        backend/data/all_tasks.json           (pipeline node definitions)
Writes: backend/data/tool_features_{slug}.json

The output is consumed by sim.py via --tool_features.

Usage:
    python backend/scripts/classifier.py --scraped backend/data/scraped_gong.json
    python backend/scripts/classifier.py --scraped backend/data/scraped_outreach.json \
        --output backend/data/tool_features_outreach.json

Requires:
    ANTHROPIC_API_KEY env var
─────────────────────────────────────────────────────────────────────────────
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

# ── Paths ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
DEFAULT_TASKS_PATH = DATA_DIR / "all_tasks.json"

# ── Pipeline Node IDs (canonical order from all_tasks.json) ───────────────────

PIPELINE_NODES = [
    "prospect_research",
    "draft_outreach",
    "send_and_log",
    "follow_up_sequence",
    "response_triage",
    "discovery_call_prep",
    "discovery_call_execution",
    "call_debrief_logging",
    "stakeholder_mapping",
    "demo_scheduling_and_prep",
    "demo_delivery",
    "objection_handling",
    "proposal_drafting",
    "contract_negotiation",
    "deal_closure_and_handoff",
]

# ── Prompts ────────────────────────────────────────────────────────────────────

_SYSTEM = """\
You are a workflow analyst specialising in B2B SaaS sales tools. Given raw scraped
data about a tool, you extract structured impact parameters for a Markov-chain
sales pipeline simulation.

The pipeline has 15 nodes:
{node_list}

Your output is a JSON object (no markdown fences, pure JSON) with these 7 sections:

─── 1. "tool_summary" ────────────────────────────────────────────────────────
2-3 sentence description of the tool's core value proposition.

─── 2. "micro_features" ──────────────────────────────────────────────────────
Array of individual tool capabilities. Each entry:
{{
  "feature_id":    snake_case identifier,
  "name":          human-readable name,
  "description":   what this specific feature does,
  "affected_nodes": [node_ids it directly impacts],
  "feature_type":  "automation" | "ai_assist" | "elimination" | "acceleration",
  "evidence":      quote or paraphrase from the source material
}}

─── 3. "node_impact" ─────────────────────────────────────────────────────────
Dict mapping ALL 15 node_ids to a float in [0.0, 0.95] — the fraction of
active work time the tool eliminates at that node. Use 0.0 for unaffected nodes.

CALIBRATION RULES:
• Human-essential nodes (discovery_call_execution, demo_delivery) → max 0.10
• contract_negotiation (legal/human) → max 0.15
• High-automation nodes with strong evidence → up to 0.80
• Nodes with only weak evidence → cap at 0.35
• When vendor claims "saves X hrs/week", back-calculate against baseline duration
• Default to conservative estimates — overfit to evidence, not hype

─── 4. "node_impact_reasoning" ───────────────────────────────────────────────
Dict mapping each node_id to a 1-2 sentence explanation of the estimate.
Cite specific features or benchmarks where available.

─── 5. "edge_impact" ─────────────────────────────────────────────────────────
Dict mapping "src_node,dst_node" strings to floats in [0.0, 0.70].
Only include edges where the tool demonstrably reduces the async wait / handoff
time between those two steps. Omit edges the tool doesn't affect.

─── 6. "topology_changes" ────────────────────────────────────────────────────
Array of structural graph modifications. Choose from:

  Collapse (tool entirely eliminates a step):
  {{"type":"collapse", "node":"node_id", "reason":"..."}}
  → Only use when a step is made redundant, not just faster.

  Add edge (tool creates a new skip or shortcut path):
  {{"type":"add_edge", "from":"src", "to":"dst", "probability":0.05-0.40, "reason":"..."}}
  → Use when the tool enables reps to skip steps or exit deals faster.
  → probability must be ≤ 0.40 to leave the existing path dominant.

  Boost exit (tool improves lead qualification, raising early-exit rate):
  {{"type":"boost_exit", "node":"node_id", "delta":0.02-0.12, "reason":"..."}}
  → Use when the tool provides better signals for disqualifying deals early.

TOPOLOGY CAUTION: Only add changes with genuine structural evidence.
An empty array is fine if no topology changes are warranted.

─── 7. "confidence" ──────────────────────────────────────────────────────────
{{
  "overall": "high" | "medium" | "low",
  "per_node": {{ "node_id": "high"|"medium"|"low", ... }},
  "notes": "1-2 sentences on data quality and main gaps"
}}

FINAL RULES:
• Return ONLY the JSON object — no preamble, no explanation, no markdown fences.
• node_impact values: floats in [0.0, 0.95]
• edge_impact values: floats in [0.0, 0.70]
• add_edge probability: floats in [0.05, 0.40]
• boost_exit delta: floats in [0.02, 0.12]
• Evidence hierarchy: ROI benchmarks > case studies > feature page claims > inference
"""

_USER = """\
PIPELINE NODE DEFINITIONS:
{node_defs}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCRAPED DATA FOR: {tool_name}
Website: {base_url}

── AI Research Summary ──
{tool_summary}

── Key Features Found ──
{key_features}

── ROI Benchmarks Found ──
{roi_benchmarks}

── Integrations ──
{integrations}

── Source Content (most relevant excerpts) ──
{source_excerpts}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Classify this tool's impact on the 15 pipeline nodes and return the JSON object.
"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def _node_list_str(tasks: list) -> str:
    return "\n".join(
        f"  {t['node_id']:42s} — {t['label']} ({t['automatable_fraction']} automatable)"
        for t in tasks
    )


def _node_defs_str(tasks: list) -> str:
    blocks = []
    for t in tasks:
        dur = t.get("duration_distribution", {})
        blocks.append(
            f"[{t['node_id']}]\n"
            f"  Label       : {t['label']}\n"
            f"  Description : {t['description']}\n"
            f"  Automatable : {t['automatable_fraction']}\n"
            f"  Duration    : {dur.get('mean_minutes', '?')} min ± {dur.get('std_minutes', '?')}\n"
            f"  Apps        : {', '.join(t.get('app_cluster', []))}"
        )
    return "\n\n".join(blocks)


def _source_excerpts(scraped: dict, max_chars: int = 40_000) -> str:
    """
    Build a compact excerpt of all scraped content, prioritising case studies
    and benchmarks first.
    """
    sources = scraped.get("sources", [])
    priority = ["case_study", "benchmark", "docs", "website", "pricing", "integration", "review"]

    def rank(s):
        t = s.get("type", "website")
        return priority.index(t) if t in priority else 99

    ordered = sorted(sources, key=rank)
    parts = []
    total = 0
    for s in ordered:
        body = s.get("content") or s.get("key_content", "")
        if not body:
            continue
        header = f"[{s.get('type', 'source')}] {s.get('url', '')}"
        excerpt = f"{header}:\n{body[:3000]}"
        if total + len(excerpt) > max_chars:
            remaining = max_chars - total
            if remaining > 200:
                parts.append(excerpt[:remaining])
            break
        parts.append(excerpt)
        total += len(excerpt)

    return "\n\n---\n\n".join(parts) if parts else "(no source content available)"


def _strip_fences(text: str) -> str:
    if "```" in text:
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        return "\n".join(lines).strip()
    return text.strip()


def _validate(features: dict, node_ids: list) -> dict:
    """
    Ensure all 15 nodes present in node_impact and reasoning, clamp all
    numeric values to their valid ranges, fill in missing defaults.
    """
    # node_impact — must have all 15 nodes, values in [0, 0.95]
    ni = features.setdefault("node_impact", {})
    for nid in node_ids:
        raw = ni.get(nid, 0.0)
        ni[nid] = float(max(0.0, min(0.95, raw)))

    # node_impact_reasoning — fill gaps
    nr = features.setdefault("node_impact_reasoning", {})
    for nid in node_ids:
        nr.setdefault(nid, "No specific evidence found.")

    # edge_impact — clamp to [0, 0.70]
    ei = features.setdefault("edge_impact", {})
    for key in list(ei.keys()):
        ei[key] = float(max(0.0, min(0.70, ei[key])))

    # topology_changes — clamp probabilities and deltas
    for change in features.get("topology_changes", []):
        if "probability" in change:
            change["probability"] = float(max(0.05, min(0.40, change["probability"])))
        if "delta" in change:
            change["delta"] = float(max(0.02, min(0.12, change["delta"])))

    features.setdefault("micro_features", [])
    features.setdefault("confidence", {"overall": "low", "per_node": {}, "notes": ""})

    return features


# ── Core Classify Function ─────────────────────────────────────────────────────

def classify(scraped: dict, tasks: list) -> dict:
    """
    Send scraped tool data to Claude, get back validated impact parameters.
    """
    client = anthropic.Anthropic()
    tool_name = scraped.get("tool_name", "Unknown Tool")
    node_ids = [t["node_id"] for t in tasks]

    system = _SYSTEM.format(node_list=_node_list_str(tasks))

    key_features_str = (
        "\n".join(f"  • {f}" for f in scraped.get("key_features_raw", []))
        or "  (none extracted)"
    )
    roi_str = (
        "\n".join(f"  • {b}" for b in scraped.get("roi_benchmarks", []))
        or "  (none extracted)"
    )
    integ_str = (
        "\n".join(f"  • {i}" for i in scraped.get("integrations", []))
        or "  (none extracted)"
    )

    user = _USER.format(
        node_defs      = _node_defs_str(tasks),
        tool_name      = tool_name,
        base_url       = scraped.get("base_url", ""),
        tool_summary   = scraped.get("tool_summary", "(none)"),
        key_features   = key_features_str,
        roi_benchmarks = roi_str,
        integrations   = integ_str,
        source_excerpts= _source_excerpts(scraped),
    )

    print(f"  Sending to Claude Opus for classification ({len(user):,} chars)...")

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    raw = message.content[0].text
    cleaned = _strip_fences(raw)

    try:
        features = json.loads(cleaned)
    except json.JSONDecodeError as e:
        debug_path = DATA_DIR / "_classifier_last_response.txt"
        debug_path.write_text(raw, encoding="utf-8")
        print(f"Error: Claude returned invalid JSON: {e}")
        print(f"Raw response saved to {debug_path}")
        sys.exit(1)

    # Attach metadata
    features["tool_name"]    = tool_name
    features["tool_slug"]    = scraped.get("tool_slug", "")
    features["generated_at"] = datetime.now(timezone.utc).isoformat()
    features["model"]        = "claude-opus-4-6"
    features["source_count"] = scraped.get("source_count", len(scraped.get("sources", [])))

    return _validate(features, node_ids)


# ── Main ──────────────────────────────────────────────────────────────────────

def run(scraped_path: Path, tasks_path: Path, output_path: Path) -> dict:
    print(f"\n{'═'*60}")
    print(f"  CLASSIFIER — tool feature extraction")
    print(f"{'═'*60}")

    if not scraped_path.exists():
        print(f"Error: scraped file not found: {scraped_path}")
        sys.exit(1)
    if not tasks_path.exists():
        print(f"Error: tasks file not found: {tasks_path}")
        sys.exit(1)

    scraped = json.loads(scraped_path.read_text(encoding="utf-8"))
    tasks   = json.loads(tasks_path.read_text(encoding="utf-8"))

    tool_name = scraped.get("tool_name", "Unknown")
    print(f"  Tool       : {tool_name}")
    print(f"  Sources    : {scraped.get('source_count', len(scraped.get('sources', [])))}")
    print(f"  Pipeline   : {len(tasks)} nodes from {tasks_path.name}")

    features = classify(scraped, tasks)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(features, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    ni = features.get("node_impact", {})
    top_nodes = sorted(ni.items(), key=lambda x: -x[1])[:6]
    topology  = features.get("topology_changes", [])
    edges     = features.get("edge_impact", {})
    mf        = features.get("micro_features", [])
    conf      = features.get("confidence", {}).get("overall", "unknown")

    print(f"\n{'─'*60}")
    print(f"  Micro-features     : {len(mf)}")
    print(f"  Topology changes   : {len(topology)}")
    print(f"  Edge impacts       : {len(edges)}")
    print(f"  Overall confidence : {conf}")
    print(f"\n  Top node impacts:")
    for nid, val in top_nodes:
        bar = "█" * int(val * 20)
        print(f"    {nid[:38]:38s}  {val*100:5.1f}%  {bar}")
    if topology:
        print(f"\n  Topology changes:")
        for ch in topology:
            ctype = ch.get("type", "?")
            if ctype == "collapse":
                print(f"    collapse  → {ch.get('node')}")
            elif ctype == "add_edge":
                print(f"    add_edge  → {ch.get('from')} → {ch.get('to')}  p={ch.get('probability')}")
            elif ctype == "boost_exit":
                print(f"    boost_exit → {ch.get('node')}  Δ={ch.get('delta')}")
    print(f"\n  Saved → {output_path}")
    print(f"{'═'*60}\n")

    return features


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Classify a scraped SaaS tool into pipeline impact parameters"
    )
    parser.add_argument("--scraped", "-s", required=True,
        help="Path to scraped_{slug}.json from parser_scraper.py")
    parser.add_argument("--tasks", default=str(DEFAULT_TASKS_PATH),
        help=f"Path to all_tasks.json (default: {DEFAULT_TASKS_PATH})")
    parser.add_argument("--output", "-o", default="",
        help="Output path (default: backend/data/tool_features_{slug}.json)")
    args = parser.parse_args()

    scraped_path = Path(args.scraped)

    if args.output:
        out_path = Path(args.output)
    else:
        try:
            scraped_data = json.loads(scraped_path.read_text())
            slug = scraped_data.get("tool_slug", "unknown")
        except Exception:
            slug = "unknown"
        out_path = DATA_DIR / f"tool_features_{slug}.json"

    run(scraped_path, Path(args.tasks), out_path)

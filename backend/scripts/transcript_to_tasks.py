"""
transcript_to_tasks.py
──────────────────────
Parses an interview transcript using Claude and merges the extracted
workflow tasks into all_tasks.json.

Supports multiple interviews over time — each call adds/updates nodes
without overwriting prior data.

Usage:
    python backend/scripts/transcript_to_tasks.py --transcript path/to/call.txt
    python backend/scripts/transcript_to_tasks.py --transcript path/to/call.txt --tasks backend/data/all_tasks.json

Requires:
    ANTHROPIC_API_KEY env var (or .env file in project root)
    pip install anthropic
"""

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

import anthropic

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
DEFAULT_TASKS_PATH = DATA_DIR / "all_tasks.json"

# ─── Schema reference (given to the LLM) ─────────────────────────────────────

TASK_SCHEMA = """\
Each task object must have exactly these fields:
{
  "node_id":                string — snake_case unique identifier,
  "label":                  string — human-readable title,
  "description":            string — 1-3 sentence description of what the person does,
  "action_verb":            string — single verb (research, produce, log, classify, prepare, converse, map, present, respond, negotiate, handoff, sequence, etc.),
  "inputs":                 [string] — what the person needs before starting,
  "outputs":                [string] — what the person produces,
  "app_cluster":            [string] — lowercase tool/app names used (e.g. "salesforce", "gmail", "notion"),
  "duration_distribution":  {"type": "lognormal"|"normal", "mean_minutes": number, "std_minutes": number},
  "automatable_fraction":   "high"|"medium"|"low",
  "sources":                [string] — transcript filenames that informed this node
}
"""

# ─── Prompt ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a workflow analyst. You receive interview transcripts where someone \
describes their day-to-day work tasks, and you extract structured workflow \
task nodes from them.

You will also receive the CURRENT task list (may be empty). Your job is to \
MERGE information from the transcript into that list:

MERGE RULES:
1. MATCH SEMANTICALLY — if the interviewee describes an activity that clearly \
   maps to an existing node, UPDATE that node rather than creating a duplicate. \
   Match by meaning, not exact wording.
2. UPDATE INCREMENTALLY:
   - description: enrich with new details, don't discard existing info
   - app_cluster: add any new tools mentioned, keep existing ones
   - duration_distribution: if the interviewee gives a time estimate, average \
     it with the existing mean_minutes. Adjust std_minutes proportionally. \
     If no time is mentioned, keep existing values.
   - inputs/outputs: add new ones mentioned, keep existing
   - automatable_fraction: only change if the interviewee gives clear signal
3. ADD NEW NODES only for tasks not covered by any existing node.
4. NEVER REMOVE existing nodes — even if the interviewee doesn't mention them. \
   Other interviews may have contributed those.
5. Add the transcript filename to the "sources" array of every node you \
   update or create. Do not remove existing source entries.
6. Preserve node_id values for existing nodes. For new nodes, generate a \
   snake_case node_id.

OUTPUT: Return ONLY a valid JSON array of task objects. No markdown, no \
explanation, no code fences. Just the raw JSON array."""


def build_user_prompt(transcript: str, existing_tasks: list, transcript_name: str) -> str:
    return f"""\
CURRENT TASK LIST:
{json.dumps(existing_tasks, indent=2)}

TRANSCRIPT FILENAME: {transcript_name}

INTERVIEW TRANSCRIPT:
{transcript}

Return the updated task list as a JSON array following this schema:
{TASK_SCHEMA}"""


# ─── Validation ───────────────────────────────────────────────────────────────

REQUIRED_FIELDS = {
    "node_id", "label", "description", "action_verb",
    "inputs", "outputs", "app_cluster",
    "duration_distribution", "automatable_fraction",
}


def validate_tasks(tasks: list) -> list[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors = []
    if not isinstance(tasks, list):
        return ["Output is not a JSON array"]

    seen_ids = set()
    for i, task in enumerate(tasks):
        if not isinstance(task, dict):
            errors.append(f"Task {i}: not a JSON object")
            continue

        missing = REQUIRED_FIELDS - set(task.keys())
        if missing:
            errors.append(f"Task {i} ({task.get('node_id', '?')}): missing fields: {missing}")

        nid = task.get("node_id")
        if nid in seen_ids:
            errors.append(f"Task {i}: duplicate node_id '{nid}'")
        seen_ids.add(nid)

        dur = task.get("duration_distribution", {})
        if not isinstance(dur, dict) or "mean_minutes" not in dur:
            errors.append(f"Task {i} ({nid}): invalid duration_distribution")

        if task.get("automatable_fraction") not in ("high", "medium", "low"):
            errors.append(f"Task {i} ({nid}): automatable_fraction must be high/medium/low")

    return errors


# ─── Main ─────────────────────────────────────────────────────────────────────

def run(transcript_path: str, tasks_path: str) -> None:
    transcript_file = Path(transcript_path)
    tasks_file = Path(tasks_path)

    if not transcript_file.exists():
        print(f"Error: transcript not found: {transcript_file}")
        sys.exit(1)

    transcript = transcript_file.read_text(encoding="utf-8")
    transcript_name = transcript_file.name

    # Load existing tasks (or start empty)
    if tasks_file.exists():
        existing_tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
        print(f"Loaded {len(existing_tasks)} existing tasks from {tasks_file}")
    else:
        existing_tasks = []
        print("No existing tasks file — starting fresh")

    # Call Claude
    client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var

    print(f"Sending transcript '{transcript_name}' ({len(transcript)} chars) to Claude...")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": build_user_prompt(transcript, existing_tasks, transcript_name),
        }],
    )

    raw_response = message.content[0].text

    # Parse JSON from response (handle possible markdown fences)
    response_text = raw_response.strip()
    if response_text.startswith("```"):
        # Strip ```json ... ``` wrapper if present
        lines = response_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        response_text = "\n".join(lines)

    try:
        updated_tasks = json.loads(response_text)
    except json.JSONDecodeError as e:
        print(f"Error: Claude returned invalid JSON: {e}")
        print("Raw response saved to backend/data/_last_response.txt for debugging")
        (DATA_DIR / "_last_response.txt").write_text(raw_response, encoding="utf-8")
        sys.exit(1)

    # Validate
    errors = validate_tasks(updated_tasks)
    if errors:
        print("Validation errors in Claude's output:")
        for err in errors:
            print(f"  - {err}")
        print("Raw response saved to backend/data/_last_response.txt for debugging")
        (DATA_DIR / "_last_response.txt").write_text(raw_response, encoding="utf-8")
        sys.exit(1)

    # Sanity check: no existing nodes were dropped
    existing_ids = {t["node_id"] for t in existing_tasks}
    updated_ids = {t["node_id"] for t in updated_tasks}
    dropped = existing_ids - updated_ids
    if dropped:
        print(f"Warning: Claude dropped existing nodes: {dropped}")
        print("Re-adding them to preserve data integrity...")
        dropped_tasks = [t for t in existing_tasks if t["node_id"] in dropped]
        updated_tasks.extend(dropped_tasks)

    # Write output
    tasks_file.write_text(
        json.dumps(updated_tasks, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Summary
    new_ids = updated_ids - existing_ids
    modified_ids = existing_ids & updated_ids
    print(f"\nDone! Updated {tasks_file}")
    print(f"  Total nodes: {len(updated_tasks)}")
    print(f"  Existing updated: {len(modified_ids)}")
    print(f"  New nodes added: {len(new_ids)}")
    if new_ids:
        for nid in new_ids:
            task = next(t for t in updated_tasks if t["node_id"] == nid)
            print(f"    + {nid}: {task['label']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract workflow tasks from an interview transcript and merge into all_tasks.json"
    )
    parser.add_argument(
        "--transcript", "-t",
        required=True,
        help="Path to the transcript text file",
    )
    parser.add_argument(
        "--tasks",
        default=str(DEFAULT_TASKS_PATH),
        help=f"Path to all_tasks.json (default: {DEFAULT_TASKS_PATH})",
    )
    args = parser.parse_args()
    run(args.transcript, args.tasks)

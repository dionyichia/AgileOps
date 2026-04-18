"""
One-time migration: upload all local pipeline files to Supabase Storage.

Usage:
    set -a && source backend/.env && set +a
    PYTHONPATH=. python backend/scripts/migrate_files_to_storage.py

What it does:
  1. Uploads global default files from backend/data/ root to pipeline-data/_global/
  2. Walks each backend/data/{project_id}/ directory and uploads:
     - Pipeline JSON files (all_tasks, telemetry, transition_matrix, monte_carlo_results*)
     - Tool-specific files (scraped_*, tool_features_*)
     - Transcript text files (transcripts/*.txt)
     - Uploaded documents (uploads/*) → uploads bucket

Requires:
    - SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
    - Both 'pipeline-data' and 'uploads' buckets already created in Supabase Dashboard
      with public access disabled
"""

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"

PIPELINE_BUCKET = "pipeline-data"
UPLOADS_BUCKET = "uploads"
GLOBAL_PREFIX = "_global"

GLOBAL_FILES = [
    "all_tasks.json",
    "telemetry.json",
    "transition_matrix.json",
    "monte_carlo_results_original_workflow.json",
]

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def _upload(storage, bucket: str, path: str, file_path: Path, content_type: str) -> None:
    data = file_path.read_bytes()
    storage.from_(bucket).upload(
        path=path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )


def migrate() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    storage = client.storage
    total = 0

    # ── Global defaults ────────────────────────────────────────────────────────
    print("Uploading global defaults → pipeline-data/_global/")
    for fname in GLOBAL_FILES:
        fpath = DATA_DIR / fname
        if fpath.exists():
            _upload(storage, PIPELINE_BUCKET, f"{GLOBAL_PREFIX}/{fname}", fpath, "application/json")
            print(f"  _global/{fname}")
            total += 1

    # ── Per-project files ──────────────────────────────────────────────────────
    for project_dir in sorted(DATA_DIR.iterdir()):
        if not project_dir.is_dir():
            continue
        project_id = project_dir.name
        if not UUID_RE.match(project_id):
            continue

        print(f"\nProject {project_id}")

        # Pipeline JSON files
        for fname in [
            "all_tasks.json",
            "telemetry.json",
            "transition_matrix.json",
        ]:
            fpath = project_dir / fname
            if fpath.exists():
                _upload(storage, PIPELINE_BUCKET, f"{project_id}/{fname}", fpath, "application/json")
                print(f"  {fname}")
                total += 1

        # Monte Carlo results (original + tool-specific)
        for fpath in project_dir.glob("monte_carlo_results*.json"):
            _upload(storage, PIPELINE_BUCKET, f"{project_id}/{fpath.name}", fpath, "application/json")
            print(f"  {fpath.name}")
            total += 1

        # Tool-specific files
        for fpath in list(project_dir.glob("scraped_*.json")) + list(project_dir.glob("tool_features_*.json")):
            _upload(storage, PIPELINE_BUCKET, f"{project_id}/{fpath.name}", fpath, "application/json")
            print(f"  {fpath.name}")
            total += 1

        # Transcript text files
        transcripts_dir = project_dir / "transcripts"
        if transcripts_dir.exists():
            for fpath in transcripts_dir.glob("*.txt"):
                _upload(
                    storage,
                    PIPELINE_BUCKET,
                    f"{project_id}/transcripts/{fpath.name}",
                    fpath,
                    "text/plain",
                )
                print(f"  transcripts/{fpath.name}")
                total += 1

        # Uploaded documents → uploads bucket
        uploads_dir = project_dir / "uploads"
        if uploads_dir.exists():
            for fpath in uploads_dir.iterdir():
                if fpath.is_file():
                    _upload(
                        storage,
                        UPLOADS_BUCKET,
                        f"{project_id}/{fpath.name}",
                        fpath,
                        "application/octet-stream",
                    )
                    print(f"  uploads/{fpath.name}")
                    total += 1

    print(f"\nDone — {total} files uploaded.")


if __name__ == "__main__":
    migrate()

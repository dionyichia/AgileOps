"""
One-time migration: copy all rows from local SQLite to Supabase PostgreSQL.

Usage:
    set -a && source backend/.env && set +a
    PYTHONPATH=. python backend/scripts/migrate_sqlite_to_pg.py

Requires:
    - DATABASE_URL env var pointing at the Supabase PostgreSQL connection string
      (postgresql+asyncpg://...)
    - The Supabase PostgreSQL schema must already exist (run alembic upgrade head first)
    - The local SQLite database at backend/data/agileops.db must still be intact

Tables are migrated in FK dependency order so foreign key constraints are satisfied.
UploadedFile.storage_path is rewritten from an absolute local path to a
bucket-relative path: "{project_id}/{filename}".
"""

import asyncio
import os
import re
import sys
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

SQLITE_URL = f"sqlite+aiosqlite:///{Path(__file__).resolve().parents[2] / 'backend' / 'data' / 'agileops.db'}"
PG_URL = os.environ.get("DATABASE_URL", "")

if not PG_URL or not PG_URL.startswith("postgresql"):
    print("ERROR: DATABASE_URL must be set to a postgresql+asyncpg:// connection string.")
    sys.exit(1)


async def migrate() -> None:
    src_engine = create_async_engine(SQLITE_URL, echo=False)
    dst_engine = create_async_engine(PG_URL, echo=False)

    src_session = async_sessionmaker(src_engine, class_=AsyncSession, expire_on_commit=False)
    dst_session = async_sessionmaker(dst_engine, class_=AsyncSession, expire_on_commit=False)

    tables_in_order = [
        "projects",
        "workflow_profiles",
        "transcripts",
        "jobs",
        "pending_invites",
        "tool_evaluations",
        "uploaded_files",
        "simulation_results",
    ]

    async with src_session() as src, dst_session() as dst:
        for table in tables_in_order:
            result = await src.execute(text(f"SELECT * FROM {table}"))
            rows = result.mappings().all()

            if not rows:
                print(f"  {table}: 0 rows (skipped)")
                continue

            # For uploaded_files, rewrite storage_path to bucket-relative form
            if table == "uploaded_files":
                rows = _fix_upload_paths(rows)

            col_names = list(rows[0].keys())
            placeholders = ", ".join(f":{c}" for c in col_names)
            col_list = ", ".join(col_names)
            insert_sql = text(
                f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
                f"ON CONFLICT DO NOTHING"
            )

            for row in rows:
                await dst.execute(insert_sql, dict(row))

            await dst.commit()
            print(f"  {table}: {len(rows)} rows migrated")

    await src_engine.dispose()
    await dst_engine.dispose()
    print("\nMigration complete.")


def _fix_upload_paths(rows):
    """
    Rewrite storage_path from absolute local path to bucket-relative path.

    Old: /absolute/path/to/backend/data/{project_id}/uploads/{uuid}_{filename}
    New: {project_id}/{uuid}_{filename}
    """
    fixed = []
    for row in rows:
        row = dict(row)
        path = row.get("storage_path", "")
        # Extract everything after /uploads/ if it's an absolute path
        match = re.search(r"([0-9a-f\-]{36})/uploads/(.+)$", path)
        if match:
            row["storage_path"] = f"{match.group(1)}/{match.group(2)}"
        fixed.append(row)
    return fixed


if __name__ == "__main__":
    print(f"Migrating from SQLite → {PG_URL[:60]}...")
    asyncio.run(migrate())

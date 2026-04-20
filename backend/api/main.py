from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.api.config import CORS_ORIGINS
from backend.api.deps import engine
from backend.api.models.db import Base
from backend.api.routes import (
    auth,
    consultation,
    cosmo,
    jobs,
    markov,
    pipeline,
    profiles,
    projects,
    recommendation,
    simulation,
    task_edit_requests,
    tasks,
    tools,
    topology,
    transcripts,
    uploads,
)


async def _run_dev_migrations() -> None:
    if not engine.url.drivername.startswith("sqlite"):
        return

    migrations = {
        "tool_evaluations": [
            ("latest_job_id", "ALTER TABLE tool_evaluations ADD COLUMN latest_job_id VARCHAR(36)"),
            ("latest_job_status", "ALTER TABLE tool_evaluations ADD COLUMN latest_job_status VARCHAR(20)"),
            ("latest_job_progress_pct", "ALTER TABLE tool_evaluations ADD COLUMN latest_job_progress_pct INTEGER"),
            ("latest_job_step", "ALTER TABLE tool_evaluations ADD COLUMN latest_job_step TEXT"),
            ("last_error", "ALTER TABLE tool_evaluations ADD COLUMN last_error TEXT"),
            ("completed_at", "ALTER TABLE tool_evaluations ADD COLUMN completed_at DATETIME"),
        ],
        "simulation_results": [
            ("baseline_transition_matrix_json", "ALTER TABLE simulation_results ADD COLUMN baseline_transition_matrix_json JSON"),
            ("tool_transition_matrix_json", "ALTER TABLE simulation_results ADD COLUMN tool_transition_matrix_json JSON"),
            ("workflow_diff_json", "ALTER TABLE simulation_results ADD COLUMN workflow_diff_json JSON"),
        ],
    }

    async with engine.begin() as conn:
        for table_name, table_migrations in migrations.items():
            pragma = await conn.execute(text(f"PRAGMA table_info({table_name})"))
            existing_columns = {row[1] for row in pragma.fetchall()}
            for column_name, statement in table_migrations:
                if column_name not in existing_columns:
                    await conn.execute(text(statement))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _run_dev_migrations()
    yield
    await engine.dispose()


app = FastAPI(title="AgileOps API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── HTTP routes (all under /api prefix) ───────────────────────────────────────
_api_routers = [
    auth.router,
    consultation.router,
    cosmo.router,
    projects.router,
    profiles.router,
    transcripts.router,
    tasks.router,
    tools.router,
    uploads.router,
    pipeline.router,
    simulation.router,
    task_edit_requests.router,
    recommendation.router,
    markov.router,
    topology.router,
    jobs.http_router,
]
for router in _api_routers:
    app.include_router(router, prefix="/api")

# ── WebSocket routes (no /api prefix — WS lives at /ws/jobs/{id}) ─────────────
app.include_router(jobs.ws_router)

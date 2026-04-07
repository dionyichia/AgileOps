from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import CORS_ORIGINS
from backend.api.deps import engine
from backend.api.models.db import Base
from backend.api.routes import (
    auth,
    jobs,
    markov,
    pipeline,
    profiles,
    projects,
    recommendation,
    simulation,
    tasks,
    tools,
    transcripts,
    uploads,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
    projects.router,
    profiles.router,
    transcripts.router,
    tasks.router,
    tools.router,
    uploads.router,
    pipeline.router,
    simulation.router,
    recommendation.router,
    markov.router,
    jobs.http_router,
]
for router in _api_routers:
    app.include_router(router, prefix="/api")

# ── WebSocket routes (no /api prefix — WS lives at /ws/jobs/{id}) ─────────────
app.include_router(jobs.ws_router)

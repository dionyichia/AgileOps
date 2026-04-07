# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgileOps is a B2B SaaS sales workflow simulation platform. The real-world pipeline is fully human-driven: intake form → interview call → paste transcript → LLM extracts tasks into `all_tasks.json` → downstream scripts generate synthetic telemetry, build Markov transition matrices, and run Monte Carlo simulations to model tool impact. Results are presented through a React frontend with a guided 5-step UX flow.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev        # Start Vite dev server (proxies /api/* to :8000)
npm run build      # TypeScript check + Vite production build
npm run preview    # Preview production build
```

### Backend — API Server
```bash
# First-time setup
./setup.sh                              # Creates .venv and installs requirements.txt

# Start FastAPI server (from project root)
PYTHONPATH=. .venv/bin/uvicorn backend.api.main:app --port 8000   # API at http://localhost:8000/docs
```

### Backend — Pipeline Scripts (standalone)
```bash
# Transcript → tasks (requires ANTHROPIC_API_KEY env var)
python backend/scripts/transcript_to_tasks.py -t path/to/transcript.txt   # Merges into backend/data/all_tasks.json

# Run the downstream pipeline (after all_tasks.json is populated)
python backend/scripts/syth_data_gen.py   # Stage 1: Generate synthetic telemetry → backend/data/telemetry.json
python backend/scripts/markov_builder.py  # Stage 2: Build transition matrix → backend/data/transition_matrix.json
python backend/scripts/sim.py             # Stage 3: Monte Carlo simulation → backend/data/monte_carlo_results.json
```

`start.sh` runs `markov_builder.py` as a convenience entry point.

## Architecture

### Backend — Transcript-Driven Data Pipeline

All stages are standalone Python scripts that read/write JSON files in `backend/data/`. No real telemetry is used — data comes from human interviews.

**Stage 0: `transcript_to_tasks.py`** — Takes an interview transcript and the existing `all_tasks.json`, sends both to Claude with merge instructions. Matches tasks semantically (not by exact name), updates incrementally (new tools added, durations averaged, descriptions enriched), and never drops existing nodes. Tracks which transcripts informed each node via a `"sources"` field. Supports interviewing multiple people at different times — each run merges into the same file.

1. **`syth_data_gen.py`** — Generates synthetic telemetry events for 6 employees across a 15-node sales pipeline defined in `config.py`. Includes realistic interruptions (standups, meetings). Outputs `telemetry.json`.

2. **`markov_builder.py`** — Parses telemetry, groups by (employee_id, deal_id), reconstructs deal sequences, and computes transition probabilities and dwell-time distributions. Outputs `transition_matrix.json`.

3. **`sim.py`** — Runs 2000 Monte Carlo deal simulations over 12 weeks. Models tool impact at three levels: node duration reductions, edge dwell-time reductions, and topology changes (collapsing nodes, adding edges, boosting early exits). Uses logistic adoption curves and exponential skill learning. Outputs `monte_carlo_results.json`.

Key assumptions (documented in `sim.py`): memoryless Markov transitions, lognormal duration distributions, 40h/week schedule, 20 concurrent deals/rep, emergent win rates.

### Backend — API Layer (FastAPI)

`backend/api/` contains a FastAPI server that bridges the frontend to the database and pipeline scripts.

- **`main.py`** — App setup with CORS middleware, auto-creates all tables on startup. All routers registered.
- **`config.py`** — Database URL (SQLite dev / PostgreSQL prod via `DATABASE_URL`), CORS origins, `DATA_DIR`, `UPLOAD_MAX_BYTES`
- **`deps.py`** — Async DB session injection, JWT auth (`get_current_user`) via python-jose (HS256). `SECRET_KEY` is hardcoded for dev — **must** be set via env var in prod.
- **`models/db.py`** — SQLAlchemy 2.0 models: `User`, `Project`, `WorkflowProfile`, `Transcript`, `Job`, `ToolEvaluation`, `UploadedFile`, `SimulationResult`
- **`schemas/api.py`** — Pydantic v2 request/response schemas for all endpoints
- **`routes/auth.py`** — `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **`routes/projects.py`** — CRUD: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/{id}`
- **`routes/profiles.py`** — `GET/PUT /api/projects/{id}/profile` (upsert)
- **`routes/transcripts.py`** — `GET/POST /api/projects/{id}/transcripts`, `GET /api/projects/{id}/transcripts/{id}`
- **`routes/tasks.py`** — `GET /api/projects/{id}/tasks`, `POST /api/projects/{id}/tasks/reset`
- **`routes/pipeline.py`** — `POST /api/projects/{id}/pipeline/run`, `POST /api/projects/{id}/pipeline/simulate`
- **`routes/tools.py`** — `GET/POST /api/projects/{id}/tools`, `GET /api/projects/{id}/tools/{id}`
- **`routes/uploads.py`** — `POST/GET /api/projects/{id}/uploads`, `DELETE /api/projects/{id}/uploads/{id}`
- **`routes/simulation.py`** — `GET /api/projects/{id}/simulation/{evalId}`
- **`routes/recommendation.py`** — `GET /api/projects/{id}/recommendation/{evalId}`
- **`routes/markov.py`** — `GET /api/projects/{id}/markov`
- **`routes/jobs.py`** — `GET /api/jobs/{jobId}` (HTTP) + `WS /ws/jobs/{jobId}` (WebSocket)
- **`services/data_io.py`** — Project-scoped file I/O helpers; all pipeline files live under `backend/data/{project_id}/`
- **`services/job_runner.py`** — Async background job execution; spawns pipeline scripts as subprocesses, emits progress via WebSocket
- **`services/ws_manager.py`** — In-process WebSocket connection registry (broadcast to all subscribers of a job)
- **`services/recommendation.py`** — `derive(tool_eval, sim_result)` — computes confidence score, impact ranges, use cases

Database file: `backend/data/agileops.db` (SQLite, auto-created on first run).
Pipeline data: `backend/data/{project_id}/` — namespaced per project.

See `frontend/src/api/client.ts` for the TypeScript types each endpoint returns.

### Frontend — Guided Workflow + Internal Tools

React 18 + TypeScript SPA built with Vite. Uses Tailwind CSS with custom color palette: Gold (#FFBF00), Magenta (#E83F6F), Cerulean (#2274A5), Sea Green (#32936F), White — all with full shade scales (50-900).

**Four route layers:**

*Public (marketing):*
`/` (LandingPage) — Gold hero, how-it-works, intake form (name, email, company, team size, CRM, tools, frustration). Popup modal CTA + inline form. "We'll be in touch" confirmation.

*Client-facing workspace:*
`/dashboard` (Dashboard) — Client workspace with editable ReactFlow workflow map, tool stack sidebar (click tool → Run Simulation), team stats header. Not a wizard or form.
`/simulation` (SimulationResults) — Monte Carlo results after running a tool simulation from Dashboard.
`/recommendation` (FinalRecommendation) — ROI readout and recommendation.

*Internal tools (our side — not client-facing):*
`/internal/form` (DataForm) → `/internal/workflow-report` (WorkflowReport) → `/internal/tool-input` (ToolInputForm)

*Project-scoped routes (production API-driven):*
`/projects/:projectId/transcripts` (TranscriptInput) → `/projects/:projectId/workflow-report` → `/projects/:projectId/tool-input` → `/projects/:projectId/simulation/:toolEvalId` → `/projects/:projectId/recommendation/:toolEvalId`

- `StepLayout` wraps internal step pages with a progress indicator and navigation
- `CustomNodes.tsx` defines ReactFlow node rendering for the pipeline visualization
- All pages are dual-mode: project-scoped routes use API data, legacy/internal routes use localStorage + mock data

**API client layer:** `src/api/client.ts` provides a typed fetch wrapper for all backend endpoints. Types (`Project`, `Transcript`, `TaskNode`, `Job`, `ToolEvaluation`, `SimulationData`, `RecommendationData`, etc.) serve as the frontend-backend contract. Backend team should implement endpoints to match these types.

**Hooks:**
- `hooks/dataLoader.ts` + `hooks/pullMarkovData.ts` — `useMarkovData(projectId?)` fetches transition matrix data. When `projectId` is provided, fetches from `/api/projects/{id}/markov`; otherwise uses static JSON from `/public/data/`. Transforms to ReactFlow nodes/edges, caches per-URL in memory. Falls back to mock data on error.
- `hooks/useJobProgress.ts` — Tracks async job progress. Tries WebSocket (`/ws/jobs/{jobId}`) first for real-time updates; falls back to HTTP polling every 2s if WS fails. Returns `{ job, isRunning, isDone, isFailed, error, transport }`.

**Shared UI components:**
- `components/ui/Skeleton.tsx` — `SkeletonLine`, `SkeletonBlock`, `SkeletonCard`, `PageLoader`, `ErrorState` — reusable loading and error primitives in the project's dark theme.

**TranscriptInput page** (`src/pages/TranscriptInput.tsx`) — Internal frame at `/projects/:projectId/transcripts`:
- Transcript submission form (name, role, date, paste transcript)
- Job progress tracking (transcript parsing + full pipeline)
- Transcript history with expandable raw text
- Task graph preview modal (table view of all_tasks nodes)
- Pipeline action buttons (Run Full Pipeline, Preview Tasks, Reset Tasks)

**UI spec:** `frontend/FRAMES.md` documents every frame's content, audience (internal vs client-facing), and data requirements.

### Current State

- Backend pipeline scripts are functional (transcript → tasks, synthetic data → Markov → simulation)
- FastAPI server fully implemented: all 28 endpoints live, all routers registered
- Database: SQLite for dev (auto-created), PostgreSQL-ready via `DATABASE_URL` env var. All tables: `users`, `projects`, `workflow_profiles`, `transcripts`, `jobs`, `tool_evaluations`, `uploaded_files`, `simulation_results`
- **Auth:** JWT-based (HS256) with `/api/auth/register` and `/api/auth/login`. `SECRET_KEY` is a dev placeholder — set via env var before prod.
- **Pipeline integration complete:** transcript → tasks, full pipeline run, and simulation-only run all work end-to-end via async background jobs with WebSocket progress streaming
- **Public landing page** at `/` with gold full-screen hero, intake form (popup modal + inline), "we'll be in touch" confirmation
- **Client Dashboard** at `/dashboard` — workspace with editable workflow map + tool stack sidebar. Not a wizard.
- **Frontend is fully wired for production:**
  - All pages are dual-mode: project-scoped routes use API data, legacy flat routes use localStorage + mock data
  - WorkflowReport: loading skeletons + error state with retry when fetching from API
  - ToolInputForm: uploads files via multipart/form-data to `/api/projects/{id}/uploads`
  - SimulationResults: real-time job progress via WebSocket (polling fallback)
  - FinalRecommendation: loading spinner while fetching recommendation data from API
- Typed API client (`src/api/client.ts`) defines the complete frontend-backend contract
- Job progress: WebSocket-first with automatic HTTP polling fallback
- Vite dev proxy configured: `/api/*` → `localhost:8000`, `/ws/*` → WebSocket
- No tests — `classifier.py` and `parser_scraper.py` are stubs

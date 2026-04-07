# AgileOps — System Design

> **North Star Document.** This file maps the complete frontend↔backend contract, tracks
> implementation status for every endpoint, defines all data models, and documents the
> end-to-end data flow. Update this file whenever a new endpoint is added, a model changes,
> or a route is wired up.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend → Backend Endpoint Map](#2-frontend--backend-endpoint-map)
3. [Data Models](#3-data-models)
4. [End-to-End Data Flow](#4-end-to-end-data-flow)
5. [Backend Pipeline Scripts](#5-backend-pipeline-scripts)
6. [Service Layer](#6-service-layer)
7. [Frontend Route Map](#7-frontend-route-map)
8. [Real-Time / WebSocket](#8-real-time--websocket)
9. [Environment & Infrastructure](#9-environment--infrastructure)

---

## 1. Architecture Overview

```
Browser (React 18 + Vite)
        │
        │  /api/*  (HTTP JSON + Bearer token)
        │  /ws/*   (WebSocket)
        ▼
  Vite Dev Proxy  ──────────────────────────────────────────►  FastAPI  :8000
  (vite.config.ts)                                             (backend/api/main.py)
                                                                      │
                                              ┌───────────────────────┼──────────────────┐
                                              │                       │                  │
                                        SQLite / Postgres       Pipeline Scripts     File Storage
                                        (backend/data/           (asyncio subprocess   (backend/data/
                                         agileops.db)            via BackgroundTask)    {project_id}/)
                                              │
                                    SQLAlchemy 2.0 async ORM
```

### Key facts

| Concern | Detail |
|---|---|
| Frontend framework | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS — custom palette: Gold `#FFBF00`, Magenta `#E83F6F`, Cerulean `#2274A5`, Sea Green `#32936F` |
| API base URL | `/api` — proxied to `http://localhost:8000` in dev |
| WebSocket base | `/ws` — proxied to `ws://localhost:8000` in dev |
| Backend framework | FastAPI (Python 3.11+) |
| ORM | SQLAlchemy 2.0 async (`aiosqlite` driver) |
| Database (dev) | SQLite at `backend/data/agileops.db` (auto-created on startup) |
| Database (prod) | PostgreSQL via `DATABASE_URL` env var (`asyncpg` driver) |
| CORS origins | `localhost:5173` (Vite dev), `localhost:4173` (Vite preview) |
| Auth | JWT (HS256) via `python-jose`. Tokens issued by `/api/auth/login` or `/api/auth/register`. `SECRET_KEY` is hardcoded to `"dev-secret-key-change-before-prod"` — **must** be set via env var before production. |
| Typed API contract | `frontend/src/api/client.ts` — single source of truth for all request/response shapes |

---

## 2. Frontend → Backend Endpoint Map

Every API call the frontend makes, grouped by the page or hook that initiates it.

> Legend: ✅ Implemented | ❌ Not Built

### Auth

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| Login page | `POST` | `/api/auth/register` | `UserCreate` | `TokenOut` | ✅ |
| Login page | `POST` | `/api/auth/login` | `UserCreate` | `TokenOut` | ✅ |
| Any authenticated page | `GET` | `/api/auth/me` | — | `UserOut` | ✅ |

### Projects (global)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| Consultation (`/get-started`) | `POST` | `/api/projects` | `ProjectCreate` | `Project` | ✅ |
| Any page needing project details | `GET` | `/api/projects/{id}` | — | `Project` | ✅ |
| Any page needing project list | `GET` | `/api/projects` | — | `Project[]` | ✅ |
| Any page needing status update | `PATCH` | `/api/projects/{id}` | `ProjectUpdate` | `Project` | ✅ |
| Admin / cleanup | `DELETE` | `/api/projects/{id}` | — | `void` (204) | ✅ |

### Workflow Profile

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| DataForm / internal workflow | `GET` | `/api/projects/{id}/profile` | — | `WorkflowProfile` | ✅ |
| DataForm / internal workflow | `PUT` | `/api/projects/{id}/profile` | `ProfileCreate` | `WorkflowProfile` | ✅ |

### TranscriptInput (`/projects/:projectId/transcripts`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| TranscriptInput | `GET` | `/api/projects/{id}/transcripts` | — | `Transcript[]` | ✅ |
| TranscriptInput | `GET` | `/api/projects/{id}/transcripts/{transcriptId}` | — | `Transcript` | ✅ |
| TranscriptInput | `POST` | `/api/projects/{id}/transcripts` | `TranscriptCreate` | `TranscriptSubmitResult` | ✅ |
| TranscriptInput — task preview | `GET` | `/api/projects/{id}/tasks` | — | `TaskNode[]` | ✅ |
| TranscriptInput — reset button | `POST` | `/api/projects/{id}/tasks/reset` | — | `void` (204) | ✅ |
| TranscriptInput — run pipeline btn | `POST` | `/api/projects/{id}/pipeline/run` | — | `{ job_id: string }` | ✅ |
| `useJobProgress` hook | `GET` | `/api/jobs/{jobId}` | — | `Job` | ✅ |
| `useJobProgress` hook | `WS` | `/ws/jobs/{jobId}` | — | `WsMessage` stream | ✅ |

### WorkflowReport (`/projects/:projectId/workflow-report`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| `loadMarkovData` / `useMarkovData` | `GET` | `/api/projects/{id}/markov` | — | `TransitionMatrixJSON` | ✅ |

*Fallback: when no `projectId` is present, the hook fetches the static file at `/public/data/transition_matrix.json` instead.*

### ToolInputForm (`/projects/:projectId/tool-input`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| ToolInputForm — create eval | `POST` | `/api/projects/{id}/tools` | `ToolEvaluationCreate` | `ToolEvaluation` | ✅ |
| ToolInputForm — file upload | `POST` | `/api/projects/{id}/uploads` | `multipart/form-data` (file, file_type, tool_evaluation_id?) | `UploadedFile` | ✅ |
| ToolInputForm — list uploads | `GET` | `/api/projects/{id}/uploads` | — | `UploadedFile[]` | ✅ |
| ToolInputForm — delete upload | `DELETE` | `/api/projects/{id}/uploads/{fileId}` | — | `void` (204) | ✅ |
| ToolInputForm — run simulation | `POST` | `/api/projects/{id}/pipeline/simulate` | `SimulateRequest` | `{ job_id: string }` | ✅ |

### SimulationResults (`/projects/:projectId/simulation/:toolEvalId`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| SimulationResults — tool name | `GET` | `/api/projects/{id}/tools/{evalId}` | — | `ToolEvaluation` | ✅ |
| SimulationResults — results | `GET` | `/api/projects/{id}/simulation/{evalId}` | — | `SimulationData` | ✅ |
| `useJobProgress` hook | `GET` | `/api/jobs/{jobId}` | — | `Job` | ✅ |
| `useJobProgress` hook | `WS` | `/ws/jobs/{jobId}` | — | `WsMessage` stream | ✅ |

### FinalRecommendation (`/projects/:projectId/recommendation/:toolEvalId`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| FinalRecommendation | `GET` | `/api/projects/{id}/recommendation/{evalId}` | — | `RecommendationData` | ✅ |

### Tool Evaluations (shared)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| Any page needing eval list | `GET` | `/api/projects/{id}/tools` | — | `ToolEvaluation[]` | ✅ |

---

## 3. Data Models

### 3a. SQLAlchemy DB Models (`backend/api/models/db.py`)

All models are live — tables are auto-created on startup via `Base.metadata.create_all`.

#### `User` table: `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `email` | `Text` | NOT NULL, UNIQUE, indexed | |
| `hashed_password` | `Text` | NOT NULL | bcrypt via passlib |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

Relationships: one-to-many `Project`

---

#### `Project` table: `projects`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `owner_id` | `String(36)` | FK → `users.id` (CASCADE), nullable, indexed | Optional owner link |
| `company_name` | `Text` | NOT NULL | |
| `team_name` | `Text` | NOT NULL | |
| `primary_role` | `Text` | NOT NULL | e.g. "Account Executive" |
| `team_size` | `Integer` | nullable | |
| `notes` | `Text` | nullable | Free text from intake |
| `status` | `String(20)` | NOT NULL, default `"draft"` | `draft | active | archived` |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |
| `updated_at` | `DateTime(tz)` | NOT NULL, auto-update | UTC |

Relationships: `owner` (User), `profile` (WorkflowProfile 1:1), `transcripts`, `jobs`, `tool_evaluations`, `uploads` — all cascade delete.

---

#### `WorkflowProfile` table: `workflow_profiles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `project_id` | `String(36)` | FK → `projects.id`, UNIQUE, NOT NULL | One profile per project |
| `role` | `Text` | NOT NULL | |
| `selected_responsibilities` | `JSON` | NOT NULL, default `[]` | `string[]` |
| `tools` | `Text` | nullable | Comma-separated or free text |
| `description` | `Text` | nullable | |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

---

#### `Transcript` table: `transcripts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `project_id` | `String(36)` | FK → `projects.id` (CASCADE), indexed | |
| `interviewee_name` | `Text` | NOT NULL | |
| `interviewee_role` | `Text` | NOT NULL | |
| `interview_date` | `String(10)` | NOT NULL | ISO date `"YYYY-MM-DD"` |
| `raw_text` | `Text` | NOT NULL | Full pasted transcript |
| `tasks_extracted` | `Integer` | nullable | Set after parse job completes |
| `tasks_updated` | `Integer` | nullable | Set after parse job completes |
| `processed_at` | `DateTime(tz)` | nullable | Set after parse job completes |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

Raw transcript text is also saved to disk at `backend/data/{project_id}/transcripts/{transcript_id}.txt` for the script to read.

---

#### `Job` table: `jobs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `project_id` | `String(36)` | FK → `projects.id` (CASCADE), indexed | |
| `job_type` | `Enum(JobType)` | NOT NULL | `transcript_parse | pipeline_run | simulation` |
| `status` | `Enum(JobStatus)` | NOT NULL, default `pending` | `pending | running | completed | failed` |
| `progress_pct` | `Integer` | NOT NULL, default `0` | 0–100 |
| `current_step` | `Text` | nullable | Human-readable step label |
| `error_message` | `Text` | nullable | Set on failure |
| `result_data` | `JSON` | nullable | Summary dict stored on completion |
| `started_at` | `DateTime(tz)` | nullable | |
| `completed_at` | `DateTime(tz)` | nullable | |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

---

#### `ToolEvaluation` table: `tool_evaluations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `project_id` | `String(36)` | FK → `projects.id` (CASCADE), indexed | |
| `use_case` | `String(50)` | NOT NULL | e.g. `"adoption"`, `"compare"` |
| `tool_name` | `Text` | NOT NULL | e.g. `"Gong"`, `"Outreach"` |
| `website_url` | `Text` | nullable | |
| `docs_url` | `Text` | nullable | Optional docs URL for scraper |
| `status` | `String(20)` | NOT NULL, default `"pending"` | `pending | running | completed | failed` |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

Relationships: `uploads` (UploadedFile), `simulation_result` (SimulationResult 1:1, cascade delete).

---

#### `UploadedFile` table: `uploaded_files`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `project_id` | `String(36)` | FK → `projects.id` (CASCADE), indexed | |
| `tool_evaluation_id` | `String(36)` | FK → `tool_evaluations.id` (SET NULL), indexed, nullable | |
| `file_type` | `String(50)` | NOT NULL | `"product_docs" | "api_docs" | "case_study"` |
| `original_name` | `Text` | NOT NULL | Filename as uploaded (path-traversal stripped) |
| `storage_path` | `Text` | NOT NULL | Absolute path on disk |
| `size_bytes` | `Integer` | NOT NULL | |
| `uploaded_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

Max upload size: 50 MB (configurable via `UPLOAD_MAX_BYTES` env var). Files saved to `backend/data/{project_id}/uploads/{uuid}_{original_name}`.

---

#### `SimulationResult` table: `simulation_results`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `tool_evaluation_id` | `String(36)` | FK → `tool_evaluations.id` (CASCADE), UNIQUE | One result per tool eval (upserted on re-run) |
| `results_json` | `JSON` | NOT NULL | Full monte carlo output from `sim.py` |
| `final_work_saved_pct` | `Float` | NOT NULL | Derived from `results_json.summary.work_saved_pct_p50` |
| `final_throughput_lift_pct` | `Float` | NOT NULL | Derived from `results_json.summary.throughput_lift_pct_p50` |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |

### 3b. Pydantic Schemas (`backend/api/schemas/api.py`)

Key request/response schemas (all use `model_config = {"from_attributes": True}`):

| Schema | Direction | Notes |
|---|---|---|
| `UserCreate` | Request | `email`, `password` |
| `UserOut` | Response | `id`, `email`, `created_at` |
| `TokenOut` | Response | `access_token`, `token_type` |
| `ProjectCreate` / `ProjectUpdate` / `ProjectOut` | Request / Request / Response | |
| `ProfileCreate` / `ProfileOut` | Request / Response | |
| `TranscriptCreate` / `TranscriptOut` | Request / Response | |
| `TranscriptSubmitResult` | Response | `{ transcript: TranscriptOut, job_id: str }` |
| `JobOut` | Response | Includes `result_data: dict | null` |
| `ToolEvaluationCreate` / `ToolEvaluationOut` | Request / Response | Includes `docs_url` |
| `UploadedFileOut` | Response | |
| `TaskNodeOut` | Response | Includes `DurationDistribution` sub-schema |
| `SimulationDataOut` | Response | |
| `RecommendationOut` | Response | Includes `EmployeeImpact`, `CompanyImpact`, `UseCase` sub-schemas |

---

## 4. End-to-End Data Flow

### Flow A — Interview → Tasks (internal ops team)

```
1. Ops team navigates to /projects/:projectId/transcripts
   └─ GET /api/projects/:id  →  load project details

2. Paste transcript into form (name, role, date, raw text)
   └─ POST /api/projects/:id/transcripts
      Body: TranscriptCreate
      Response: { transcript: Transcript, job_id: string }
      Side effects:
        - Persists Transcript row in DB
        - Writes raw text to backend/data/{project_id}/transcripts/{transcript_id}.txt
        - Creates Job row (status: pending)
        - Dispatches run_transcript_job() as BackgroundTask

3. Frontend subscribes to job progress
   └─ WS  /ws/jobs/:jobId       (primary transport)
   └─ GET /api/jobs/:jobId      (polling fallback, every 2s)
      Server runs: transcript_to_tasks.py --transcript <path> --tasks <path>
      Merges result into all_tasks.json for this project
      Progress: 10% → 30% → 80% → 100%
      On completion: updates Transcript.tasks_extracted / processed_at

4. Repeat for each interviewee — all runs merge into the same all_tasks.json

5. Preview task graph
   └─ GET /api/projects/:id/tasks  →  TaskNode[]
      Reads backend/data/{project_id}/all_tasks.json, returns []  if not yet generated

6. (Optional) Reset task graph
   └─ POST /api/projects/:id/tasks/reset  →  204
      Deletes all_tasks.json for the project
```

---

### Flow B — Run Full Pipeline (after transcripts collected)

```
7. Click "Run Full Pipeline"
   └─ POST /api/projects/:id/pipeline/run
      Response: { job_id: string }
      Dispatches run_pipeline_job() as BackgroundTask
      Server runs sequentially:
        syth_data_gen.py   (10%) → telemetry.json
        markov_builder.py  (40%) → transition_matrix.json
        sim.py             (70%) → monte_carlo_results.json

8. On completion, navigate to /projects/:id/workflow-report
   └─ GET /api/projects/:id/markov  →  TransitionMatrixJSON
      Reads backend/data/{project_id}/transition_matrix.json
      Rendered as interactive ReactFlow diagram
```

---

### Flow C — Tool Evaluation → Simulation → Recommendation

```
9. Navigate to /projects/:id/tool-input
   └─ POST /api/projects/:id/tools
      Body: ToolEvaluationCreate { use_case, tool_name, website_url?, docs_url? }
      Response: ToolEvaluation

10. (Optional) Upload supporting files (product docs, API docs, case studies)
    └─ POST /api/projects/:id/uploads  (multipart/form-data)
       Fields: file (binary), file_type, tool_evaluation_id?
       Max size: 50 MB
       Saved to: backend/data/{project_id}/uploads/{uuid}_{name}
       Response: UploadedFile

11. Click "Run Simulation"
    └─ POST /api/projects/:id/pipeline/simulate
       Body: SimulateRequest { tool_evaluation_id, adoption_rate?, learning_rate?,
                               n_simulations?, n_weeks?, pipeline_depth? }
       Response: { job_id: string }
       Dispatches run_simulation_job() as BackgroundTask
       Server runs: sim.py --telemetry_path ... --output_path ... [optional flags]
       On completion: upserts SimulationResult row in DB

12. Navigate to /projects/:id/simulation/:toolEvalId
    └─ GET /api/projects/:id/tools/:evalId   →  ToolEvaluation (tool name for display)
    └─ GET /api/projects/:id/simulation/:evalId  →  SimulationData
       Priority: DB SimulationResult → fallback to monte_carlo_results.json on disk

13. Navigate to /projects/:id/recommendation/:toolEvalId
    └─ GET /api/projects/:id/recommendation/:evalId  →  RecommendationData
       Requires SimulationResult to exist (run simulation first)
       Derived by recommendation_service.derive(tool_eval, sim_result)
```

---

## 5. Backend Pipeline Scripts

All scripts are standalone Python scripts. The API layer invokes them as async subprocesses
via `asyncio.create_subprocess_exec` inside `BackgroundTask` handlers. Progress is tracked
by emitting predefined percentage steps between subprocess calls; stdout is not parsed.

| Script | Input Files | Output File | Purpose | Status |
|---|---|---|---|---|
| `transcript_to_tasks.py` | `--transcript <path>`, `--tasks <path>` (all_tasks.json) | `all_tasks.json` (merged) | Calls Claude API to extract workflow tasks from interview transcript. Semantically merges into existing task graph without dropping nodes. Tracks `sources` per node. | Functional |
| `syth_data_gen.py` | `--tasks_path`, `--output_dir` | `telemetry.json` | Generates synthetic telemetry for 6 employees across a 15-node sales pipeline. | Functional |
| `markov_builder.py` | `--telemetry_path`, `--output_path` | `transition_matrix.json` | Parses telemetry, computes transition probabilities and dwell-time distributions. | Functional |
| `sim.py` | `--telemetry_path` (transition matrix), `--output_path`, optional sim flags | `monte_carlo_results.json` | Runs 2,000 Monte Carlo deal simulations over 12 weeks. Accepts `--adoption_rate`, `--learning_rate`, `--n_simulations`, `--n_weeks`, `--pipeline_depth`. | Functional |
| `classifier.py` | — | — | Stub — not yet implemented | Stub |
| `parser_scraper.py` | — | — | Stub — not yet implemented | Stub |

---

## 6. Service Layer

`backend/api/services/` — shared logic consumed by multiple route handlers.

| Module | Purpose |
|---|---|
| `data_io.py` | Project-scoped file I/O. Centralises path construction for `backend/data/{project_id}/` subdirectories (transcripts, uploads, pipeline JSON). All routes use this instead of building paths inline. |
| `job_runner.py` | Async background job execution. `create_job()` inserts a pending Job row (called in route handler, before response). `run_transcript_job()`, `run_pipeline_job()`, `run_simulation_job()` are dispatched as `BackgroundTask`s and open their own DB sessions. Each emits progress/completed/failed events via `ws_manager`. |
| `ws_manager.py` | In-process WebSocket connection registry. `connect()` / `disconnect()` / `broadcast()` / `close_all()`. All connections for a given `job_id` are tracked in a dict; `broadcast()` sends to all. |
| `recommendation.py` | `derive(tool_eval, sim_result) → RecommendationOut`. Derives recommendation metrics from a `SimulationResult`. Applies business logic to compute confidence score, employee/company impact ranges, and use-case descriptions. |

---

## 7. Frontend Route Map

| Route | Component | Audience | Data Source | API Endpoints Called |
|---|---|---|---|---|
| `/` | `LandingPage` | Public | Static | None |
| `/get-started` | `Consultation` | Public → client | localStorage | None (saves to localStorage on submit) |
| `/login` | `Login` | Client | Static (UI only) | `auth.login`, `auth.register` |
| `/dashboard` | `Dashboard` | Client | Mock data + ReactFlow | None (mock data) |
| `/simulation` | `SimulationResults` | Client | localStorage (`axisToolInput`) | `toolEvals.get`, `simulation.get` (optional) |
| `/recommendation` | `FinalRecommendation` | Client | localStorage | `recommendation.get` (optional) |
| `/internal` | `InternalDashboard` | Internal | Static | None |
| `/internal/form` | `DataForm` (unused) | Internal | localStorage | None |
| `/internal/workflow-report` | `WorkflowReport` | Internal | Static JSON (`/public/data/transition_matrix.json`) | `loadMarkovData()` → static file |
| `/internal/tool-input` | `ToolInputForm` | Internal | localStorage | None |
| `/projects/:projectId/dashboard` | `Dashboard` | Internal | API | `projects.get` |
| `/projects/:projectId/transcripts` | `TranscriptInput` | Internal | API | `projects.get`, `transcripts.list`, `transcripts.submit`, `tasks.get`, `tasks.reset`, `pipeline.run`, `jobs.get` |
| `/projects/:projectId/workflow-report` | `WorkflowReport` | Internal | API | `loadMarkovData(projectId)` → `GET /api/projects/:id/markov` |
| `/projects/:projectId/tool-input` | `ToolInputForm` | Internal | API | `toolEvals.create`, `uploads.upload`, `uploads.list`, `uploads.delete`, `pipeline.simulate` |
| `/projects/:projectId/simulation/:toolEvalId` | `SimulationResults` | Internal | API | `toolEvals.get`, `simulation.get`, `jobs.get` (via `useJobProgress`) |
| `/projects/:projectId/recommendation/:toolEvalId` | `FinalRecommendation` | Internal | API | `recommendation.get` |

### Dual-mode pattern

All pages support two modes:
- **Project-scoped** (`/projects/:projectId/...`): uses the API client for live data
- **Legacy / flat** (`/internal/...`, `/dashboard`, `/simulation`, `/recommendation`): falls back to `localStorage` or static mock data

---

## 8. Real-Time / WebSocket

The frontend uses `useJobProgress` (`frontend/src/hooks/useJobProgress.ts`) to track
long-running pipeline jobs. It implements a **WebSocket-first, HTTP-polling fallback** strategy.

### Connection lifecycle

```
jobId provided
      │
      ▼
GET /api/jobs/{jobId}  ──►  initial state snapshot
      │
      ├─ status = completed/failed  →  render result, stop
      │
      └─ status = pending/running
             │
             ▼
      Try: WS /ws/jobs/{jobId}
             │
        ┌────┴────┐
        │         │
      WS OK    WS fails / disconnects
        │         │
        ▼         ▼
  Real-time   Poll GET /api/jobs/{jobId}
  messages    every 2 seconds
        │         │
        └────┬────┘
             ▼
      Render progress bar + current_step
             │
      type: "completed" or "failed"
             │
             ▼
      Stop WS / stop polling
      Render final state
```

### Late-join catch-up

On WebSocket connect, the server immediately sends the current job state so clients that
connect after a job has already progressed don't wait for the next broadcast.

### WebSocket message protocol

```typescript
// Progress update
{ "type": "progress", "pct": 45, "step": "Building Markov matrix..." }

// Job finished
{ "type": "completed", "summary": { ...optional result metadata } }

// Job failed
{ "type": "failed", "error": "Claude API rate limit exceeded" }
```

---

## 9. Environment & Infrastructure

### Environment variables

| Variable | Default (dev) | Required in Prod | Notes |
|---|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///backend/data/agileops.db` | Yes | Set to `postgresql+asyncpg://user:pass@host/agileops` |
| `ANTHROPIC_API_KEY` | — | Yes | Required by `transcript_to_tasks.py` |
| `SECRET_KEY` | `"dev-secret-key-change-before-prod"` | **Yes — change this** | JWT signing key (HS256). Hardcoded in `deps.py` for dev — **must** be overridden in prod. |
| `CORS_ORIGINS` | `localhost:5173`, `localhost:4173` | Yes | Set to production domain(s) |
| `DATA_DIR` | `backend/data` | No | Override to store pipeline files elsewhere |
| `UPLOAD_MAX_BYTES` | `52428800` (50 MB) | No | Max file upload size |

### Dev startup

```bash
# Backend
./setup.sh                  # one-time: creates .venv, installs deps
PYTHONPATH=. .venv/bin/uvicorn backend.api.main:app --port 8000 --reload

# Frontend (separate terminal)
cd frontend && npm run dev   # Vite on :5173, proxies /api → :8000
```

### File layout (backend data directory)

```
backend/data/
├── agileops.db                              ← SQLite database (git-ignored)
└── {project_id}/                            ← Per-project data directory (auto-created)
    ├── all_tasks.json                        ← Task graph (output of transcript_to_tasks.py)
    ├── telemetry.json                        ← Synthetic telemetry (output of syth_data_gen.py)
    ├── transition_matrix.json               ← Markov matrix (output of markov_builder.py)
    ├── monte_carlo_results.json             ← Simulation output (output of sim.py)
    ├── transcripts/
    │   └── {transcript_id}.txt              ← Raw transcript text (saved on POST /transcripts)
    └── uploads/
        └── {uuid}_{original_name}           ← Uploaded files (saved on POST /uploads)
```

### Router registration (`backend/api/main.py`)

All routers are registered. HTTP routes use the `/api` prefix; the WebSocket router
is registered at root (so the path `/ws/jobs/{id}` is not double-prefixed).

```python
# HTTP
app.include_router(auth.router,           prefix="/api")  # ✅
app.include_router(projects.router,       prefix="/api")  # ✅
app.include_router(profiles.router,       prefix="/api")  # ✅
app.include_router(transcripts.router,    prefix="/api")  # ✅
app.include_router(tasks.router,          prefix="/api")  # ✅
app.include_router(tools.router,          prefix="/api")  # ✅
app.include_router(uploads.router,        prefix="/api")  # ✅
app.include_router(pipeline.router,       prefix="/api")  # ✅
app.include_router(simulation.router,     prefix="/api")  # ✅
app.include_router(recommendation.router, prefix="/api")  # ✅
app.include_router(markov.router,         prefix="/api")  # ✅
app.include_router(jobs.http_router,      prefix="/api")  # ✅

# WebSocket (no /api prefix)
app.include_router(jobs.ws_router)                        # ✅  /ws/jobs/{job_id}
```

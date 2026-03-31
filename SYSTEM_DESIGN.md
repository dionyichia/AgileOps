# AgileOps — System Design

> **North Star Document.** This file maps the complete frontend↔backend contract, tracks
> implementation status for every endpoint, defines all data models, and documents the
> end-to-end data flow. Update this file whenever a new endpoint is added, a model changes,
> or a route is wired up.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend → Backend Endpoint Map](#2-frontend--backend-endpoint-map)
3. [Gap Analysis — Unimplemented Endpoints](#3-gap-analysis--unimplemented-endpoints)
4. [Data Models](#4-data-models)
5. [End-to-End Data Flow](#5-end-to-end-data-flow)
6. [Backend Pipeline Scripts](#6-backend-pipeline-scripts)
7. [Frontend Route Map](#7-frontend-route-map)
8. [Real-Time / WebSocket](#8-real-time--websocket)
9. [Environment & Infrastructure](#9-environment--infrastructure)

---

## 1. Architecture Overview

```
Browser (React 18 + Vite)
        │
        │  /api/*  (HTTP JSON)
        │  /ws/*   (WebSocket)
        ▼
  Vite Dev Proxy  ──────────────────────────────────────────►  FastAPI  :8000
  (vite.config.ts)                                             (backend/api/main.py)
                                                                      │
                                              ┌───────────────────────┼──────────────────┐
                                              │                       │                  │
                                        SQLite / Postgres       Pipeline Scripts     File Storage
                                        (backend/data/           (subprocess or        (local disk,
                                         agileops.db)            async job queue)      future S3)
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
| Auth | **None yet** — no authentication layer implemented |
| Typed API contract | `frontend/src/api/client.ts` — single source of truth for all request/response shapes |

---

## 2. Frontend → Backend Endpoint Map

Every API call the frontend makes, grouped by the page or hook that initiates it.
The `Status` column reflects current backend implementation state.

> Legend: ✅ Implemented | ❌ Not Built

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
| TranscriptInput | `GET` | `/api/projects/{id}/transcripts` | — | `Transcript[]` | ❌ |
| TranscriptInput | `GET` | `/api/projects/{id}/transcripts/{transcriptId}` | — | `Transcript` | ❌ |
| TranscriptInput | `POST` | `/api/projects/{id}/transcripts` | `TranscriptCreate` | `TranscriptSubmitResult` | ❌ |
| TranscriptInput — task preview | `GET` | `/api/projects/{id}/tasks` | — | `TaskNode[]` | ❌ |
| TranscriptInput — reset button | `POST` | `/api/projects/{id}/tasks/reset` | — | `void` (204) | ❌ |
| TranscriptInput — run pipeline btn | `POST` | `/api/projects/{id}/pipeline/run` | — | `{ job_id: string }` | ❌ |
| `useJobProgress` hook | `GET` | `/api/jobs/{jobId}` | — | `Job` | ❌ |
| `useJobProgress` hook | `WS` | `/ws/jobs/{jobId}` | — | `WsMessage` stream | ❌ |

### WorkflowReport (`/projects/:projectId/workflow-report`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| `loadMarkovData` / `useMarkovData` | `GET` | `/api/projects/{id}/markov` | — | `TransitionMatrixJSON` | ❌ |

*Fallback: when no `projectId` is present, the hook fetches the static file at `/public/data/transition_matrix.json` instead.*

### ToolInputForm (`/projects/:projectId/tool-input`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| ToolInputForm — create eval | `POST` | `/api/projects/{id}/tools` | `ToolEvaluationCreate` | `ToolEvaluation` | ❌ |
| ToolInputForm — file upload | `POST` | `/api/projects/{id}/uploads` | `multipart/form-data` (file, file_type, tool_evaluation_id?) | `UploadedFile` | ❌ |
| ToolInputForm — list uploads | `GET` | `/api/projects/{id}/uploads` | — | `UploadedFile[]` | ❌ |
| ToolInputForm — delete upload | `DELETE` | `/api/projects/{id}/uploads/{fileId}` | — | `void` (204) | ❌ |
| ToolInputForm — run simulation | `POST` | `/api/projects/{id}/pipeline/simulate` | `{ tool_evaluation_id: string }` | `{ job_id: string }` | ❌ |

### SimulationResults (`/projects/:projectId/simulation/:toolEvalId`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| SimulationResults — tool name | `GET` | `/api/projects/{id}/tools/{evalId}` | — | `ToolEvaluation` | ❌ |
| SimulationResults — results | `GET` | `/api/projects/{id}/simulation/{evalId}` | — | `SimulationData` | ❌ |
| `useJobProgress` hook | `GET` | `/api/jobs/{jobId}` | — | `Job` | ❌ |
| `useJobProgress` hook | `WS` | `/ws/jobs/{jobId}` | — | `WsMessage` stream | ❌ |

### FinalRecommendation (`/projects/:projectId/recommendation/:toolEvalId`)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| FinalRecommendation | `GET` | `/api/projects/{id}/recommendation/{evalId}` | — | `RecommendationData` | ❌ |

### Tool Evaluations (shared)

| Page / Hook | Method | Path | Request Body | Response Type | Status |
|---|---|---|---|---|---|
| Any page needing eval list | `GET` | `/api/projects/{id}/tools` | — | `ToolEvaluation[]` | ❌ |

---

## 3. Gap Analysis — Unimplemented Endpoints

**7 of 28 endpoints are implemented. 21 remain to be built.**

The table below is the backend team's build checklist. Each row includes the TypeScript
response type from `frontend/src/api/client.ts` — this is the contract the backend must match.

### Router: Transcripts → `backend/api/routes/transcripts.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/projects/{id}/transcripts` | — | `Transcript[]` | List all transcripts for a project, ordered by `created_at` desc |
| 2 | `GET` | `/api/projects/{id}/transcripts/{transcriptId}` | — | `Transcript` | Fetch single transcript by ID |
| 3 | `POST` | `/api/projects/{id}/transcripts` | `TranscriptCreate` | `TranscriptSubmitResult` | Save transcript to DB, kick off async parse job via `transcript_to_tasks.py`, return `{ transcript, job_id }` |

**`TranscriptCreate` body:**
```json
{
  "interviewee_name": "string",
  "interviewee_role": "string",
  "interview_date": "YYYY-MM-DD",
  "raw_text": "string"
}
```

**`TranscriptSubmitResult` response:**
```json
{
  "transcript": { ...Transcript },
  "job_id": "uuid"
}
```

**`Transcript` shape:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "interviewee_name": "string",
  "interviewee_role": "string",
  "interview_date": "YYYY-MM-DD",
  "raw_text": "string",
  "tasks_extracted": 12,
  "tasks_updated": 3,
  "processed_at": "ISO datetime or null",
  "created_at": "ISO datetime"
}
```

---

### Router: Tasks → `backend/api/routes/tasks.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 4 | `GET` | `/api/projects/{id}/tasks` | — | `TaskNode[]` | Read `all_tasks.json` for the project, return as array |
| 5 | `POST` | `/api/projects/{id}/tasks/reset` | — | `void` (204) | Clear `all_tasks.json` for the project back to `[]` |

**`TaskNode` shape:**
```json
{
  "node_id": "prospect_research",
  "label": "Prospect Research",
  "description": "string",
  "action_verb": "research",
  "inputs": ["string"],
  "outputs": ["string"],
  "app_cluster": ["salesforce", "linkedin"],
  "duration_distribution": {
    "type": "lognormal",
    "mean_minutes": 45,
    "std_minutes": 15
  },
  "automatable_fraction": "high",
  "sources": ["transcript_001.txt"]
}
```

---

### Router: Pipeline → `backend/api/routes/pipeline.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 6 | `POST` | `/api/projects/{id}/pipeline/run` | — | `{ job_id: string }` | Run full pipeline: `syth_data_gen.py` → `markov_builder.py` → `sim.py`. Creates a Job record, runs async, streams progress via WebSocket |
| 7 | `POST` | `/api/projects/{id}/pipeline/simulate` | `{ tool_evaluation_id: string }` | `{ job_id: string }` | Run simulation only (`sim.py`) for a specific tool eval. Creates a Job record, runs async |

---

### Router: Tool Evaluations → `backend/api/routes/tools.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 8 | `GET` | `/api/projects/{id}/tools` | — | `ToolEvaluation[]` | List all tool evaluations for a project |
| 9 | `GET` | `/api/projects/{id}/tools/{evalId}` | — | `ToolEvaluation` | Fetch single tool evaluation |
| 10 | `POST` | `/api/projects/{id}/tools` | `ToolEvaluationCreate` | `ToolEvaluation` | Create new tool evaluation record |

**`ToolEvaluationCreate` body:**
```json
{
  "use_case": "string",
  "tool_name": "string",
  "website_url": "https://... (optional)"
}
```

**`ToolEvaluation` shape:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "use_case": "string",
  "tool_name": "string",
  "website_url": "string or null",
  "created_at": "ISO datetime"
}
```

---

### Router: Simulation Results → `backend/api/routes/simulation.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 11 | `GET` | `/api/projects/{id}/simulation/{evalId}` | — | `SimulationData` | Return the Monte Carlo results for a given tool evaluation. Read from `monte_carlo_results.json` or DB |

**`SimulationData` shape:**
```json
{
  "results_json": { ...raw monte carlo output },
  "tool_name": "string",
  "n_simulations": 2000,
  "n_weeks": 12,
  "final_work_saved_pct": 18.4,
  "final_throughput_lift_pct": 12.1
}
```

---

### Router: Recommendations → `backend/api/routes/recommendations.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 12 | `GET` | `/api/projects/{id}/recommendation/{evalId}` | — | `RecommendationData` | Derive recommendation from simulation output. May call Claude to generate summary |

**`RecommendationData` shape:**
```json
{
  "tool_name": "string",
  "confidence_score": 0.87,
  "summary": "string",
  "employee_impact": {
    "time_saved": { "p10": 4.2, "p70": 8.1 },
    "velocity_gain": { "p10": 0.11, "p70": 0.23 },
    "learning_weeks": "3-5 weeks"
  },
  "company_impact": {
    "throughput": { "p10": 0.08, "p70": 0.18 },
    "revenue_impact": { "p10": 42000, "p70": 98000 },
    "tool_cost": 12000
  },
  "use_cases": [
    { "title": "string", "description": "string" }
  ]
}
```

---

### Router: Uploads → `backend/api/routes/uploads.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 13 | `POST` | `/api/projects/{id}/uploads` | `multipart/form-data`: `file` (binary), `file_type` (string), `tool_evaluation_id?` (string) | `UploadedFile` | Save file to disk (or S3). Record metadata in DB |
| 14 | `GET` | `/api/projects/{id}/uploads` | — | `UploadedFile[]` | List all uploaded files for a project |
| 15 | `DELETE` | `/api/projects/{id}/uploads/{fileId}` | — | `void` (204) | Delete file from storage and DB |

**`UploadedFile` shape:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "file_type": "proposal | contract | other",
  "original_name": "proposal_v2.pdf",
  "storage_path": "uploads/project-uuid/filename.pdf",
  "size_bytes": 204800,
  "uploaded_at": "ISO datetime"
}
```

---

### Router: Jobs → `backend/api/routes/jobs.py` (new file)

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 16 | `GET` | `/api/jobs/{jobId}` | — | `Job` | Poll job status. Used as HTTP fallback when WebSocket is unavailable |

**`Job` shape:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "job_type": "transcript_parse | pipeline_run | simulate",
  "status": "pending | running | completed | failed",
  "progress_pct": 72,
  "current_step": "Running Monte Carlo simulation...",
  "error_message": null,
  "started_at": "ISO datetime or null",
  "completed_at": "ISO datetime or null",
  "created_at": "ISO datetime"
}
```

---

### WebSocket: Job Progress → `backend/api/ws/jobs.py` (new file)

| # | Protocol | Path | Server → Client Messages | Notes |
|---|---|---|---|---|
| 17 | `WS` | `/ws/jobs/{jobId}` | `WsMessage` stream | Real-time progress. Frontend tries this first; falls back to polling `GET /api/jobs/{jobId}` every 2s if WS fails |

**`WsMessage` shapes the server must emit:**
```json
{ "type": "progress", "pct": 45, "step": "Building Markov matrix..." }
{ "type": "completed", "summary": { ...optional result metadata } }
{ "type": "failed", "error": "string" }
```

---

### Endpoint: Markov Data → add to `backend/api/routes/projects.py` or new `markov.py`

| # | Method | Path | Request Body | Response Type | Notes |
|---|---|---|---|---|---|
| 18 | `GET` | `/api/projects/{id}/markov` | — | `TransitionMatrixJSON` | Read `transition_matrix.json` for the project and return as JSON. Used by `WorkflowReport` via `loadMarkovData(projectId)` |

**`TransitionMatrixJSON` shape** (matches `backend/data/transition_matrix.json` output):
```json
{
  "metadata": {
    "n_sequences": 120,
    "n_states": 15,
    "n_transitions_observed": 480,
    "states": ["prospect-research", "draft-outreach", "..."]
  },
  "edge_list": [
    { "source": "string", "target": "string", "probability": 0.72, "count": 86, "time_stats": {...} }
  ],
  "node_durations": { "prospect-research": [45, 32, 61, ...] },
  "transition_dwell": { "prospect-research,draft-outreach": [120, 95, ...] },
  "top_transitions": [...]
}
```

---

## 4. Data Models

### 4a. Implemented — SQLAlchemy DB Models (`backend/api/models/db.py`)

#### `Project` table: `projects`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String(36)` | PK, default `uuid4()` | UUID string |
| `company_name` | `Text` | NOT NULL | |
| `team_name` | `Text` | NOT NULL | |
| `primary_role` | `Text` | NOT NULL | e.g. "Account Executive" |
| `team_size` | `Integer` | nullable | |
| `notes` | `Text` | nullable | Free text from intake |
| `status` | `String(20)` | NOT NULL, default `"draft"` | `draft | active | archived` |
| `created_at` | `DateTime(tz)` | NOT NULL, auto | UTC |
| `updated_at` | `DateTime(tz)` | NOT NULL, auto-update | UTC |

Relationships: one-to-one `WorkflowProfile` (cascade delete)

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

### 4b. Planned — DB Tables to Build

These TypeScript types in `client.ts` each need a corresponding DB table, SQLAlchemy model, and Pydantic schema.

#### `Transcript` → table: `transcripts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | FK → `projects.id` | |
| `interviewee_name` | Text | |
| `interviewee_role` | Text | |
| `interview_date` | Date | |
| `raw_text` | Text | Full pasted transcript |
| `tasks_extracted` | Integer | nullable — filled after parse |
| `tasks_updated` | Integer | nullable — filled after parse |
| `processed_at` | DateTime | nullable — filled after parse |
| `created_at` | DateTime | auto |

---

#### `Job` → table: `jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | FK → `projects.id` | |
| `job_type` | String | `transcript_parse`, `pipeline_run`, `simulate` |
| `status` | String | `pending`, `running`, `completed`, `failed` |
| `progress_pct` | Integer | 0–100 |
| `current_step` | Text | nullable — human-readable step label |
| `error_message` | Text | nullable |
| `started_at` | DateTime | nullable |
| `completed_at` | DateTime | nullable |
| `created_at` | DateTime | auto |

---

#### `ToolEvaluation` → table: `tool_evaluations`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | FK → `projects.id` | |
| `use_case` | Text | Free-text description of the use case |
| `tool_name` | Text | e.g. "Gong", "Outreach" |
| `website_url` | Text | nullable |
| `created_at` | DateTime | auto |

---

#### `UploadedFile` → table: `uploaded_files`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | FK → `projects.id` | |
| `tool_evaluation_id` | FK → `tool_evaluations.id` | nullable |
| `file_type` | String | `proposal`, `contract`, `other` |
| `original_name` | Text | Filename as uploaded |
| `storage_path` | Text | Relative path on disk (or S3 key) |
| `size_bytes` | Integer | |
| `uploaded_at` | DateTime | auto |

---

#### `SimulationResult` → table: `simulation_results` (or JSON file per project)

> **Decision needed:** Store as a DB row (large JSON column) or as a file at
> `backend/data/{project_id}/monte_carlo_results.json`. The API endpoint must return
> `SimulationData` regardless of storage strategy.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | FK → `projects.id` | |
| `tool_evaluation_id` | FK → `tool_evaluations.id` | |
| `results_json` | JSON | Full monte carlo output from `sim.py` |
| `tool_name` | Text | Denormalized for quick reads |
| `n_simulations` | Integer | |
| `n_weeks` | Integer | |
| `final_work_saved_pct` | Float | |
| `final_throughput_lift_pct` | Float | |
| `created_at` | DateTime | auto |

---

## 5. End-to-End Data Flow

### Flow A — Interview → Tasks (internal ops team)

```
1. Ops team navigates to /projects/:projectId/transcripts
   └─ GET /api/projects/:id  →  load project details

2. Paste transcript into form (name, role, date, raw text)
   └─ POST /api/projects/:id/transcripts
      Body: TranscriptCreate
      Response: { transcript: Transcript, job_id: string }

3. Frontend subscribes to job progress
   └─ WS  /ws/jobs/:jobId       (primary transport)
   └─ GET /api/jobs/:jobId      (polling fallback, every 2s)
      Server runs: transcript_to_tasks.py --transcript <raw_text>
      Merges result into all_tasks.json for this project
      Emits: { type: "progress", pct: N, step: "..." }
      Emits: { type: "completed" }

4. Repeat for each interviewee — all runs merge into the same all_tasks.json

5. Preview task graph
   └─ GET /api/projects/:id/tasks  →  TaskNode[]
      Rendered as expandable table in modal

6. (Optional) Reset task graph
   └─ POST /api/projects/:id/tasks/reset  →  204
```

---

### Flow B — Run Full Pipeline (after transcripts collected)

```
7. Click "Run Full Pipeline"
   └─ POST /api/projects/:id/pipeline/run
      Response: { job_id: string }
      Server runs sequentially:
        syth_data_gen.py   → telemetry.json
        markov_builder.py  → transition_matrix.json
        sim.py             → monte_carlo_results.json
      Job emits progress events throughout

8. On completion, navigate to /projects/:id/workflow-report
   └─ GET /api/projects/:id/markov  →  TransitionMatrixJSON
      Rendered as interactive ReactFlow diagram
```

---

### Flow C — Tool Evaluation → Simulation → Recommendation

```
9. Navigate to /projects/:id/tool-input
   └─ POST /api/projects/:id/tools
      Body: ToolEvaluationCreate
      Response: ToolEvaluation  (captures tool_name, use_case, website_url)

10. (Optional) Upload supporting files (proposals, contracts)
    └─ POST /api/projects/:id/uploads  (multipart/form-data)
       Response: UploadedFile

11. Click "Run Simulation"
    └─ POST /api/projects/:id/pipeline/simulate
       Body: { tool_evaluation_id: string }
       Response: { job_id: string }
       Server runs sim.py with tool parameters applied
       Writes monte_carlo_results.json for this eval

12. Navigate to /projects/:id/simulation/:toolEvalId
    └─ GET /api/projects/:id/tools/:evalId   →  ToolEvaluation (tool name for display)
    └─ GET /api/projects/:id/simulation/:evalId  →  SimulationData
       Job progress tracked via WS / polling same as above

13. Navigate to /projects/:id/recommendation/:toolEvalId
    └─ GET /api/projects/:id/recommendation/:evalId  →  RecommendationData
       Backend derives from SimulationResult, enriches with Claude-generated summary
```

---

## 6. Backend Pipeline Scripts

All scripts are standalone — they read/write JSON files in `backend/data/`. The API layer
will invoke them as async subprocesses (or via a task queue) and track progress in the
`jobs` table.

| Script | Input Files | Output File | Purpose | Status |
|---|---|---|---|---|
| `transcript_to_tasks.py` | transcript text (stdin/arg), `all_tasks.json` | `all_tasks.json` (merged) | Calls Claude API to extract workflow tasks from interview transcript. Semantically merges into existing task graph without dropping nodes. Tracks `sources` per node. | Functional (CLI only) |
| `syth_data_gen.py` | `config.py` (pipeline node definitions) | `telemetry.json` | Generates synthetic telemetry for 6 employees across a 15-node sales pipeline. Includes realistic interruptions (standups, meetings). | Functional (CLI only) |
| `markov_builder.py` | `telemetry.json` | `transition_matrix.json` | Parses telemetry, groups by (employee_id, deal_id), reconstructs deal sequences, computes transition probabilities and dwell-time distributions. | Functional (CLI only) |
| `sim.py` | `transition_matrix.json` | `monte_carlo_results.json` | Runs 2,000 Monte Carlo deal simulations over 12 weeks. Models tool impact at three levels: node duration reductions, edge dwell-time reductions, topology changes. Uses logistic adoption curves + exponential skill learning. | Functional (CLI only) |
| `classifier.py` | — | — | Stub — not yet implemented | Stub |
| `parser_scraper.py` | — | — | Stub — not yet implemented | Stub |

### Pipeline API integration requirements

When the API exposes `POST /pipeline/run` and `POST /pipeline/simulate`, the backend must:

1. Create a `Job` record in the DB with `status: "pending"`
2. Spawn the script(s) as an async subprocess (or background task via `asyncio`)
3. Parse stdout/stderr for progress markers and update `job.progress_pct` + `job.current_step`
4. Emit WebSocket messages to all clients subscribed to `/ws/jobs/{jobId}`
5. On completion, set `job.status = "completed"` and `job.completed_at`
6. On failure, set `job.status = "failed"` and `job.error_message`

---

## 7. Frontend Route Map

| Route | Component | Audience | Data Source | API Endpoints Called |
|---|---|---|---|---|
| `/` | `LandingPage` | Public | Static | None |
| `/get-started` | `Consultation` | Public → client | localStorage | None (saves to localStorage on submit) |
| `/login` | `Login` | Client | Static (UI only) | None |
| `/dashboard` | `Dashboard` | Client | Mock data + ReactFlow | None (mock data) |
| `/simulation` | `SimulationResults` | Client | localStorage (`axisToolInput`) | `toolEvals.get`, `simulation.get` (optional) |
| `/recommendation` | `FinalRecommendation` | Client | localStorage | `recommendation.get` (optional) |
| `/internal` | `InternalDashboard` | Internal | Static | None |
| `/internal/form` | `DataForm` | Internal | localStorage | None |
| `/internal/workflow-report` | `WorkflowReport` | Internal | Static JSON (`/public/data/transition_matrix.json`) | `loadMarkovData()` → static file |
| `/internal/tool-input` | `ToolInputForm` | Internal | localStorage | None |
| `/projects/:projectId/transcripts` | `TranscriptInput` | Internal | API | `projects.get`, `transcripts.list`, `transcripts.submit`, `tasks.get`, `tasks.reset`, `pipeline.run`, `jobs.get` |
| `/projects/:projectId/workflow-report` | `WorkflowReport` | Internal | API | `loadMarkovData(projectId)` → `GET /api/projects/:id/markov` |
| `/projects/:projectId/tool-input` | `ToolInputForm` | Internal | API | `toolEvals.create`, `uploads.upload`, `uploads.list`, `uploads.delete`, `pipeline.simulate` |
| `/projects/:projectId/simulation/:toolEvalId` | `SimulationResults` | Internal | API | `toolEvals.get`, `simulation.get`, `jobs.get` (via `useJobProgress`) |
| `/projects/:projectId/recommendation/:toolEvalId` | `FinalRecommendation` | Internal | API | `recommendation.get` |

### Dual-mode pattern

All pages support two modes:
- **Project-scoped** (`/projects/:projectId/...`): uses the API client for live data
- **Legacy / flat** (`/internal/...`, `/dashboard`, `/simulation`, `/recommendation`): falls back to `localStorage` or static mock data

This lets the internal team use the full workflow without a backend while development is in progress.

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

### WebSocket message protocol

The server must emit JSON messages over the WebSocket connection:

```typescript
// Progress update
{ "type": "progress", "pct": 45, "step": "Building Markov matrix..." }

// Job finished
{ "type": "completed", "summary": { ...optional metadata } }

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
| `CORS_ORIGINS` | `localhost:5173`, `localhost:4173` | Yes | Set to production domain(s) |

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
├── agileops.db               ← SQLite database (git-ignored)
├── all_tasks.json            ← Task graph (output of transcript_to_tasks.py)
├── telemetry.json            ← Synthetic telemetry (output of syth_data_gen.py)
├── transition_matrix.json    ← Markov matrix (output of markov_builder.py)
└── monte_carlo_results.json  ← Simulation output (output of sim.py)
```

> **Future:** When multi-project support is fully wired, these files should be namespaced
> per project, e.g. `backend/data/{project_id}/transition_matrix.json`.

### Implemented router registration (`backend/api/main.py`)

```python
app.include_router(projects.router, prefix="/api")   # ✅
app.include_router(profiles.router, prefix="/api")   # ✅
# All other routers below are NOT yet registered — add them as they are built:
# app.include_router(transcripts.router, prefix="/api")
# app.include_router(tasks.router,       prefix="/api")
# app.include_router(pipeline.router,    prefix="/api")
# app.include_router(tools.router,       prefix="/api")
# app.include_router(simulation.router,  prefix="/api")
# app.include_router(recommendations.router, prefix="/api")
# app.include_router(uploads.router,     prefix="/api")
# app.include_router(jobs.router,        prefix="/api")
# app.include_router(markov.router,      prefix="/api")
# app.add_api_websocket_route("/ws/jobs/{job_id}", ws_job_progress)
```

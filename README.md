# AgileOps

B2B SaaS sales workflow simulation platform. Interview clients → extract workflow tasks → run Monte Carlo simulation → recommend tools.

---

## Prerequisites

- Python 3.11+
- Node.js 18+

```bash
# Install via Homebrew if missing
brew install python@3.11 node
```

---

## First-Time Setup

```bash
# 1. Backend — create virtualenv and install dependencies
./setup.sh        # automatically finds Python 3.11+ and runs pip install

# Or manually:
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Frontend — install npm packages (must run from the frontend/ subdirectory)
cd frontend && npm install && cd ..

# 3. Environment variables — two separate files (both are gitignored)
```

**Root `.env`** — backend secrets:
```
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
RESEND_API_KEY=...
RESEND_FROM="Axis <you@yourdomain.com>"
SITE_URL=...
```

**`frontend/.env`** — browser-only Supabase config:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

> Supabase credentials are in your project dashboard under **Project Settings → API**.
> Only `VITE_`-prefixed variables are bundled into the browser — never put secret keys there.

---

## Running Locally

### Option A — Automatic (opens two Terminal windows)
```bash
./setup.sh
```

### Option B — Manual (two separate terminals)

**Terminal 1 — Backend API (port 8000)**
```bash
cd /path/to/AgileOps
source .venv/bin/activate
set -a && source .env && set +a
PYTHONPATH=. uvicorn backend.api.main:app --port 8000 --reload
# Swagger UI: http://localhost:8000/docs
```

**Terminal 2 — Frontend dev server (port 5173)**
```bash
cd /path/to/AgileOps/frontend
npm run dev
# App: http://localhost:5173
```

---

## Pipeline Scripts (standalone)

Run these after collecting interview transcripts.

```bash
source .venv/bin/activate
set -a && source .env && set +a

# Stage 0: Extract tasks from an interview transcript
python backend/scripts/transcript_to_tasks.py -t path/to/transcript.txt
# → merges into backend/data/{project_id}/all_tasks.json

# Stage 1: Generate synthetic telemetry
python backend/scripts/syth_data_gen.py

# Stage 2: Build Markov transition matrix
python backend/scripts/markov_builder.py

# Stage 3: Run Monte Carlo simulation
python backend/scripts/sim.py
```

Or trigger the full pipeline via the API: `POST /api/projects/{id}/pipeline/run`

---

## Architecture Overview

```
frontend/          React 18 + TypeScript + Vite + Tailwind
backend/
  api/             FastAPI server (28 endpoints, SQLite dev / Postgres prod)
  scripts/         Pipeline: transcript → tasks → telemetry → Markov → simulation
  data/            Per-project JSON files (all_tasks.json, transition_matrix.json, etc.)
```

### Auth & Login Routes

| URL | Audience | Auth |
|-----|----------|------|
| `/login` | Clients | Supabase — routes admins to `/internal`, clients to their project dashboard |
| `/internal/login` | Staff | Supabase — requires `user_profiles.role = 'admin'` |
| `/internal` | Staff only | `AdminRoute` guard — redirects non-admins to `/login` |

See `CLAUDE.md` for detailed architecture notes and data flow documentation.

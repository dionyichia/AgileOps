# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgileOps is a B2B SaaS sales workflow simulation platform. The real-world pipeline is fully human-driven: intake form → interview call → paste transcript → LLM extracts tasks into `all_tasks.json` → downstream scripts generate synthetic telemetry, build Markov transition matrices, and run Monte Carlo simulations to model tool impact. Results are presented through a React frontend with a guided 5-step UX flow.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite production build
npm run preview    # Preview production build
```

### Backend
```bash
# First-time setup
./setup.sh                              # Creates .venv and installs requirements.txt (numpy, anthropic)

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

### Frontend — Guided 5-Step Workflow

React 18 + TypeScript SPA built with Vite. Uses Tailwind CSS with a custom navy color palette.

**Route flow:** `/` (Dashboard) → `/form` (DataForm) → `/workflow-report` (WorkflowReport) → `/tool-input` (ToolInputForm) → `/simulation` (SimulationResults) → `/recommendation` (FinalRecommendation)

- `StepLayout` wraps each step page with a progress indicator and navigation
- `CustomNodes.tsx` defines ReactFlow node rendering for the pipeline visualization
- Form state persisted to localStorage (key: `axisToolInput`)

**Data loading layer:** `schema.tsx` defines TypeScript types matching the backend's `transition_matrix.json` output. `hooks/dataLoader.ts` fetches the JSON from `/public/data/transition_matrix.json`, transforms it into ReactFlow nodes/edges with topological layout, and caches results in memory. `hooks/pullMarkovData.ts` wraps this in a React hook (`useMarkovData`) with loading/error states and automatic fallback to mock data. The fetch URL is designed to be swapped for a real API endpoint later.

### Current State

- Backend pipeline is functional (synthetic data → Markov → simulation)
- Frontend loads real Markov data from a static JSON copy in `frontend/public/data/`, with mock data fallback
- No tests, no API layer, no database — all data flows through JSON files
- `classifier.py` and `parser_scraper.py` are stubs (empty files)

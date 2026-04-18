#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Project root (resolved early so all paths are absolute)
# ---------------------------------------------------------------------------
ROOT="$(cd "$(dirname "$0")" && pwd)"

VENV_DIR="$ROOT/.venv"
VENV_PY="$VENV_DIR/bin/python"

# ---------------------------------------------------------------------------
# Resolve Python (3.11+ required)
# ---------------------------------------------------------------------------
PYTHON=""

for candidate in python3.13 python3.12 python3.11; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$(command -v "$candidate")"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "Error: Python 3.11+ not found. Install via Homebrew or pyenv." >&2
  exit 1
fi

echo "Using: $($PYTHON --version) at $PYTHON"

# ---------------------------------------------------------------------------
# Create or validate venv
# ---------------------------------------------------------------------------
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment..."
  "$PYTHON" -m venv "$VENV_DIR"
else
  echo "Reusing existing .venv"

  if [ ! -f "$VENV_PY" ]; then
    echo "Broken .venv detected. Recreating..."
    rm -rf "$VENV_DIR"
    "$PYTHON" -m venv "$VENV_DIR"
  fi
fi

# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------
"$VENV_PY" -m pip install --upgrade pip --quiet

if [ -f "$ROOT/requirements.txt" ]; then
  "$VENV_PY" -m pip install -r "$ROOT/requirements.txt" --quiet
fi

echo "Virtual environment ready."
echo "To activate in your shell: source $VENV_DIR/bin/activate"

# ---------------------------------------------------------------------------
# Service runners
# ---------------------------------------------------------------------------
start_backend() {
  echo "Starting backend on http://localhost:8000 ..."
  PYTHONPATH="$ROOT" "$VENV_PY" -m uvicorn backend.api.main:app --port 8000 --reload
}

start_frontend() {
  echo "Starting frontend..."
  cd "$ROOT/frontend" && npm run dev
}

start_both_macos() {
  osascript <<EOF
tell application "Terminal"
  do script "cd '$ROOT' && source '$VENV_DIR/bin/activate' && '$VENV_PY' -m uvicorn backend.api.main:app --port 8000 --reload"
  do script "cd '$ROOT/frontend' && npm run dev"
end tell
EOF
}

# ---------------------------------------------------------------------------
# CLI mode
# ---------------------------------------------------------------------------
run_both() {
  if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Error: 'both' mode opens Terminal windows and requires macOS." >&2
    echo "On Linux, run './setup.sh backend' and './setup.sh frontend' in separate terminals." >&2
    exit 1
  fi
  echo "Opening backend and frontend in separate Terminal windows..."
  start_both_macos
}

case "${1:-both}" in
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  both)
    run_both
    ;;
  *)
    echo "Error: Unknown argument '$1'" >&2
    echo ""
    echo "Usage: ./setup.sh [backend|frontend|both]"
    echo ""
    echo "  backend   Start the FastAPI server (port 8000)"
    echo "  frontend  Start the frontend dev server"
    echo "  both      Open both in separate Terminal windows (macOS only, default)"
    echo "" >&2
    exit 1
    ;;
esac
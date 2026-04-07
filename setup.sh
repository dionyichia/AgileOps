#!/usr/bin/env bash
set -e

# ---------------------------------------------------------------------------
# Setup: create venv with Python 3.11+
# ---------------------------------------------------------------------------
PYTHON=""
for candidate in python3.13 python3.12 python3.11; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON=$(command -v "$candidate")
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "Error: Python 3.11+ not found. Install it via 'brew install python@3.11'." >&2
  exit 1
fi

echo "Using $($PYTHON --version) at $PYTHON"

if [ ! -d ".venv" ]; then
  echo "Creating .venv..."
  "$PYTHON" -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

source .venv/bin/activate

# ---------------------------------------------------------------------------
# Start: backend + frontend in separate terminal tabs (macOS Terminal / iTerm)
# ---------------------------------------------------------------------------
ROOT="$(cd "$(dirname "$0")" && pwd)"

start_backend() {
  PYTHONPATH="$ROOT" "$ROOT/.venv/bin/uvicorn" backend.api.main:app --port 8000 --reload
}

start_frontend() {
  cd "$ROOT/frontend" && npm run dev
}

# If a subcommand is given, run just that service
case "${1:-}" in
  backend)  start_backend; exit 0 ;;
  frontend) start_frontend; exit 0 ;;
esac

# Default: launch both in new Terminal windows
echo "Starting backend on :8000 and frontend on :5173..."

osascript <<EOF
tell application "Terminal"
  do script "cd '$ROOT' && source .venv/bin/activate && bash setup.sh backend"
  do script "cd '$ROOT' && bash setup.sh frontend"
end tell
EOF

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if [[ ! -d "$BACKEND_DIR/venv" ]]; then
  echo "Missing backend virtualenv at $BACKEND_DIR/venv"
  echo "Create it first: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Missing frontend dependencies at $FRONTEND_DIR/node_modules"
  echo "Install first: cd frontend && npm install"
  exit 1
fi

PIDS=()

cleanup() {
  echo
  echo "Shutting down dev servers..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  wait || true
}

trap cleanup EXIT INT TERM

echo "Starting backend on http://$BACKEND_HOST:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  source venv/bin/activate
  uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload
) &
PIDS+=("$!")

echo "Starting frontend on http://$FRONTEND_HOST:$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) &
PIDS+=("$!")

echo
echo "Backend:  http://$BACKEND_HOST:$BACKEND_PORT"
echo "Frontend: http://$FRONTEND_HOST:$FRONTEND_PORT"
echo "Press Ctrl+C to stop both."
echo

wait

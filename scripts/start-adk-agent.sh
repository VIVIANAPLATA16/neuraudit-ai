#!/usr/bin/env bash
# Local ADK Agent API — http://127.0.0.1:8080/health
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -v '^[[:space:]]*$' | xargs)
  set +a
fi

export PYTHONPATH="$ROOT"
export NEURAUDIT_API="${NEURAUDIT_API:-http://127.0.0.1:3000/api/agent/search}"
export PORT="${PORT:-8080}"

if [[ ! -d .venv-adk ]]; then
  python3 -m venv .venv-adk
fi
# shellcheck disable=SC1091
source .venv-adk/bin/activate
pip install -q -r neuraudit_agent/requirements-agent.txt

echo "==> ADK Agent API on :${PORT}"
echo "    Health: http://127.0.0.1:${PORT}/health"
echo "    Chat:   POST http://127.0.0.1:${PORT}/chat"
echo ""

exec uvicorn neuraudit_agent.agent_service:app --host 0.0.0.0 --port "$PORT" --reload

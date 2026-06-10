#!/usr/bin/env bash
# Local ADK dev-ui — http://127.0.0.1:8000/dev-ui/?app=neuraudit_agent&userId=user
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

if [[ ! -d .venv-adk ]]; then
  python3 -m venv .venv-adk
fi
# shellcheck disable=SC1091
source .venv-adk/bin/activate
pip install -q -r neuraudit_agent/requirements-agent.txt

echo "==> ADK Agent dev-ui"
echo "    URL: http://127.0.0.1:8000/dev-ui/?app=neuraudit_agent&userId=user"
echo "    NEURAUDIT_API=$NEURAUDIT_API"
echo "    Elastic MCP: ${ELASTIC_MCP_URL:-${ELASTIC_KIBANA_URL:+${ELASTIC_KIBANA_URL}/api/agent_builder/mcp}}"
echo ""
echo "Terminal B (required): npm run dev"
echo ""

exec adk web --port 8000 --host 127.0.0.1

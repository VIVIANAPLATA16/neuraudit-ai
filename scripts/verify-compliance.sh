#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"

echo "==> Compliance: $BASE/api/system/compliance"
curl -sS "$BASE/api/system/compliance" | python3 -m json.tool

echo ""
echo "==> ADK Agent health (if NEURAUDIT_ADK_AGENT_URL set locally)"
ADK_URL="${NEURAUDIT_ADK_AGENT_URL:-http://127.0.0.1:8080}"
curl -sS "$ADK_URL/health" 2>/dev/null | python3 -m json.tool || echo "ADK agent not running at $ADK_URL"

echo ""
echo "==> Investigation smoke (ICBF)"
curl -sS "$BASE/api/agent/search?q=ICBF" | python3 -c "
import sys,json
d=json.load(sys.stdin)
e=d.get('elasticInsights',{})
print('score:', d.get('riesgo',{}).get('score'))
print('elastic:', e.get('status'), e.get('retrievalMethod'), e.get('mcpTool'), e.get('totalHits'))
"

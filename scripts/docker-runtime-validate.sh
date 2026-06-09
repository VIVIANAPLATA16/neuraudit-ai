#!/usr/bin/env bash
# Validación runtime Docker — Fase 22 cierre
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="$ROOT/docs/docker-runtime-logs.txt"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

if [[ ! -f .env.local ]]; then
  echo "ERROR: .env.local requerido (copiar desde .env.example)" >&2
  exit 1
fi

log "=== docker compose down ==="
docker compose down 2>&1 | tee -a "$LOG" || true

log "=== docker compose up --build -d ==="
docker compose up --build -d 2>&1 | tee -a "$LOG"

log "=== esperando healthchecks (60s) ==="
sleep 60

log "=== docker compose ps ==="
docker compose ps 2>&1 | tee -a "$LOG"

log "=== ADK /health ==="
curl -sf http://localhost:8001/health | tee -a "$LOG"
echo "" | tee -a "$LOG"

log "=== Next.js /api/system/status ==="
curl -sf http://localhost:3000/api/system/status | tee -a "$LOG"
echo "" | tee -a "$LOG"

log "=== GET /api/agent/search?q=UNGRD ==="
curl -sf "http://localhost:3000/api/agent/search?q=UNGRD&nocache=true" -o /tmp/neuraudit-ungrd.json
node -e "
const d=require('/tmp/neuraudit-ungrd.json');
console.log(JSON.stringify({
  score:d.riesgo?.score,
  total:d.fuentes?.total,
  adkUrl:process.env.NEURAUDIT_ADK_ANALYZE_URL,
  meta:d.meta,
  traceCount:d.fuentesTrace?.length
},null,2));
" 2>&1 | tee -a "$LOG"

log "=== POST /api/agent/analysis ==="
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('/tmp/neuraudit-ungrd.json','utf8'));
fetch('http://localhost:3000/api/agent/analysis',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({query:d.query,result:d})
}).then(r=>r.json()).then(j=>console.log(JSON.stringify({
  mode:j.mode,source:j.source,conclusionLen:(j.analysis?.conclusion||'').length
},null,2)));
" 2>&1 | tee -a "$LOG"

log "=== logs adk-analyze (tail) ==="
docker compose logs adk-analyze --tail=20 2>&1 | tee -a "$LOG"

log "=== logs nextjs (tail) ==="
docker compose logs nextjs --tail=20 2>&1 | tee -a "$LOG"

log "=== VALIDACION COMPLETA ==="

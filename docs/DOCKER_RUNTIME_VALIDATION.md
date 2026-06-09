# Docker — Validación Runtime (Fase 22 cierre)

**Fecha:** 9 de junio de 2026  
**Entorno:** Docker 28.5.2, Compose v2.40.0  
**Resultado:** **EXITOSO** tras correcciones de despliegue

---

## Comandos ejecutados

```bash
# Preparación — liberar puertos ocupados por dev local
fuser -k 8001/tcp 3000/tcp 2>/dev/null || true
pkill -f "uvicorn neuraudit_agent" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

# Bajar stack previo
docker compose down --remove-orphans

# Build + arranque
docker compose up --build -d

# Verificación
docker compose ps
curl http://localhost:8001/health
curl http://localhost:3000/api/system/status
curl "http://localhost:3000/api/agent/search?q=UNGRD&nocache=true" -o /tmp/ungrd.json
curl -X POST http://localhost:3000/api/agent/analysis \
  -H "Content-Type: application/json" \
  -d @<(node -e "const d=require('/tmp/ungrd.json');console.log(JSON.stringify({query:d.query,result:d}))")

docker compose logs adk-analyze --tail=25
docker compose logs nextjs --tail=25
```

Script automatizado: `scripts/docker-runtime-validate.sh`

---

## Errores encontrados (1ª ejecución)

| Error | Causa | Impacto |
|-------|-------|---------|
| `address already in use` :8001 / :3000 | Procesos dev local (`uvicorn`, `next dev`) | `compose up` falló |
| `ModuleNotFoundError: No module named 'google.adk'` | `neuraudit_agent/__init__.py` importaba `agent.py` eager | ADK crash-loop, Next.js nunca arrancó |
| `GOOGLE_API_KEY variable is not set` (warning) | `environment:` en compose sobrescribía `env_file` con string vacío | Keys no llegaban al contenedor |

---

## Correcciones realizadas (solo despliegue)

| Archivo | Cambio |
|---------|--------|
| `neuraudit_agent/__init__.py` | Eliminado `from . import agent` eager — `analyze_service` no requiere `google.adk` |
| `docker-compose.yml` | `env_file: .env.local`; removidas variables `${GOOGLE_API_KEY}` que vaciaban keys del host |
| `.dockerignore` | Contexto de build reducido (excluye `node_modules`, `.env*`, backups) |
| `scripts/docker-runtime-validate.sh` | Script de validación reproducible |

**No se modificó:** lógica de negocio, UI, motor de riesgo, paginación, normalización.

---

## Resultado final (2ª ejecución — post-fix)

### Contenedores

```
NAME                      STATUS                    PORTS
neuraudit-adk-analyze-1   Up (healthy)              0.0.0.0:8001->8001/tcp
neuraudit-nextjs-1        Up                        0.0.0.0:3000->3000/tcp
```

### Build

- `neuraudit-adk-analyze` — Built ✅
- `neuraudit-nextjs` — Built ✅ (Next.js 16.2.5 production, TypeScript OK)

### ADK — `GET /health`

```json
{
  "status": "ok",
  "service": "neuraudit-adk-analyze",
  "geminiConfigured": true,
  "model": "gemini-2.5-flash",
  "version": "22.1.0",
  "geminiKeySource": "GEMINI_API_KEY"
}
```

### Next.js — `GET /api/system/status`

```json
{
  "gemini": { "connected": true, "model": "gemini-2.5-flash" },
  "adk": {
    "connected": true,
    "analyzeUrl": "http://adk-analyze:8001/analyze",
    "geminiConfigured": true,
    "model": "gemini-2.5-flash",
    "version": "22.1.0",
    "geminiKeySource": "GEMINI_API_KEY",
    "error": null
  },
  "cache": { "entries": 0, "ttlMs": 1800000 }
}
```

**Comunicación interna Next.js → ADK:** confirmada (`adk.connected: true`, URL `http://adk-analyze:8001/analyze`).

### `GET /api/agent/search?q=UNGRD&nocache=true`

```json
{
  "score": 90,
  "total": 5070,
  "meta": {
    "fuentesConsultadas": 13,
    "fuentesExitosas": 1,
    "fuentesConError": 2,
    "fuentesVacias": 7,
    "fuentesTimeout": 1,
    "fuentesParciales": 2,
    "fetchConcurrency": 4,
    "duracionTotalMs": 79458
  }
}
```

### `POST /api/agent/analysis`

```json
{ "status": 200, "source": "derived" }
```

> Gemini responde 429 (billing agotado) dentro del contenedor — fallback derivado operativo. No es defecto Docker.

### Logs relevantes

**nextjs:**
```
▲ Next.js 16.2.5
✓ Ready in 0ms
[Analysis] Gemini direct error: [429 Too Many Requests] prepayment credits depleted
```

**adk-analyze:**
```
INFO: GET /health HTTP/1.1 200 OK  (healthcheck periódico OK)
```

---

## Checklist de validación

| Criterio | Estado |
|----------|--------|
| Next.js inicia correctamente | ✅ |
| analyze_service inicia correctamente | ✅ |
| Healthchecks responden | ✅ |
| Variables de entorno visibles | ✅ (`geminiConfigured: true`) |
| Comunicación Next.js → ADK | ✅ |
| Search API funcional en Docker | ✅ |
| Analysis API funcional en Docker | ✅ |

---

## Requisitos previos para despliegue

1. Archivo `.env.local` presente con `GEMINI_API_KEY` o `GOOGLE_API_KEY`
2. Puertos **3000** y **8001** libres (detener `npm run dev` y uvicorn local)
3. Ejecutar: `docker compose up --build -d`

---

*Validación runtime Fase 22 — cerrada con éxito.*

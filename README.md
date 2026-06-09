# NeurAudit AI — Plataforma de Inteligencia Anticorrupción

NeurAudit AI analiza entidades de contratación pública colombiana cruzando datos oficiales de SECOP, Contraloría, Procuraduría, SGR y sanciones. Genera score de riesgo, expedientes, informes IA y comparaciones.

## Arquitectura

```
Usuario (Next.js UI)
    │
    ▼
GET /api/agent/search?q=...
    │  ├─ Caché en memoria (TTL configurable)
    │  └─ runInvestigation() → 13 fuentes datos.gov.co (paginación real)
    │         ├─ fuentesTrace (success | timeout | error | empty)
    │         ├─ scoreExplainability (10 reglas documentadas)
    │         └─ risk-engine + interpretación
    │
POST /api/agent/analysis
    │  └─ ADK FastAPI :8001 → Gemini → Fallback derivado
    │
GET /api/agent/compare?a=...&b=...
    └─ Mismo pipeline IA unificado (ADK → Gemini → Fallback)
```

### Servicios

| Servicio | Puerto | Rol |
|----------|--------|-----|
| Next.js | 3000 | UI + API routes |
| ADK Analyze (FastAPI) | 8001 | Análisis profundo vía Gemini |

### Fuentes de datos (datos.gov.co / Socrata)

13 datasets con paginación automática (`$limit` + `$offset`, hasta 10.000 registros/fuente):

- SECOP II, SECOP I, SECOP I alternativo
- Procesos de contratación, ejecución contractual
- Responsabilidad fiscal (CGR), sanciones contractuales
- Contadores sancionados, Relatoría Procuraduría
- SGR (gastos, programación, ejecución ingresos)

## Inicio rápido (desarrollo)

```bash
npm install
cp .env.example .env.local
# Agregar GOOGLE_API_KEY en .env.local

# Terminal 1 — ADK Analyze
uvicorn neuraudit_agent.analyze_service:app --host 127.0.0.1 --port 8001

# Terminal 2 — Next.js
npm run dev
```

## Docker Compose

```bash
cp .env.example .env
# Configurar GOOGLE_API_KEY en .env

docker compose up --build
```

- App: http://localhost:3000
- ADK health: http://localhost:8001/health

## Variables de entorno

Ver `.env.example`:

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_API_KEY` | API key Gemini (requerida para IA) |
| `NEURAUDIT_ADK_ANALYZE_URL` | URL del servicio ADK (default `http://127.0.0.1:8001/analyze`) |
| `NEURAUDIT_CACHE_TTL_MS` | TTL caché investigaciones (default 1.800.000 ms = 30 min) |
| `NEURAUDIT_GEMINI_MODEL` | Modelo Gemini (default `gemini-2.5-flash`) |

## API principal

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/agent/search?q=` | GET | Investigación completa (+ `?insights=true` para IA) |
| `/api/agent/search?q=&nocache=true` | GET | Bypass caché |
| `/api/agent/analysis` | POST | Análisis IA (ADK → Gemini → Fallback) |
| `/api/agent/compare?a=&b=` | GET | Comparación de entidades |
| `/api/system/status` | GET | Diagnóstico Gemini/ADK/caché |

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **IA:** Gemini 2.5 Flash vía ADK FastAPI + fallback derivado
- **Datos:** APIs públicas Socrata (datos.gov.co)
- **Motor de riesgo:** 10 reglas con explicabilidad formal

## Licencia

MIT — ver `LICENSE`

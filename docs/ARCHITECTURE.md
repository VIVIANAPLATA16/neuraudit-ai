# NeurAudit AI — Arquitectura (1 minuto)

**Hackathon Google Cloud · Contratación pública colombiana**

---

## Diagrama

```
┌─────────────────────────────────────────────────────────────────┐
│  USUARIO / JUECES / AGENT BUILDER                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────────┐
│  Next.js UI     │ │  MCP Server  │ │  ADK Dev UI :8000   │
│  Vercel :3000   │ │  /api/mcp    │ │  (local hackathon)  │
└────────┬────────┘ └──────┬───────┘ └──────────┬──────────┘
         │                 │                     │
         └────────┬────────┴─────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Routes (Next.js serverless)                                │
│  /api/agent/search  → investigación 13 fuentes datos.gov.co     │
│  /api/agent/analysis → informe IA                                 │
│  /api/agent/summary  → resumen compacto (MCP / Agent Builder)   │
│  /api/mcp            → JSON-RPC para Google Agent Builder       │
└────────┬───────────────────────────────┬────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────────┐
│  datos.gov.co       │       │  ADK Analyze Service        │
│  (Socrata / SECOP)  │       │  FastAPI :8001              │
│  13 datasets        │       │  Cloud Run / Docker / local │
└─────────────────────┘       └──────────────┬──────────────┘
                                             ▼
                               ┌─────────────────────────────┐
                               │  Google Gemini 2.5 Flash    │
                               │  (Google AI / Cloud)        │
                               └─────────────────────────────┘
```

---

## Capas

| Capa | Tecnología | Dónde corre |
|------|------------|-------------|
| **Frontend** | Next.js 16, React 19, Tailwind | **Vercel** (`neuraudit.vercel.app`) |
| **API BFF** | Next.js Route Handlers | Vercel (serverless) |
| **Motor de datos** | `investigation.ts` + Socrata | Vercel → datos.gov.co |
| **Motor de riesgo** | `risk-engine.ts` (10 reglas) | Vercel |
| **IA profunda** | `analysis.ts` → ADK → Gemini → fallback | ADK en Cloud Run; fallback en Vercel |
| **Agente ADK** | `agent.py` (Google ADK) | Local `:8000` dev-ui |
| **MCP** | `/api/mcp` JSON-RPC | Vercel (integración Agent Builder) |

---

## Flujo principal (investigación)

1. Usuario busca entidad en UI → `GET /api/agent/search?q=ICBF`
2. Backend consulta **13 fuentes** en datos.gov.co (paginación, caché 30 min)
3. `risk-engine` calcula score 0–100 + `scoreExplainability`
4. UI muestra resultados; opcional `POST /api/agent/analysis` para informe IA
5. Pipeline IA: **ADK FastAPI** → **Gemini** → **fallback derivado** si falla

---

## Base de datos

| Tipo | Estado | Uso |
|------|--------|-----|
| PostgreSQL | **No** | No requerido para MVP hackathon |
| SQLite | **No** | Solo artifact ADK dev (`session.db` — ignorado en git) |
| Elastic | **Script offline** | `scripts/index-secop.mjs` — no runtime |
| **Caché servidor** | Memoria (TTL) | `investigation-cache.ts` |
| **Cliente** | localStorage / sessionStorage | Historial, settings, investigación activa |

**Conclusión MVP:** Datos en tiempo real desde APIs públicas; persistencia cliente-side.

---

## Google Cloud en el stack

| Servicio | Rol |
|----------|-----|
| **Gemini 2.5 Flash** | Análisis narrativo anticorrupción |
| **Google ADK** | Agente con herramientas (`agent.py`) |
| **Agent Builder + MCP** | Consume `/api/mcp` y `/api/agent/summary` |
| **Cloud Run** (recomendado) | Host del servicio `analyze_service.py` |

---

## Despliegue hackathon

| Componente | URL / comando |
|------------|---------------|
| Producción UI | https://neuraudit.vercel.app |
| ADK Analyze | Docker local o Cloud Run (ver `AGENT_DEPLOYMENT.md`) |
| ADK Dev UI | `adk web` → http://127.0.0.1:8000/dev-ui/ |

---

## Repo

```
neuraudit/
├── src/app/          # Next.js UI + API routes
├── src/lib/          # Motor investigación, riesgo, IA
├── src/components/   # UI components
├── neuraudit_agent/  # Python ADK + FastAPI analyze
├── docs/             # Documentación hackathon
└── docker-compose.yml
```

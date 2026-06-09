# NeurAudit AI

**Agente de inteligencia anticorrupción para contratación pública colombiana.**

Google Cloud Rapid Agent Hackathon 2026 · Gemini · ADK · MCP

**Demo:** https://neuraudit.vercel.app

---

## Qué es

NeurAudit cruza **13 fuentes oficiales** (SECOP, Contraloría, Procuraduría, SGR, sanciones) y en segundos entrega:

- Score de riesgo **0–100** con explicabilidad formal
- Trazabilidad por fuente (`success` / `partial` / `error` / `timeout` / `empty`)
- Informe de auditoría con **Gemini 2.5 Flash**
- Expediente PDF y comparación de entidades
- Integración **MCP** para Google Cloud Agent Builder

---

## Cómo funciona (60 segundos)

```
Buscar entidad → 13 APIs datos.gov.co → Motor de riesgo → Score + hallazgos
                                              ↓
                                    Panel Analista IA (Gemini)
                                              ↓
                                    PDF / Comparar / Historial
```

| Componente | Dónde |
|------------|-------|
| UI + APIs | **Vercel** (Next.js) |
| Datos | **datos.gov.co** (tiempo real) |
| IA profunda | **ADK Analyze** (FastAPI) → **Gemini** |
| Agente ADK | Local `:8000` dev-ui o Agent Builder vía MCP |
| Base de datos | **No SQL** — caché memoria + localStorage cliente |

Diagrama completo: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Setup local

```bash
git clone https://github.com/VIVIANAPLATA16/neuraudit-ai.git
cd neuraudit-ai
npm install
cp .env.example .env.local
# Editar: GEMINI_API_KEY=...
```

### Opción A — Desarrollo rápido

```bash
# Terminal 1
python3 -m uvicorn neuraudit_agent.analyze_service:app --port 8001

# Terminal 2
npm run dev
# → http://localhost:3000
```

### Opción B — Docker

```bash
docker compose up --build
```

### Opción C — ADK Dev UI (demo hackathon)

```bash
adk web --port 8000
# → http://127.0.0.1:8000/dev-ui/
```

---

## Deploy

### Frontend (Vercel)

Conectado a `main` en GitHub. Push a `main` → auto-deploy.

```bash
vercel deploy --prod   # manual si necesario
```

Variables en Vercel: `GEMINI_API_KEY`, `NEURAUDIT_ADK_ANALYZE_URL` (si ADK en cloud).

### Agente Python (Cloud Run)

Guía completa: [`docs/AGENT_DEPLOYMENT.md`](docs/AGENT_DEPLOYMENT.md)

---

## Agente explicado simple

NeurAudit tiene **3 interfaces de agente**:

1. **UI web** — el usuario busca y explora resultados
2. **MCP Server** (`/api/mcp`) — Google Agent Builder invoca herramientas
3. **ADK Analyze** (`analyze_service.py`) — cerebro IA que Next.js consulta

Pipeline IA: `ADK → Gemini → Fallback derivado` (nunca deja al usuario sin respuesta).

---

## API principal

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/agent/search?q=` | Investigación completa |
| `POST /api/agent/analysis` | Informe IA |
| `GET /api/agent/compare?a=&b=` | Comparar entidades |
| `GET /api/system/status` | Diagnóstico sistema |
| `POST /api/mcp` | MCP JSON-RPC |

Referencia completa: [`docs/API.md`](docs/API.md)

---

## Casos de uso

| Usuario | Caso |
|---------|------|
| Auditor / Contraloría | Priorizar entidades por score de riesgo |
| Periodista | Investigar contratación en minutos |
| Ciudadanía | Transparencia sobre entidades estatales |
| Hackathon judges | Demo MCP + Gemini + datos reales |

---

## Documentación hackathon

| Doc | Contenido |
|-----|-----------|
| [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md) | Texto para Devpost + demo steps |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura 1 minuto |
| [`docs/AGENT_DEPLOYMENT.md`](docs/AGENT_DEPLOYMENT.md) | Deploy Cloud Run |
| [`docs/API.md`](docs/API.md) | Endpoints activos vs legacy |
| [`docs/DEPLOYMENT_AUDIT.md`](docs/DEPLOYMENT_AUDIT.md) | Estado deploy Vercel |

---

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **IA:** Gemini 2.5 Flash, Google ADK, MCP
- **Backend agente:** FastAPI + Python 3.11
- **Datos:** APIs Socrata datos.gov.co
- **Deploy:** Vercel + Docker / Cloud Run

---

## Licencia

MIT — ver [`LICENSE`](LICENSE)

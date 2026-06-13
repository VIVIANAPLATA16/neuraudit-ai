# NeurAudit AI

**Anti-corruption intelligence agent for Colombian public procurement.**

Built for the **[Google Cloud Rapid Agent Hackathon 2026](https://cloud.google.com/events/rapid-agent-hackathon)** — Elastic Track · Gemini · ADK · MCP · Agent Builder

**Live demo:** https://neuraudit-web-986541948066.us-central1.run.app

**Legacy URL:** https://neuraudit.vercel.app

---

## What it is

NeurAudit AI cross-references **13 official government datasets** (SECOP, Comptroller General, Attorney General, royalty funds, sanctions) and delivers, in seconds:

- A **0–100 risk score** with formal explainability (`scoreExplainability`)
- Per-source traceability (`success` / `partial` / `error` / `timeout` / `empty`)
- Deep audit reports powered by **Gemini 2.5 Flash**
- PDF case files and side-by-side entity comparison
- **MCP** integration for **Google Cloud Agent Builder**

---

## Unified technology stack

| Layer | Technology | Role |
|-------|------------|------|
| **Frontend & BFF** | **Next.js 16**, React 19, Tailwind CSS 4 | UI + serverless API routes (Vercel / Cloud Run) |
| **Live government data** | datos.gov.co (Socrata) | 13 datasets, paginated fetch with backoff |
| **Hybrid search** | **Elasticsearch on GCP** (`secop-contratos`) | Semantic SECOP contract search at runtime |
| **Risk engine** | TypeScript (`risk-engine.ts`) | 10-rule scoring — unchanged, deterministic |
| **Generative AI** | **Gemini 2.5 Flash** | Google AI Studio API (production) · Vertex AI–ready on GCP |
| **AI orchestration** | `ADK → Gemini → derived fallback` | Never leaves the user without a response |
| **ADK Analyze** | FastAPI (`analyze_service.py`) | Deep analysis microservice (Docker / Cloud Run) |
| **Agent surfaces** | **Google Cloud Agent Builder (MCP)** | JSON-RPC at `/api/mcp` |
| **ADK Dev UI** | `agent.py` (Google ADK) | Local `:8000` for hackathon demos |
| **Persistence** | In-memory cache + browser storage | No SQL required for MVP |

```
User query
    │
    ├─► datos.gov.co (13 sources) ──┐
    └─► Elasticsearch GCP (hybrid) ─┤
                                      ▼
                              Risk engine + explainability
                                      ▼
                         ADK Analyze → Gemini 2.5 Flash → derived fallback
                                      ▼
                         UI · PDF · Compare · MCP · Agent Builder
```

Full architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## How it works (60 seconds)

1. User searches an entity (e.g. `ICBF`, `UNGRD`).
2. `runInvestigation()` fetches **datos.gov.co** and queries **Elasticsearch** in parallel.
3. The risk engine computes score, alerts, and enriched findings (including Elastic insights).
4. Optional `POST /api/agent/analysis` runs the IA pipeline: **ADK Analyze → Gemini → derived fallback**.
5. Results surface in the UI, PDF export, comparison views, or via **MCP** for external agents.

---

## Local setup

### Prerequisites

- Node.js 20+
- Python 3.11+ (for ADK Analyze)
- Docker (optional, recommended)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` ([Google AI Studio](https://aistudio.google.com/))
- `ELASTIC_ENDPOINT` + `ELASTIC_API_KEY` (optional — graceful skip if missing)

### Clone & install

```bash
git clone https://github.com/VIVIANAPLATA16/neuraudit-ai.git
cd neuraudit-ai
npm install
```

Create `.env.local` at the project root:

```bash
# Required for generative analysis
GEMINI_API_KEY=your_google_ai_studio_key

# Optional — Elasticsearch hybrid search (GCP cluster)
ELASTIC_ENDPOINT=https://your-deployment.es.us-central1.gcp.cloud.es.io
ELASTIC_API_KEY=your_elastic_api_key

# Optional — ADK Analyze (defaults to localhost:8001)
NEURAUDIT_ADK_ANALYZE_URL=http://127.0.0.1:8001/analyze
```

### Index SECOP into Elasticsearch (one-time)

```bash
node scripts/index-secop.mjs
```

### Option A — Fast development

```bash
# Terminal 1 — ADK Analyze (FastAPI)
python3 -m uvicorn neuraudit_agent.analyze_service:app --host 127.0.0.1 --port 8001

# Terminal 2 — Next.js
npm run dev
# → http://localhost:3000
```

### Option B — Docker Compose (recommended)

```bash
docker compose up --build
# Next.js → http://localhost:3000
# ADK Analyze → http://localhost:8001/health
```

### Option C — ADK Dev UI (hackathon agent demo)

```bash
adk web --port 8000
# → http://127.0.0.1:8000/dev-ui/
```

### Verify

```bash
curl http://localhost:3000/api/system/status
# Check: gemini.connected, elastic.configured, adk.connected
```

---

## Enterprise deployment

### Frontend — Vercel (current production)

Connected to `main` on GitHub. Push to `main` → automatic deploy.

```bash
vercel deploy --prod   # manual deploy if needed
```

**Vercel environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `ELASTIC_ENDPOINT` | Recommended | GCP Elasticsearch endpoint |
| `ELASTIC_API_KEY` | Recommended | Elastic API key |
| `NEURAUDIT_ADK_ANALYZE_URL` | If ADK in cloud | Cloud Run Analyze URL |

### Full stack — Google Cloud Run

Deploy **Next.js** and **ADK Analyze** to Cloud Run with one script:

```bash
export GCP_PROJECT_ID="your-gcp-project"
export GCP_REGION="us-central1"
export GEMINI_API_KEY="..."
export ELASTIC_ENDPOINT="https://..."
export ELASTIC_API_KEY="..."

chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

The script will:

1. Enable required GCP APIs (Run, Artifact Registry, Cloud Build)
2. Build and push Docker images (`nextjs` + `adk-analyze`)
3. Deploy **ADK Analyze** to Cloud Run (`:8001`, 300s timeout)
4. Deploy **Next.js** to Cloud Run (`:8080`, 2Gi RAM, 300s timeout)
5. Wire `NEURAUDIT_ADK_ANALYZE_URL` to the deployed Analyze service

**Post-deploy:**

```bash
# Set public app URL for status checks
gcloud run services update neuraudit-web \
  --region=us-central1 \
  --set-env-vars="NEXT_PUBLIC_APP_URL=https://your-service-url"
```

Detailed agent deployment: [`docs/AGENT_DEPLOYMENT.md`](docs/AGENT_DEPLOYMENT.md)

---

## Agent interfaces

NeurAudit exposes **three agent surfaces**:

| Surface | Entry point | Audience |
|---------|-------------|----------|
| **Web UI** | `/` | Auditors, journalists, citizens |
| **MCP Server** | `POST /api/mcp` | Google Cloud Agent Builder |
| **ADK Analyze** | `analyze_service.py` | Next.js IA pipeline (internal) |

**IA pipeline (unchanged):** `ADK Analyze → Gemini 2.5 Flash → derived institutional fallback`

---

## Core API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/search?q=` | GET | Full investigation (13 sources + Elastic) |
| `/api/agent/analysis` | POST | Deep IA audit report |
| `/api/agent/compare?a=&b=` | GET | Compare two entities |
| `/api/expediente/pdf?q=` | GET | PDF case file |
| `/api/system/status` | GET | System diagnostics |
| `/api/mcp` | POST | MCP JSON-RPC (Agent Builder) |

Full reference: [`docs/API.md`](docs/API.md)

---

## Use cases

| User | Use case |
|------|----------|
| Auditor / Comptroller | Prioritize entities by explainable risk score |
| Journalist | Cross-source procurement investigation in minutes |
| Civil society | Transparency on state entities and contractors |
| Hackathon judges | Live demo: MCP + Gemini + real government data + Elastic hybrid search |

---

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md) | Devpost copy + demo script |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | One-minute architecture |
| [`docs/AGENT_DEPLOYMENT.md`](docs/AGENT_DEPLOYMENT.md) | Cloud Run agent deployment |
| [`docs/API.md`](docs/API.md) | Active vs legacy endpoints |
| [`docs/DEPLOYMENT_AUDIT.md`](docs/DEPLOYMENT_AUDIT.md) | Vercel production audit |

---

## Hackathon alignment

| Criterion | How NeurAudit delivers |
|-----------|------------------------|
| **Google Cloud Rapid Agent Hackathon 2026** | First-class submission: Gemini, ADK, Agent Builder MCP |
| **Elastic Track** | Runtime Elasticsearch on GCP for hybrid SECOP search |
| **Real data** | 100% public Colombian government APIs — no mocks |
| **Agent Builder** | MCP tools: `investigar_entidad`, `comparar_entidades` |
| **Resilience** | Graceful degradation at every layer (Elastic, ADK, Gemini) |

---

## License

**MIT License** — Copyright (c) 2026 VIVIANAPLATA16

See the full license text in [`LICENSE`](LICENSE).

```
MIT License — free to use, modify, and distribute with attribution.
```

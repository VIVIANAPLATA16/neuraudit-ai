# NeurAudit AI — Architecture (One Minute)

**Google Cloud Rapid Agent Hackathon 2026 · Colombian public procurement**

---

## System diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER / JUDGES / GOOGLE CLOUD AGENT BUILDER                          │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│  Next.js UI      │ │  MCP Server  │ │  ADK Dev UI :8000    │
│  Vercel / Run    │ │  /api/mcp    │ │  (local hackathon)   │
└────────┬─────────┘ └──────┬───────┘ └──────────┬───────────┘
         │                  │                     │
         └────────┬─────────┴─────────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  API Routes (Next.js serverless)                                     │
│  /api/agent/search   → investigation (datos.gov.co + Elasticsearch)  │
│  /api/agent/analysis → deep IA report                                │
│  /api/agent/summary  → compact summary (MCP / Agent Builder)         │
│  /api/mcp            → JSON-RPC for Google Cloud Agent Builder       │
└────────┬───────────────────────────────┬───────────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────────────┐
│  datos.gov.co (Socrata) │   │  ADK Analyze Service            │
│  13 official datasets   │   │  FastAPI :8001                  │
│  SECOP · CGR · Proc.    │   │  Cloud Run / Docker / local     │
└─────────────────────────┘   └──────────────┬──────────────────┘
         │                                    ▼
         ▼                       ┌─────────────────────────────────┐
┌─────────────────────────┐     │  Gemini 2.5 Flash               │
│  Elasticsearch on GCP   │     │  Google AI Studio / Vertex-ready│
│  Index: secop-contratos │     └─────────────────────────────────┘
│  Hybrid semantic search │
└─────────────────────────┘
```

---

## Layers

| Layer | Technology | Where it runs |
|-------|------------|---------------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 | **Vercel** or **Cloud Run** |
| **API BFF** | Next.js Route Handlers | Serverless (Vercel / Cloud Run) |
| **Data engine** | `investigation.ts` + Socrata fetcher | Parallel fetch to datos.gov.co |
| **Hybrid search** | `@elastic/elasticsearch` → GCP cluster | Runtime in `elastic-search.ts` |
| **Risk engine** | `risk-engine.ts` (10 rules) | Deterministic scoring — no LLM |
| **Deep IA** | `analysis.ts` → ADK → Gemini → derived | ADK on Cloud Run; fallback on Next.js |
| **ADK agent** | `agent.py` (Google ADK) | Local `:8000` dev-ui |
| **MCP** | `/api/mcp` JSON-RPC | Agent Builder integration |

---

## Primary investigation flow

1. User searches an entity → `GET /api/agent/search?q=ICBF`
2. `runInvestigation()` runs **in parallel**:
   - **13 Socrata datasets** on datos.gov.co (pagination, concurrency pool)
   - **Elasticsearch** query on `secop-contratos` (semantic multi-match)
3. If Elastic credentials are missing or fail → **graceful skip**; datos.gov.co completes the investigation
4. `risk-engine` computes score 0–100 + `scoreExplainability`
5. `elasticInsights` and enriched `interpretacion.hallazgos` are attached to `SearchResult`
6. UI renders results; optional `POST /api/agent/analysis` triggers the IA pipeline
7. IA pipeline: **ADK FastAPI** → **Gemini 2.5 Flash** → **derived fallback** on failure

---

## Data & persistence

| Type | Status | Usage |
|------|--------|-------|
| PostgreSQL | **No** | Not required for hackathon MVP |
| SQLite | **No** | ADK dev artifact only (`session.db` — gitignored) |
| **Elasticsearch** | **Runtime** | GCP cluster, index `secop-contratos`, hybrid search |
| **Server cache** | In-memory (TTL) | `investigation-cache.ts` — per Lambda instance |
| **Client storage** | sessionStorage / localStorage | Active investigation, history, settings |

**MVP conclusion:** Real-time public APIs + Elastic hybrid search; client-side persistence only.

---

## Google Cloud in the stack

| Service | Role |
|---------|------|
| **Gemini 2.5 Flash** | Narrative anti-corruption audit analysis |
| **Google AI Studio** | Production API key path (`@langchain/google-genai`) |
| **Vertex AI** | GCP-native deployment path (same model family) |
| **Google ADK** | Tool-calling agent (`agent.py`) |
| **Agent Builder + MCP** | Consumes `/api/mcp` and `/api/agent/summary` |
| **Cloud Run** | Hosts `analyze_service.py` and Next.js (`deploy-gcp.sh`) |
| **Elasticsearch on GCP** | Semantic SECOP contract index for hybrid retrieval |

---

## IA pipeline (unchanged)

```
generateAnalysis() / generateComparativeAnalysis()
    │
    ├─① POST NEURAUDIT_ADK_ANALYZE_URL  (analyze_service.py → analyze.py → Gemini)
    │     └─ skipped on Vercel if URL points to localhost
    │
    ├─② invokeGeminiDirect()  (analysis.ts → ChatGoogleGenerativeAI → AI Studio API)
    │
    └─③ buildDerivedAnalysis()  (institutional template — no LLM)
```

---

## Hackathon deployment map

| Component | URL / command |
|-----------|---------------|
| Production UI | https://neuraudit-web-986541948066.us-central1.run.app |
| Legacy URL | https://neuraudit.vercel.app |
| GCP full stack | `./deploy-gcp.sh` → Cloud Run (Next.js + ADK Analyze) |
| ADK Analyze | Docker local or Cloud Run — see `AGENT_DEPLOYMENT.md` |
| ADK Dev UI | `adk web` → http://127.0.0.1:8000/dev-ui/ |
| Elastic indexing | `node scripts/index-secop.mjs` (one-time) |

---

## Repository layout

```
neuraudit/
├── src/app/              # Next.js UI + API routes
├── src/lib/              # Investigation engine, risk, IA, Elastic client
├── src/components/       # UI components
├── neuraudit_agent/      # Python ADK + FastAPI analyze service
├── scripts/              # Elastic SECOP indexer
├── docs/                 # Hackathon & deployment documentation
├── deploy-gcp.sh         # Cloud Run one-shot deploy
└── docker-compose.yml    # Local full stack
```

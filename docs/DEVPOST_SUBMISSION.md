# NeurAudit AI — Devpost Submission

**Google Cloud Rapid Agent Hackathon 2026**

---

## Elevator pitch (30 seconds)

**NeurAudit AI** is an anti-corruption intelligence agent for Colombian public procurement. In seconds, it cross-references real data from SECOP, the Comptroller General, the Attorney General, and sanctions registries; computes an explainable risk score; and generates audit reports with **Gemini 2.5 Flash** — surfacing concentration risk, direct contracting, contract splitting, and disciplinary history before fiscal damage occurs.

---

## The problem

Colombia publishes millions of procurement records as open data, yet:

- Auditors spend **days** manually cross-referencing sources
- There is no unified, explainable risk score per entity
- Corruption hides in patterns: splitting, single-bidder awards, recurring contractors
- Existing tools do not combine **generative AI** with **real-time official data** and **semantic search**

---

## The solution

NeurAudit automates end-to-end investigation:

1. **Search** an entity (ICBF, UNGRD, Bogotá City Hall…)
2. **Cross-reference** 13 official sources with real pagination
3. **Hybrid retrieval** via **Elasticsearch on GCP** (`secop-contratos` index)
4. **Score** risk 0–100 with 10 documented rules + formal explainability
5. **Explain** factors and per-source traceability
6. **Report** with IA (Gemini) or institutional derived fallback

---

## Demo steps (video / live)

### Demo 1 — Web investigation (2 min)

1. Open https://neuraudit.vercel.app
2. Search **"ICBF"** or **"UNGRD"**
3. Show: risk score, sources consulted, contracts, enriched findings
4. Highlight **`elasticInsights`** in API response (Elastic Track)
5. Open **AI Analyst** panel → executive report
6. Export **PDF case file**

### Demo 2 — Entity comparison (1 min)

1. Navigate to `/comparar`
2. Compare **UNGRD** vs **ICBF**
3. Show score delta and comparative IA analysis

### Demo 3 — MCP / Agent Builder (1 min)

1. Call `POST https://neuraudit.vercel.app/api/mcp` with `tools/call`
2. Or run local ADK dev-ui on `:8000`
3. Agent invokes `investigar_entidad` → real government data

### Demo 4 — Architecture (30 sec)

Walk through `docs/ARCHITECTURE.md`: Vercel · Gemini · datos.gov.co · **Elasticsearch GCP**

---

## Architecture (simple)

```
User → Next.js (Vercel / Cloud Run)
         ├─► datos.gov.co (13 sources)
         └─► Elasticsearch GCP (hybrid SECOP search)
                    ↓
         Risk engine + score explainability + elasticInsights
                    ↓
         ADK Analyze (Cloud Run) → Gemini 2.5 Flash
                    ↓
         Anti-corruption audit report
```

**MCP Server** on Vercel integrates with **Google Cloud Agent Builder**.

---

## Technologies

| Technology | Role |
|------------|------|
| **Google Gemini 2.5 Flash** | Deep narrative audit analysis |
| **Google AI Studio / Vertex AI** | Generative model access on GCP |
| **Google ADK** | Tool-calling agent (`agent.py`) |
| **Google Agent Builder / MCP** | Standard JSON-RPC integration |
| **Elasticsearch on GCP** | Hybrid semantic SECOP contract search |
| **Next.js 16** | Frontend + serverless API |
| **Vercel** | Current production deploy |
| **Google Cloud Run** | Enterprise deploy (`deploy-gcp.sh`) |
| **FastAPI** | ADK Analyze microservice |
| **datos.gov.co (Socrata)** | 13 official SECOP / CGR / Attorney General datasets |
| **Docker** | Local and Cloud Run containerization |

---

## Potential impact

- **Comptroller / Attorney General:** audit prioritization by explainable score
- **Media / civil society:** investigative journalism in minutes, not weeks
- **State entities:** preventive self-monitoring of procurement risk
- **Hackathon → product:** architecture ready for institutional pilot

**Market context:** ~$50B COP/year in Colombian public procurement.

---

## Why it scales

| Dimension | How it scales |
|-----------|---------------|
| Data | License-free public APIs; pagination up to 10K records per source |
| Search | Elasticsearch cluster scales independently on GCP |
| IA | Gemini serverless; derived fallback ensures zero downtime |
| Deploy | Vercel auto-scale; full stack on Cloud Run via `deploy-gcp.sh` |
| Integration | Standard MCP → any Google Cloud agent |
| Geography | Same pattern applicable to other countries with open procurement data |

---

## Hackathon MVP status

| Feature | Status |
|---------|--------|
| Production web UI | ✅ Vercel |
| 13 datos.gov.co sources | ✅ |
| Elasticsearch runtime (GCP) | ✅ Hybrid search in `runInvestigation()` |
| Score + explainability | ✅ |
| IA report | ✅ Gemini or derived fallback |
| MCP Agent Builder | ✅ |
| ADK dev-ui local | ✅ |
| ADK Analyze on Cloud Run | ✅ `deploy-gcp.sh` |
| PostgreSQL | ❌ Not required for MVP |

---

## Links

| Resource | URL |
|----------|-----|
| **Live demo** | https://neuraudit.vercel.app |
| **Repository** | https://github.com/VIVIANAPLATA16/neuraudit-ai |
| **Architecture** | `docs/ARCHITECTURE.md` |
| **Agent deployment** | `docs/AGENT_DEPLOYMENT.md` |
| **GCP deploy script** | `deploy-gcp.sh` |

---

## Team & attribution

Built for the **Google Cloud Rapid Agent Hackathon 2026** — **Elastic Track** / **Agent Builder** integration.

*Data is 100% sourced from public Colombian government APIs (datos.gov.co).*

**License:** MIT — see [`LICENSE`](../LICENSE)

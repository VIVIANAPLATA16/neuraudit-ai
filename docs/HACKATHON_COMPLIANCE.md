# NeurAudit AI — Hackathon Compliance (Runtime Evidence)

**Google Cloud Rapid Agent Hackathon 2026 · Elastic Track**

Production: https://neuraudit.vercel.app  
Repository: https://github.com/VIVIANAPLATA16/neuraudit-ai

This document maps **only real runtime behavior** — not README claims.

---

## Gemini Runtime Usage

### Where Gemini is initialized

| Location | Mechanism | Model |
|----------|-----------|-------|
| `src/lib/gemini-config.ts` | `NEURAUDIT_GEMINI_MODEL`, `getGeminiApiKey()` | `gemini-2.5-flash` (env override: `NEURAUDIT_GEMINI_MODEL`) |
| `src/lib/analysis.ts` | Dynamic import `@langchain/google-genai` → `ChatGoogleGenerativeAI` | Same model |
| `neuraudit_agent/analyze.py` | `google.generativeai` or `langchain_google_genai` | Same model |

### Where Gemini is called (execution flow)

```
User search
  → GET /api/agent/search?q=…
  → runInvestigation() [no Gemini yet — data only]

User views IA report (automatic after search)
  → POST /api/agent/analysis { query, result }
  → generateAnalysis() in src/lib/analysis.ts
       1. invokeADKAnalysis() → Cloud Run / localhost :8001 (skipped on Vercel if localhost)
       2. invokeGeminiDirect() → ChatGoogleGenerativeAI.invoke(prompt)
       3. buildDerivedAnalysis() → fallback if Gemini unavailable
```

**Primary production path on Vercel:** `invokeGeminiDirect()` (step 2), because ADK localhost is skipped when `VERCEL=1`.

### Prompts Gemini receives

1. **Deep analysis** (`buildDeepPrompt` in `analysis.ts`):
   - System: `ANALYST_SYSTEM_PROMPT` from `gemini-config.ts` (anti-corruption analyst, no hallucination rules)
   - User context: JSON analytics from `analyticsToPromptContext()` — score, contracts, providers, alerts, Elastic hits
   - Output contract: JSON with 9 sections (`resumenEjecutivo`, `evaluacionRiesgo`, `hallazgosCriticos`, etc.)

2. **ADK Analyze service** (`neuraudit_agent/analyze.py`):
   - Same institutional prompt + structured payload from investigation analytics
   - Invoked when `NEURAUDIT_ADK_ANALYZE_URL` points to reachable Cloud Run endpoint

### What Gemini generates

- `AnalystAnalysis` object: executive summary, risk evaluation, critical findings, recommendations, conclusion
- Metadata: `meta.engine` = `"gemini"` | `"adk"` | `"derived"`, `meta.geminiConnected`, `meta.model`, `meta.durationMs`

### User-visible evidence

- **Executive Dashboard** → IA panel shows engine badge (Gemini 2.5 Flash / ADK + Gemini / derived)
- **Configuración → Sistema IA** → Gemini status via `GET /api/system/status`
- **API response** → `analisisIA.source` and `analisisIA.meta.engine`

### Verify in production

```bash
curl -s "https://neuraudit.vercel.app/api/system/status" | jq '.gemini'
curl -s -X POST "https://neuraudit.vercel.app/api/agent/analysis" \
  -H "Content-Type: application/json" \
  -d '{"query":"ICBF","result":{...}}'  # after a search
```

---

## Agent Builder Runtime Usage

### Where Agent Builder integrates

NeurAudit **hosts an MCP-compatible server** consumed by **Google Cloud Agent Builder**:

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `POST /api/mcp` | JSON-RPC 2.0 | `initialize`, `tools/list`, `tools/call` |
| `GET /api/mcp` | REST | Server metadata + tool catalog |
| `GET /api/mcp/sse` | SSE | Streaming MCP transport |
| `POST /api/mcp/message` | JSON-RPC | Message channel for SSE clients |

Source: `src/app/api/mcp/route.ts`, `sse/route.ts`, `message/route.ts`

### MCP tools (runtime)

| Tool | Action |
|------|--------|
| `investigar_entidad` | Calls `${origin}/api/agent/summary?q=…` → full investigation + risk score |
| `comparar_entidades` | Parallel `investigar_entidad` for up to 4 entities |

### What Agent Builder does

Agent Builder (or any MCP client) connects to NeurAudit's MCP server and invokes tools. Each tool triggers the **same investigation pipeline** as the web UI — datos.gov.co + Elasticsearch + risk engine.

### When it is invoked

- **External:** Agent Builder console configured with MCP URL `https://neuraudit.vercel.app/api/mcp`
- **Demo:** `POST /api/mcp` with `{"method":"tools/list"}` or `tools/call`

### What the user sees

- **Home:** `HackathonTechStrip` — "Agent Builder MCP · POST /api/mcp"
- **Results:** Executive Dashboard badge "Agent Builder MCP Active"
- **Configuración:** Sistema IA → MCP operational

### Verify in production

```bash
curl -s https://neuraudit.vercel.app/api/mcp
curl -s -X POST https://neuraudit.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## Elastic MCP Runtime Usage

### Clarification (honest)

NeurAudit uses the **official `@elastic/elasticsearch` client** against an Elasticsearch cluster on GCP (`secop-contratos` index). This is **Elastic partner technology at runtime**.

NeurAudit does **not** run Elastic's standalone MCP server product as a separate process. Hybrid search runs inside `runInvestigation()` via the Elasticsearch API.

### Where Elasticsearch runs

| File | Function | When |
|------|----------|------|
| `src/lib/elastic-search.ts` | `searchElasticSecop()` | Every investigation (parallel with datos.gov.co) |
| `src/lib/investigation.ts` | `runInvestigation()` | Calls Elastic + merges `elasticInsights` into `SearchResult` |
| `scripts/index-secop.mjs` | Offline indexing | Populates `secop-contratos` (not runtime) |

### Configuration

- `ELASTIC_ENDPOINT` — cluster URL
- `ELASTIC_API_KEY` — API key
- If missing: `elasticInsights.status = "skipped"` (graceful degradation)

### What evidence Elasticsearch retrieves

- Semantic multi-match on `entidad`, `contratista`, `objeto`, `texto_completo`
- Returns: `totalHits`, `topContratos`, `alertas`, `valorTotalIndexado`
- Merged into risk scoring via `elasticInsightsToHallazgos()` and trace in `sourceTrace`

### What the user sees

- **Executive Dashboard:** badges "Elastic Search Enabled", "Elastic Evidence · N hits", "Elasticsearch Connected"
- **Evidence panel:** "Elastic SECOP · N hits"
- **Sources list:** "Elasticsearch SECOP" checked when hits > 0

### Verify in production

```bash
curl -s "https://neuraudit.vercel.app/api/agent/search?q=ICBF" | jq '.elasticInsights'
curl -s https://neuraudit.vercel.app/api/system/status | jq '.elastic'
```

---

## Interaction Flow

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ search / MCP tool call
       ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js BFF (Vercel / Cloud Run)                       │
│  /api/agent/search  ·  /api/mcp  ·  /api/agent/analysis │
└──────┬──────────────────────────────┬───────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────┐         ┌────────────────────┐
│ runInvestigation │         │ generateAnalysis   │
│  · datos.gov.co  │         │  ADK → Gemini →    │
│  · Elasticsearch │         │  derived fallback  │
└────────┬─────────┘         └────────────────────┘
         │
         ▼
┌──────────────────┐
│  Risk engine +   │
│  explainability  │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Executive UI   │
│ PDF · Compare  │
└──────────────────┘
```

**Gemini** runs only in the analysis phase (not during raw data fetch).  
**Elasticsearch** runs in parallel during investigation.  
**Agent Builder MCP** exposes the same investigation to external agents.

---

## User Visible Experience

| Step | User action | Gemini | Agent Builder | Elasticsearch |
|------|-------------|--------|---------------|---------------|
| 1 | Open home | Strip shows Gemini | Strip shows MCP endpoint | Strip shows SECOP index |
| 2 | Click "View Demo" or example | — | — | Search starts |
| 3 | Loading timeline | — | — | Step includes hybrid search |
| 4 | Executive Dashboard | Risk score < 10s | MCP Active badge | Evidence hits count |
| 5 | IA panel loads | Engine badge | — | Context includes Elastic hits |
| 6 | Export PDF | Report may include IA | — | Contract evidence |

### What the user does NOT see

- Internal `127.0.0.1:8001` ADK URL (skipped on Vercel)
- Raw JSON-RPC MCP payloads (unless using Agent Builder console)
- Elasticsearch cluster credentials

### How value is perceived

< 10 seconds: Risk score + key findings + evidence counts  
< 30 seconds: Full executive dashboard + technology badges  
< 2 minutes: Gemini narrative report + PDF export

---

## End-to-End Architecture

```
Usuario
  ↓
Frontend Next.js (page.tsx, executive-dashboard.tsx)
  ↓
Agent Layer (/api/agent/search, /api/agent/analysis, /api/mcp)
  ↓
Gemini 2.5 Flash (analysis.ts · analyze.py)
  ↓
Elasticsearch GCP (elastic-search.ts · secop-contratos)
  ↓
Fuentes Públicas (datos.gov.co · 13 datasets)
  ↓
Resultado (SearchResult · Executive Dashboard · PDF)
```

| Stage | Responsible component |
|-------|----------------------|
| UI / UX | `src/app/page.tsx`, `src/components/*` |
| Investigation orchestration | `src/lib/investigation.ts` |
| Government data | `src/lib/datos-fetcher.ts` |
| Elastic hybrid search | `src/lib/elastic-search.ts` |
| Risk scoring | `src/lib/risk-engine.ts` |
| Gemini analysis | `src/lib/analysis.ts`, `neuraudit_agent/analyze.py` |
| Agent Builder surface | `src/app/api/mcp/*` |
| Health / status | `src/app/api/system/status/route.ts` |

---

## User Experience Mapping (Judge Path)

**Paso 1** — Open https://neuraudit.vercel.app → see hackathon hero + tech strip (Gemini, MCP, Elasticsearch)

**Paso 2** — Click **View Demo** or **Try Example Investigations → ICBF**

**Paso 3** — Executive Dashboard: Risk Score, factores, hallazgos, evidencia, recomendación + Elastic badges

**Paso 4** — IA panel: Gemini engine badge + narrative report → **Export PDF** or **Ver Expediente Ampliado**

**Judge verification (< 30s):** Technology strip on home + badges on results + score gauge

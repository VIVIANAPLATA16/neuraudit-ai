# Final Judge Checklist — Disqualification Risk Audit

**NeurAudit AI · Google Cloud Rapid Agent Hackathon 2026 · Elastic Track**

Last audit: 2026-06-03  
Production: https://neuraudit-web-986541948066.us-central1.run.app

Legacy URL: https://neuraudit.vercel.app

Severity: **CRÍTICO** | **ALTO** | **MEDIO** | **BAJO**

---

## CRÍTICO

| # | Risk | Impact | Status | Correction applied |
|---|------|--------|--------|-------------------|
| C1 | Required tech not invoked at runtime | Immediate disqualification | ⚠️ Conditional | Gemini requires `GEMINI_API_KEY` on Vercel; without it → `derived` fallback only. **Action:** verify env var set; pre-warm demo searches. |
| C2 | Hosted URL broken (404/500) | Judges cannot evaluate | ✅ Fixed | Prod returns 200: home, `/api/system/status`, `/api/mcp`, `/bases-datos` |
| C3 | Private or inaccessible repository | Cannot review code | ✅ OK | Public GitHub repo |
| C4 | No OSI license | Disqualification per Devpost | ✅ OK | MIT `LICENSE` in root |
| C5 | Elastic partner tech not demonstrable | Elastic track failure | ⚠️ Conditional | Requires `ELASTIC_*` env on Vercel. UI shows hits when configured. **Action:** confirm env + demo ICBF shows `elasticInsights.totalHits > 0`. |

### C1 detail — Gemini

- **Runtime path:** `POST /api/agent/analysis` → `generateAnalysis()` → `invokeGeminiDirect()` (`@langchain/google-genai`)
- **Failure mode:** Missing API key or 429 billing → `source: "derived"`, `meta.geminiConnected: false`
- **Judge test:** After search, check IA panel engine badge or `analisisIA.meta.engine`

### C5 detail — Elastic

- **Runtime path:** `runInvestigation()` → `searchElasticSecop()` → `@elastic/elasticsearch`
- **Not used:** Elastic's standalone MCP server product (honest disclosure in `HACKATHON_COMPLIANCE.md`)
- **Judge test:** Executive Dashboard "Elastic Evidence · N hits" or API `elasticInsights`

---

## ALTO

| # | Risk | Impact | Status | Correction applied |
|---|------|--------|--------|-------------------|
| A1 | Agent Builder not visible to judges | Appears README-only | ✅ Fixed | `HackathonTechStrip` on home; "Agent Builder MCP Active" on Executive Dashboard; `/api/mcp` returns 200 |
| A2 | First search timeout (>120s) | Judge thinks app broken | ⚠️ Mitigated | `maxDuration=300`, UI timeout 120s, server cache. **Action:** pre-warm ICBF before demo. |
| A3 | Project appears pre-hackathon | Credibility loss | ✅ OK | First commit 2026-05-07 (after May 5 start). Mark "new" on Devpost. |
| A4 | Competitor AI/cloud services | Rule violation | ✅ OK | No OpenAI/Anthropic/AWS Bedrock in analysis path. AWS used only for CSV proxy (`/api/csv-aws`). |
| A5 | No demo video | Incomplete submission | ⬜ User | **User must upload** < 3 min public video |

---

## MEDIO

| # | Risk | Impact | Status | Correction applied |
|---|------|--------|--------|-------------------|
| M1 | localhost URLs exposed in UI | Unprofessional / broken links | ✅ Fixed | No localhost in `src/app/*` pages. ADK localhost only in server lib with Vercel skip. |
| M2 | "Elastic MCP" wording vs Elasticsearch SDK | Judge confusion | ✅ Fixed | UI: "Elasticsearch Connected" + compliance doc clarifies SDK vs MCP product |
| M3 | ADK Analyze unavailable on Vercel | Partial stack only | ✅ By design | `shouldSkipAdkInvoke()` when localhost; Gemini direct is production path |
| M4 | PDF generation timeout | Demo failure | ⚠️ Mitigated | Cache + 504 message. Search entity before PDF. |
| M5 | Cold-start cache miss | Slow first query | ⚠️ Known | In-memory cache per Lambda instance. Pre-warm recommended. |

---

## BAJO

| # | Risk | Impact | Status | Correction applied |
|---|------|--------|--------|-------------------|
| B1 | Mixed ES/EN UI copy | Minor polish | ⚠️ Acceptable | Hero + examples in EN; some labels ES (Colombian audience) |
| B2 | `session.db` in git history | Noise | ✅ Removed from tracking | Not in current deliverable path |
| B3 | Backup files in workspace | Repo clutter | ⚠️ Local only | `page.tsx.backup`, etc. untracked — do not commit |
| B4 | Compare page less polished than home | Secondary flow | ✅ OK | `/comparar` functional |

---

## Judge 30-second test

1. Open https://neuraudit-web-986541948066.us-central1.run.app
2. See: **Google Cloud Rapid Agent Hackathon 2026 · Elastic Track**
3. See tech strip: **Gemini · Agent Builder MCP · Elasticsearch**
4. Click **View Demo** (ICBF)
5. See Executive Dashboard: **Risk Score**, hallazgos, **Elastic Evidence hits**, recomendación

**Pass criteria:** Steps 1–5 complete without error in < 60 seconds (after cache warm).

---

## Judge 10-second result test

On results page, judge must immediately see:

| Element | Location |
|---------|----------|
| Risk Score (0–100 gauge) | Executive Dashboard top |
| Hallazgos clave | Executive Dashboard |
| Evidencia (contratos, valor, fuentes, Elastic hits) | Executive Dashboard |
| Factores de riesgo | Executive Dashboard bars |
| Recomendación | Executive Dashboard footer |

---

## Feature verification matrix

| Feature | Route / Action | Status |
|---------|----------------|--------|
| View Demo | Home button → ICBF search | ✅ |
| Start Investigation | Focus search input | ✅ |
| Search | `/api/agent/search` | ✅ |
| Export PDF | `/api/expediente/pdf` | ✅ (after search) |
| Ver Expediente Ampliado | `/investigacion/[query]` | ✅ |
| Sidebar | `sidebar.tsx` | ✅ |
| Configuración | `/configuracion` → Sistema IA | ✅ |
| Try Example Investigations | ICBF, Min Transporte, Medellín, Antioquia | ✅ |
| MCP tools/list | `POST /api/mcp` | ✅ |
| Elastic visibility | Dashboard badges + hits | ✅ (if env configured) |

---

## Recommended demo order for judges

1. **View Demo** (ICBF) — fastest path to value
2. Point to **Elastic Evidence · N hits** badge
3. Scroll to **Gemini** IA panel when loaded
4. Mention **Agent Builder MCP** at `/api/mcp` (optional curl)
5. **Export PDF** as deliverable

---

## Outstanding user actions

1. Confirm `GEMINI_API_KEY` and `ELASTIC_*` on Vercel production
2. Upload public demo video (< 3 min)
3. Final Devpost submit with Elastic track + team members
4. Pre-warm searches 5 minutes before live judging

# NeurAudit AI — Hackathon UX Audit

**Google Cloud Rapid Agent Hackathon 2026 · Elastic Track**  
**Date:** 2026-06-03 · **Goal:** Judge understands value in &lt;30 seconds

---

## CRÍTICO (fixed)

| Issue | Status | Fix |
|-------|--------|-----|
| ADK Dev UI `127.0.0.1:8000` — connection refused if linked | ✅ Fixed | No public localhost links in UI; Config shows *Agent Runtime available in deployment environment* |
| Configuración exposed `127.0.0.1:8001/analyze`, endpoints, model vars | ✅ Fixed | Replaced with **Sistema IA** — operational status only (🟢🟡🔴) |
| **Ver Demo** button non-functional | ✅ Fixed | Runs live demo search (`ICBF`) |
| **Investigar Entidad** only focused input | ✅ Fixed | **Start Investigation** scrolls + focuses search |
| Analysis wall-of-text (9 sections) on results | ✅ Fixed | **Executive Dashboard** — gauge, 3 bullets, 5 hallazgos max, 1 recomendación |
| **Ver Detalles Completos** duplicated home content | ✅ Fixed | Home = executive view; link renamed **Ver Expediente Ampliado** → full expediente page |
| Elastic Track invisible to judges | ✅ Fixed | Elastic MCP / Search / Evidence badges on executive dashboard |

---

## ALTO (fixed)

| Issue | Status | Fix |
|-------|--------|-----|
| AWS CSV CORS on `/bases-datos` | ✅ Fixed (prior) | Next.js proxy `/api/csv-aws/[action]` |
| CSV proxy 502 on slow Lambda | ✅ Fixed (prior) | 8s timeout + degraded 200 response |
| CSV table showed duplicate entity rows | ✅ Fixed (prior) | Contract-level columns (ID, objeto, valor, proveedor) |
| No visual risk dashboard | ✅ Fixed | CSS gauge + factor bar chart (no Recharts dep) |
| `/api/system/status` leaked internal URLs | ✅ Fixed | Removed `analyzeUrl` from API response |

---

## MEDIO (fixed / accepted)

| Issue | Status | Notes |
|-------|--------|-------|
| Homepage hero not hackathon-positioned | ✅ Fixed | English hero + Elastic Track badge |
| Sidebar label "Configuración" | ✅ Fixed | Renamed **Sistema IA** |
| AI Analyst 9-section panel on home | ✅ Fixed | `executive` mode — 3 bullets + short conclusion |
| Agent Runtime not deployed on Cloud Run | 🟡 Accepted | Graceful partial status; Gemini + Elastic + datos.gov.co operational |
| `/investigacion/[query]` still verbose | 🟡 Accepted | Intentional — **Expediente Ampliado** for deep audit |

---

## BAJO (backlog)

| Issue | Status | Notes |
|-------|--------|-------|
| ADK Dev UI for local demos | 📋 Docs only | `adk web` in README — not linked from production UI |
| Recharts dependency | ⏭ Skipped | Pure CSS visualizations per constraint |
| Compare flow executive trim | 📋 Future | Compare page functional; not blocking demo |
| Pre-warm cache on deploy | 📋 Ops | Run ICBF/UNGRD before judge demo |

---

## Route audit

| Route | Status |
|-------|--------|
| `/` | ✅ Demo + search + executive results |
| `/bases-datos` | ✅ Soda2 + AWS CSV proxy |
| `/comparar` | ✅ Functional |
| `/historial` | ✅ Functional |
| `/configuracion` | ✅ Sistema IA (no localhost) |
| `/investigacion/[query]` | ✅ Full expediente (differentiated from home) |

---

## Demo script (30s)

1. Open home → **View Demo** (ICBF)  
2. Judge sees: Risk gauge, Elastic badges, executive bullets  
3. Optional: **Ver Expediente Ampliado** for depth  
4. **Sistema IA** → all services green/yellow, no infra URLs  

---

## Files changed (this pass)

- `src/app/page.tsx` — hero, demo buttons, elastic in sources
- `src/app/configuracion/page.tsx` — SaaS system status
- `src/app/api/system/status/route.ts` — public `services` map, no internal URLs
- `src/components/executive-dashboard.tsx` — **new**
- `src/components/investigation-results.tsx` — executive layout
- `src/components/ai-analyst-panel.tsx` — executive mode
- `src/components/sidebar.tsx` — Sistema IA label
- `src/lib/executive-summary.ts` — **new**
- `docs/HACKATHON_AUDIT.md` — **new**

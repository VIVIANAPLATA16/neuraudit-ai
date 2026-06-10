# Devpost Final Checklist — NeurAudit AI

**Deadline:** June 11, 2026 · 2:00 PM Pacific  
**Track:** Elastic  
**Live URL:** https://neuraudit.vercel.app  
**Repo:** https://github.com/VIVIANAPLATA16/neuraudit-ai

---

## Required submission items

| Item | Status | Evidence / Action |
|------|--------|-------------------|
| Public code repository | ✅ | https://github.com/VIVIANAPLATA16/neuraudit-ai — verify in incognito |
| Open Source license (OSI) visible in GitHub About | ✅ | `LICENSE` (MIT) in repo root |
| README with setup & run instructions | ✅ | `README.md` — clone, env vars, `npm run dev` |
| Hosted project URL works | ✅ | `curl -I https://neuraudit.vercel.app` → 200 |
| Partner track selected: Elastic | ⬜ | Confirm in Devpost form: **Elastic** |
| All team members listed | ⬜ | Verify in Devpost team section |
| Demo video < 3 min, public (YouTube/Vimeo) | ⬜ | **User action required** — upload & paste URL |
| Text description (features, tech, learnings) | ⬜ | Use `docs/DEVPOST_SUBMISSION.md` as draft |
| Project created during contest (May 5+ 2026) | ✅ | First commit: 2026-05-07 |

---

## Technology compliance (runtime — not README only)

| Required tech | Runtime evidence | How to demo |
|---------------|------------------|-------------|
| **Gemini** | `analysis.ts` → `ChatGoogleGenerativeAI.invoke()` | Search ICBF → IA panel shows "Gemini 2.5 Flash" |
| **Google Cloud Agent Builder** | MCP at `/api/mcp` | `POST tools/list` or Agent Builder console |
| **Elastic (partner)** | `elastic-search.ts` → `@elastic/elasticsearch` | Results show Elastic hits + `elasticInsights` in API |

See full mapping: [`docs/HACKATHON_COMPLIANCE.md`](HACKATHON_COMPLIANCE.md)

---

## Common disqualification errors (Devpost email)

| Error | NeurAudit status | Mitigation |
|-------|------------------|------------|
| Required tech not actually used | ⚠️ Verify live | Pre-warm demo: search ICBF before judging; confirm `meta.engine: "gemini"` in analysis |
| Hosted URL broken | ✅ | Test from fresh browser |
| Repo inaccessible | ✅ | Public, no 404 |
| No OSI license | ✅ | MIT `LICENSE` file |
| Project predates hackathon | ✅ | First commit May 7, 2026; mark "new" on Devpost |

---

## Pre-submission smoke test (5 minutes)

```bash
# 1. Home loads
curl -sS -o /dev/null -w "%{http_code}\n" https://neuraudit.vercel.app/

# 2. System status
curl -s https://neuraudit.vercel.app/api/system/status | jq '{gemini, elastic, mcp, services}'

# 3. MCP tools
curl -s -X POST https://neuraudit.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'

# 4. Investigation (may take 30–90s first time)
curl -s "https://neuraudit.vercel.app/api/agent/search?q=ICBF" | jq '{score: .riesgo.score, elastic: .elasticInsights.status, hits: .elasticInsights.totalHits}'
```

### Browser checklist

- [ ] **View Demo** launches ICBF investigation
- [ ] **Start Investigation** focuses search
- [ ] **Try Example Investigations** — all 4 examples work
- [ ] Executive Dashboard shows Risk Score, hallazgos, evidencia, recomendación
- [ ] **Export PDF** downloads file
- [ ] **Ver Expediente Ampliado** opens `/investigacion/[query]`
- [ ] Sidebar navigation works
- [ ] Configuración → Sistema IA shows green/yellow status (no localhost URLs)

---

## Video script outline (< 3 min)

1. **0:00–0:20** — Problem: Colombian procurement corruption, fragmented data
2. **0:20–1:00** — Live demo: ICBF search → Executive Dashboard → Elastic hits
2. **1:00–1:40** — Gemini IA report + PDF export
3. **1:40–2:20** — MCP: `tools/list` + `investigar_entidad` (Agent Builder)
4. **2:20–2:50** — Architecture: datos.gov.co + Elasticsearch + Gemini
5. **2:50–3:00** — Closing + repo URL

---

## Environment variables (Vercel)

Required for full demo:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Gemini analysis |
| `ELASTIC_ENDPOINT` | Elasticsearch cluster |
| `ELASTIC_API_KEY` | Elasticsearch auth |
| `NEXT_PUBLIC_APP_URL` | `https://neuraudit.vercel.app` |

Optional (GCP full stack):

| Variable | Purpose |
|----------|---------|
| `NEURAUDIT_ADK_ANALYZE_URL` | Cloud Run analyze service (not localhost on Vercel) |

---

## Files to reference in Devpost description

- Architecture: `docs/ARCHITECTURE.md`
- Compliance (runtime): `docs/HACKATHON_COMPLIANCE.md`
- API: `docs/API.md`
- Deployment: `docs/AGENT_DEPLOYMENT.md`

---

## Final actions before submit

1. [ ] Upload demo video (public)
2. [ ] Paste video URL in Devpost
3. [ ] Confirm Elastic track selected
4. [ ] Pre-warm ICBF + Ministerio de Transporte searches
5. [ ] Double-check team members
6. [ ] Submit / update Devpost entry

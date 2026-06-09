# Auditoría de Despliegue — NeurAudit AI

**Fecha:** 9 de junio de 2026  
**Acción posterior:** Recuperación y redeploy completados

---

## Estado Git (post-recuperación)

| Campo | Valor |
|-------|-------|
| Rama | `main` |
| Commit local | `6f7810f` |
| Commit remoto | `6f7810f` (sincronizado) |
| Remote | `https://github.com/VIVIANAPLATA16/neuraudit-ai.git` |
| Mensaje | `fix: restore latest NeurAudit full system (ADK + MCP + UI)` |

### Historial reciente

```
6f7810f fix: restore latest NeurAudit full system (ADK + MCP + UI)
4e2b19f Update README to remove ANTHROPIC_API_KEY
89e3a17 feat: ADK agent NeurAudit AI con Gemini 2.5 Flash - 3 herramientas reales
```

---

## Estado previo (problema detectado)

- **Producción Vercel:** commit `89e3a17` (~6 días antiguo)
- **Local:** 74 archivos sin commitear (Fase 22, UI nueva, APIs, ADK analyze)
- **Fase 22 en producción:** **NO** desplegada
- **gitSource en Vercel:** `null` (desync CLI vs GitHub)

---

## Estado Vercel (post-recuperación)

| Campo | Valor |
|-------|-------|
| Proyecto | `neuraudit` (`prj_6c5g9yuUHYtiFazdAVIDAlLogsgW`) |
| URL producción | **https://neuraudit.vercel.app** |
| Deployment ID | `dpl_ChWZCrhRoSZiFfA3wcRNbfB2wa68` |
| Build | SUCCESS (Next.js 16.2.5, 33s) |
| Rama GitHub | `main` (push `6f7810f`) |
| Auto-deploy GitHub | Push realizado; deploy manual `vercel deploy --prod` ejecutado |

### Variables Vercel configuradas

- `GEMINI_API_KEY` (Production)
- `GOOGLE_CLOUD_PROJECT` (Preview, Production)
- `ELASTIC_API_KEY`, `ELASTIC_ENDPOINT` (Preview, Production)

### Verificación producción

```bash
curl https://neuraudit.vercel.app/api/system/status
# → cache.ttlMs: 1800000 (Fase 22)
# → gemini.connected: true
# → mcp.status: configured

curl -o /dev/null -w "%{http_code}" https://neuraudit.vercel.app/api/agent/analysis
# → 405 (ruta POST existe — Fase 22)
```

---

## Estado GitHub

- **Plataforma:** GitHub (`VIVIANAPLATA16/neuraudit-ai`)
- **No** GitLab / Bitbucket
- Rama producción: `main`

---

## Archivos incluidos en commit `6f7810f`

- 74 archivos, +9.001 / -4.337 líneas
- Phase 22: `datos-fetcher.ts`, `search-normalize.ts`, `fetch-pool.ts`, `investigation-cache.ts`, `score-explainability.ts`
- APIs: `/api/agent/analysis`, `/compare`, `/insights`, `/system/status`, `/expediente/pdf`
- UI: `src/app/page.tsx`, componentes, sidebar, historial, comparar, configuración
- ADK: `analyze_service.py`, `analyze.py`, Docker
- Docs: `PHASE22_*.md`, `DOCKER_RUNTIME_VALIDATION.md`

### Excluidos (preservados en disco, no en repo)

- `.env.local`, backups (`page.original`, `page.tsx.backup`)
- `neuraudit_agent/.adk/session.db`, `__pycache__/`

---

## Conclusión final

| Pregunta | Respuesta |
|----------|-----------|
| ¿Fase 22 desplegada? | **Sí** (post `6f7810f` + redeploy) |
| ¿Producción = local? | **Sí** (código sincronizado) |
| ¿ADK en Vercel? | **No** — ADK es servicio externo (`:8001`); en Vercel `adk.connected: false` es esperado |
| ¿UI nueva visible? | **Sí** — `https://neuraudit.vercel.app` |

**Producción actualizada.** Sistema completo restaurado en GitHub y Vercel.

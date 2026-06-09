# Informe de Auditoría de Código — NeurAudit AI

**Fecha:** 2026-06-03  
**Alcance:** FASE 21 — Identificación de código muerto, duplicados y dependencias sin uso.  
**Acción:** Solo reporte. No se eliminó ningún archivo automáticamente.

---

## 1. Archivos backup / legacy (candidatos a limpieza manual)

| Archivo | Estado | Notas |
|---------|--------|-------|
| `src/app/page.tsx.backup` | Muerto | Backup UI antigua. No importado. |
| `src/app/page.original` | Muerto | UI legacy clara (#003366). |
| `src/app/page.dashboard-viejo` | Muerto | Dashboard anterior. |
| `src/app/globals.css.bak` | Muerto | Backup CSS. |

---

## 2. Componentes y libs con uso limitado

| Archivo | Estado | Notas |
|---------|--------|-------|
| `src/lib/favorites.ts` | Sin UI | Modelo definido, sin consumidor en componentes. |
| `src/lib/insights.ts` | Deprecado | Reemplazado por `analysis.ts`. Route `/api/agent/insights` delega. |
| `src/lib/contractConfidence.ts` | Sin consumidor | No referenciado en app routes ni components. |

---

## 3. Rutas API

| Ruta | Consumidor | Estado |
|------|------------|--------|
| `/api/agent/search` | Principal | Activo |
| `/api/agent/analysis` | page, investigacion, comparar, PDF | Activo |
| `/api/agent/compare` | comparar | Activo |
| `/api/agent/insights` | Legacy | Deprecado, delega a analysis |
| `/api/agent/summary` | MCP/agent ADK | Activo |
| `/api/expediente/pdf` | UI | Activo |
| `/api/system/status` | /configuracion | Activo |
| `/api/analyze` | — | Sin consumidor frontend directo |
| `/api/mcp/*` | MCP externo | Activo para integraciones |
| `/api/paco`, `/api/secop`, `/api/soda2` | — | Revisar uso — posible legacy |

---

## 4. Dependencias npm potencialmente sin uso

| Paquete | Evidencia |
|---------|-----------|
| `mammoth` | No importado en `src/` |
| `pdfjs-dist` | No importado en `src/` |
| `openai` | No importado en `src/` |
| `@azure/openai` | No importado en `src/` |
| `@elastic/elasticsearch` | No importado en `src/` |
| `@langchain/langgraph` | No importado en `src/` |

---

## 5. Duplicación funcional

| Área | Duplicado | Recomendación |
|------|-----------|---------------|
| Análisis IA | `insights.ts` vs `analysis.ts` | Mantener `analysis.ts` |
| Interpretación | `interpretation.ts` + `analysis.ts` | Complementarios |

---

## 6. Agente ADK

| Componente | Estado |
|------------|--------|
| `neuraudit_agent/agent.py` | Activo |
| `neuraudit_agent/analyze.py` | Cerebro análisis profundo |
| `neuraudit_agent/analyze_service.py` | FastAPI puerto 8001 |

```bash
uvicorn neuraudit_agent.analyze_service:app --host 127.0.0.1 --port 8001
```

---

## 7. Páginas activas

`/`, `/investigacion/[query]`, `/comparar`, `/comparar/[A]/[B]`, `/historial`, `/configuracion`, `/bases-datos`

# Informe de Estado del Proyecto — NeurAudit AI

**Fecha:** 2026-06-03  
**Rol:** Arquitecto Principal  
**Metodología:** Auditoría directa del repositorio (71 archivos en árbol activo, sin suposiciones)  
**Alcance:** Estado real, arquitectura, funcionalidades, riesgos, deuda técnica y roadmap Fase 22–26

---

## 1. Estado real del sistema

### 1.1 Qué funciona (verificado en código)

| Capacidad | Evidencia | Nivel de madurez |
|-----------|-----------|------------------|
| **Búsqueda multi-fuente** | `src/lib/investigation.ts` — 13 consultas paralelas a datos.gov.co | Operativo |
| **Motor de riesgo** | `src/lib/risk-engine.ts` — score 0–100, breakdown, alertas, hallazgos, recomendaciones | Operativo |
| **Capa interpretativa** | `src/lib/interpretation.ts` — análisis ejecutivo, factores, hallazgos enriquecidos | Operativo |
| **Analytics contractuales** | `src/lib/data-analytics.ts` — top proveedores/contratos, concentración top 5/10 | Operativo |
| **UI principal** | `src/app/page.tsx` — home → loading → results | Operativo |
| **Expediente digital** | `src/app/investigacion/[query]/page.tsx` + `expediente-sections.tsx` | Operativo |
| **PDF institucional** | `src/app/api/expediente/pdf/route.ts` — jsPDF, 10+ secciones | Operativo |
| **Comparador** | `/comparar`, `/comparar/[A]/[B]` + tabla comparativa + IA | Operativo |
| **Historial local** | `src/lib/history.ts` + `/historial` — localStorage | Operativo (solo cliente) |
| **Configuración / diagnóstico** | `/configuracion` + `/api/system/status` | Operativo |
| **Sidebar navegable** | `src/components/sidebar.tsx` — 6 destinos | Operativo |
| **Panel Analista IA** | `src/components/ai-analyst-panel.tsx` — 9 secciones + metadatos | Operativo |
| **Análisis IA (cadena)** | `src/lib/analysis.ts` — ADK → Gemini → derived | Operativo con fallback |
| **Agente ADK (herramientas)** | `neuraudit_agent/agent.py` — search, compare, fiscal report | Operativo si ADK dev-ui corre |
| **Servicio ADK análisis** | `neuraudit_agent/analyze_service.py` :8001 | Operativo si se inicia manualmente |
| **Gemini** | `analyze.py`, `analysis.ts` (`@langchain/google-genai`) | Operativo con `GOOGLE_API_KEY` |
| **MCP interno** | `src/app/api/mcp/*` — investigar_entidad, comparar_entidades | Implementado |
| **Build producción** | `npm run build` — exitoso (13 rutas app + APIs) | Operativo |
| **Bases de datos UI** | `src/app/bases-datos/page.tsx` | Operativo |

### 1.2 Qué funciona parcialmente

| Capacidad | Limitación real |
|-----------|-----------------|
| **ADK como cerebro principal** | `invokeADKAnalysis()` en `adk-client.ts` llama a `localhost:8001`. Si el servicio no está levantado, cae a Gemini directo o `buildDerivedAnalysis()`. El usuario no ve ADK; depende de proceso externo. |
| **Análisis profundo 500+ palabras** | El prompt exige extensión (`analyze.py`, `analysis.ts`), pero Gemini puede no cumplirla. El fallback `padSection()` en `buildDerivedAnalysis()` rellena con texto repetitivo — no es auditoría real. |
| **Datos SECOP completos** | Límites hardcoded: SECOP II `$limit=50`, otras fuentes 20–30 registros, timeout 10s por fuente, errores silenciados (`return []`). Entidades grandes quedan sub-muestreadas. |
| **Persistencia de investigaciones** | `sessionStorage` (investigation-store) + `localStorage` (historial). No hay servidor ni base de datos. |
| **README / marketing** | Afirma Elastic, red de contratistas, Agent Builder — no refleja el código de producción. |
| **Ruta compare API** | `src/app/api/agent/compare/route.ts` aún usa `insights.ts` (legado), no el pipeline `analysis.ts` de 9 secciones. |
| **Configuración ADK URL** | `settings.ts` guarda `adkAnalyzeUrl` en localStorage pero `adk-client.ts` lee solo `process.env.NEURAUDIT_ADK_ANALYZE_URL`. La UI de configuración no afecta el backend. |

### 1.3 Qué no funciona / no existe en runtime

| Capacidad | Evidencia |
|-----------|-----------|
| **Elasticsearch en la app** | `@elastic/elasticsearch` en `package.json` pero **cero imports en `src/`**. Solo `scripts/index-secop.mjs` (script manual, no integrado al flujo de búsqueda). |
| **Búsqueda semántica** | No hay cliente Elastic en rutas API ni en `runInvestigation()`. |
| **Indexación automática** | Script existe; no hay cron, worker ni trigger desde la app. |
| **Red de contratistas / grafos** | Mencionado en README y texto de `agent.py`; no hay componente ni lib de grafos. |
| **Autenticación / usuarios** | No hay auth, middleware, ni modelo de usuario en `src/`. |
| **Persistencia empresarial** | No Prisma, Supabase, Postgres, ni API de almacenamiento. |
| **Dashboard ejecutivo** | No existe ruta `/dashboard` ni agregación multi-entidad. |
| **Monitoreo automático** | No hay alertas programadas, webhooks ni jobs. |
| **Monetización SaaS** | No Stripe, planes, límites por tenant, ni facturación. |
| **Favoritos UI** | `src/lib/favorites.ts` definido; ningún componente lo consume. |
| **`.env.example`** | No presente en el repositorio (búsqueda glob: 0 archivos). |

### 1.4 Cadena de análisis IA — estado real

```
POST /api/agent/analysis
    │
    ├─① POST http://127.0.0.1:8001/analyze  (analyze_service.py → analyze.py → Gemini)
    │      └─ Requiere: uvicorn manual + GOOGLE_API_KEY en entorno Python
    │
    ├─② invokeGeminiDirect()  (analysis.ts → @langchain/google-genai)
    │      └─ Requiere: GOOGLE_API_KEY en entorno Next.js
    │
    └─③ buildDerivedAnalysis()  (reglas + interpretation + padSection)
           └─ Siempre disponible; source: "derived"
```

**Conclusión:** Gemini puede funcionar sin ADK. ADK analyze_service es un wrapper FastAPI sobre el mismo modelo, no invoca `agent.py` root_agent ni sus herramientas ADK directamente.

---

## 2. Arquitectura actual

### 2.1 Diagrama lógico

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 16 (App Router)                             │
│  src/app/          src/components/       src/lib/               │
│  page.tsx          sidebar.tsx             investigation.ts       │
│  investigacion/    ai-analyst-panel.tsx    risk-engine.ts         │
│  comparar/         intelligence-sections     interpretation.ts    │
│  historial/        expediente-sections     analysis.ts            │
│  configuracion/                              data-analytics.ts    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch
┌───────────────────────────▼─────────────────────────────────────┐
│  API ROUTES — Next.js Route Handlers                            │
│  /api/agent/search      → runInvestigation()                    │
│  /api/agent/analysis    → generateAnalysis()                    │
│  /api/agent/compare     → 2× runInvestigation + insights (legado)│
│  /api/expediente/pdf    → runInvestigation + generateAnalysis │
│  /api/system/status     → health check                          │
│  /api/mcp/*             → proxy a summary/search                  │
│  /api/analyze           → ruta legacy (Anthropic/OpenAI)        │
└───────────┬─────────────────────────────┬───────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌──────────────────────────────────┐
│  FUENTES EXTERNAS     │    │  CEREBRO IA                       │
│  datos.gov.co (13)    │    │  analyze_service.py :8001 (opt.)  │
│  SECOP I/II, CGR,     │    │  analyze.py → Gemini 2.5 Flash    │
│  Procuraduría, SGR,   │    │  agent.py (ADK dev :8000)         │
│  Sanciones, etc.      │    │  analysis.ts → Gemini directo     │
└───────────────────────┘    └──────────────────────────────────┘

PERSISTENCIA CLIENTE:
  sessionStorage — investigación activa
  localStorage   — historial + settings
```

### 2.2 Frontend

| Elemento | Ubicación | Notas |
|----------|-----------|-------|
| Framework | Next.js 16.2.5, React 19 | App Router |
| Estilos | Tailwind v4, `globals.css` | Tema oscuro, glassmorphism |
| Animaciones | framer-motion | Timeline, transiciones |
| Layout secundario | `app-shell.tsx` | Sidebar + header |
| Estado búsqueda | `page.tsx` local state | No Zustand/Redux |

### 2.3 Backend (Next.js API)

| Ruta | Función |
|------|---------|
| `GET /api/agent/search` | Investigación completa |
| `POST /api/agent/analysis` | Análisis IA profundo |
| `GET /api/agent/compare` | Dos investigaciones + insights legado |
| `GET /api/expediente/pdf` | PDF multi-sección |
| `GET /api/system/status` | Diagnóstico |
| `GET/POST /api/mcp/*` | Protocolo MCP para integraciones |
| `POST /api/analyze` | Legacy — análisis de contrato individual (Anthropic/OpenAI) |

### 2.4 ADK (Python)

| Archivo | Rol |
|---------|-----|
| `agent.py` | Agente ADK con 3 herramientas; llama `NEURAUDIT_API` → localhost:3000 `/api/agent/search` |
| `analyze.py` | Prompt profundo 9 secciones; invoca Gemini vía `google.generativeai` o langchain |
| `analyze_service.py` | FastAPI `/analyze` y `/health` en puerto 8001 |
| `.adk/session.db` | Sesiones ADK dev-ui |

**Nota arquitectónica:** Existen dos procesos Python independientes:
- `:8000` — ADK dev-ui (`agent.py`)
- `:8001` — analyze_service (análisis profundo)

No hay orquestación automática entre ellos ni con Next.js.

### 2.5 Gemini

| Punto de uso | Archivo |
|--------------|---------|
| Config compartida | `src/lib/gemini-config.ts` — modelo `gemini-2.5-flash` |
| Análisis Next.js | `src/lib/analysis.ts` — `@langchain/google-genai` |
| Análisis Python | `neuraudit_agent/analyze.py` |
| Insights legado | `src/lib/insights.ts` — aún usado por compare y search?insights=true |

### 2.6 MCP

| Archivo | Función |
|---------|---------|
| `api/mcp/route.ts` | Lista herramientas MCP |
| `api/mcp/message/route.ts` | Ejecución de tools |
| `api/mcp/sse/route.ts` | SSE para sesiones |

Tools: `investigar_entidad`, `comparar_entidades` → delegan a `/api/agent/summary`.

### 2.7 Elastic — estado declarado vs real

| Componente | Estado |
|------------|--------|
| `ELASTIC_ENDPOINT` / `ELASTIC_API_KEY` | Variables referenciadas en README y script |
| `scripts/index-secop.mjs` | Script standalone de indexación |
| Runtime de la app | **No integrado** |
| `agent.py` línea "Elastic Search" | **Texto informativo falso** en lista de fuentes |

---

## 3. Funcionalidades terminadas

### Core de investigación
- [x] Búsqueda por nombre/NIT en 13 fuentes datos.gov.co
- [x] Score de riesgo 0–100 con 10 reglas documentadas
- [x] Breakdown de factores, alertas, hallazgos, recomendaciones
- [x] Interpretación ejecutiva (capa `interpretation.ts`)
- [x] Analytics: top proveedores, contratos, concentración, modalidades, recurrencia

### Experiencia de usuario
- [x] Flujo home → loading (timeline) → resultados
- [x] Expediente completo `/investigacion/[query]`
- [x] PDF descargable institucional
- [x] Comparador `/comparar` y `/comparar/[A]/[B]`
- [x] Historial local `/historial`
- [x] Configuración y diagnóstico `/configuracion`
- [x] Bases de datos `/bases-datos`
- [x] Sidebar funcional (6 destinos)
- [x] Panel Analista IA con 9 secciones y metadatos de transparencia

### Inteligencia artificial
- [x] Cadena ADK → Gemini → derived
- [x] Análisis comparativo IA
- [x] Prompt anticorrupción con restricciones anti-alucinación
- [x] Agente ADK con herramientas search/compare/report

### Integraciones
- [x] MCP server interno
- [x] API REST para búsqueda, análisis, compare, PDF, status

### Documentación interna
- [x] `docs/CODE_AUDIT.md` (Fase 21)

---

## 4. Funcionalidades incompletas (priorizadas)

### P0 — Bloquean credibilidad comercial

| # | Funcionalidad | Gap |
|---|---------------|-----|
| 1 | **Cobertura de datos SECOP** | Límites 20–50 registros; timeouts silenciosos; entidades grandes incompletas |
| 2 | **ADK siempre disponible** | Servicio :8001 manual; sin proceso supervisado en deploy |
| 3 | **README / documentación alineada** | Claims de Elastic, grafos, Agent Builder no implementados |
| 4 | **Análisis IA consistente** | Compare API usa `insights.ts` legado; no pipeline unificado de 9 secciones |

### P1 — Bloquean venta institucional

| # | Funcionalidad | Gap |
|---|---------------|-----|
| 5 | **Autenticación y multi-usuario** | No existe |
| 6 | **Persistencia servidor** | Solo localStorage/sessionStorage |
| 7 | **Historial empresarial** | Sin export, sin compartir, sin auditoría de accesos |
| 8 | **Elasticsearch / búsqueda semántica** | Script huérfano; no en flujo principal |

### P2 — Diferenciación SaaS

| # | Funcionalidad | Gap |
|---|---------------|-----|
| 9 | **Dashboard ejecutivo** | Vista agregada multi-entidad, KPIs, tendencias |
| 10 | **Monitoreo automático** | Alertas cuando score cambia o nuevos contratos |
| 11 | **Favoritos / watchlist** | Modelo sin UI |
| 12 | **Red de contratistas** | Prometido, no construido |

### P3 — Monetización

| # | Funcionalidad | Gap |
|---|---------------|-----|
| 13 | **Planes y límites** | Sin tiers Free/Pro/Enterprise |
| 14 | **Facturación** | Sin Stripe ni equivalente |
| 15 | **Multi-tenant** | Sin aislamiento por organización |

---

## 5. Riesgos técnicos (producción)

| Riesgo | Severidad | Descripción |
|--------|-----------|-------------|
| **Dependencia datos.gov.co** | Alta | API pública sin SLA; timeouts 10s; caídas silenciosas devuelven score bajo artificial |
| **Sub-muestreo de contratos** | Alta | $limit=50 puede omitir millones en entidades como Policía, MinSalud |
| **ADK :8001 no supervisado** | Alta | En producción sin uvicorn → 100% fallback derived si también falla Gemini |
| **Gemini rate limits / costos** | Media | Análisis 9×500 palabras por búsqueda; sin cache ni deduplicación |
| **Sin autenticación en APIs** | Alta | Cualquiera puede llamar `/api/agent/search` y `/api/agent/analysis` |
| **CORS / localhost hardcoded** | Media | `adk-client`, `analyze_service` asumen 127.0.0.1 |
| **Secrets en cliente** | Media | Settings UI no debe exponer API keys (actualmente no las muestra, pero tampoco las gestiona bien) |
| **sessionStorage volátil** | Media | Expediente se pierde al cerrar pestaña si no está en historial |
| **PDF síncrono pesado** | Media | `generateAnalysis()` dentro de PDF puede timeout en serverless |
| **Deuda de dependencias** | Baja | 6+ paquetes npm sin uso aumentan superficie de ataque |
| **Archivos backup en repo** | Baja | `page.tsx.backup`, `page.original` — confusión, no impacto runtime |

---

## 6. Deuda técnica

### 6.1 Código

| Item | Ubicación | Acción recomendada |
|------|-----------|-------------------|
| Rutas API duplicadas | `insights.ts` vs `analysis.ts` | Unificar en `analysis.ts` |
| Ruta legacy | `/api/analyze` (Anthropic/OpenAI) | Deprecar o documentar |
| Libs sin uso | `favorites.ts`, `contractConfidence.ts` | Conectar UI o archivar |
| 4 archivos backup | `src/app/page.*` | Mover fuera de repo tras aprobación |
| Compare API | `compare/route.ts` | Migrar a `generateComparativeAnalysis()` |
| Config desconectada | `settings.ts` vs `adk-client.ts` | Unificar fuente de verdad |

### 6.2 Dependencias npm sin uso en `src/`

- `@elastic/elasticsearch` (solo script)
- `@azure/openai`, `openai` (solo `/api/analyze` legacy)
- `mammoth`, `pdfjs-dist`
- `@langchain/langgraph`, `langchain` (core)

### 6.3 Documentación

- `README.md` desactualizado respecto al producto real
- Falta `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`, `.env.example`
- `agent.py` lista "Elastic Search" como fuente activa — incorrecto

### 6.4 Infraestructura

- Sin Docker Compose para Next + ADK analyze + ADK agent
- Sin CI/CD documentado
- Sin tests automatizados (unit, integration, e2e)

---

## 7. Roadmap recomendado (Fase 22–26)

Ordenado por **impacto de negocio** para venta a veedurías, contralorías, procuradurías, periodistas, ONG, firmas de auditoría y compliance.

---

### Fase 22 — Confiabilidad de datos y credibilidad del informe
**Impacto:** Crítico — sin datos completos no hay venta institucional.

| Tarea | Descripción |
|-------|-------------|
| 22.1 | Paginación real en SECOP (eliminar límite 50; cursor/offset hasta agotar o cap configurable) |
| 22.2 | Manejo explícito de errores por fuente (no silenciar `[]`) |
| 22.3 | Unificar pipeline IA: compare y search usan `analysis.ts` |
| 22.4 | Docker Compose: Next.js + analyze_service + variables documentadas |
| 22.5 | Alinear README y textos de agent.py con realidad |
| 22.6 | Cache de investigaciones por query (TTL) para reducir costo Gemini |

**Entregable comercial:** Informes auditables con cobertura demostrable y fuente IA trazable.

---

### Fase 23 — Plataforma multi-usuario y persistencia
**Impacto:** Alto — requisito para SaaS B2B e instituciones.

| Tarea | Descripción |
|-------|-------------|
| 23.1 | Auth (NextAuth, Clerk o similar) — email, SSO institucional |
| 23.2 | Base de datos (PostgreSQL + Prisma/Drizzle) — usuarios, organizaciones, investigaciones |
| 23.3 | Migrar historial de localStorage a servidor por usuario |
| 23.4 | Expedientes persistentes con versionado (timestamp, score histórico) |
| 23.5 | Roles: analista, supervisor, admin org |
| 23.6 | API keys por organización para integraciones |

**Entregable comercial:** Cuentas institucionales, expedientes que no se pierden, trazabilidad.

---

### Fase 24 — Inteligencia ampliada (Elastic + monitoreo)
**Impacto:** Alto — diferenciador vs consultas manuales en SECOP.

| Tarea | Descripción |
|-------|-------------|
| 24.1 | Integrar Elasticsearch en `runInvestigation()` como fuente complementaria |
| 24.2 | Indexación programada (worker/cron) desde SECOP |
| 24.3 | Búsqueda semántica por objeto contractual y similitud de proveedores |
| 24.4 | Watchlist / favoritos con UI + alertas por email/webhook |
| 24.5 | Dashboard ejecutivo: entidades monitoreadas, scores en el tiempo |
| 24.6 | Grafos básicos de relación entidad–proveedor (sin rediseñar UI) |

**Entregable comercial:** "NeurAudit vigila por usted" — valor recurrente SaaS.

---

### Fase 25 — Producto SaaS comercial
**Impacto:** Medio-alto — habilita ingresos.

| Tarea | Descripción |
|-------|-------------|
| 25.1 | Planes: Free (5 consultas/mes), Pro (ilimitado + PDF), Enterprise (API + SSO) |
| 25.2 | Stripe / facturación Colombia-compatible |
| 25.3 | Límites por plan en APIs (rate limiting) |
| 25.4 | Onboarding institucional (logo org, plantilla PDF) |
| 25.5 | Exportación masiva (CSV, JSON, ZIP de PDFs) |
| 25.6 | Landing comercial separada del app (sin tocar UI investigación) |

**Entregable comercial:** Producto vendible con pricing público.

---

### Fase 26 — Escala, compliance y certificación
**Impacto:** Medio — desbloquea contratos grandes.

| Tarea | Descripción |
|-------|-------------|
| 26.1 | Auditoría de seguridad (OWASP, penetration test) |
| 26.2 | Política de datos y retención (Ley 1581 Colombia) |
| 26.3 | SLA y monitoreo (Sentry, Datadog, healthchecks) |
| 26.4 | Tests E2E (Playwright) en flujos críticos |
| 26.5 | Documentación para entes de control (metodología de score, fuentes, limitaciones) |
| 26.6 | Certificación / pilotos formales con veeduría o universidad aliada |

**Entregable comercial:** Confianza para Contraloría, Procuraduría y firmas Big Four como revendedores.

---

## 8. Inventario de archivos clave

```
neuraudit/
├── src/app/                    # Next.js App Router (7 páginas + APIs)
├── src/components/             # 8 componentes UI
├── src/lib/                    # 16 módulos de lógica
├── neuraudit_agent/            # ADK Python (agent, analyze, service)
├── scripts/index-secop.mjs     # Elastic indexing (standalone)
├── docs/CODE_AUDIT.md
└── docs/PROJECT_STATUS_REPORT.md  # este documento
```

---

## 9. Resumen ejecutivo

NeurAudit AI es una **plataforma funcional de investigación anticorrupción** con UI premium, motor de riesgo real, expedientes, PDF, comparador e IA de 9 secciones. El flujo principal **funciona end-to-end** contra datos públicos colombianos.

Las brechas críticas para comercialización son:

1. **Datos incompletos** por límites y timeouts en datos.gov.co  
2. **Sin usuarios ni persistencia servidor**  
3. **Elastic y búsqueda semántica declarados pero no integrados**  
4. **ADK analyze_service no es proceso gestionado en deploy**  
5. **Documentación desalineada con el producto real**

El producto está listo para **demos, hackathons y pilotos controlados**. No está listo para **SaaS comercial multi-tenant** sin Fases 22–25.

---

*Documento generado por auditoría de código. No se modificó ningún archivo de aplicación durante su elaboración.*

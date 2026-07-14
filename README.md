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

---

# 🇨🇴 ESPAÑOL

## NeurAudit AI

Agente de inteligencia anti-corrupción para contratación pública colombiana.

Desarrollado para el **Concurso Datos al Ecosistema 2026: IA para Colombia** — MinTIC · datos.gov.co | Google Cloud Rapid Agent Hackathon 2026 — Elastic Track · Gemini · ADK · MCP · Agent Builder

Demo en vivo: https://neuraudit-web-986541948066.us-central1.run.app

## Qué es

NeurAudit AI cruza 13 conjuntos de datos oficiales del gobierno (SECOP, Contraloría General, Procuraduría, fondos de regalías, sanciones) y entrega, en segundos:

- Puntaje de riesgo 0–100 con explicabilidad formal (scoreExplainability)
- Trazabilidad por fuente (éxito / parcial / error / timeout / vacío)
- Informes de auditoría profunda con Gemini 2.5 Flash
- Expedientes en PDF y comparación de entidades
- Integración MCP con Google Cloud Agent Builder

## Stack tecnológico unificado

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend & BFF | Next.js 16, React 19, Tailwind CSS 4 | UI + rutas API serverless (Vercel / Cloud Run) |
| Datos gobierno en vivo | datos.gov.co (Socrata) | 13 datasets, fetch paginado con backoff |
| Búsqueda híbrida | Elasticsearch en GCP (secop-contratos) | Búsqueda semántica SECOP en tiempo real |
| Motor de riesgo | TypeScript (risk-engine.ts) | 10 reglas — sin cambios, determinístico |
| IA Generativa | Gemini 2.5 Flash | Google AI Studio API (producción) · Listo para Vertex AI en GCP |
| Orquestación IA | ADK → Gemini → fallback derivado | Nunca deja al usuario sin respuesta |
| ADK Analyze | FastAPI (analyze_service.py) | Microservicio de análisis profundo (Docker / Cloud Run) |
| Superficies de agente | Google Cloud Agent Builder (MCP) | JSON-RPC en /api/mcp |
| ADK Dev UI | agent.py (Google ADK) | Local :8000 para demos |
| Persistencia | Caché en memoria + almacenamiento navegador | Sin SQL requerido para MVP |

## Arquitectura

    Consulta del usuario
         │
         ├─► datos.gov.co (13 fuentes) ──┐
         └─► Elasticsearch GCP (híbrido) ─┤
                                           ▼
                                Motor de riesgo + explicabilidad
                                           ▼
                         ADK Analyze → Gemini 2.5 Flash → fallback derivado
                                           ▼
                         UI · PDF · Comparar · MCP · Agent Builder

Arquitectura completa: docs/ARCHITECTURE.md

## Cómo funciona (60 segundos)

1. El usuario busca una entidad (ej. ICBF, UNGRD).
2. runInvestigation() consulta datos.gov.co y Elasticsearch en paralelo.
3. El motor de riesgo calcula puntaje, alertas y hallazgos enriquecidos.
4. POST /api/agent/analysis opcional ejecuta el pipeline IA: ADK Analyze → Gemini → fallback derivado.
5. Resultados disponibles en UI, exportación PDF, vistas comparativas o vía MCP para agentes externos.

## Instalación local

### Requisitos
- Node.js 20+
- Python 3.11+ (para ADK Analyze)
- Docker (opcional, recomendado)
- GEMINI_API_KEY o GOOGLE_API_KEY (Google AI Studio)
- ELASTIC_ENDPOINT + ELASTIC_API_KEY (opcional — omisión elegante si no está)

### Clonar e instalar

    git clone https://github.com/VIVIANAPLATA16/neuraudit-ai.git
    cd neuraudit-ai
    npm install

Crear .env.local en la raíz del proyecto:

    # Requerido para análisis generativo
    GEMINI_API_KEY=tu_api_key_google_ai_studio

    # Opcional — Elasticsearch búsqueda híbrida (clúster GCP)
    ELASTIC_ENDPOINT=https://tu-deployment.es.us-central1.gcp.cloud.es.io
    ELASTIC_API_KEY=tu_elastic_api_key

    # Opcional — ADK Analyze (por defecto localhost:8001)
    NEURAUDIT_ADK_ANALYZE_URL=http://127.0.0.1:8001/analyze

Indexar SECOP en Elasticsearch (una sola vez):

    node scripts/index-secop.mjs

### Opción A — Desarrollo rápido

    # Terminal 1 — ADK Analyze (FastAPI)
    python3 -m uvicorn neuraudit_agent.analyze_service:app --host 127.0.0.1 --port 8001

    # Terminal 2 — Next.js
    npm run dev
    # → http://localhost:3000

### Opción B — Docker Compose (recomendado)

    docker compose up --build
    # Next.js → http://localhost:3000
    # ADK Analyze → http://localhost:8001/health

### Opción C — ADK Dev UI (demo del agente)

    adk web --port 8000
    # → http://127.0.0.1:8000/dev-ui/

### Verificar

    curl http://localhost:3000/api/system/status
    # Verificar: gemini.connected, elastic.configured, adk.connected

## Despliegue empresarial

### Frontend — Vercel (producción actual)
Conectado a main en GitHub. Push a main → despliegue automático.

    vercel deploy --prod   # despliegue manual si es necesario

Variables de entorno en Vercel:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| GEMINI_API_KEY | Sí | API key de Google AI Studio |
| ELASTIC_ENDPOINT | Recomendada | Endpoint de Elasticsearch en GCP |
| ELASTIC_API_KEY | Recomendada | API key de Elastic |
| NEURAUDIT_ADK_ANALYZE_URL | Si ADK en nube | URL de Cloud Run Analyze |

### Stack completo — Google Cloud Run

    export GCP_PROJECT_ID="tu-proyecto-gcp"
    export GCP_REGION="us-central1"
    export GEMINI_API_KEY="..."
    export ELASTIC_ENDPOINT="https://..."
    export ELASTIC_API_KEY="..."

    chmod +x deploy-gcp.sh
    ./deploy-gcp.sh

El script:
- Habilita APIs de GCP requeridas (Run, Artifact Registry, Cloud Build)
- Construye y publica imágenes Docker (nextjs + adk-analyze)
- Despliega ADK Analyze en Cloud Run (:8001, timeout 300s)
- Despliega Next.js en Cloud Run (:8080, 2Gi RAM, timeout 300s)
- Conecta NEURAUDIT_ADK_ANALYZE_URL al servicio Analyze desplegado

## Superficies del agente

NeurAudit expone tres superficies de agente:

| Superficie | Punto de entrada | Audiencia |
|-----------|-----------------|-----------|
| UI Web | / | Auditores, periodistas, ciudadanos |
| Servidor MCP | POST /api/mcp | Google Cloud Agent Builder |
| ADK Analyze | analyze_service.py | Pipeline IA de Next.js (interno) |

## API principal

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/agent/search?q= | GET | Investigación completa (13 fuentes + Elastic) |
| /api/agent/analysis | POST | Informe de auditoría profunda con IA |
| /api/agent/compare?a=&b= | GET | Comparar dos entidades |
| /api/expediente/pdf?q= | GET | Expediente en PDF |
| /api/system/status | GET | Diagnóstico del sistema |
| /api/mcp | POST | MCP JSON-RPC (Agent Builder) |

Referencia completa: docs/API.md

## Casos de uso

| Usuario | Caso de uso |
|---------|-------------|
| Auditor / Contraloría | Priorizar entidades por puntaje de riesgo explicable |
| Periodista | Investigación de contratación en minutos |
| Sociedad civil | Transparencia sobre entidades y contratistas del Estado |
| Jurados hackathon | Demo en vivo: MCP + Gemini + datos reales del gobierno + búsqueda Elastic híbrida |

## Documentación

| Documento | Contenido |
|-----------|-----------|
| docs/DEVPOST_SUBMISSION.md | Copia Devpost + script de demo |
| docs/ARCHITECTURE.md | Arquitectura en un minuto |
| docs/AGENT_DEPLOYMENT.md | Despliegue del agente en Cloud Run |
| docs/API.md | Endpoints activos vs legacy |
| docs/DEPLOYMENT_AUDIT.md | Auditoría de producción en Vercel |

## Alineación con el Concurso Datos al Ecosistema 2026: IA para Colombia

| Criterio | Cómo NeurAudit AI lo cumple |
|----------|----------------------------|
| Innovación y creatividad | Motor de riesgo con 10 reglas + IA generativa única en Colombia |
| Uso de datos abiertos | 13 datasets de datos.gov.co en tiempo real |
| Análisis y rigor técnico | Puntuación determinística + explicabilidad formal por fuente |
| Uso de tecnologías emergentes — IA | Gemini 2.5 Flash + ADK + detección de anomalías en contratación pública |
| Impacto y escalabilidad | Aplicable a todas las entidades públicas colombianas — potencial adopción por Contraloría y Procuraduría |
| Diseño, comunicación y usabilidad | UI intuitiva, PDF exportable, comparación de entidades, acceso ciudadano |

### Datasets de datos.gov.co utilizados

| Dataset | Uso en NeurAudit AI |
|---------|-------------------|
| SECOP II — Contratos públicos | Fuente principal de contratos y procesos |
| SECOP II — Procesos de contratación | Análisis de irregularidades en licitaciones |
| Contraloría General — Hallazgos fiscales | Detección de sanciones fiscales |
| Procuraduría — Sanciones disciplinarias | Verificación de contratistas sancionados |
| Regalías — SMSCE | Monitoreo de fondos de regalías |
| SECOP I — Contratos legacy | Historial contractual de entidades |
| Inhabilidades e incompatibilidades | Lista de inhabilitados para contratar |

### Impacto esperado
- Reducción del tiempo de auditoría de semanas a segundos
- Acceso ciudadano a inteligencia anti-corrupción basada en datos abiertos
- Escalable a todas las entidades públicas colombianas
- Potencial de adopción por Contraloría General y Procuraduría

## Licencia

Licencia MIT — Copyright (c) 2026 VIVIANAPLATA16

Consulta el texto completo de la licencia en LICENSE.

MIT License — libre de usar, modificar y distribuir con atribución.

---

*Concurso Datos al Ecosistema 2026: IA para Colombia — MinTIC · datos.gov.co*

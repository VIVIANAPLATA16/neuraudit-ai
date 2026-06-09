# Despliegue del Agente NeurAudit (Google Cloud)

NeurAudit tiene **dos servicios Python** con roles distintos:

| Servicio | Puerto | Archivo | Propósito |
|----------|--------|---------|-----------|
| **ADK Dev UI** | 8000 | `agent.py` | Agente Google ADK con herramientas + dev-ui |
| **ADK Analyze** | 8001 | `analyze_service.py` | FastAPI interno — análisis profundo Gemini |

Next.js (Vercel) solo alcanza **Analyze (:8001)** vía `NEURAUDIT_ADK_ANALYZE_URL`.

---

## 1. Local (desarrollo / demo hackathon)

### Terminal A — Analyze Service (requerido para IA)

```bash
cd neuraudit
pip install -r neuraudit_agent/requirements.txt
python3 -m uvicorn neuraudit_agent.analyze_service:app --host 127.0.0.1 --port 8001
```

Verificar: `curl http://127.0.0.1:8001/health`

```json
{
  "status": "ok",
  "geminiConfigured": true,
  "model": "gemini-2.5-flash",
  "version": "22.1.0"
}
```

### Terminal B — Next.js

```bash
npm install
cp .env.example .env.local
# GEMINI_API_KEY=...
npm run dev
```

### Terminal C — ADK Dev UI (opcional, demo Agent Builder)

```bash
# Requiere google-adk instalado
adk web --port 8000
# → http://127.0.0.1:8000/dev-ui/
```

El agente en `agent.py` llama a `http://127.0.0.1:3000/api/agent/search`.

---

## 2. Docker (local o servidor)

```bash
cp .env.example .env.local   # GEMINI_API_KEY requerida
docker compose up --build
```

- Next.js: http://localhost:3000
- ADK Analyze: http://localhost:8001/health

---

## 3. Google Cloud Run (producción del agente)

### Prerrequisitos

- Proyecto GCP con billing activo
- `gcloud` CLI autenticado
- API Gemini habilitada
- Imagen Docker del servicio analyze (ya existe `neuraudit_agent/Dockerfile`)

### Build y deploy

```bash
export PROJECT_ID=tu-proyecto-gcp
export REGION=us-central1
export SERVICE=neuraudit-adk-analyze

# Build en Artifact Registry
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/neuraudit/${SERVICE}:latest \
  -f neuraudit_agent/Dockerfile .

# Deploy Cloud Run
gcloud run deploy ${SERVICE} \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/neuraudit/${SERVICE}:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=TU_KEY,NEURAUDIT_GEMINI_MODEL=gemini-2.5-flash" \
  --port 8001
```

Obtener URL:

```bash
gcloud run services describe ${SERVICE} --region ${REGION} --format='value(status.url)'
# Ejemplo: https://neuraudit-adk-analyze-xxxxx-uc.a.run.app
```

### Conectar Vercel → Cloud Run

En Vercel → Project Settings → Environment Variables:

```
NEURAUDIT_ADK_ANALYZE_URL=https://TU-SERVICIO.run.app/analyze
GEMINI_API_KEY=...   # también en Vercel para fallback directo
```

Redeploy Vercel. Verificar:

```bash
curl https://neuraudit.vercel.app/api/system/status
# adk.connected: true
```

---

## 4. Google Agent Builder + MCP

El MCP server corre **en Vercel** (no requiere deploy separado):

| Endpoint | Uso |
|----------|-----|
| `POST /api/mcp` | JSON-RPC (initialize, tools/list, tools/call) |
| `POST /api/mcp/message` | Alias compatible Agent Builder |
| `GET /api/mcp/sse` | SSE handshake |

Herramientas MCP exponen búsqueda vía `/api/agent/summary`.

Configurar en Agent Builder la URL de producción:

```
https://neuraudit.vercel.app/api/mcp
```

---

## 5. Variables de entorno

| Variable | Servicio | Requerida |
|----------|----------|-----------|
| `GEMINI_API_KEY` | Analyze + Next.js | Sí (IA) |
| `NEURAUDIT_GEMINI_MODEL` | Analyze | No (default `gemini-2.5-flash`) |
| `NEURAUDIT_ADK_ANALYZE_URL` | Next.js | Sí en prod con ADK cloud |
| `GOOGLE_CLOUD_PROJECT` | ADK dev | Opcional |

---

## 6. Troubleshooting

| Problema | Solución |
|----------|----------|
| `adk.connected: false` en Vercel | Desplegar Analyze en Cloud Run; configurar URL |
| `gemini_unavailable` | Verificar `GEMINI_API_KEY` y créditos billing |
| Puerto 8001 ocupado | `docker compose down` o matar uvicorn local |
| `ModuleNotFoundError: google.adk` | Solo afecta dev-ui; Analyze no lo requiere |

---

*Ver también: `ARCHITECTURE.md`, `DOCKER_RUNTIME_VALIDATION.md`*

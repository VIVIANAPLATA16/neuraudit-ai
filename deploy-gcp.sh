#!/usr/bin/env bash
# NeurAudit — despliegue en Google Cloud Run
# Requisitos: gcloud CLI, Docker, proyecto GCP con billing activo
#
# Uso (desde la raíz del repo):
#   ./deploy-gcp.sh
#
# Secretos: leídos desde .env.local (gitignored). Nunca hardcodear API keys aquí.
# Requerido en .env.local: GEMINI_API_KEY (o GOOGLE_API_KEY), ELASTIC_ENDPOINT, ELASTIC_API_KEY
# Opcional: GCP_PROJECT_ID, GCP_REGION, GOOGLE_API_KEY

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cargar secretos y config desde .env.local
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -v '^[[:space:]]*$' | xargs)
  set +a
  echo "==> Variables cargadas desde .env.local"
else
  echo "Error: .env.local no encontrado."
  echo "  Crea .env.local con GEMINI_API_KEY, ELASTIC_ENDPOINT y ELASTIC_API_KEY."
  exit 1
fi

# Defaults no sensibles (override permitido vía .env.local o entorno)
export GCP_PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-neuraudit-ai}}"
export GCP_REGION="${GCP_REGION:-us-central1}"

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="${GCP_REGION}"
REPO="${ARTIFACT_REPO:-neuraudit}"
SERVICE_NEXTJS="${SERVICE_NEXTJS:-neuraudit-web}"
SERVICE_ADK="${SERVICE_ADK:-neuraudit-adk-analyze}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"

# Validar secretos requeridos (sin imprimir valores)
missing=()
[[ -z "${GEMINI_API_KEY:-}" && -z "${GOOGLE_API_KEY:-}" ]] && missing+=("GEMINI_API_KEY o GOOGLE_API_KEY")
[[ -z "${ELASTIC_ENDPOINT:-}" ]] && missing+=("ELASTIC_ENDPOINT")
[[ -z "${ELASTIC_API_KEY:-}" ]] && missing+=("ELASTIC_API_KEY")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: faltan variables en .env.local:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

echo "==> Proyecto: $PROJECT_ID | Región: $REGION | Tag: $IMAGE_TAG"
echo "==> Elastic: configurado | Gemini: configurado"
gcloud config set project "$PROJECT_ID"

echo "==> Habilitando APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

echo "==> Artifact Registry..."
if ! gcloud artifacts repositories describe "$REPO" --location="$REGION" &>/dev/null; then
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="NeurAudit container images"
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
NEXTJS_IMAGE="${REGISTRY}/nextjs:${IMAGE_TAG}"
ADK_IMAGE="${REGISTRY}/adk-analyze:${IMAGE_TAG}"

echo "==> Build Next.js (standalone)..."
docker build -t "$NEXTJS_IMAGE" -f Dockerfile .

echo "==> Build ADK Analyze..."
docker build -t "$ADK_IMAGE" -f neuraudit_agent/Dockerfile .

echo "==> Push imágenes..."
docker push "$NEXTJS_IMAGE"
docker push "$ADK_IMAGE"

echo "==> Deploy ADK Analyze (servicio interno)..."
ADK_ENV="NEURAUDIT_GEMINI_MODEL=gemini-2.5-flash"
[[ -n "${GEMINI_API_KEY:-}" ]] && ADK_ENV="${ADK_ENV},GEMINI_API_KEY=${GEMINI_API_KEY}"
[[ -n "${GOOGLE_API_KEY:-}" ]] && ADK_ENV="${ADK_ENV},GOOGLE_API_KEY=${GOOGLE_API_KEY}"

gcloud run deploy "$SERVICE_ADK" \
  --image="$ADK_IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8001 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="$ADK_ENV" \
  --quiet

ADK_URL="$(gcloud run services describe "$SERVICE_ADK" --region="$REGION" --format='value(status.url)')/analyze"
echo "    ADK Analyze URL: $ADK_URL"

echo "==> Deploy Next.js (público)..."
ENV_VARS="NEURAUDIT_GEMINI_MODEL=gemini-2.5-flash,NEURAUDIT_ADK_ANALYZE_URL=${ADK_URL},NEURAUDIT_CACHE_TTL_MS=1800000,NEURAUDIT_FETCH_CONCURRENCY=4"
[[ -n "${GEMINI_API_KEY:-}" ]] && ENV_VARS="${ENV_VARS},GEMINI_API_KEY=${GEMINI_API_KEY}"
[[ -n "${GOOGLE_API_KEY:-}" ]] && ENV_VARS="${ENV_VARS},GOOGLE_API_KEY=${GOOGLE_API_KEY}"
ENV_VARS="${ENV_VARS},ELASTIC_ENDPOINT=${ELASTIC_ENDPOINT}"
ENV_VARS="${ENV_VARS},ELASTIC_API_KEY=${ELASTIC_API_KEY}"

gcloud run deploy "$SERVICE_NEXTJS" \
  --image="$NEXTJS_IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="$ENV_VARS" \
  --quiet

WEB_URL="$(gcloud run services describe "$SERVICE_NEXTJS" --region="$REGION" --format='value(status.url)')"
echo ""
echo "==> Despliegue completado"
echo "    Web:  $WEB_URL"
echo "    ADK:  $ADK_URL"
echo ""
echo "Siguiente paso (recomendado): actualizar NEXT_PUBLIC_APP_URL y re-desplegar:"
echo "  gcloud run services update $SERVICE_NEXTJS --region=$REGION --set-env-vars=NEXT_PUBLIC_APP_URL=$WEB_URL"
echo ""
echo "Indexar SECOP en Elastic (offline, una vez):"
echo "  node scripts/index-secop.mjs   # lee .env.local automáticamente"
echo ""
echo "Producción institucional: migrar secretos a Secret Manager:"
echo "  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,ELASTIC_API_KEY=elastic-api-key:latest"
echo ""
echo "Nota seguridad ADK: desplegado con --allow-unauthenticated para MVP/hackathon."
echo "  En producción institucional, usar --no-allow-unauthenticated + IAM invoker + token OIDC en adk-client.ts"

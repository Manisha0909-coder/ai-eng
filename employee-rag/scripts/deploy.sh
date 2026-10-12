#!/usr/bin/env bash
# Deploys the Gradio demo (Dockerfile.gradio) to Cloud Run, region us-central1,
# configured to stay inside each service's free tier for a low-traffic demo:
#   - Cloud Run:        min-instances 0 (scales to zero, no idle cost),
#                        max-instances 1 (caps blast radius / cost if it ever
#                        did get real traffic), concurrency 10, 1 vCPU, 2Gi RAM.
#   - Cloud Build:       one build per deploy; each build is a few free
#                        build-minutes (see README "Known limitations" for the
#                        quota numbers) -- don't loop this in CI on every push.
#   - Artifact Registry: one repo, old images should be pruned periodically
#                        (see step 5) since storage is billed per GB-month.
#   - Secret Manager:    3 secrets, a handful of versions/accesses -- orders
#                        of magnitude under the free monthly quota.
#
# Every gcloud/docker command below is PRINTED before it runs (set -x) and
# nothing here is destructive, but review it before running -- this talks to
# real GCP billing, even if each step is designed to land in a free tier.
#
# Usage:
#   PROJECT_ID=your-gcp-project ./scripts/deploy.sh

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID=your-gcp-project-id}"
REGION="us-central1"
SERVICE="employee-rag-gradio"
REPO="employee-rag"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:$(git rev-parse --short HEAD)"

ENV_FILE="$(dirname "$0")/../.env"

cd "$(dirname "$0")/.."
set -x

# 1. Enable the APIs this deploy touches (idempotent; enabling an API itself
#    is free, you only pay for what you actually use below).
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project "$PROJECT_ID"

# 2. Artifact Registry repo for the built image (one-time; skips if it exists).
gcloud artifacts repositories describe "$REPO" \
  --project "$PROJECT_ID" --location "$REGION" \
  || gcloud artifacts repositories create "$REPO" \
       --project "$PROJECT_ID" --location "$REGION" \
       --repository-format docker \
       --description "employee-rag demo images"

# 3. Secrets, read from local .env (never printed, never committed -- .env is
#    gitignored). --data-file=- pipes the value in over stdin so it never
#    appears in shell history or `ps`. Re-running adds a new version instead
#    of failing if the secret already exists.
create_or_update_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=-
  else
    printf '%s' "$value" | gcloud secrets create "$name" --project "$PROJECT_ID" --data-file=-
  fi
}

set +x  # don't trace the lines that touch secret values
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
create_or_update_secret OPENROUTER_API_KEY "$OPENROUTER_API_KEY"
create_or_update_secret LANGFUSE_PUBLIC_KEY "$LANGFUSE_PUBLIC_KEY"
create_or_update_secret LANGFUSE_SECRET_KEY "$LANGFUSE_SECRET_KEY"
set -x

# Cloud Run's default compute service account needs explicit access to each
# secret -- granting it is idempotent (safe to re-run every deploy).
RUNTIME_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
for secret in OPENROUTER_API_KEY LANGFUSE_PUBLIC_KEY LANGFUSE_SECRET_KEY; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --project "$PROJECT_ID" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor
done

# 4. Build the image with Cloud Build (uses cloudbuild.gradio.yaml) and push
#    it to Artifact Registry.
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild.gradio.yaml \
  --substitutions "_IMAGE=${IMAGE}" \
  .

# 5. Deploy to Cloud Run. min/max-instances keep this at zero cost when idle
#    and cap it at one instance so a traffic spike can't run away with cost.
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 10 \
  --cpu 1 \
  --memory 2Gi \
  --timeout 120 \
  --set-env-vars "LANGFUSE_TRACING_ENVIRONMENT=production" \
  --set-secrets "OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest,LANGFUSE_PUBLIC_KEY=LANGFUSE_PUBLIC_KEY:latest,LANGFUSE_SECRET_KEY=LANGFUSE_SECRET_KEY:latest"

set +x
echo
echo "Deployed. URL:"
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format "value(status.url)"
echo
echo "Housekeeping (run occasionally, not part of every deploy):"
echo "  List old images:   gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}"
echo "  Delete an old one:  gcloud artifacts docker images delete <IMAGE_URI_WITH_DIGEST> --quiet"

# Codifies a real bug hit while deploying this service imperatively: the
# first `gcloud run deploy` failed because Cloud Run's default compute
# service account had no access to the secrets, only discovered from the
# deploy's own error message ("Permission denied on secret... must be
# granted the 'Secret Manager Secret Accessor' role"). scripts/deploy.sh
# now grants this on every run (idempotent); this is the same grant,
# declaratively.
data "google_project" "current" {
  project_id = var.project_id
}

locals {
  cloud_run_service_account = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_secret_manager_secret_iam_member" "openrouter_access" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.openrouter_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.cloud_run_service_account}"
}

resource "google_secret_manager_secret_iam_member" "langfuse_public_access" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.langfuse_public_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.cloud_run_service_account}"
}

resource "google_secret_manager_secret_iam_member" "langfuse_secret_access" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.langfuse_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.cloud_run_service_account}"
}

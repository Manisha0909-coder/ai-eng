variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run and Artifact Registry"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "employee-rag-gradio"
}

variable "artifact_repo_name" {
  description = "Artifact Registry repository name"
  type        = string
  default     = "employee-rag"
}

variable "image" {
  description = "Full image URI to deploy, e.g. REGION-docker.pkg.dev/PROJECT/REPO/employee-rag-gradio:TAG. Built by scripts/deploy.sh or cloudbuild.gradio.yaml, not by this Terraform config."
  type        = string
}

variable "billing_account_id" {
  description = "Billing account ID for the budget alert, e.g. XXXXXX-XXXXXX-XXXXXX (see: gcloud billing accounts list)"
  type        = string
}

variable "budget_amount_usd" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 1
}

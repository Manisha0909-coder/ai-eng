# References to EXISTING secrets created out-of-band (scripts/deploy.sh,
# which pipes values from local .env over stdin) -- never created here,
# and no secret VALUE is ever read into Terraform state. `terraform
# apply` fails if these don't already exist; that's intentional, not a
# bug. Provisioning infrastructure and writing credential material are
# different concerns with different blast radii: keeping them separate
# means a `terraform destroy` can never have held (or risk deleting) the
# actual secret contents.
data "google_secret_manager_secret" "openrouter_api_key" {
  project   = var.project_id
  secret_id = "OPENROUTER_API_KEY"
}

data "google_secret_manager_secret" "langfuse_public_key" {
  project   = var.project_id
  secret_id = "LANGFUSE_PUBLIC_KEY"
}

data "google_secret_manager_secret" "langfuse_secret_key" {
  project   = var.project_id
  secret_id = "LANGFUSE_SECRET_KEY"
}

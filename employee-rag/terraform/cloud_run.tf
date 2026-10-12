# Mirrors scripts/deploy.sh's flags exactly: min-instances 0 (scale to
# zero, the actual cost-control lever), max-instances 1 (caps a traffic
# spike), concurrency 10, 1 vCPU / 2Gi memory, 120s timeout,
# unauthenticated. This file is the declarative equivalent of that
# script's `gcloud run deploy` step -- not a replacement for it yet (the
# image still has to be built by Cloud Build first, same as today).
resource "google_cloud_run_v2_service" "employee_rag_gradio" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  template {
    containers {
      image = var.image

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
      }

      env {
        name  = "LANGFUSE_TRACING_ENVIRONMENT"
        value = "production"
      }

      env {
        name = "OPENROUTER_API_KEY"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.openrouter_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "LANGFUSE_PUBLIC_KEY"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.langfuse_public_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "LANGFUSE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.langfuse_secret_key.secret_id
            version = "latest"
          }
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    max_instance_request_concurrency = 10
    timeout                          = "120s"
  }
}

resource "google_cloud_run_v2_service_iam_member" "allow_unauthenticated" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.employee_rag_gradio.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

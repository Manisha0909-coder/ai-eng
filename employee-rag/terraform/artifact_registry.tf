# Keeps only the single most recent image, deleting everything else --
# the same "housekeeping" scripts/deploy.sh currently prints as a manual
# command (gcloud artifacts docker images list/delete) is automated here
# instead, so storage cost (~$0.10/GB-month) never silently accumulates
# across repeated deploys.
resource "google_artifact_registry_repository" "employee_rag" {
  location      = var.region
  repository_id = var.artifact_repo_name
  format        = "DOCKER"
  description   = "employee-rag demo images"

  cleanup_policies {
    id     = "keep-most-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 1
    }
  }

  cleanup_policies {
    id     = "delete-everything-else"
    action = "DELETE"

    condition {
      tag_state = "ANY"
    }
  }
}

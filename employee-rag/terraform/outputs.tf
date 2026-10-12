output "service_url" {
  description = "The deployed Cloud Run service's URL"
  value       = google_cloud_run_v2_service.employee_rag_gradio.uri
}

output "artifact_registry_repo" {
  description = "The Artifact Registry repository's full resource name"
  value       = google_artifact_registry_repository.employee_rag.name
}

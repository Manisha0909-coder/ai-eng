# Infrastructure as Code (Terraform)

`terraform/` is a declarative equivalent of `scripts/deploy.sh` +
`scripts/set_budget_alert.sh`'s imperative `gcloud` commands — written,
formatted (`terraform fmt`), and validated (`terraform validate`) against
the real provider schema. **`terraform plan` and `terraform apply` have
never been run.** Nothing here has touched a real GCP project. Don't run
either without explicit confirmation first, same as every other command
in this project that could incur a real charge.

## What `terraform apply` would create

| Resource | What it is | Could it cost money? |
|---|---|---|
| `google_artifact_registry_repository.employee_rag` | The Docker image repository | Storage, ~$0.10/GB-month. The cleanup policy (keep most-recent image only) caps this to roughly one image's worth, same as `scripts/deploy.sh`'s manual "Housekeeping" step but automatic. |
| `google_cloud_run_v2_service.employee_rag_gradio` | The Gradio demo service, `min_instances=0`/`max_instances=1`, same flags as `scripts/deploy.sh` | Only if it receives real traffic beyond Cloud Run's free tier -- scales to zero when idle, so near-zero for low demo traffic. |
| `google_cloud_run_v2_service_iam_member.allow_unauthenticated` | Makes the service public | No direct cost; same public-access choice `scripts/deploy.sh` already makes with `--allow-unauthenticated`. |
| `google_secret_manager_secret_iam_member.*` (3) | Grants Cloud Run's service account read access to the 3 existing secrets | No cost -- IAM bindings are free. |
| `google_billing_budget.demo_budget` | A $1/month budget alert (50/90/100% thresholds) | No cost -- budget alerts are free. **Would create a second, redundant alert** if `scripts/set_budget_alert.sh` has already been run against the same billing account (it has, for this project) -- see below. |

**Not created here, on purpose:** the 3 secrets' actual *values*.
`terraform/secrets.tf` only references them by name (`data` sources, not
`resource`s) -- they must already exist (created via
`scripts/deploy.sh`, which pipes `.env` values into
`gcloud secrets create`/`versions add`) before `terraform apply` would
succeed. A secret's contents never enter Terraform state this way.

## Known redundancy with the imperative scripts

This project's Cloud Run service and budget alert already exist, created
by `scripts/deploy.sh` and `scripts/set_budget_alert.sh` earlier in this
project's history. Running `terraform apply` against the same project
now would either:

- **Fail or conflict** on the Cloud Run service and Artifact Registry
  repo (Terraform doesn't know about resources it didn't create, so it
  would try to create new ones with the same names and likely hit an
  "already exists" error from the GCP API) -- resolvable with
  `terraform import`, not attempted here.
- **Create a genuinely new, second budget alert** (`budget.tf`'s
  `display_name` has a `-tf` suffix specifically to avoid silently
  colliding with the existing one, but it would still be a duplicate
  alert on the same billing account).

This Terraform config is presented as a demonstration of the IaC
pattern for this deployment, not as a drop-in replacement for the
already-running imperative scripts. Adopting it for real would mean
either `terraform import`-ing the existing resources first, or tearing
down the imperative deployment and recreating it via `terraform apply`
-- both real, consequential decisions that need your explicit choice,
not something to do silently.

## Running it (when you're ready)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform plan    # review what it would do -- ask for the output to be shown
# only after reviewing the plan:
terraform apply
```

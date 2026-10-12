# Declarative equivalent of scripts/set_budget_alert.sh, which already
# created this alert imperatively (see docs/IAC.md for which one is
# authoritative if both exist).
resource "google_billing_budget" "demo_budget" {
  billing_account = var.billing_account_id
  display_name    = "employee-rag-demo-${var.budget_amount_usd}usd-tf"

  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }
}

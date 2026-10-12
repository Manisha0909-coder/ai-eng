#!/usr/bin/env bash
# One-time: creates a $1/month budget alert on the billing account, emailing
# billing-account admins at 50/90/100% of spend. Separate from deploy.sh so
# re-running a deploy never creates a duplicate budget.
#
# Usage:
#   PROJECT_ID=your-gcp-project BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX \
#     ./scripts/set_budget_alert.sh
#
# Find your billing account ID with:
#   gcloud billing accounts list

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID=your-gcp-project-id}"
: "${BILLING_ACCOUNT_ID:?Set BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX (see: gcloud billing accounts list)}"

set -x
gcloud billing budgets create \
  --billing-account "$BILLING_ACCOUNT_ID" \
  --display-name "employee-rag-demo-1usd" \
  --budget-amount 1 \
  --filter-projects "projects/${PROJECT_ID}" \
  --threshold-rule percent=0.5 \
  --threshold-rule percent=0.9 \
  --threshold-rule percent=1.0

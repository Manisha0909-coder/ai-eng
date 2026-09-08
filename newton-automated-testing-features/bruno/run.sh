#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$(mktemp -d)"
trap 'rm -rf "$REPORT_DIR"' EXIT

fetch_token() {
  echo "🔑 Fetching access token via Playwright..."
  cd "$ROOT" && python bruno/get_token.py
  ACCESS_TOKEN=$(grep "^access_token=" "$ROOT/bruno/.env" | cut -d'=' -f2-)
  API_KEY=$(grep "^api_key=" "$ROOT/bruno/.env" | cut -d'=' -f2-)
}

run_folder() {
  local target="$1"
  local report_file="$2"
  cd "$ROOT/bruno" && bru run $target --env production \
    --env-var "access_token=$ACCESS_TOKEN" \
    --env-var "api_key=$API_KEY" \
    --reporter-json "$report_file"
}

FOLDER=${1:-""}

if [ -n "$FOLDER" ]; then
  # Single folder: one token is enough, it won't run long enough to expire.
  echo "🚀 Running Bruno collection: $FOLDER"
  fetch_token
  set +e
  run_folder "$FOLDER" "$REPORT_DIR/report.json"
  set -e
else
  # Full suite: refresh the token before every top-level folder so a long
  # run never hits an expired token partway through.
  echo "🚀 Running Bruno collection (all)..."
  for dir in "$ROOT"/bruno/*/; do
    name="$(basename "$dir")"
    [ "$name" = "environments" ] && continue
    [ -z "$(find "$dir" -maxdepth 1 -name '*.bru' -print -quit)" ] && continue

    echo ""
    echo "──── $name/ ────"
    fetch_token
    set +e
    run_folder "$name/" "$REPORT_DIR/$name.json"
    set -e
  done
fi

python "$ROOT/bruno/summarize_reports.py" "$REPORT_DIR"
exit $?

# bash bruno/run.sh            # run everything (fresh token before each folder)
# bash bruno/run.sh roles/     # run only roles
# bash bruno/run.sh users/     # run only users
# bash bruno/run.sh personas/  # etc.

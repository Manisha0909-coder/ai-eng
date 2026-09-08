#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Available suites ──────────────────────────────────────────────────────────
SUITES=(
  "F001:suite_F001_share_panel"
  "F002:suite_F002_theme"
  "F003:suite_F003_documents"
  "F004:suite_F004_session_logout"
  "F005:suite_F005_chat"
  "F006:suite_F006_sidebar"
  "F007:suite_F007_admin_dashboard"
  "F008:suite_F008_admin_role_access"
  "F009:suite_F009_persona_management"
  "F010:suite_F010_admin_role_management"
  "F011:suite_F011_admin_user_management"
  "F012:suite_F012_admin_shared_memory"
  "F013:suite_F013_admin_feedback_management"
  "F014:suite_F014_connections_integrations"
  "F015:suite_F015_security_and_authentication"
  "F016:suite_F016_performance_reliability"
  "F017:suite_F017_admin_data_sources"
  "F018:suite_F018_dashboard_persona"
  "F019:suite_F019_form_submission"
)

usage() {
  echo -e "${BOLD}Usage:${NC}"
  echo "  bash playwright_automation/run.sh                  # run all suites"
  echo "  bash playwright_automation/run.sh F005             # run one suite by code"
  echo "  bash playwright_automation/run.sh F003 F007 F019   # run multiple suites"
  echo "  bash playwright_automation/run.sh --headed F005    # run headed (visible browser)"
  echo "  bash playwright_automation/run.sh --smoke          # run smoke-marked tests only"
  echo "  bash playwright_automation/run.sh --env sentinel F007   # run F007 against sentinel.gotalk.dev"
  echo ""
  echo -e "${BOLD}Available suites:${NC}"
  for entry in "${SUITES[@]}"; do
    code="${entry%%:*}"
    folder="${entry##*:}"
    printf "  ${CYAN}%-6s${NC} %s\n" "$code" "$folder"
  done
  exit 0
}

resolve_suite() {
  local key; key="$(echo "$1" | tr '[:lower:]' '[:upper:]')"
  for entry in "${SUITES[@]}"; do
    code="${entry%%:*}"
    folder="${entry##*:}"
    if [[ "$code" == "$key" ]]; then
      echo "tests/$folder"
      return 0
    fi
  done
  # Allow passing the full folder name directly
  if [[ -d "$ROOT/tests/$1" ]]; then
    echo "tests/$1"
    return 0
  fi
  echo ""
}

# ── Parse arguments ───────────────────────────────────────────────────────────
HEADED=""
SMOKE=""
ENV_NAME=""
TARGETS=()

EXTRA=()   # extra pytest flags passed through as-is

while [ $# -gt 0 ]; do
  arg="$1"
  case "$arg" in
    --help|-h)   usage ;;
    --headed)    HEADED="--headed"; shift ;;
    --smoke)     SMOKE="-m smoke"; shift ;;
    --env)
      ENV_NAME="$2"
      if [ -z "$ENV_NAME" ]; then
        echo -e "${RED}❌ --env requires a value, e.g. --env sentinel${NC}"
        exit 1
      fi
      shift 2
      ;;
    --env=*)     ENV_NAME="${arg#--env=}"; shift ;;
    -*)          EXTRA+=("$arg"); shift ;;   # forward other flags (e.g. -k, --tb) to pytest
    *)           TARGETS+=("$arg"); shift ;;
  esac
done

# ── Resolve environment ───────────────────────────────────────────────────────
if [ -n "$ENV_NAME" ]; then
  ENV_FILE_PATH="$ROOT/.env.$ENV_NAME"
  if [ ! -f "$ENV_FILE_PATH" ]; then
    echo -e "${RED}❌ Unknown environment: '$ENV_NAME' (no $ENV_FILE_PATH)${NC}"
    available="production (default, .env)"
    for f in "$ROOT"/.env.*; do
      [ -e "$f" ] || continue
      available="$available, $(basename "$f" | sed 's/^\.env\.//')"
    done
    echo "   Available environments: $available"
    exit 1
  fi
fi

# ── Build pytest path list ────────────────────────────────────────────────────
PATHS=()
if [ ${#TARGETS[@]} -eq 0 ]; then
  PATHS=("tests/")
else
  for t in "${TARGETS[@]}"; do
    resolved=$(resolve_suite "$t")
    if [ -z "$resolved" ]; then
      echo -e "${RED}❌ Unknown suite: '$t'${NC}"
      echo "   Run with --help to see available suites."
      exit 1
    fi
    PATHS+=("$resolved")
  done
fi

# ── Run ───────────────────────────────────────────────────────────────────────
cd "$ROOT"

echo -e "${BOLD}🎭 Playwright Automation Runner${NC}"
echo -e "   Root  : $ROOT"
echo -e "   Paths : ${PATHS[*]}"
[ -n "$HEADED"  ] && echo -e "   Mode  : ${YELLOW}headed${NC}"
[ -n "$SMOKE"   ] && echo -e "   Filter: ${YELLOW}smoke only${NC}"
echo -e "   Env   : ${CYAN}${ENV_NAME:-production (.env)}${NC}"
echo ""

PLAYWRIGHT_ENV="$ENV_NAME" python -m pytest "${PATHS[@]}" \
  -v \
  --tb=short \
  $HEADED \
  $SMOKE \
  "${EXTRA[@]}"

# ── Usage examples (for reference) ───────────────────────────────────────────
# bash playwright_automation/run.sh                    # all suites
# bash playwright_automation/run.sh F005               # chat suite only
# bash playwright_automation/run.sh F003 F007          # documents + admin dashboard
# bash playwright_automation/run.sh --headed F005      # headed browser
# bash playwright_automation/run.sh --smoke            # smoke tests only
# bash playwright_automation/run.sh --env sentinel F007   # F007 against sentinel

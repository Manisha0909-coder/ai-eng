#!/usr/bin/env bash
# Fail CI when hardcoded color literals appear in TypeScript source.
# Allowed definitions live in src/index.css and src/styles/ only.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 6-digit hex, 3-digit hex (not a prefix of a longer hex), rgb()/rgba() with numeric args
PATTERN='#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}([^0-9a-fA-F]|$)|rgba?\([[:space:]]*[0-9][^)]*\)'

EXIT_CODE=0

while IFS= read -r result; do
  [[ -z "$result" ]] && continue

  file="${result%%:*}"
  rest="${result#*:}"
  line_num="${rest%%:*}"
  line="${rest#*:}"

  trimmed="${line#"${line%%[![:space:]]*}"}"
  [[ "$trimmed" == //* ]] && continue
  [[ "$trimmed" == \** ]] && continue
  [[ "$line" == *'var(--'* ]] && continue

  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    echo "${file}:${line_num}:${match}"
    EXIT_CODE=1
  done < <(printf '%s\n' "$line" | grep -oE "$PATTERN")
done < <(
  grep -rnE "$PATTERN" src \
    --include='*.ts' \
    --include='*.tsx' \
    --exclude='*.d.ts' \
    2>/dev/null \
  | grep -v '^src/styles/' \
  | grep -v '^src/index.css:' \
  | grep -v '^src/constants/ThemesData.ts:' \
  | grep -v '^src/features/dashboard/theme-editor/themePresets.ts:' \
  | grep -v '^src/utils/chartColors.ts:' \
  | grep -v '^src/pwa/manifest.ts:' \
  || true
)

exit "$EXIT_CODE"

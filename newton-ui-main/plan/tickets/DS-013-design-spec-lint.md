# DS-013 · Design Spec Lint Script

**Type:** Task  
**Wave:** 2 (run after DS-001, parallel with DS-003/004/005/006)  
**Effort:** S  
**Blocked by:** DS-001  
**Blocks:** —  (can run independently; ideally failing in CI before Wave 3 starts)

## Goal

Encode the greppable rules from `plan/design-spec.md` into a shell script that exits non-zero on any violation. Run it in CI and optionally as a pre-commit hook so no Wave 3 PR can land with regressions.

The DS-000 epic already lists some of these checks as "Definition of Done" greps. This ticket turns them into a single executable, adds the missing checks, and wires it into the build.

## Deliverable

**File:** `scripts/check-design-spec.sh`

```bash
#!/usr/bin/env bash
# Enforces the rules in plan/design-spec.md.
# Exits 1 if any rule is violated; prints file:line for each hit.

set -euo pipefail
FAIL=0
FEATURE_DIRS="src/features src/layouts src/pages"

check() {
  local rule="$1"
  local pattern="$2"
  local dirs="${3:-$FEATURE_DIRS}"
  # shellcheck disable=SC2086
  if grep -rn --include="*.tsx" --include="*.ts" -E "$pattern" $dirs 2>/dev/null; then
    echo "FAIL [$rule]"
    FAIL=1
  fi
}

# §1 — Token vocabulary: shadcn tokens banned in feature files
check "token-vocab"      'text-foreground|text-muted-foreground|border-border[^-]'

# §1 — No hardcoded palette classes in feature files
check "palette-text"     'text-zinc-[0-9]|text-gray-[0-9]'
check "palette-bg"       'bg-gray-[0-9]|bg-blue-50|bg-green-500|bg-red-200'
check "palette-border"   'border-blue-[0-9]|border-green-[0-9]|border-red-[0-9]'

# §5 — No JS hover handlers for styling
check "hover-js"         'onMouseEnter|onMouseLeave'

# §5 — Disallowed hover opacity variants
check "hover-opacity"    'hover:bg-surface/80|hover:bg-white/10|hover:bg-gray-[0-9]'

# §7 — No oversized border-radius in feature files
check "radius"           'rounded-xl|rounded-2xl|rounded-3xl'

# §8 — No raw icon size classes (use w-icon-* tokens instead)
check "icon-size"        '\bw-4\b.*\bh-4\b|\bw-5\b.*\bh-5\b|\bw-6\b.*\bh-6\b|size-[456]\b'

# §9 — No inline border-radius style workarounds (from Header.tsx migration)
check "inline-radius"    'borderRadius.*9999|borderRadius.*999'

# §11 — Motion: no duration-500+ on hover states
check "hover-duration"   'hover:.*duration-500|hover:.*duration-700'

# §12 — No arbitrary z-index in feature files
check "z-index"          'z-\[[0-9]'

# Card tier: no arbitrary shadow values (use shadow-elevated constant)
check "shadow-arb"       'shadow-\[var\(--shadow-elevated'

# bg-primary opacity floor: /5 is invisible; minimum is /10
check "primary-opacity"  'bg-primary/[1-9][^0]?\b|bg-primary/5\b'

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "Design spec violations found. See plan/design-spec.md for the canonical rules."
  exit 1
fi

echo "✓ Design spec lint passed."
```

## Wire into the build

Add to `package.json`:
```json
"scripts": {
  "lint:design": "bash scripts/check-design-spec.sh"
}
```

Add to CI (alongside `npm run lint` and `npm run build`):
```yaml
- run: npm run lint:design
```

Optional pre-commit hook (add to `.husky/pre-commit` or equivalent):
```bash
npm run lint:design
```

## Notes on coverage

| Rule | What it catches | What it misses |
|------|----------------|----------------|
| Token vocab | `text-foreground`, `border-border` | Tokens used inside template literals |
| Palette classes | `bg-gray-*`, `text-zinc-*` | Palette used via `cn()` with dynamic strings |
| Hover JS | `onMouseEnter` in feature files | Hover JS in `src/components/ui/` (excluded by scope) |
| Icon size | `w-4 h-4`, `w-5 h-5` pairs | Solo `w-4` without matching `h-4` |
| `bg-primary/5` | Direct class usage | Computed via template literal |

The script catches the common cases. It will not catch every possible violation — that would require a full AST-based ESLint plugin. The script is fast (< 1s on this codebase) and catches the mechanical copy-paste errors that are the actual source of drift.

## Acceptance Criteria

- [ ] `scripts/check-design-spec.sh` exists and is executable (`chmod +x`)
- [ ] `npm run lint:design` runs and passes on a clean `newton-stable` HEAD (after Wave 2 lands)
- [ ] Script is added to the CI pipeline
- [ ] `npm run lint:design` is documented in the repo README or `plan/design-spec.md` under a "Tooling" note
- [ ] Running the script against the current codebase (pre-Wave 2) produces at least one failure, confirming it actually detects violations

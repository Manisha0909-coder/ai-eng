# UI-013 — Add Hardcoded Color Check Script

**Type:** Tooling  
**Priority:** P2  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** S (1–2 hours)  
**Risk:** None  
**Depends on:** nothing — can start immediately

## Why

After purging hardcoded colors (UI-002, UI-003, UI-004), there's nothing stopping them from creeping back in. A script that fails CI when a hardcoded hex or rgba is detected enforces the rule permanently without relying on code review.

## What the Script Does

- Scans all `.tsx` and `.ts` files under `src/` for hardcoded color patterns
- Ignores legitimate locations (CSS variable definitions, comments)
- Prints `file:line:match` for every violation
- Exits with code `1` if any violations found — CI fails

## Patterns to Catch

| Pattern | Example |
|---------|---------|
| 6-digit hex | `#3b82f6`, `#B68A35` |
| 3-digit hex | `#fff`, `#000` |
| `rgb()` with numeric args | `rgb(59, 130, 246)` |
| `rgba()` with numeric args | `rgba(96, 165, 250, 0.1)` |

## What to Exclude

| Exclusion | Reason |
|-----------|--------|
| `src/styles/` and `src/index.css` | Where CSS variables are legitimately defined |
| Lines containing `var(--` | Already using CSS variables correctly |
| Lines starting with `//` or `*` | Comments |
| `node_modules/`, `*.d.ts` | Not source code |
| `scripts/` itself | The script may reference color patterns as strings |

## Script Location

```
scripts/check-hardcoded-colors.sh
```

## npm Script Entry

Add to `package.json`:

```json
"check:colors": "bash scripts/check-hardcoded-colors.sh"
```

## Wire into CI

Add to the CI pipeline after `lint`, but **only after UI-011 lands** — `ThemesData.ts`, `useTheme.ts`, and `useThemeColors.ts` account for ~150 of the ~224 current violations and are deleted in UI-011. Running the check before that causes noise.

```yaml
- run: npm run check:colors
```

## Exclusion List

The script must exclude files that legitimately contain color values:
- `src/styles/` and `src/index.css` — where CSS vars are defined
- `src/constants/ThemesData.ts` — deleted in UI-011, exclude until then
- Lines containing `var(--` — already using the token system
- Comment lines (`//`, `*`)

## Acceptance Criteria

- [ ] `scripts/check-hardcoded-colors.sh` exists and is executable
- [ ] `npm run check:colors` exits `0` on a clean codebase
- [ ] `npm run check:colors` exits `1` and prints the offending `file:line:match` when a hardcoded color exists in a `.tsx` file
- [ ] Script does not flag colors defined in `src/index.css` or `src/styles/`
- [ ] Wired into CI

# UI-000 · EPIC — UI Consistency & Design System Refactor

**Type:** Epic  
**Priority:** High  
**Owner:** Tech Lead  
**Status:** Planning

## Goal

Make the UI consistent and maintainable so that one change to a design token or primitive component propagates everywhere automatically.

Replace the custom `useTheme` hook system with the correct architecture: CSS variables in `index.css` (baked in per deployment), Tailwind token classes, and environment variables for tenant assets. No JavaScript needed to apply a theme.

## Architecture in One Sentence

Each tenant is a separate deployment — the theme is in `index.css`, assets are in `.env`, and the only runtime toggle is dark mode.

## Problem Summary

| Issue | Impact |
|-------|--------|
| `useTheme` hook (446 lines) + ThemeService + ThemesData | Solves a problem CSS already solves; 31 consumers to clean up |
| Hardcoded hex colors in feature files | Components don't recolor when CSS variables change |
| Arbitrary Tailwind values (`h-[28px]`, `text-[10px]`) in 30+ files | Cannot update sizing from one place |
| Duplicated carousel (2) and dropdown (14 consumers, 1 canonical) | Developers pick at random |
| Every modal has a custom `max-w-[Xpx]` | No consistent dialog sizing |
| Raw `<input>` elements in dashboard sections | Bypasses the ui/ primitive system |

## Child Tickets

| Ticket | Title | Sprint | Effort | Blocked By |
|--------|-------|--------|--------|------------|
| [UI-011](./UI-011-remove-usetheme.md) | Remove useTheme system (31 consumers) | 1 | XL | — |
| [UI-005](./UI-005-merge-carousel.md) | Merge carousel components | 1 | M | — |
| [UI-006](./UI-006-merge-combobox.md) | Extend Combobox, deprecate SearchableDropdown (14 consumers) | 1 | XL | — |
| [UI-007](./UI-007-form-cleanup.md) | Form system cleanup + raw input audit | 1 | M | — |
| [UI-002](./UI-002-hardcoded-colors-payment.md) | Delete PaymentForm + TravelPackage | 2 | XS | — |
| [UI-001](./UI-001-design-tokens.md) | CSS tokens + Tailwind config + .env.template | 2 | S | UI-011 |
| [UI-003](./UI-003-hardcoded-colors-chat.md) | Purge hardcoded colors — Chat | 3 | L | UI-001 |
| [UI-004](./UI-004-hardcoded-colors-settings.md) | Purge hardcoded colors — Dashboard & Visualization | 3 | L | UI-001 |
| [UI-008](./UI-008-modal-sizing.md) | Standardize modal/dialog sizing | 3 | S | UI-001 |
| [UI-009](./UI-009-arbitrary-tailwind.md) | Global sweep — replace arbitrary Tailwind values | 3 | M | UI-001 |
| [UI-013](./UI-013-hardcoded-color-check-script.md) | Hardcoded color check script + CI | 3 | S | UI-011 |
| [UI-010](./UI-010-inline-styles.md) | Inline style cleanup | 4 | M | UI-001 |

## Sprint Plan

```
Sprint 1 (all parallel — no dependencies between them):
  UI-011  Remove useTheme, ThemeService, ThemesData, useThemeColors
  UI-005  Merge carousel
  UI-006  Extend Combobox / deprecate SearchableDropdown
  UI-007  Form system cleanup + raw input audit

Sprint 2 (parallel):
  UI-001  CSS token restructure + Tailwind config + .env.template  [needs UI-011]
  UI-002  Delete PaymentForm + TravelPackage                        [no deps]

Sprint 3 (parallel — all need UI-001):
  UI-003  Purge hardcoded colors — Chat
  UI-004  Purge hardcoded colors — Dashboard & Visualization
  UI-008  Modal sizing tokens
  UI-009  Arbitrary Tailwind value sweep
  UI-013  Color check script + wire to CI

Sprint 4:
  UI-010  Inline style cleanup
```

## Definition of Done

- `grep -r 'useTheme\|useThemeColors' src/` returns zero results
- `grep -r 'ThemeService\|ThemesData' src/` returns zero results
- Toggle `.dark` class on `<html>` → all components recolor, no JS intervention
- `grep -r '#[0-9a-fA-F]\{6\}' src/features/` returns only intentional OAuth brand values
- `grep -r 'bg-\[var\|text-\[var\|border-\[var' src/features/` returns zero results
- `.env.template` documents all tenant asset variables
- `npm run build` passes after every sprint

# DS-002 · Resolve Dual Token Vocabulary

**Type:** Task  
**Wave:** 1  
**Effort:** S  
**Priority:** High  
**Blocked by:** UI-001 (CSS token restructure must be complete)  
**Blocks:** DS-007, DS-008, DS-009, DS-010

## Problem

Two naming systems for identical colors coexist in feature files:

| shadcn token (wrong in feature files) | Our token (canonical) |
|---------------------------------------|----------------------|
| `text-foreground` | `text-text-main` |
| `text-muted-foreground` | `text-text-muted` |
| `border-border` | `border-border-main` |
| bare `border` (uses shadcn default) | `border-border-main` |

shadcn's tokens live in `tailwind.config.js` as aliases pointing to `--foreground`, `--border` etc. (HSL-based). Our tokens point to `--color-text`, `--color-border` (RGB-based). They may render similarly now but are semantically disconnected and will diverge if we ever adjust the shadcn default values.

The rule from DS-001: **feature files use our tokens only**. shadcn primitive components (`ui/*.tsx`) can keep shadcn tokens since they came from the scaffolding and we don't want to diverge from upstream.

## Scope

Only `src/features/` and `src/layouts/` files are in scope. Files under `src/components/ui/` are excluded.

## Files to Migrate

### `src/features/settings/components/Settings.tsx`
- `text-foreground` → `text-text-main`
- `text-muted-foreground` → `text-text-muted`
- `border-border` → `border-border-main`

### `src/features/dashboard/components/ToolCard.tsx`
- `text-foreground` → `text-text-main`
- bare `border` on the card wrapper → `border-border-main`

### `src/features/dashboard/sections/AdminOverviewSection.tsx`
- `text-foreground` → `text-text-main`
- `border-border` → `border-border-main`

### `src/layouts/Sidebar/AppSidebar.tsx`
- `text-zinc-400` → `text-text-muted`
- `text-zinc-500` → `text-text-muted`

## Approach

1. Run a search to confirm no other files have missed occurrences:
   ```bash
   grep -rn 'text-foreground\|text-muted-foreground\|border-border[^-]\|text-zinc-[0-9]' src/features/ src/layouts/
   ```
2. Migrate the listed files above.
3. Re-run the search — zero results expected (except inside `src/components/ui/`).

## tailwind.config.js Note

The shadcn aliases (`foreground`, `muted-foreground`, `border`) must remain in `tailwind.config.js` so the shadcn UI primitives continue to work. Do **not** remove them. Only stop using them in feature files.

## Acceptance Criteria

- [ ] `grep -r 'text-foreground\|text-muted-foreground\|border-border[^-]' src/features/ src/layouts/` returns zero results
- [ ] `grep -r 'text-zinc-[0-9]' src/features/ src/layouts/` returns zero results
- [ ] `npm run build` passes
- [ ] Dark mode toggle still visually works for Settings, ToolCard, AdminOverview, AppSidebar

# UI-004 — Purge Hardcoded Colors: Settings, Dashboard & Visualization

**Type:** Refactor  
**Priority:** P1  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** L (5–7 hours — significantly more files than originally scoped)  
**Risk:** Low  
**Depends on:** [UI-001](./UI-001-design-tokens.md)

## Files and Instances

### `src/features/settings/components/Settings.tsx`
- `#0078D4` (4×) and `#005a9e` (4×) — Microsoft OAuth brand colors
- These are intentional brand colors, not theme-driven
- Replace with CSS vars defined in `index.css`: `--color-oauth-microsoft: 0 120 212`
- In Tailwind: `bg-[rgb(var(--color-oauth-microsoft))]` or add `oauth-microsoft` token

### `src/features/dashboard/components/AdminOverviewSection.tsx` ← largest file
- 32+ violations including:
  - Plotly chart series colors (`rgba(73,166,73,...)`, `rgba(255,152,0,...)`, `rgba(244,67,54,...)`)
  - Log-level severity color maps (hardcoded per-level hex values)
  - `resolveCssVar()` calls with hardcoded hex fallbacks
- Strategy: extract a `CHART_COLORS` constant using CSS variables; for Plotly (which takes raw color strings) use `getComputedStyle(root).getPropertyValue('--color-primary')` at render time

### `src/features/dashboard/components/ToolExecution.tsx`
- `#22c55e` → `text-status-success`
- `#ef4444` → `text-status-error`
- `#ffffff` → `text-text-main`

### `src/features/visualization/components/DraggableDashboard/index.tsx`
- `#1e293b`, `#334155` → `bg-surface`, `bg-surface/80`
- Multiple `rgba()` shadow values → CSS var `--shadow-*` or Tailwind shadow utilities

### `src/features/visualization/components/DraggableDashboard/SortableCard.tsx`
### `src/features/visualization/components/DraggableDashboard/OverlayCard.tsx`
### `src/features/visualization/components/DraggableDashboard/FullScreenModal.tsx`
- `#f87171` (error red) → `text-status-error`

### `src/components/ui/rich-text-editor.tsx`
- Audit and replace any hardcoded colors in editor toolbar/styles

## Special Case: Plotly Charts

Plotly takes color values as raw strings, not CSS classes. For chart colors in `AdminOverviewSection.tsx` and visualization files:

```ts
// Read CSS variables at render time for Plotly
const root = document.documentElement
const primary = getComputedStyle(root).getPropertyValue('--color-primary').trim()
// Convert "59 130 246" → "rgb(59, 130, 246)" for Plotly
const toRgb = (v: string) => `rgb(${v.replace(/ /g, ',')})`
```

Extract a `useChartColors()` hook or a `chartColors()` utility that returns resolved color strings for Plotly consumption. This keeps the CSS variable as the source of truth while satisfying Plotly's string format requirement.

## Acceptance Criteria

- [ ] `grep -rn '#[0-9a-fA-F]\{6\}' src/features/settings/ src/features/dashboard/ src/features/visualization/` returns zero results
- [ ] Microsoft OAuth button still renders in correct brand blue
- [ ] Plotly charts recolor correctly when theme switches
- [ ] Error/success states in ToolExecution still show correct colors
- [ ] `npm run build` passes

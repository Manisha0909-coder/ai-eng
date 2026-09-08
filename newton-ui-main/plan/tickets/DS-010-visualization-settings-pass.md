# DS-010 · Visualization & Settings Visual Pass

**Type:** Task  
**Wave:** 3 (parallel with DS-007/008/009)  
**Effort:** M  
**Blocked by:** DS-003, DS-005, DS-006, DS-011  
**Target:** All components match `plan/mockups/visualization-zone.html` and `plan/mockups/settings-zone.html`

## Scope

`src/features/visualization/` (13 files) + `src/features/settings/` (2 files).

## Changes

### `Settings.tsx`

- **Token cleanup:** `border-border` → `border-border-main`; `text-foreground` → `text-text-main`; `text-muted-foreground` → `text-text-muted`.
- **Profile card:** Apply `cardDefault` (from `src/lib/card-styles.ts`).
- **Account panels / connected account rows:** Apply `cardDefault` to each account section container.
- **Section headings:** Any `<h3>` using `text-foreground` → `<SectionHeading>`.
- **Status icons:** `text-status-success` for check icon; `text-status-error` for error badge.

### `VisualizationSidebar/index.tsx`

- Audit token usage. Sidebar panel background → `bg-surface`. Border → `border-border-main`.
- Panel section headings → `<SectionHeading>`.

### `VisualizationSidebar/ChartContent.tsx` / `DataPanel/*.tsx`

- Check for hardcoded colors; replace with status or primary tokens.
- Source list rows → `min-h-10 py-2 px-3 hover:bg-surface`.

### `DraggableDashboard/Toolbar.tsx`

- Icon buttons → `<IconButton size="md" variant="ghost">`.
- Background: toolbar bar → `bg-surface border-b border-border-main`.

### `DraggableDashboard/SortableCard.tsx` and `PlotlyCell.tsx`

- Card wrapper → `cardDefault`.
- Any hardcoded colors in the drag overlay or cell header → token classes.

### `DraggableDashboard/FullScreenModal.tsx`

- Modal max-width → `max-w-dialog-lg`.
- Background overlay → standard modal pattern.

## Acceptance Criteria

- [ ] `grep -rn 'text-foreground\|text-muted-foreground\|border-border[^-]' src/features/settings/ src/features/visualization/` returns zero results
- [ ] Visualization sidebar renders with `bg-surface` and `border-border-main` correctly in dark mode
- [ ] Settings profile card and account rows use `cardDefault` tier
- [ ] Toolbar icon buttons use `<IconButton>`
- [ ] DraggableDashboard cards use `cardDefault`
- [ ] `npm run build` passes

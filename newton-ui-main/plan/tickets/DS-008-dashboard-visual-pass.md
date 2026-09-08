# DS-008 · Dashboard Visual Pass

**Type:** Task  
**Wave:** 3 (parallel with DS-007/009/010)  
**Effort:** L  
**Blocked by:** DS-003, DS-004, DS-005, DS-006, DS-011  
**Target:** All components match `plan/mockups/dashboard-zone.html`

## Scope

`src/features/dashboard/` — all sections (11), all components, all forms (7), all modals (6).

## Changes

### `AdminOverviewSection.tsx`

- **Card tiers:** Main outer card → `cardElevated + cardElevatedHover` (from `src/lib/card-styles.ts`). Log Volume card + Feedback metrics card → `cardDefault`. KPI metric cards inside Feedback section → `cardFlat`.
- **CardTitle normalization:** Currently 3 different sizes (`text-2xl sm:text-3xl`, `text-2xl`, `text-xl sm:text-2xl`) on one page. Normalize: overview card title `text-2xl font-bold tracking-tight text-text-main`; section card titles `text-lg font-semibold text-text-main`.
- **Token cleanup:** `text-foreground` → `text-text-main`; `border-border` → `border-border-main`.
- **Filter label:** `<p className="font-semibold text-foreground">` → `<SectionHeading>`.
- **Plotly / log-level colors:** The 32+ hardcoded hex colors for Plotly charts and log-level badges should be replaced by a `useChartColors()` hook that reads CSS variable values at render time. Define the hook in `src/hooks/useChartColors.ts`.

  The hook must return an object with this exact shape (so all callers share the same names):
  ```ts
  interface ChartColors {
    primary: string;    // from --color-primary
    secondary: string;  // from --color-secondary
    accent: string;     // from --color-accent
    success: string;    // from --color-status-success
    warning: string;    // from --color-status-warning
    error: string;      // from --color-status-error
    info: string;       // from --color-status-info
    muted: string;      // from --color-text-muted (for disabled/neutral series)
    series: string[];   // 8-element array: [primary, secondary, accent, then 5 tints at /70 /50 /30 of primary/secondary/accent cycling]
  }
  ```

  The hook reads values via `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')` etc., so it responds to theme changes at runtime. It should be memoized on theme to avoid recomputing on every render.

  Log-level badge colors map: `ERROR`/`FATAL` → `error`, `WARN` → `warning`, `INFO` → `info`, `DEBUG` → `muted`, `TRACE` → `muted`.

### `DashboardTabLayout.tsx`

- Apply `cardElevated` const to the card class string (remove duplicated raw class string).
- Export constants remain (`dashboardTabCardClassName`, `dashboardTabCardHeaderClassName`) but they should now reference the card-styles constants.

### `ToolCard.tsx`

- Apply `cardDefault + cardDefaultHover`.
- `text-foreground` → `text-text-main`.
- Reasoning block: `bg-blue-50 dark:bg-blue-950/20 border-blue-200` → `bg-primary/10 border-border-main` (`/5` is below visible threshold on most monitors — use `/10`).
- Icon: `text-blue-600 dark:text-blue-400` → `text-primary`.
- Bare `border` on outer card → covered by `cardDefault`.

### `GridList.tsx`

List rows: normalize to `min-h-10 py-2 px-3 hover:bg-surface transition-colors`.

### All Dashboard Forms (`src/features/dashboard/components/Forms/`)

7 form files. Audit: ensure every `<input>`, `<textarea>`, `<select>` element uses `<Input>`, `<Textarea>`, `<Select>` from `src/components/ui/`. No raw HTML form elements.

### All Dashboard Modals (`src/features/dashboard/components/Modals/`)

6 modal files. Confirm `max-w-dialog-sm/md/lg` tokens are applied (this should already be done by UI-008, but verify). Any remaining `max-w-[Xpx]` → appropriate dialog token.

### Dashboard Section Files (`src/features/dashboard/sections/`)

11 section files. Sweep for:
- Hardcoded colors (`text-green-*`, `text-red-*`, `bg-*-500`) → status tokens
- Raw `<input>` elements → `<Input>` primitive
- `text-foreground` / `border-border` → our tokens
- Section headings using `<p>` or wrong classes → `<SectionHeading>`

## Acceptance Criteria

- [ ] `grep -rn 'text-foreground\|border-border[^-]' src/features/dashboard/` returns zero results
- [ ] `grep -rn 'bg-blue-50\|border-blue-200\|text-blue-[0-9]' src/features/dashboard/` returns zero results
- [ ] All 3 card tiers are visually distinct and match the mockup
- [ ] All CardTitles within AdminOverview use consistent sizes
- [ ] No raw `<input>` elements in form files
- [ ] `useChartColors` hook exists and is used in AdminOverviewSection
- [ ] Dark mode pass: all dashboard sections recolor correctly
- [ ] `npm run build` passes

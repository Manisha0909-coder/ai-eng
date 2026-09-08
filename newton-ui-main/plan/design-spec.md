# Design Specification — Newton UI

**Status:** Final (DS-001)
**Owner:** Tech Lead
**Last updated:** 2026-07-03

This document is the single written source of truth for every visual decision in the app. Every DS ticket cites this document. When writing a new component, the answer to "which class do I use?" is here. Any deviation discovered during implementation is a **spec update** (edit this file, note it in the PR), never a silent one-off.

## Token source of truth

All semantic tokens are declared in **`src/index.css`** as CSS custom properties in `:root` (light) and `.dark` (dark), and exposed as Tailwind classes via `tailwind.config.js`. Color vars hold space-separated RGB channels (e.g. `--color-primary: 59 130 246`) so Tailwind opacity modifiers (`bg-primary/10`) work.

> `src/styles/theme.css` is **legacy and not imported anywhere**. Do not add tokens there; do not use its `.theme-*` utility classes in new code. It is slated for deletion.

---

## 1. Color Token Vocabulary

Which Tailwind token carries which semantic meaning. Resolved values shown for reference; the CSS vars in `src/index.css` are authoritative.

| Role | Token class | Light | Dark | Notes |
|------|-------------|-------|------|-------|
| Brand action | `text-primary` / `bg-primary` | `59 130 246` (blue-500) | `99 102 241` (indigo-500) | Buttons, links, active indicators |
| Secondary brand | `text-secondary` / `bg-secondary` | `99 102 241` | `139 92 246` | Gradients, secondary accents |
| Accent | `text-accent` / `bg-accent` | `139 92 246` | `167 139 250` | Decorative highlights only |
| Card / panel background | `bg-surface` | `255 255 255` | `17 24 39` | One level above page background |
| Page background | `bg-background` | `249 250 251` | `10 15 26` | The outermost fill |
| Default body text | `text-text-main` | `17 24 39` | `255 255 255` | Canonical — never `text-foreground` in feature files |
| Secondary / helper text | `text-text-muted` | `107 114 128` | `156 163 175` | Never `text-muted-foreground` in feature files |
| Standard dividers | `border-border-main` | `229 231 235` | `55 65 81` | Never `border-border` in feature files |
| Input background | `bg-input-bg` | `255 255 255` | `31 41 55` | Form fields only |
| Error state | `text-status-error` / `bg-status-error` | `239 68 68` | same | Shared across themes |
| Success state | `text-status-success` / `bg-status-success` | `16 185 129` | same | |
| Warning state | `text-status-warning` / `bg-status-warning` | `245 158 11` | same | |
| Info state | `text-status-info` / `bg-status-info` | `59 130 246` | same | |

Rules:

- **Feature files** (`src/features/`, `src/layouts/`, `src/pages/`) use only the tokens above. The shadcn vocabulary (`text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-muted`) is reserved for `src/components/ui/` internals and is unified by DS-002.
- **No hardcoded palette classes** in feature files: `text-zinc-*`, `bg-gray-*`, `bg-blue-50`, `bg-green-500`, `bg-red-200`, etc. are banned — they don't respond to theme or dark mode. Use the semantic token that matches the *role*.
- Opacity variants are expressed with slash modifiers on tokens: `bg-primary/10`, `bg-surface/50`, `border-border-main/60`.
- OAuth brand colors (`bg-oauth-microsoft`, `bg-oauth-microsoft-hover`) are the only permitted literal-brand tokens.

## 2. Typography

### 2.1 Font Families

| Role | How to use | Stack |
|------|-----------|-------|
| UI & headings | Default (`--font-family` on `body`) — never set a family class in feature files | `"Inter", system-ui, -apple-system, sans-serif` |
| Code / log output | `font-mono` (Tailwind default stack) | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| Metrics / KPI numbers / timestamps | add `tabular-nums` to the size class | same family, tabular figures |

Rules:

- **One family.** Headings and body both use Inter; hierarchy comes from size and weight (§2.2), not from a second face. `--font-family-heading` exists but must stay identical to `--font-family` — do not diverge it without a spec update.
- Numbers that update or sit in columns (KPI cards, tables, durations) always get `tabular-nums` so digits don't jitter or misalign.
- No decorative faces in the app.

> **Config gap (must fix in DS-002):** Inter is *declared* but never *loaded* — there is no Google Fonts link, `@font-face`, or fontsource import, so every user currently sees their system font. Fix by self-hosting: `npm i @fontsource-variable/inter`, then `import "@fontsource-variable/inter";` in `src/main.tsx`, and update the var to `"Inter Variable", "Inter", system-ui, ...`.
>
> **Also remove:** the render-blocking `@import` of the Allura script font (line 1 of `index.css`) and the `font-emma` entry in `tailwind.config.js` (which also contains a typo: `'Allura"'`). Neither is used anywhere in `src/`.

### 2.2 Type Scale

| Level | Element | Classes |
|-------|---------|---------|
| Page title | `<h1>` (via `<PageHeading>`, DS-005) | `text-2xl font-bold tracking-tight text-text-main` |
| Card title | shadcn `<CardTitle>` | `text-lg font-semibold text-text-main` |
| Subsection heading | `<h3>` (via `<SectionHeading>`, DS-005) | `text-sm font-semibold text-text-main` |
| Body | `<p>` / `<span>` | `text-sm text-text-main` |
| Secondary body | `<p>` / `<span>` | `text-sm text-text-muted` |
| Caption / badge | `<span>` | `text-xs text-text-muted` |
| Mini label | `<span>` | `text-2xs text-text-muted` (10px token from `tailwind.config.js`) |

Rules:

- One `<h1>` per page.
- Card titles inside a dashboard section always use `text-lg`, never `text-xl` or `text-2xl`.
- `font-bold` is for page titles only. `font-semibold` for card and section titles. `font-medium` for emphasized body text.
- `tracking-tight` only on page titles.
- `text-3xs` (9px) exists but is reserved for dense chart annotations; do not use it for readable UI text.
- Root font size is responsive (`html { font-size: var(--font-size-base) }` with `clamp(14px, 1vw + 0.75rem, 16px)`), so all `rem`-based text scales with viewport. Do not use `px` font sizes in feature files.

## 3. Card Tier System (3 levels)

Implemented as exported class-string constants in `src/lib/card-styles.ts` (DS-003). Always use the constants, never retype the strings.

| Tier | When to use | Class string |
|------|-------------|-------------|
| `cardElevated` | Primary content cards, top-level section containers | `border-2 border-border-main bg-background/80 backdrop-blur-xl shadow-elevated rounded-lg` + gradient accent bar at top |
| `cardDefault` | Standard information cards, list item panels | `border border-border-main bg-surface rounded-lg shadow-sm` |
| `cardFlat` | Nested content within an elevated/default card | `bg-surface/50 rounded-lg` (no border, no shadow) |

Hover behavior (separate constants, composed only where the card is interactive):

- `cardElevatedHover` → `hover:shadow-elevated-hover transition-all duration-300`
- `cardDefaultHover` → `hover:shadow-md transition-shadow duration-200`
- `cardFlat`: no hover, ever.

### Gradient accent bar

The gradient accent bar is a required direct-child `<div>` on every `cardElevated` card — it is not optional. It is not part of the `cardElevated` string because it must sit as a child element, not a background on the card itself.

```tsx
// Always the first child of a cardElevated card:
<div className="h-[3px] bg-gradient-to-r from-primary to-secondary rounded-t-lg -mx-[2px] -mt-[2px]" />
```

This 3px strip runs the full width of the card, flush to the top border. `from-primary to-secondary` maps to blue-500 → indigo-500 in light mode and indigo-500 → violet-500 in dark mode. The `-mx-[2px] -mt-[2px]` offsets compensate for the `border-2` so the bar sits inside the border edge.

Rules:

- Never nest `elevated` inside `elevated`. Nesting order is elevated → default → flat.
- `cardElevated` without the gradient bar is a design error — if the gradient bar is visually unwanted for a specific placement, use `cardDefault` instead.
- No other card patterns. `border-[2px]`, `shadow-[var(--shadow-elevated)]` arbitrary values, and one-off blur/border combos are replaced by the constants.
- `backdrop-blur-xl` on elevated cards relies on the dark page background (`10 15 26`, a blue-tinged near-black) providing color contrast behind the `bg-background/80` translucency. This effect is intentional and should not be removed to "simplify" the card.

## 4. Spacing Scale

| Context | Rule |
|---------|------|
| Intra-card padding | `p-4` (default), `p-6` (large desktop panels) |
| Section stack gap | `space-y-4` |
| Chat message gap | `mt-4` between every top-level content block in `AssistantMessage` |
| List row | `min-h-10 py-2 px-3` |
| Modal inner padding | `px-6 py-4` |
| Inline icon-to-text gap | `gap-2` |

Use the Tailwind 4-based rhythm (`2 / 4 / 6`); do not introduce `p-5`, `p-7`, or arbitrary pixel padding in feature files.

## 5. Interactive States

| State | Classes |
|-------|---------|
| Default hover (list rows, sidebar items) | `hover:bg-surface` |
| Hover on colored / overlay background | `hover:bg-surface/50` |
| Active / selected | `bg-primary/10 text-primary` |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none` |
| Disabled | `opacity-50 cursor-not-allowed` |

Rules:

- **No `onMouseEnter`/`onMouseLeave` JS for hover styling.** Tailwind `hover:` classes only. (JS mouse handlers remain legitimate for behavior — tooltips, prefetch — never for swapping colors.)
- These are the only two hover background variants. `hover:bg-surface/30`, `hover:bg-white/10`, and similar ad-hoc opacities are replaced during Wave 3 passes.
- Transitions accompanying hover states: `transition-colors duration-200` unless the card tier constant already provides one.

## 6. Elevation Model

| Level | Shadow class | Backing value |
|-------|-------------|---------------|
| Flat (no elevation) | — | — |
| Card default | `shadow-sm` | Tailwind default |
| Card elevated | `shadow-elevated` | `var(--shadow-elevated)` = `0 18px 40px rgb(0 0 0 / 0.2)` |
| Card elevated hover | `shadow-elevated-hover` | `var(--shadow-elevated-hover)` = `0 20px 50px rgb(0 0 0 / 0.3)` |
| Popover / dropdown | `shadow-lg` | Tailwind default |
| Modal | `shadow-xl` | Tailwind default |

Elevation communicates layering, not importance: page → card (`sm`) → elevated section (`elevated`) → overlay (`lg`/`xl`). Never stack a heavier shadow inside a lighter one.

> **Config note:** `shadow-elevated` / `shadow-elevated-hover` are not yet Tailwind utilities — existing code uses arbitrary `shadow-[var(--shadow-elevated)]`. DS-003 adds the `boxShadow` extension to `tailwind.config.js`:
> ```js
> boxShadow: {
>   elevated: 'var(--shadow-elevated)',
>   'elevated-hover': 'var(--shadow-elevated-hover)',
> }
> ```
> The `--shadow-elevated-xl(-hover)` vars in `index.css` are unadopted; do not use them without a spec update.

## 7. Border Radius

| Shape | When | Class | Value |
|-------|------|-------|-------|
| Rounded large | Cards, dialogs, inputs, panels | `rounded-lg` | 12px (`--border-radius-lg: 0.75rem`) |
| Rounded medium | Badges, chips, tags, small UI elements | `rounded-md` | 8px (`--border-radius-md: 0.5rem`) |
| Rounded full | Icon buttons, avatars, status dots, pills | `rounded-full` | 9999px |

No `rounded-xl`, `rounded-2xl`, or arbitrary radii in feature files.

> **Config gap (must fix in DS-002):** `tailwind.config.js` currently maps `borderRadius.lg/md/sm` to `var(--radius)` (shadcn convention), but **`--radius` is not defined anywhere**, so these classes silently compute to `0`. Fix by re-pointing the config to the existing vars:
> ```js
> borderRadius: {
>   lg: 'var(--border-radius-lg)',   // 0.75rem
>   md: 'var(--border-radius-md)',   // 0.5rem
>   sm: 'var(--border-radius-sm)',   // 0.375rem
> }
> ```

## 8. Icon Sizing

Uses spacing tokens already defined in `tailwind.config.js`:

| Token | Size | When |
|-------|------|------|
| `w-icon-sm h-icon-sm` | 20px | Inline icons next to text |
| `w-icon-md h-icon-md` | 28px | Icon buttons (most common) |
| `w-icon-lg h-icon-lg` | 42px | FAB / prominent action buttons |

No `w-4 h-4`, `w-5 h-5`, `size-6`, or pixel-arbitrary icon sizes in feature files — pick the nearest token.

## 9. Icon Button Pattern

Use `<IconButton>` from `src/components/ui/icon-button.tsx` (created in DS-004) for every circular/square button that contains only an icon.

```tsx
<IconButton size="md" variant="ghost" aria-label="Copy message">
  <CopyIcon />
</IconButton>
```

- Sizes map to the icon tokens in §8: `sm` → `icon-sm`, `md` → `icon-md` (default), `lg` → `icon-lg`.
- Variants:
  - `ghost` — transparent background, `hover:bg-surface`. Use for icon buttons on standard `bg-surface` or `bg-background` backgrounds (most cases).
  - `overlay` — transparent background, `hover:bg-surface/50`. Use for icon buttons that sit on a colored or dark-overlay background (e.g. the dictate button inside a chat bubble, toolbar buttons on a non-standard fill).
  - `solid` — `bg-primary text-white hover:bg-primary/90`. Use for prominent single-action buttons only.
- `aria-label` is **required** and enforced as a non-optional TypeScript prop — the component will not compile without it.
- Do not write `rounded-full p-2 hover:bg-surface transition-colors` ad hoc. Do not use `onMouseEnter`/`onMouseLeave`.

## 10. Section Heading Pattern

Use `<SectionHeading>` and `<PageHeading>` from `src/components/ui/headings.tsx` (created in DS-005).

```tsx
<PageHeading>Dashboard</PageHeading>
// renders: <h1 className="text-2xl font-bold tracking-tight text-text-main">Dashboard</h1>

<SectionHeading>Connected Accounts</SectionHeading>
// renders: <h3 className="text-sm font-semibold text-text-main">Connected Accounts</h3>
```

- Never use `<p>` for a section label.
- Never apply `text-zinc-400` (or any palette class) to a heading — headings are always `text-text-main`.
- Both accept `className` for margin adjustments only, not for color/size/weight overrides.

## 11. Motion & Transitions

| Context | Duration | Property |
|---------|----------|----------|
| Hover color/background (buttons, rows, icons) | `duration-200` | `transition-colors` |
| Hover shadow (default cards) | `duration-200` | `transition-shadow` |
| Elevated card hover | `duration-300` | `transition-all` (via §3 constant) |
| Layout (sidebar open/close, panel resize) | `duration-300` | `transition-transform` / width var |
| Enter/exit (modals, popovers, toasts) | shadcn/`tailwindcss-animate` defaults | — |

Rules:

- Easing: Tailwind defaults only. No custom cubic-beziers in feature files.
- Animate `transform`, `opacity`, `color`, and `shadow` — never `width`/`height`/`top`/`left` (except the sidebar, which is driven by the `--viz-sidebar-width` var).
- `duration-500`+ is banned for hover states; existing `duration-500` card hovers are normalized to the §3 constants during Wave 3.
- Ambient animations (`animate-spin-slow`, `animate-spin-slow-reverse`) are reserved for loading and branding moments, not persistent decoration.
- `prefers-reduced-motion` is respected globally (already handled in `index.css`); never add an animation that bypasses it.

## 12. Z-Index Scale

| Layer | Class | Value |
|-------|-------|-------|
| Base content | (none) | auto |
| Sticky headers / in-panel toolbars | `z-10` | 10 |
| Fixed app chrome (Header, Sidebar) | `z-20` | 20 |
| Dropdowns / popovers / tooltips | `z-30` (or shadcn's own `z-50`) | 30 |
| Modal overlay + dialog | shadcn `z-50` | 50 |
| Toasts | `z-[60]` | 60 |

Rules:

- shadcn primitives (Dialog, Popover, Toast) own their overlay z-indices — never override them.
- No arbitrary `z-[...]` values in feature files (`z-[9999]` etc.). The existing arbitrary values in `Header.tsx` and `AppSidebar.tsx` are normalized to this scale during DS-009.

## 13. Quality Floor (responsive & accessibility)

Every screen ships meeting this baseline — it is not a polish pass:

- **Breakpoints:** Tailwind defaults, mobile-first. The sidebar collapses and dashboards stack below `md`; no custom breakpoints.
- **Touch targets:** interactive elements are at least 40×40px on touch layouts — `IconButton` sizes reach this via padding, list rows via `min-h-10` (§4).
- **Focus:** every interactive element shows the §5 focus ring via `focus-visible`; never `outline-none` without a replacement.
- **Contrast:** `text-text-muted` on `bg-surface` is the lowest-contrast pairing allowed for readable text (≈4.6:1 both modes). Never put muted text on `bg-primary` or gradient fills.
- **Labels:** icon-only controls always have `aria-label` (§9); images of data (charts) get a text alternative.

## 14. Date & Time Display

Admin console tables carry two distinct date columns that follow different formatting rules.

| Column | Format | Rationale |
|--------|--------|-----------|
| **Created** | Exact date — `Jan 4, 2025` | A permanent audit fact; relative decay ("8 months ago") loses precision needed for compliance, filtering, and sorting. |
| **Last Updated** (and similar recency signals) | Relative → falls back to exact date | Answers "was this touched recently?" at a glance; relative labels stop being useful past ~7 days. |

### Relative time thresholds ("Last Updated" column)

| Age | Display |
|-----|---------|
| < 1 min | `Just now` |
| 1 – 59 min | `Xm ago` |
| 1 – 23 h | `Xh ago` |
| ~1 day | `Yesterday` |
| 2 – 6 days | `Xd ago` |
| ≥ 7 days | exact date: `Jan 4, 2025` |

Rules:

- All date/time cells use `tabular-nums` (§2.1) so values in a column don't jitter.
- Relative values always expose the precise timestamp in a tooltip on hover (e.g. `Jan 4, 2025 at 14:23 UTC`). No tooltip is needed for cells that already show an exact date.
- This pattern applies to any "last seen / last active / last modified" signal anywhere in the admin console, not only the main Users table.
- Time zone for display: UTC. Surface it explicitly in the tooltip suffix (e.g. `14:23 UTC`) so admins in distributed teams aren't guessing.

---

## Appendix A — Known gaps this spec resolves

| Gap | Resolution | Ticket |
|-----|-----------|--------|
| `src/styles/theme.css` is dead (not imported) and contradicts `index.css` | Delete; `src/index.css` is the only token source | DS-002 |
| `--radius` undefined → `rounded-lg/md/sm` compute to 0 | Re-point `borderRadius` config to `--border-radius-*` (§7) | DS-002 |
| `shadow-elevated` used only as arbitrary value | Add `boxShadow` extension (§6) | DS-003 |
| Dual text/border token vocabulary | Feature files use `text-text-main` / `text-text-muted` / `border-border-main` only (§1) | DS-002 |
| Backward-compat aliases (`--color-text-secondary`, `--color-muted*`, `--color-destructive`) | Do not use in new code; removed in UI-010 | UI-010 |
| Inter declared in `--font-family` but never loaded — users see system fonts | Self-host via `@fontsource-variable/inter` (§2.1) | DS-002 |
| Allura font loaded (render-blocking `@import`) + `font-emma` config entry with typo, both unused | Remove import and config entry (§2.1) | DS-002 |
| Arbitrary `z-[...]` values in `Header.tsx` / `AppSidebar.tsx` | Normalize to the z-index scale (§12) | DS-009 |

## Appendix B — Sign-off

- [ ] Reviewed and signed off by: _______________ (required before Wave 2 starts)

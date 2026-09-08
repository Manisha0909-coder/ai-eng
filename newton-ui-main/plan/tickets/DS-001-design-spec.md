# DS-001 · Design Specification Document

**Type:** Task  
**Wave:** 1  
**Effort:** M  
**Priority:** P0 — all other DS tickets depend on this  
**Blocked by:** —  
**Blocks:** DS-003, DS-004, DS-005, DS-006, DS-007, DS-008, DS-009, DS-010, DS-011

## Goal

Produce `plan/design-spec.md` — the single written source of truth for every visual decision in the app. Every subsequent ticket in this epic cites this document. Developers writing a new component have one place to look.

## Deliverable

**File:** `plan/design-spec.md`

The spec must cover all sections below. Actual values are to be finalized during writing of this ticket.

---

## Sections to Define

### 1. Color Token Vocabulary

Which Tailwind token carries which semantic meaning. All tokens are defined in `tailwind.config.js` and resolved from `src/styles/theme.css` (CSS vars in `:root` / `.dark`).

| Role | Token class | Notes |
|------|-------------|-------|
| Brand action | `text-primary` / `bg-primary` | Buttons, links, active indicators |
| Card / panel background | `bg-surface` | One level above page background |
| Page background | `bg-background` | The outermost fill |
| Default body text | `text-text-main` | Canonical — never use `text-foreground` in feature files |
| Secondary / helper text | `text-text-muted` | Never use `text-muted-foreground` in feature files |
| Standard dividers | `border-border-main` | Never use `border-border` in feature files |
| Error state | `text-status-error` / `bg-status-error` | |
| Success state | `text-status-success` / `bg-status-success` | |
| Warning state | `text-status-warning` / `bg-status-warning` | |
| Info state | `text-status-info` / `bg-status-info` | |

### 2. Typography Scale

| Level | Element | Classes |
|-------|---------|---------|
| Page title | `<h1>` | `text-2xl font-bold tracking-tight text-text-main` |
| Card title | shadcn `<CardTitle>` | `text-lg font-semibold text-text-main` |
| Subsection heading | `<h3>` | `text-sm font-semibold text-text-main` |
| Body | `<p>` / `<span>` | `text-sm text-text-main` |
| Secondary body | `<p>` / `<span>` | `text-sm text-text-muted` |
| Caption / badge | `<span>` | `text-xs text-text-muted` |
| Mini label | `<span>` | `text-2xs text-text-muted` |

Rules:
- One `<h1>` per page.
- Card titles inside a dashboard section always use `text-lg`, not `text-xl` or `text-2xl`.
- `font-bold` is for page titles only. `font-semibold` for card and section titles. `font-medium` for emphasized body text.
- `tracking-tight` only on page titles.

### 3. Card Tier System (3 levels)

| Tier | When to use | Class string |
|------|-------------|-------------|
| `elevated` | Primary content cards, top-level section containers | `border-2 border-border-main bg-background/80 backdrop-blur-xl shadow-elevated rounded-lg` + gradient accent bar at top |
| `default` | Standard information cards, list item panels | `border border-border-main bg-surface rounded-lg shadow-sm` |
| `flat` | Nested content within an elevated/default card | `bg-surface/50 rounded-lg` (no border, no shadow) |

Hover behavior:
- `elevated` cards: `hover:shadow-elevated-hover transition-all duration-300`
- `default` cards: `hover:shadow-md transition-shadow duration-200`
- `flat` cards: no hover

### 4. Spacing Scale

| Context | Rule |
|---------|------|
| Intra-card padding | `p-4` (default), `p-6` (large desktop panels) |
| Section stack gap | `space-y-4` |
| Chat message gap | `mt-4` between every top-level content block in AssistantMessage |
| List row | `min-h-10 py-2 px-3` |
| Modal inner padding | `px-6 py-4` |

### 5. Interactive States

| State | Classes |
|-------|---------|
| Default hover (list rows, sidebar items) | `hover:bg-surface` |
| Hover on colored / overlay background | `hover:bg-surface/50` |
| Active / selected | `bg-primary/10 text-primary` |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none` |
| Disabled | `opacity-50 cursor-not-allowed` |

No `onMouseEnter`/`onMouseLeave` JS for hover states. Tailwind hover classes only.

### 6. Elevation Model

| Level | Shadow |
|-------|--------|
| Flat (no elevation) | — |
| Card default | `shadow-sm` |
| Card elevated | `shadow-elevated` (maps to `--shadow-elevated` CSS var) |
| Card elevated hover | `shadow-elevated-hover` |
| Popover / dropdown | `shadow-lg` |
| Modal | `shadow-xl` |

### 7. Border Radius

| Shape | When | Class |
|-------|------|-------|
| Rounded large | Cards, dialogs, inputs, panels | `rounded-lg` |
| Rounded full | Icon buttons, avatars, status dots, pills | `rounded-full` |
| Rounded medium | Badges, chips, tags, small UI elements | `rounded-md` |

### 8. Icon Sizing

Uses tokens from `tailwind.config.js`:

| Token | Size | When |
|-------|------|------|
| `w-icon-sm h-icon-sm` | 20px | Inline icons next to text |
| `w-icon-md h-icon-md` | 28px | Icon buttons (most common) |
| `w-icon-lg h-icon-lg` | 42px | FAB / prominent action buttons |

### 9. Icon Button Pattern

Use `<IconButton>` from `src/components/ui/icon-button.tsx` (created in DS-004) for every circular/square button that contains only an icon.

```tsx
<IconButton size="md" variant="ghost" aria-label="Copy message">
  <CopyIcon />
</IconButton>
```

Do not write `rounded-full p-2 hover:bg-surface transition-colors` ad hoc. Do not use `onMouseEnter`/`onMouseLeave`.

### 10. Section Heading Pattern

Use `<SectionHeading>` from `src/components/ui/headings.tsx` (created in DS-005).

```tsx
<SectionHeading>Connected Accounts</SectionHeading>
// renders: <h3 className="text-sm font-semibold text-text-main">Connected Accounts</h3>
```

Never use `<p>` for a section label. Never apply `text-zinc-400` to a section heading.

---

## Acceptance Criteria

- [x] `plan/design-spec.md` exists covering all 10 sections above with finalized values
- [ ] Design spec reviewed and signed off by at least one other team member
- [ ] Every subsequent DS ticket references this doc, not the epic
- [ ] Any deviation from the spec during implementation is flagged as a spec update, not a one-off

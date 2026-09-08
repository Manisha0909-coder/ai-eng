# DS-003 · Card Tier System

**Type:** Task  
**Wave:** 2  
**Effort:** M  
**Blocked by:** DS-001  
**Blocks:** DS-007, DS-008, DS-009, DS-010

## Problem

The codebase has 5 different card visual patterns with no shared abstraction. Every developer picks their own combination of border width, shadow, backdrop-blur, and gradient:

| Pattern | Where used | Border | Shadow | Blur |
|---------|-----------|--------|--------|------|
| Elevated + gradient bar | `DashboardTabLayout`, AdminOverview main | `border-[2px]` | `shadow-[var(--shadow-elevated)]` | `backdrop-blur-xl` |
| Elevated sub-card | AdminOverview Log Volume, Feedback | `border` (1px) | same shadow | same blur |
| ToolCard | `ToolCard.tsx` | unstyled `border` | `hover:shadow-md` | none |
| Settings panel | `Settings.tsx` | `border-border` | `shadow-sm` | none |
| AdminOverview KPI micro-card | inside AdminOverview | `border-border-main/60` | none | none |

## Solution

### Step 1 — Extend `tailwind.config.js`

`shadow-elevated` and `shadow-elevated-hover` are used in the tier constants but currently only work as arbitrary values (`shadow-[var(--shadow-elevated)]`). Before the string constants can compile, add the `boxShadow` extension:

```js
// tailwind.config.js — extend theme:
boxShadow: {
  elevated:       'var(--shadow-elevated)',
  'elevated-hover': 'var(--shadow-elevated-hover)',
},
```

The `--shadow-elevated` and `--shadow-elevated-hover` CSS vars already exist in `src/index.css`. Do not add new vars; only wire the Tailwind utilities to them.

### Step 2 — Create `src/lib/card-styles.ts`

Define **3 named tiers** as exported class-string constants. Lightweight approach — no new component wrapping, just shared string constants that developers apply.

```ts
export const cardElevated =
  "border-2 border-border-main bg-background/80 backdrop-blur-xl shadow-elevated rounded-lg"

export const cardDefault =
  "border border-border-main bg-surface rounded-lg shadow-sm"

export const cardFlat =
  "bg-surface/50 rounded-lg"
```

Hover additions (apply separately, not baked into the tier strings):
```ts
export const cardElevatedHover = "hover:shadow-elevated-hover transition-all duration-300"
export const cardDefaultHover  = "hover:shadow-md transition-shadow duration-200"
```

### Step 3 — Gradient accent bar

Every `cardElevated` card must include the gradient bar as its first child element (see DS-001 §3 for full spec):

```tsx
<div className="h-[3px] bg-gradient-to-r from-primary to-secondary rounded-t-lg -mx-[2px] -mt-[2px]" />
```

When migrating existing elevated cards, add this bar if it is absent. It is not optional.

## Migration Targets

### `DashboardTabLayout.tsx`
Current ad-hoc class → `cardElevated + cardElevatedHover`  
The gradient accent bar `<div>` stays as-is.

### `AdminOverviewSection.tsx`
- Main outer card → `cardElevated + cardElevatedHover`
- Log Volume card, Feedback metrics card (nested) → `cardDefault`
- KPI metric cards inside feedback section → `cardFlat`

### `ToolCard.tsx`
Current `border rounded-lg ... bg-background hover:shadow-md` → `cardDefault + cardDefaultHover`

### `Settings.tsx`
Profile card, account panels → `cardDefault`

## Acceptance Criteria

- [ ] `tailwind.config.js` has `elevated` and `elevated-hover` entries under `boxShadow`
- [ ] `src/lib/card-styles.ts` created with the three tier exports (using `shadow-elevated`, not the arbitrary value)
- [ ] All 5 migration targets updated to use the tier constants
- [ ] Every `cardElevated` usage has the gradient accent bar `<div>` as its first child
- [ ] No new ad-hoc card class strings introduced in these files
- [ ] `npm run build` passes
- [ ] Visually: elevated cards have the 2px border + blur + gradient bar; default cards have 1px border + sm shadow; flat sections have no border

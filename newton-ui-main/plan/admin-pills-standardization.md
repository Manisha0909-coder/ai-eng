# Admin Console Pill / Badge Standardization

## Problem

Admin DataTable cells use at least five independent pill patterns today:

| Pattern | Example locations | Issue |
|---------|-------------------|-------|
| shadcn `Badge` variants | Tools type, Tags name, Roles name | Mixed `default` / `secondary` / `outline`; shape is `rounded-md` |
| `StatusBadge` | Health, upload status, feedback | `rounded-full`; inline `style={}` on CSS vars |
| `dashboardHelper` tint classes | Server, doc tags, personas | Hardcoded Tailwind hues (`bg-purple-100`); breaks theme token rules |
| Inline `style={}` | Data source kind | Opaque solid fills; not theme-aware |
| Raw `<span>` chips | Roles/Tags associations, Users access | Duplicated class strings |

This produces inconsistent opacity, shape, and color semantics across tabs that should feel like one console.

---

## Design goals

1. **One component** — `DashboardPill` (name TBD) for all admin table chips.
2. **Four intents** — visual style driven by *meaning*, not by which tab you're on.
3. **Token-backed** — no hardcoded Tailwind color names in section files; `npm run check:colors` stays clean.
4. **Match existing mockups** — `plan/mockups/admin-tables.html` already prototypes neutral + entity pills for Tools; extend that language everywhere.
5. **Backward compatible** — migrate section-by-section; keep `StatusBadge` as a thin wrapper during transition.

---

## Pill taxonomy (the contract)

### 1. `neutral` — categorical metadata

Use for values that describe *what kind of thing* something is, not *which* thing.

| Field | Example value |
|-------|-----------------|
| Tool type | `mcp`, `builtin` |
| File format | `PDF`, `CSV` |
| Server type (non-MCP) | `custom` |
| Admin role (secondary) | `User Admin` |

**Look:** `bg-surface` · `border-border-main` · `text-text-muted` · `rounded-md`

### 2. `entity` — domain identity

Use when the pill represents a named object in the RBAC graph.

| Entity key | Example | Replaces |
|------------|---------|----------|
| `role` | `analyst` | `ROLE_COLOR` |
| `persona` | `Newton Default` | `PERSONA_COLOR` |
| `doc-tag` | `finance` | `DOC_TAG_COLOR` |
| `tool-tag` | `web-tools` | `TOOL_COLOR` |
| `server` | `brave-search` | Server column (was persona blue) |
| `datasource` | `sales-db` | Data source kind (tinted, not opaque) |

**Look:** tinted background + matching border + text, all from entity hue token:

```
bg:    rgb(var(--color-entity-{key}) / var(--pill-bg-alpha))
border: rgb(var(--color-entity-{key}) / var(--pill-border-alpha))
text:  rgb(var(--color-entity-{key}))
```

Optional `mono` prop for server names / technical IDs (`font-mono`).

> **Persona type (chat vs dashboard) is NOT an entity pill.** See [Persona type avatar](#persona-type-avatar-not-a-pill) below.

### 3. `status` — operational state

Use for health, progress, resolution, visibility.

| Status | Example |
|--------|---------|
| `success` | Healthy, Completed, Resolved, Public |
| `error` | Unhealthy, Failed |
| `warning` | Unresolved |
| `pending` | Upload 42% |
| `info` | Private, MCP type |
| `neutral` | Queued, Not checked |

**Look:** same alpha pattern as today’s `StatusBadge`, but **`rounded-md`** (not `rounded-full`) for table consistency. Icon + label supported.

Uses existing `--color-success`, `--color-error`, `--color-warning`, `--color-info`, `--color-primary` (pending), `--color-text-muted` (neutral).

### 4. `count` — numeric summary

Use for Users access column (`3 roles`, `2 personas`).

**Look:** `border-border-main` · `bg-surface` · bold number + muted noun. Not color-coded.

---

## Persona type avatar (not a pill)

**Deprecate** `PersonaTypeBadge`, `CHAT_PERSONA_TYPE_COLOR`, `DASHBOARD_PERSONA_TYPE_COLOR`, and the sky/indigo dot legend in `PersonasSection`.

Persona mode (chat vs dashboard) is encoded on the **avatar chip** beside the persona name — same language as `plan/mockups/chat-welcome.html`:

| Type | Token | Avatar look |
|------|-------|-------------|
| **Chat** | `--color-primary` (green / viridian) | Gradient `primary/15 → primary/8`, `text-primary`, inset ring `primary/18` |
| **Dashboard** | `--color-accent` (yellow / brass) | Gradient `accent/15 → accent/8`, `text-accent`, inset ring `accent/18` |

### Component: `PersonaTypeAvatar`

```tsx
// src/features/dashboard/components/PersonaTypeAvatar.tsx

interface PersonaTypeAvatarProps {
  name?: string;
  type?: 'chat' | 'dashboard' | 'api' | null;
  size?: 'sm' | 'md';   // sm = 28px (table), md = 36px (cards)
  className?: string;
}
```

- Renders **initials** (`font-display`) inside a `rounded-lg` box — matches chat-welcome persona cards.
- `type === 'dashboard'` → accent styling; everything else (chat, api, null) → primary styling.
- `aria-label` includes type: `"Research Strategist, chat persona"`.
- **Remove the TYPE column** from the Personas DataTable; type is visible on the avatar. The type filter in the toolbar stays.

### Where to apply

| Location | Change |
|----------|--------|
| `Persona.tsx` — PERSONA column | `PersonaAvatar` → `PersonaTypeAvatar` with `type={row.type}` |
| `Persona.tsx` — TYPE column | **Delete column** |
| `PersonasSection` header legend | `bg-sky-500` / `bg-indigo-500` dots → `bg-primary` / `bg-accent` |
| `PersonaSidebar` | Replace type `Badge` with accent/primary avatar or subtitle text |
| `dashboardHelper.ts` | Remove `CHAT_PERSONA_TYPE_COLOR`, `DASHBOARD_PERSONA_TYPE_COLOR`, `personaTypeBadgeClassName` |

### Tokens needed

**None new** — reuse existing `--color-primary` and `--color-accent`. Do not add `--color-entity-chat-persona` / `--color-entity-dashboard-persona`.

---

## User avatar (not a pill, not persona-colored)

**Yes — standardize this too.** Today human users have three incompatible treatments:

| Location | Current | Problem |
|----------|---------|---------|
| **Admin → Admin users** | `getPersonaAvatarColor()` hash → emerald/violet/amber/sky/rose/teal | Reuses persona helper; rainbow looks random in an admin table |
| **Admin → Users** | Generic `UserIcon` in `rounded-full bg-primary/10` | No initials; visually different from Admin users tab |
| **Users → Access graph drawer** | Hardcoded `bg-teal-100 text-teal-700` + initials | Third style; breaks theme tokens |

Personas get **semantic** color (green / yellow). Humans get **neutral** color — always the same, never hash-randomized.

### Component: `UserAvatar`

```tsx
// src/features/dashboard/components/UserAvatar.tsx

interface UserAvatarProps {
  /** user_id, email, or display_name — used for initials */
  label: string;
  size?: 'sm' | 'md';   // sm = 32px (Users tab), md = 36px (Admin users)
  className?: string;
}
```

**Look** (one style everywhere):

```
rounded-lg
bg-surface-2 · border border-border-main · text-text-main
font-display font-semibold
initials from label (reuse getDisplayInitials — rename from getPersonaInitials)
```

| Size | Box | Font | Used in |
|------|-----|------|---------|
| `sm` | `h-8 w-8` | `text-2xs` | Users tab table |
| `md` | `h-9 w-9` | `text-xs` | Admin users table, access graph header |

- **No** `User` silhouette icon in table cells.
- **No** per-user hash colors.
- `aria-label="User: alice@corp.com"`.

> The logged-in user chip in the **chat header** (`chat-welcome.html`) may keep `primary/15` tint — that's session chrome, not an admin table row. Admin console tables use the neutral `UserAvatar` only.

### Where to apply

| Location | Change |
|----------|--------|
| `AdminUsersSection` — USER column | Replace hash `getPersonaAvatarColor` div → `<UserAvatar label={displayName} size="md" />` |
| `UsersSection` — User column | Replace `UserIcon` circle → `<UserAvatar label={user.user_id} size="sm" />` |
| `AccessGraphView` — header | Replace hardcoded teal box → `<UserAvatar label={user.user_id} size="md" />` |

### Deprecate

| Current | Replacement |
|---------|-------------|
| `getPersonaAvatarColor()` | **Delete** — personas use `PersonaTypeAvatar`, humans use `UserAvatar` |
| `PERSONA_AVATAR_COLORS` | **Delete** |
| `getPersonaInitials()` | Rename → `getDisplayInitials()` (shared by both avatar components) |

### Tokens needed

**None new** — `surface-2`, `border-main`, `text-main` already exist.

### Visual language summary (admin console)

| Element | Component | Color meaning |
|---------|-----------|---------------|
| Persona row | `PersonaTypeAvatar` | Green = chat, yellow = dashboard |
| Human user row | `UserAvatar` | Neutral — not type-coded |
| RBAC tag / status | `DashboardPill` | Entity hue or status hue |
| Access counts | `DashboardPill intent="count"` | Uncolored |

---

## Do we need new design tokens?

**Yes — but only for entity hues and pill structure.** Status tokens already exist.

### Add to `:root` / `.dark` in `src/index.css`

```css
/* Entity hues (RGB triplets, same format as --color-primary) */
--color-entity-role:       100 116 139;   /* slate  — roles */
--color-entity-persona:     59 130 246;   /* blue   — personas */
--color-entity-doc-tag:    147  51 234;   /* purple — document tags */
--color-entity-tool-tag:    16 185 129;   /* emerald — tool tags */
--color-entity-server:      23 112  92;   /* primary-aligned — servers / infra */
--color-entity-datasource:   6 182 212;   /* cyan   — data sources */

/* Pill structure (shared across intents) */
--pill-radius: var(--border-radius-sm);   /* 6px → rounded-md */
--pill-px: 0.5rem;                        /* px-2 */
--pill-py: 0.125rem;                      /* py-0.5 */
--pill-font-size: 0.75rem;                /* text-xs */
--pill-bg-alpha: 0.10;
--pill-border-alpha: 0.22;
--pill-status-bg-alpha: 0.12;             /* status slightly more visible */
--pill-status-border-alpha: 0.28;
```

Dark mode: adjust entity triplets for contrast on `--color-surface` (same approach as primary dark flip). Values to tune during implementation — mockup includes working light/dark examples.

### Add to `tailwind.config.js`

```js
entity: {
  role:       'rgb(var(--color-entity-role) / <alpha-value>)',
  persona:    'rgb(var(--color-entity-persona) / <alpha-value>)',
  'doc-tag':  'rgb(var(--color-entity-doc-tag) / <alpha-value>)',
  'tool-tag': 'rgb(var(--color-entity-tool-tag) / <alpha-value>)',
  server:     'rgb(var(--color-entity-server) / <alpha-value>)',
  datasource: 'rgb(var(--color-entity-datasource) / <alpha-value>)',
},
```

### What we do **not** need

- Entity tokens for chat/dashboard persona type — use `--color-primary` / `--color-accent` on `PersonaTypeAvatar`.
- New status hue tokens — `--color-success|error|warning|info` are sufficient.
- New shadcn `Badge` variants — admin tables should not use raw `Badge` for data cells.
- Per-section color maps — replace `kindBadgeStyle()` inline styles with `entity="datasource"` + optional kind suffix.

### Deprecate after migration

| Current | Replacement |
|---------|-------------|
| `DOC_TAG_COLOR`, `TOOL_COLOR`, etc. in `dashboardHelper.ts` | `entity` prop on `DashboardPill` |
| `PersonaTypeBadge`, `CHAT_PERSONA_TYPE_COLOR`, `DASHBOARD_PERSONA_TYPE_COLOR` | `PersonaTypeAvatar` (primary / accent) |
| `getPersonaAvatarColor`, `PERSONA_AVATAR_COLORS` | `UserAvatar` (neutral) + `PersonaTypeAvatar` (typed) |
| `StatusBadge` in table cells | `DashboardPill intent="status"` |
| `Badge variant="default" text-white` on name columns | `DashboardPill intent="entity"` (tinted, not solid primary) |
| `chipClassName` spans in Roles/Tags | `DashboardPill intent="entity"` or `neutral` for generic lists |
| `NODE_STYLE` hardcoded Tailwind in `AccessGraphView` | Map node types → entity keys |

Keep `StatusBadge` exported temporarily as `export const StatusBadge = (p) => <DashboardPill intent="status" {...p} />` for non-admin callers if any exist.

---

## Component API (proposed)

```tsx
// src/features/dashboard/components/DashboardPill.tsx

type DashboardPillIntent = 'neutral' | 'entity' | 'status' | 'count';
type DashboardPillEntity =
  | 'role' | 'persona' | 'doc-tag' | 'tool-tag'
  | 'server' | 'datasource';
type DashboardPillStatus =
  | 'success' | 'error' | 'warning' | 'pending' | 'info' | 'neutral';

interface DashboardPillProps {
  intent: DashboardPillIntent;
  entity?: DashboardPillEntity;      // required when intent === 'entity'
  status?: DashboardPillStatus;      // required when intent === 'status'
  label: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
  truncate?: boolean;
  className?: string;
  as?: 'span' | 'button';           // for clickable failed-upload pill
}
```

Shared base classes (CVA):

```
inline-flex items-center gap-1 font-medium
rounded-[var(--pill-radius)] px-[var(--pill-px)] py-[var(--pill-py)]
text-[var(--pill-font-size)] max-w-full
```

---

## Section migration map

| Section | Column / UI | Current | Target |
|---------|-------------|---------|--------|
| **Tools** | Type | `Badge outline` | `neutral` |
| **Tools** | Server | `Badge secondary` + `PERSONA_COLOR` | `entity server` + `mono` |
| **Servers** | Name | solid primary `Badge` | `entity server` |
| **Servers** | Type | `StatusBadge info/neutral` | `status info` (MCP) / `neutral` (custom) |
| **Servers** | Health | `StatusBadge` | `status` (keep icons) |
| **Data Sources** | Kind | inline opaque style | `entity datasource` |
| **Tool Tags** | Name | solid primary | `entity tool-tag` |
| **Tool Tags** | Tools list | transparent bordered chip | `entity tool-tag` or `neutral` |
| **Doc Tags** | Name | `DOC_TAG_COLOR` | `entity doc-tag` |
| **Roles** | Name | solid primary | `entity role` |
| **Roles** | Personas / doc tags | transparent chip | `entity persona` / `entity doc-tag` |
| **Personas** | Avatar + TYPE column | `PersonaTypeBadge` + hash-colored avatar | `PersonaTypeAvatar` (primary/accent); **drop TYPE column** |
| **Admin users** | USER column | hash `getPersonaAvatarColor` | `UserAvatar` size md |
| **Users** | User column | `UserIcon` in primary circle | `UserAvatar` size sm |
| **Users** | Access graph header | hardcoded teal initials | `UserAvatar` size md |
| **Shared Memory** | Persona | `PERSONA_COLOR` | `entity persona` |
| **Documents** | Format | `Badge outline` | `neutral` |
| **Documents** | Private/Public | `StatusBadge` | `status info/success` |
| **Documents** | Status | `StatusBadge` / destructive | `status` |
| **Documents** | Doc tags | `DocTagsCollapsible` | use `DashboardPill` inside |
| **Users** | Access | `AccessChips` spans | `count` |
| **Users** | Legend | palette `Badge`s | `entity` variants |
| **Feedback** | Status | `StatusBadge` | `status` |
| **Admin** | Roles | `ADMIN_ROLE_BADGE_CONFIG` | super → `entity role` emphasis OR `status`; others → `neutral` |
| **Overview** | Log level | inline Tailwind status | `status` |
| **Overview** | Filter chips | inline spans | `neutral` / `status` |

---

## Implementation phases

### Phase 0 — Reference (this PR)

- [x] Plan doc (`plan/admin-pills-standardization.md`)
- [x] Visual mockup (`plan/mockups/admin-pills.html`)
- [ ] Team review of taxonomy + token values

### Phase 1 — Foundation (~1 day)

1. Add CSS tokens to `index.css` (light + dark).
2. Extend `tailwind.config.js` with `entity.*` colors.
3. Create `DashboardPill.tsx` + `dashboardPillVariants.ts` (CVA).
4. Add `dashboardPillUtils.ts` mapping helpers (`logLevelToStatus`).
5. Create `PersonaTypeAvatar.tsx` (primary = chat, accent = dashboard).
6. Create `UserAvatar.tsx` (neutral initials for human users).
5. Unit-free smoke: render all variants in Storybook-like dev page OR rely on mockup parity.

### Phase 2 — High-traffic tables (~2 days)

Migrate in order of user visibility:

1. Tools + Servers (the reported inconsistency)
2. Documents (status + format)
3. Roles + Tags + Doc Tags
4. Users + Personas + Shared Memory

### Phase 3 — Remaining surfaces (~1 day)

1. Feedback, Admin users, Overview logs
2. `AccessGraphView` node badges
3. Modals / sidebars (`CreatePersonaModal`, `PersonaSidebar`, `DocTagsCollapsible`)

### Phase 4 — Cleanup

1. Remove `DOC_TAG_COLOR` etc. from `dashboardHelper.ts` (keep non-pill helpers).
2. Re-export `StatusBadge` as alias → delete after grep-clean.
3. Update `admin-tables.html` cell examples to reference `admin-pills.html`.
4. Run `npm run check:colors` + visual pass on both themes.

---

## Visual rules (quick reference)

| Question | Answer |
|----------|--------|
| `rounded-md` or `rounded-full`? | **`rounded-md`** everywhere in admin tables. Full round reserved for filter toggles / steppers outside tables. |
| Solid primary fill? | **Avoid** in table cells. Use entity tint instead. |
| When to use `neutral` vs `entity`? | Neutral = type/format enum. Entity = named RBAC object. |
| Icons in pills? | Status only (health, upload, lock/globe). Entity/neutral stay text-only. |
| Persona chat vs dashboard? | **Avatar color**, not a pill. Green (`primary`) = chat. Yellow (`accent`) = dashboard. |
| Human user in admin table? | **`UserAvatar`** — neutral surface, initials, no hash colors, no generic user icon. |
| Truncation | `truncate` + `max-w-*` on entity pills with `title` tooltip. |
| Clickable pills | `as="button"` for retry-failed; preserve existing a11y. |

---

## Reference files

| File | Purpose |
|------|---------|
| `plan/mockups/admin-pills.html` | Canonical visual spec — all intents, sizes, table context |
| `plan/mockups/chat-welcome.html` | Persona avatar color language (primary = chat, accent = dashboard) |
| `plan/mockups/admin-tables.html` | Table layout context (update TYPE/SERVER rows after sign-off) |
| `src/features/dashboard/components/StatusBadge.tsx` | Current status implementation to merge |

---

## Open questions for review

1. **Server entity color** — use `--color-primary` directly vs dedicated `--color-entity-server`? (Mockup uses primary-aligned teal; dedicated token allows future divergence.)
2. **Datasource kind** — one `datasource` entity for all kinds, or `neutral` for unknown + `entity datasource` only for known kinds (csv/postgresql/api)?
3. **Super Admin badge** — `entity role` with stronger alpha, or a fifth intent `emphasis`?
4. **Access graph colors** — align exactly with entity tokens (recommended) or keep distinct drawer palette?

Default recommendation: yes to dedicated server token; datasource entity for all kinds; super admin uses `entity role` with `--pill-bg-alpha: 0.18`; access graph adopts entity tokens.

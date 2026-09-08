# Newton UI — Refactoring Plan: Consistency & Design System

## Context

The codebase has a solid foundation (shadcn/ui + Radix + Tailwind), but has accumulated:
- A custom `useTheme` hook (446 lines) that duplicates what Tailwind + CSS variables already do natively
- Two parallel theme systems (`--color-*` CSS vars vs. shadcn HSL vars) creating confusion
- Hardcoded hex colors in feature files that bypass theming entirely
- Arbitrary Tailwind values (`h-[28px]`, `text-[10px]`) spread across 30+ feature files
- Duplicated components (two carousels, two dropdowns) with no guidance on which to use
- Inconsistent modal sizing across every feature

**Goal:** One change to a CSS variable or Tailwind token propagates everywhere automatically. No JavaScript required to apply a theme.

---

## How theming works today (the core problem)

```
ThemesData.ts (9 hardcoded theme objects)
       ↓
useTheme() hook — called by N components = N independent state copies
       ↓
applyTheme() — 15+ setProperty() calls writing CSS vars imperatively in JS
       ↓
applyShadcnTokens() — second pass translating the same values into shadcn HSL format
       ↓
CSS variables on :root  ← the right destination, but reached the wrong way
       ↓
Components that use the CSS variables → work correctly
Components that read currentTheme directly → bypass the variables entirely
  e.g. color: currentTheme.name === "UAE" ? "#B68A35" : "var(--color-primary)"
```

**The broadcast hack:** Because every `useTheme()` call creates its own isolated React state, a `window.dispatchEvent('activeThemeChanged')` custom event manually notifies all hook instances when the theme changes. This is a symptom of the wrong abstraction — not a feature.

**The result:** ~600 lines of infrastructure (hook + service + types + broadcast utility) to do what CSS already does natively. Adding a new client brand requires a TypeScript object, an API record, and JS to apply it. It should be one CSS block.

---

## Architecture Decision: Build-time config, not runtime switching

Each tenant gets its own deployment. The theme is not a runtime decision — it is baked in at deploy time. There is nothing to switch between tenants at runtime.

This eliminates:
- `[data-theme]` attribute selectors and runtime theme switching
- API calls to fetch theme config
- Zustand store for tenant assets
- `ThemeService`, `ThemesData`, `useTheme`, `useThemeColors`, `applyShadcnTokens`

### Colors — two CSS blocks, that's it

`index.css` for a given deployment contains exactly two blocks: light (`:root`) and dark (`.dark`). These are written once per tenant and baked into the deployment:

```css
/* index.css — this IS the tenant's theme, no switching needed */
:root {
  --color-primary:   182 138  53;   /* UAE gold — light mode */
  --color-secondary: 212 173  89;
  --color-accent:    160 120  40;
  --color-surface:   255 252 240;
  --color-background:255 254 249;
  --color-text:       17  24  39;
  --color-text-muted:107 114 128;
  --color-border:    212 183 116;
  --color-input-bg:  255 255 255;
}

.dark {
  --color-primary:   212 173  89;   /* brighter gold — more luminous on dark bg */
  --color-secondary: 240 200 120;
  --color-accent:    182 138  53;
  --color-surface:    30  20   5;
  --color-background: 20  12   0;
  --color-text:      255 248 230;
  --color-text-muted:180 160 110;
  --color-border:    100  80  30;
  --color-input-bg:   40  28  10;
}

/* Shared across all tenants — not overridden per deployment */
:root {
  --color-error:           239  68  68;
  --color-success:          16 185 129;
  --color-warning:         245 158  11;
  --color-info:             59 130 246;
  --color-oauth-microsoft:   0 120 212;
}
```

Primary colors differ between light and dark — a color readable on white needs more luminosity on a dark surface. Each deployment makes this decision independently.

### Tenant assets — environment variables

Logo URLs, icon sizes, and other per-tenant assets are known at build time. No API call or Zustand store needed:

```bash
# .env.uae
VITE_LOGO_URL=https://cdn.example.com/uae-logo.png
VITE_MOBILE_LOGO_URL=https://cdn.example.com/uae-logo-mobile.png
VITE_BOT_LOGO_URL=https://cdn.example.com/uae-bot.png
VITE_BOT_LOGO_HEIGHT=48
VITE_BOT_LOGO_WIDTH=48
VITE_CHATBOT_ICON=https://cdn.example.com/uae-icon.png
VITE_FAVICON=https://cdn.example.com/uae-favicon.ico
VITE_LOADING_ANIMATION=https://cdn.example.com/uae-loading.json
VITE_LOADING_ANIMATION_HEIGHT=80
VITE_LOADING_ANIMATION_WIDTH=80
```

```ts
// Read directly — no fetch, no store, no hook
const logoUrl = import.meta.env.VITE_LOGO_URL
const botLogoHeight = Number(import.meta.env.VITE_BOT_LOGO_HEIGHT)
```

### Dark mode — the only runtime toggle

```ts
// src/utils/theme.ts — the entire theme system
export function initTheme() {
  const saved = localStorage.getItem('color-scheme') ?? 'dark'
  document.documentElement.classList.toggle('dark', saved === 'dark')
}

export function toggleDarkMode(dark?: boolean) {
  const root = document.documentElement
  const next = dark ?? !root.classList.contains('dark')
  root.classList.toggle('dark', next)
  localStorage.setItem('color-scheme', next ? 'dark' : 'light')
}
```

Call `initTheme()` in `main.tsx` before React mounts — prevents flash on reload.

### Tailwind maps class names to the variables

```js
// tailwind.config.js
colors: {
  primary:      'rgb(var(--color-primary) / <alpha-value>)',
  secondary:    'rgb(var(--color-secondary) / <alpha-value>)',
  surface:      'rgb(var(--color-surface) / <alpha-value>)',
  'text-main':  'rgb(var(--color-text) / <alpha-value>)',
  'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
  'border-main':'rgb(var(--color-border) / <alpha-value>)',
  // etc.
}
```

### Deploying a new tenant

1. Copy `.env.template` to `.env.<tenant>`
2. Fill in colors (for `index.css` `:root` and `.dark` blocks) and asset URLs
3. Deploy — no code changes, no database records, no API calls

---

## Phase 0 — Remove useTheme System (do first, unblocks everything)

**Delete:**
- `src/hooks/useTheme.ts`
- `src/services/infrastructure/themeService.ts`
- `src/constants/ThemesData.ts`
- `src/utils/applyShadcnTokens.ts` (or wherever it lives)
- `src/types/theme.ts` — simplify to just tenant asset config type

**Add:**
- `src/utils/theme.ts` — 3-line `toggleDarkMode()` and `applyClientTheme(tenantId)` utilities
- `src/store/tenantSlice.ts` (or extend existing Zustand store) — holds `logoUrl`, `logoHeight`, `logoWidth`, `chatbotIcon`

**Update every consumer of `useTheme`:**
- Components reading `currentTheme.colors.*` → delete, use Tailwind classes instead
- Components reading `currentTheme.assets.*` → read from Zustand tenant config store
- `Header.tsx` theme switcher → call `toggleDarkMode()`
- Admin settings theme panel → remove or replace with `applyClientTheme()`

---

## Phase 1 — Restructure Design Tokens

**Two changes: rewrite `index.css` to `:root` + `.dark` blocks, and wire the variables into `tailwind.config.js`.**

Variables use space-separated RGB (not hex) — required for Tailwind opacity modifiers like `bg-primary/50`.

Since each tenant is a separate deployment, `index.css` contains exactly two blocks for that tenant. No `[data-theme]` selectors needed.

### `src/index.css`

```css
/* Tenant brand — light mode (default) */
:root {
  --color-primary:    59 130 246;
  --color-secondary:  99 102 241;
  --color-accent:    139  92 246;
  --color-surface:   255 255 255;
  --color-background:249 250 251;
  --color-text:       17  24  39;
  --color-text-muted:107 114 128;
  --color-border:    229 231 235;
  --color-input-bg:  255 255 255;

  /* Shared — same across all tenants */
  --color-error:           239  68  68;
  --color-success:          16 185 129;
  --color-warning:         245 158  11;
  --color-info:             59 130 246;
  --color-oauth-microsoft:   0 120 212;
}

/* Dark mode — primary can differ from light for correct luminosity */
.dark {
  --color-primary:    99 102 241;
  --color-secondary: 139  92 246;
  --color-accent:    167 139 250;
  --color-surface:    17  24  39;
  --color-background: 10  15  26;
  --color-text:      255 255 255;
  --color-text-muted:156 163 175;
  --color-border:     55  65  81;
  --color-input-bg:   31  41  55;
}
```

For a UAE deployment, these values are different — that is the only change between deployments.

### `tailwind.config.js`

```js
extend: {
  colors: {
    primary:      'rgb(var(--color-primary) / <alpha-value>)',
    secondary:    'rgb(var(--color-secondary) / <alpha-value>)',
    accent:       'rgb(var(--color-accent) / <alpha-value>)',
    surface:      'rgb(var(--color-surface) / <alpha-value>)',
    background:   'rgb(var(--color-background) / <alpha-value>)',
    'text-main':  'rgb(var(--color-text) / <alpha-value>)',
    'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
    'border-main':'rgb(var(--color-border) / <alpha-value>)',
    'input-bg':   'rgb(var(--color-input-bg) / <alpha-value>)',
    status: {
      error:   'rgb(var(--color-error) / <alpha-value>)',
      success: 'rgb(var(--color-success) / <alpha-value>)',
      warning: 'rgb(var(--color-warning) / <alpha-value>)',
      info:    'rgb(var(--color-info) / <alpha-value>)',
    },
  },
  spacing: {
    'icon-sm': '20px',
    'icon-md': '28px',
    'icon-lg': '42px',
  },
  maxWidth: {
    'dialog-sm': '360px',
    'dialog-md': '560px',
    'dialog-lg': '860px',
  },
  fontSize: {
    '2xs': ['10px', { lineHeight: '14px' }],
    '3xs': ['9px',  { lineHeight: '12px' }],
  },
}
```

### `.env.template` — tenant asset config

```bash
VITE_LOGO_URL=
VITE_MOBILE_LOGO_URL=
VITE_BOT_LOGO_URL=
VITE_BOT_LOGO_HEIGHT=48
VITE_BOT_LOGO_WIDTH=48
VITE_CHATBOT_ICON=
VITE_FAVICON=
VITE_LOADING_ANIMATION=
VITE_LOADING_ANIMATION_HEIGHT=80
VITE_LOADING_ANIMATION_WIDTH=80
```

Components read these directly — no fetch, no store:
```ts
const logoUrl = import.meta.env.VITE_LOGO_URL
```

---

## Phase 2 — Purge Hardcoded Colors

With tokens in place, replace all hardcoded hex/rgba in feature files:

| File | Values | Replace with |
|------|--------|-------------|
| `PaymentForm.tsx` | `#ef4444` (53×), `#8b5cf6` (16×) | `text-status-error`, `text-primary` |
| `ReasoningBlock.tsx` | `#B68A35` (9×) | `text-[rgb(var(--color-gold))]` or new `text-gold` token |
| `AssistantMessage.tsx` | UAE name-check + `#B68A35` | Delete conditional — UAE theme sets `--color-primary` to gold in CSS |
| `DynamicForm.tsx` | `#436bff` (24×) | `text-primary` / `bg-primary` |
| `Settings.tsx` | `#0078D4`, `#005a9e` | `bg-[rgb(var(--color-oauth-microsoft))]` |
| `RallyLayout.tsx` | `rgba(96, 165, 250, 0.1)` | `bg-primary/10` |

---

## Phase 3 — Eliminate Duplicate Components

### 3a. Carousel
- Keep `carousel.tsx` (Embla). Add `autoPlay` + `itemsPerSlide` props.
- Migrate `CardsContainer.tsx` (travel). Delete `custom-carousel.tsx`.

### 3b. Combobox
- Extend `combobox.tsx` with `mode: 'single' | 'multi'`, async `onSearch`, `debounceMs`, `placement`.
- Migrate `UserForm.tsx`. Delete `SearchableDropdown.tsx`.

### 3c. Form cleanup
- Audit 7 dashboard forms — ensure they use `Input`, `Label`, `Select` from `ui/`.
- Delete empty `src/components/DynamicForms/` directory.

---

## Phase 4 — Standardize Modal Sizing

Replace arbitrary `max-w-[Xpx]` with tokens from Phase 1:

| Component | Before | After |
|-----------|--------|-------|
| `CreateVersionModal` | `max-w-[360px] sm:max-w-2xl` | `max-w-dialog-sm sm:max-w-dialog-lg` |
| `CreatePersonaModal` | `max-w-[95vw] sm:max-w-[860px]` | `max-w-[95vw] sm:max-w-dialog-lg` |
| `DeleteConfirmationModal` | `max-w-[90vw] sm:max-w-md` | `max-w-[90vw] sm:max-w-dialog-md` |
| `ShareDialog` | `max-w-md w-[90%]` | `max-w-dialog-md w-[90%]` |

---

## Phase 5 — Replace Arbitrary Tailwind Values

Global find-replace after Phase 1:

| Pattern | Replace with |
|---------|-------------|
| `bg-[var(--color-surface)]` | `bg-surface` |
| `text-[var(--color-text)]` | `text-text-main` |
| `border-[var(--color-border)]` | `border-border-main` |
| `bg-[var(--color-primary)]` | `bg-primary` |
| `text-[var(--color-primary)]` | `text-primary` |
| `h-[28px] w-[28px]` | `h-icon-md w-icon-md` |
| `w-[20px] h-[20px]` | `w-icon-sm h-icon-sm` |
| `text-[10px]` | `text-2xs` |
| `text-[9px]` | `text-3xs` |

---

## Phase 6 — Inline Style Cleanup

Target only static inline styles (leave dynamic runtime values alone):

| File | Before | After |
|------|--------|-------|
| `Header.tsx` persona button | `style={{ gap:4, padding:4, borderRadius:999 }}` | `className="gap-1 p-1 rounded-full"` |
| `VisualizationSidebar` FAB | `style={{ width:42, height:42, borderRadius:9999 }}` | `className="w-icon-lg h-icon-lg rounded-full"` |
| `AssistantMessage` bounce dots | `style={{ animation:"bounce 1.4s..." }}` | `className="animate-bounce"` |
| `UploadDocument` tooltip | complex `boxShadow` string | `className="shadow-xl"` |

Dynamic styles (`botLogoHeight`, `direction`, `calc(...)`) stay as-is.

---

## Execution Order

```
Sprint 1 (parallel):   UI-011 (remove useTheme)   UI-005 (carousel)   UI-006 (combobox)   UI-007 (forms)
Sprint 2 (parallel):   UI-001 (token restructure + .env.template)   UI-002 (delete PaymentForm/TravelPackage)
Sprint 3 (parallel):   UI-003  UI-004  UI-008  UI-009  UI-013 (color check script, wire to CI)
Sprint 4:              UI-010 (inline styles)
```

UI-011 and UI-001 are the two foundational tickets. Everything else is cleanup that follows.

---

## Verification

- Switch between dark/light — all components recolor via `dark:` Tailwind classes
- Set `data-theme="uae"` on `<html>` — primary color becomes gold everywhere, no JS intervention
- `grep -r 'useTheme' src/` returns zero results
- `grep -r '#[0-9a-fA-F]\{6\}' src/features/` returns only intentional OAuth brand values
- `grep -r 'bg-\[var\|text-\[var\|border-\[var' src/features/` returns zero results
- `npm run build` passes after every phase

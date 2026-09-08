# UI-001 — Restructure Design Tokens: CSS Variables + Tailwind Config + env.template

**Type:** Chore  
**Priority:** P0 — Foundational  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** S (half a day)  
**Risk:** Low — CSS and config only, no component edits  
**Depends on:** [UI-011](./UI-011-remove-usetheme.md)  
**Blocks:** UI-003, UI-004, UI-008, UI-009, UI-010

## Why

Each tenant is a separate deployment. The theme is not a runtime decision — it is baked into `index.css` for that deployment. This means:

- No `[data-theme]` attribute selectors
- No runtime theme switching
- No API call to fetch theme config
- `index.css` has exactly two blocks: `:root` (light) and `.dark` (dark)
- Tenant assets (logos, icon sizes) come from environment variables, not a store or API

Variables use space-separated RGB (not hex) to enable Tailwind opacity modifiers (`bg-primary/50`).

## Changes

### `src/index.css` — rewrite variable declarations

Replace all existing `--color-*` declarations with this structure:

```css
/* Light mode — tenant brand values go here */
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

  /* Shared across all tenants */
  --color-error:           239  68  68;
  --color-success:          16 185 129;
  --color-warning:         245 158  11;
  --color-info:             59 130 246;
  --color-oauth-microsoft:   0 120 212;
}

/* Dark mode — primary can differ from light for correct luminosity on dark bg */
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

The values above are for the default (Newton) deployment. Each tenant deployment has its own `index.css` with different values in these blocks — that is the only difference between deployments.

### `tailwind.config.js` — extend with token mappings

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

### `.env.template` — create at repo root

Documents all per-tenant asset variables so deploying a new tenant has a clear checklist:

```bash
# Tenant asset config — copy to .env.<tenant> and fill in values
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

Add `.env.*` (except `.env.template`) to `.gitignore` if not already there.

## Acceptance Criteria

- [ ] `index.css` has exactly `:root` and `.dark` blocks — no `[data-theme]` selectors
- [ ] All variables use space-separated RGB format
- [ ] `tailwind.config.js` extended with all token mappings
- [ ] `.env.template` created at repo root
- [ ] `npm run build` passes
- [ ] `bg-primary/50`, `text-text-main`, `border-border-main` work in components

## Verification

```bash
npm run build

# Confirm token classes generate correctly
npx tailwindcss --content './src/**/*.tsx' --output /tmp/tw-out.css
grep 'bg-primary\|bg-surface\|text-text-main' /tmp/tw-out.css

# Toggle dark in browser console — all colors should shift
document.documentElement.classList.toggle('dark')
```

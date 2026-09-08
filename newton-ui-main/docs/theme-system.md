# Theme system (current behavior)

This document describes **how theming currently works** in `newton-ui`, where the theme data comes from, how it’s applied to the DOM, and how other components pick it up.

## Sources of truth

- **Theme definitions (frontend defaults)**: `src/constants/ThemesData.ts`
  - `DEFAULT_THEMES` contains full theme objects (colors, typography, assets, layout, etc.).
  - Each theme has `isActive: checkActiveTheme("<ThemeName>")`, which marks the **environment default** theme at build/runtime.

- **User-selected theme override (persisted)**: `activeThemeName` in Zustand store
  - Stored in `src/store/useStore.ts` as `activeThemeName: string | null`.
  - Persisted via Zustand `persist()` (`name: "newton-storage"`, see `partialize` list).
  - Accessors used by the theme hook:
    - `getActiveThemeName()` / `setActiveThemeNameValue()` from `src/store/useStore.ts`.


## How a theme is applied

The main logic lives in `src/hooks/useTheme.ts`.

### 1) Initialization order (startup)

On mount, `useTheme` chooses a theme in this order:

1. **Stored user override**: `getActiveThemeName()`
   - If present and found in `themes` or `DEFAULT_THEMES`, it wins.
2. **Environment default**: the theme whose `isActive === true`
   - Found via `themes.find(t => t.isActive)` or `DEFAULT_THEMES.find(...)`.
   - When used, we also call `setActiveThemeNameValue(envActiveName)` and broadcast a change event.

### 2) Applying theme tokens to the DOM

`applyTheme(theme)` writes CSS custom properties on `document.documentElement` (`:root`) via `root.style.setProperty(...)`.

There are two layers of variables being set:

- **App-specific variables** (used throughout the codebase):
  - `--color-primary`, `--color-background`, `--color-background-gradient`, `--color-text`, `--color-border`, etc.
  - These align with what’s declared as defaults in `src/index.css` under `:root`.

- **Tailwind / shadcn variables (HSL)**:
  - `--background`, `--foreground`, `--primary`, `--border`, `--ring`, etc.
  - `useTheme` converts hex colors to HSL strings so Tailwind/shadcn tokens work correctly.

It also sets non-color tokens:

- **Typography**: `--font-family`, `--font-size-base`
- **Border radius**: `--border-radius-*`
- **Shadows**: `--shadow-*`

### 3) In-app broadcasting for synchronization

`useTheme` defines `THEME_CHANGED_EVENT = "activeThemeChanged"` and uses:

- `window.dispatchEvent(new CustomEvent("activeThemeChanged", { detail: themeName }))`
- `window.addEventListener("activeThemeChanged", ...)`

This is used so **multiple instances** of `useTheme()` stay in sync without a dedicated React context/provider.

## Who consumes theme values

There are two main consumption styles.

### A) CSS variables (most common)

Many components use CSS variables directly in styles, for example:

- `background: "var(--color-background)"`
- `borderColor: "var(--color-border)"`

Defaults for these variables are present in `src/index.css` (`:root` block). `useTheme` overwrites them at runtime.

### B) `currentTheme` object (assets + conditionals)

Components call `useTheme()` and use `currentTheme` for:

- **Assets**: `currentTheme.assets.logo`, `currentTheme.assets.mobileLogo`, etc. (e.g. `src/components/Header.tsx`)
- **Theme-specific layout behavior**: `currentTheme.layout.name` (e.g. special-casing Gemini border behavior in `useTheme.ts`)

## Changing themes (UI flows)

### Local user selection (no backend)

`applyThemeLocal(themeName)` in `src/hooks/useTheme.ts`:

- Finds the theme in `themes`/`DEFAULT_THEMES`
- Persists it: `setActiveThemeNameValue(theme.name)`
- Updates local `themes` state to mark `isActive`
- Applies it to DOM (`applyTheme`)
- Broadcasts `activeThemeChanged`

### Admin apply (backend + UI)

`ThemeSelector` (`src/components/ThemeSelector.tsx`) uses `useTheme()`:

- Calls `setActiveTheme(themeName)` which:
  - Calls backend `ThemeService.applyTheme(themeName)`
  - Updates local state and persists `activeThemeName`
  - Applies to DOM and broadcasts `activeThemeChanged`

## Files to know

- **Theme application**: `src/hooks/useTheme.ts`
- **Theme definitions**: `src/constants/ThemesData.ts`
- **Theme types**: `src/types/theme.ts`
- **Default CSS variable fallback**: `src/index.css`
- **Additional theme utility CSS (optional)**: `src/styles/theme.css`
  - Note: this file defines many `.theme-*` utility classes; ensure it’s imported somewhere if you expect these classes to apply globally.

## Gotchas / current quirks

- **No ThemeProvider**: theme synchronization is event-based (`activeThemeChanged`).
- **`src/styles/theme.css` import**: if you rely on `.theme-*` classes from that file, confirm it’s included in the CSS bundle (e.g. imported from `index.css` or another global entry).


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (see Local Dev Setup below)
npm run build        # production build (raises heap limit to 4 GB)
npm run lint         # ESLint
npm run check:colors # detect hardcoded color values (must stay clean)
npm run start        # vite preview of built output
```

There is no test suite.

## Local Dev Setup

Auth relies on an `httpOnly` cookie scoped to `.gotalk.dev`. You must run the dev server on `local.gotalk.dev` for cookies to work:

1. Add `127.0.0.1 local.gotalk.dev` to `/etc/hosts`
2. Generate certs: `mkcert -install && mkcert -key-file certs/local.gotalk.dev-key.pem -cert-file certs/local.gotalk.dev.pem local.gotalk.dev`
3. Create `.env.local`:
   ```
   VITE_API_BASE_URL=https://local.gotalk.dev:5175/api
   VITE_DEV_HTTPS=true
   VITE_DEV_PORT=5175
   ```
4. Open `https://local.gotalk.dev:5175`

Without HTTPS certs, `vite.config.ts` falls back to plain HTTP on `0.0.0.0` (useful in Docker/CI but auth won't work).

## Architecture

### Tech Stack
React 18 · TypeScript · Vite 8 · Tailwind CSS 3 · Zustand · TanStack Query · React Router v7 · shadcn/ui (Radix UI) · Axios · Framer Motion · PWA (vite-plugin-pwa)

### Path alias
`@/` → `src/`

### Directory layout

```
src/
  App.tsx              # main chat view; mounted at / and /chat/:sessionId
  routes/              # React Router route definitions
  layouts/             # Header, Sidebar (AppSidebar)
  features/
    auth/              # login, OAuth callbacks, protected routes
    chat/              # chat container, input, streaming, TTS, welcome screen
    dashboard/         # admin console (/admin-dashboard); sections + DataTable
    documents/         # document manager (/documents)
    search/            # cross-session chat search
    settings/          # user settings panel (slide-over)
    tools/             # tool browser
    travel/            # travel feature
    visualization/     # chart/dashboard sidebar
  components/
    DataTable/         # reusable server-side-paginated table used by admin sections
    ui/                # shadcn primitives
  services/
    api/               # Axios client, envelope unwrapping, session expiry
    chat/              # streaming chat logic, session bridge
    rbac/              # roles/users/persona API calls
    user/              # /me profile
    …                  # datasources, documents, travel, visualization
  store/
    useStore.ts        # auth state, personas, UI flags (Zustand + persist)
    chatStore.ts       # chat sessions and messages
    ttsStore.ts        # TTS playback state
  hooks/               # shared hooks (useTheme, useTTS, useSwipeGesture, …)
  config/api.ts        # API base URLs derived from VITE_API_BASE_URL
  lib/card-styles.ts   # shared card class constants
  types/               # shared TypeScript types
```

### API layer

`src/services/api/client.ts` creates an Axios instance with `withCredentials: true` (cookie auth). The backend wraps all responses in an envelope `{ success, data, message }`. The response interceptor unwraps successful envelopes and auto-toasts errors; pass `{ silent: true }` on the Axios config to suppress toasts.

Two API roots come from `src/config/api.ts`:
- `API_CONFIG.LOCAL_API_BASE_URL` → `<VITE_API_BASE_URL>/mid` (chat / most endpoints)
- `API_CONFIG.DASHBOARD_API_BASE_URL` → `<VITE_API_BASE_URL>/core` (admin dashboard)

A `401` response triggers `handleSessionExpired()` which clears state and redirects to `/login`.

### State management

**Zustand** is the primary store:
- `useStore` (`store/useStore.ts`) — auth flags, personas, `activeThemeName`, `newChatType`, `isDashboardFullscreen`, search state. Persisted to `localStorage` as `newton-storage` (v2); PII fields are explicitly excluded from `partialize`.
- `chatStore` — chat session list and messages; also persisted.

**TanStack Query** is used in the admin dashboard sections for server state (queries + mutations).

### Streaming chat

`App.tsx` manages a complex multi-ref setup to keep a streaming response alive across route changes:
- `streamingOwnerChatIdRef` — which chat owns the in-flight request
- `streamingSessionBridge` (`src/services/chat/streamingSessionBridge.ts`) — registers the AbortController so it survives unmount/remount when navigating to `/admin-dashboard` and back
- On remount, `adoptStreamingSessionRefs` reattaches to the live stream

The extracted hooks (`useStreamingSubmit`, `useSessionManager`, `useMessageEdit`, `useQueryParamChat`) each take the shared refs as parameters; the refs are the authoritative source of truth for in-flight state.

### Theme system

Themes are CSS custom properties written to `:root` by `src/hooks/useTheme.ts`. Two layers:
- App tokens: `--color-primary`, `--color-background`, `--color-border`, etc. (RGB triplets, used as `rgb(var(--color-primary) / <alpha-value>)` in Tailwind config)
- Tailwind/shadcn tokens: `--background`, `--foreground`, `--primary`, etc. (HSL strings, auto-converted by `useTheme`)

Theme definitions live in `src/constants/ThemesData.ts`. User's selected theme is persisted in `useStore.activeThemeName`. Theme changes broadcast via `window.dispatchEvent(new CustomEvent("activeThemeChanged", ...))` so multiple `useTheme()` consumers stay in sync without a React context.

**Never hardcode color values** — use Tailwind semantic tokens (`text-text-main`, `bg-surface`, `border-border-main`, `text-primary`, etc.) or CSS variables. Run `npm run check:colors` to verify.

### UI conventions

- **Icons:** always `lucide-react`, standard size `18px`, action button containers `h-7 w-7`
- **Cards:** use the constants from `src/lib/card-styles.ts` (`cardElevated`, `cardDefault`, `cardFlat`, `cardElevatedHover`, `cardDefaultHover`). `cardElevated` gets a `cardElevatedGradientBar` as its first child.
- **Fonts:** `font-display` (Bricolage Grotesque), `font-sans` (Instrument Sans), `font-mono` (Spline Sans Mono)
- **Toasts:** `import notify from "@/utils/notify"` — wraps `react-hot-toast`

### Admin dashboard

`/admin-dashboard` is protected by both `ProtectedRoute` and `AdminProtectedRoute`. Each tab is a section component under `src/features/dashboard/sections/`. Sections use:
- `DataTable` (`src/components/DataTable/`) for paginated, sortable, filterable tables
- `DashboardTabFilterUi` components for search/filter bars
- `EnhancedPagination` for page controls
- TanStack Query hooks for data fetching

### Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `App` | main chat |
| `/chat/:sessionId` | `App` | restore specific session |
| `/admin-dashboard` | `Dashboard` | admin only |
| `/documents` | `DocumentDashboard` | |
| `/login` | `BffAuthScreen` | |
| `/chat_share/:id` | `ShareChat` | public variant at `/chat_share/:id/public` |
| `/gmail-connected`, `/outlook-connected`, etc. | `OAuthCallback` | |

# Progressive Web App (PWA)

Newton ships as an installable PWA powered by
[`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox under the hood).
It works in **both** local development and production.

## File layout

All PWA code is isolated under [`src/pwa/`](../src/pwa):

| File | Runs in | Purpose |
| --- | --- | --- |
| `manifest.ts` | build (Node) | Web App Manifest — name, colors, icons, display mode. |
| `pwaOptions.ts` | build (Node) | `vite-plugin-pwa` options: dev SW + production Workbox/caching. |

> There is **no PWA UI component**. The plugin auto-injects the SW registration
> script (`injectRegister: "auto"`), so registration, updates and reloads are
> handled without any React code. The app remains installable through the
> browser's own menu, but there is no custom in-app install button.

Wiring is just one line in [`vite.config.ts`](../vite.config.ts)
(`VitePWA(pwaOptions)`). The registration script is auto-injected into the
built `index.html`, so there is nothing to mount in `main.tsx`. Virtual-module
types are referenced in [`src/vite-env.d.ts`](../src/vite-env.d.ts).

## How it behaves

### Development (`npm run dev`)
- A **real service worker is enabled on localhost** (`devOptions.enabled: true`),
  so the app behaves like a PWA while you code.
- The dev SW does **not** precache — assets are served straight from Vite, so
  there are **no stale-asset problems** and **HMR / hot reload keeps working**.
- A service worker only registers in a **secure context**. This project's `.env`
  sets `VITE_DEV_HTTPS=true`, so `npm run dev` serves over HTTPS at
  **`https://local.gotalk.dev:5175`** (using the certs in `certs/`) — that
  qualifies. Plain `http://localhost` also qualifies if you set
  `VITE_DEV_HTTPS=false`. Opening the app over a plain-HTTP LAN IP
  (e.g. `http://10.x.x.x:5175`) will **not** register a SW — that is a browser
  rule, not a config issue.

### Production (`npm run build`)
- Workbox **precaches the app shell + all static assets** (JS, CSS, HTML,
  images, fonts) for offline use.
- **Offline fallback (allowlist):** the SW serves the cached `index.html` shell
  **only for the app's own routes** — listed in `navigateFallbackAllowlist`
  (`/`, `/login`, `/auth`, `/chat`, `/chat_share`, `/admin-dashboard`,
  `/documents`, `/docs`, `/openapi`, the `*-connected`/`*-error` OAuth callbacks).
  **Every other same-origin navigation goes straight to the network.** This is
  critical because the app shares its origin with the Zitadel auth provider
  (`/oauth`, `/ui`, `/idps`, `/oidc`, `/.well-known`) **and** same-origin external
  IdPs (e.g. Noah at `/erp/noah_oidc/...`). An **allowlist** is used instead of a
  denylist of auth paths on purpose: a missed entry only costs *offline* fallback
  for that one route — it can never serve the shell over an auth page and break
  sign-in. **Keep the list in sync with `src/routes/index.tsx`.**
- **Versioning & cleanup:** every build re-hashes assets and bumps the precache
  revision; `cleanupOutdatedCaches` removes old precaches automatically.
- **Updates:** uses `registerType: "autoUpdate"`. A new deployment installs a SW
  that `skipWaiting` + `clientsClaim`s; open tabs **reload automatically** onto
  the new build. This is required for **recovery** — if a previously-deployed SW
  was broken, a "waiting" worker would never replace it and each user would have
  to clear site data by hand; `autoUpdate` makes the corrected worker take over
  on the next visit. The mid-action-reload risk is bounded by the allowlist
  above: auth navigations are never SW-controlled, so a reload can't land on a
  shell-served auth page.

## Testing

### 1. Localhost (dev, with hot reload)
```bash
npm run dev
```
Open the printed **Local** URL (`https://local.gotalk.dev:5175` with the default
HTTPS config), then DevTools → **Application → Service Workers**: you should see
an active worker. Edit a file — HMR still updates instantly.

### 2. Production build, served locally
```bash
npm run build     # generates dist/ incl. sw.js + manifest.webmanifest
npm run preview   # serves the production build on http://localhost:4173
```
In DevTools → **Application**:
- **Manifest** shows name, colors, and the 192/512 icons.
- **Service Workers** shows the production `sw.js`.
- **Lighthouse → PWA** should pass "installable".

**Test auto-update:** with `preview` running and the tab open, run `npm run build`
again. The new SW activates and the tab **reloads itself** onto the new build.
(In DevTools → Application → Service Workers you'll see the worker version change.)

**Test auth pass-through:** with the SW active, navigate to a non-SPA path such
as `/oauth/v2/authorize` or `/erp/anything`. In DevTools → Network the document
request must show **(from network)**, NOT *(from ServiceWorker)* — confirming the
allowlist lets auth navigations reach the backend. A real SPA route like `/chat`
should still show *(from ServiceWorker)*.

**Test offline:** in DevTools → Network, toggle **Offline**, then reload — the
app still loads from cache.

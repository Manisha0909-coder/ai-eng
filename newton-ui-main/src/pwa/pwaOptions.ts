import type { VitePWAOptions } from "vite-plugin-pwa";
import { manifest } from "./manifest";

/**
 * Single source of truth for the `vite-plugin-pwa` configuration.
 *
 * Imported by `vite.config.ts`. Kept free of any browser/React imports so it is
 * safe to load inside Vite's Node config context.
 *
 * Update strategy: `registerType: "autoUpdate"`.
 *   A new build emits a SW that `skipWaiting` + `clientsClaim`s, and the
 *   auto-injected registration script reloads open tabs once it takes control.
 *   This is REQUIRED for recovery: if a previously-deployed SW is broken (e.g.
 *   it hijacked an auth route), a "waiting" worker would never replace it —
 *   users would each have to clear site data by hand. `autoUpdate` makes the
 *   corrected SW take over on the next visit automatically, so browsers
 *   self-heal. Trade-off: a reload can fire mid-action; this is bounded because
 *   the SW only serves the app shell for the app's OWN routes (see
 *   `navigateFallbackAllowlist`) — every auth navigation goes straight to the
 *   network and is never controlled by the fallback.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "autoUpdate",

  // Let the plugin inject its own registration script. With "autoUpdate" this
  // is all that's needed — no React component registers or prompts.
  injectRegister: "auto",

  manifest,

  // Extra files from `public/` to force into the precache (globPatterns below
  // only sees the built `dist/` output; this guarantees the icons are available
  // offline even before they are requested).
  includeAssets: ["icons/*.png"],

  /**
   * DEVELOPMENT (localhost) configuration.
   *
   * `enabled: true` runs a real service worker during `npm run dev`, so the app
   * behaves like an installable PWA while coding. The dev SW is a lightweight,
   * non-precaching worker: it serves assets straight from Vite's dev server, so
   * there are NO stale-asset problems and HMR / hot reload keeps working. Each
   * full reload re-fetches everything fresh — nothing is aggressively cached.
   */
  devOptions: {
    enabled: true,
    // Dev SW must be an ES module to match Vite's module-based dev server.
    type: "module",
    // Let client-side routes (e.g. /chat/123) resolve to the SPA shell in dev.
    navigateFallback: "index.html",
    // Silence the expected "dev SW is not the production SW" console notice.
    suppressWarnings: true,
  },

  /**
   * PRODUCTION (Workbox) configuration — used by `npm run build`.
   */
  workbox: {
    // Layer the Web Push handlers (reminder notifications) onto the generated
    // SW without switching to `injectManifest`: `public/push-sw.js` only adds
    // `push` + `notificationclick` listeners, so the recovery properties of
    // the generated worker documented above are untouched.
    importScripts: ["push-sw.js"],

    // Precache the app shell + all static assets so the app loads offline.
    globPatterns: [
      "**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf,eot}",
    ],
    // Plotly/chart vendor chunks are large; raise the precache size ceiling
    // (default 2 MiB) so they are not silently skipped.
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,

    // VERSIONING / CACHE CLEANUP: every build hashes asset names and bumps the
    // precache revision; this deletes precaches from previous builds so users
    // never accumulate or serve outdated bundles.
    cleanupOutdatedCaches: true,

    // Silent auto-update: the new SW activates immediately and takes control of
    // open tabs, which (with `autoUpdate`) triggers an automatic reload. Needed
    // so a corrected SW replaces a previously-broken one without users having to
    // clear site data. Safe because the navigation fallback below is scoped to
    // the app's own routes only — auth navigations are never SW-controlled.
    clientsClaim: true,
    skipWaiting: true,

    // OFFLINE FALLBACK: serve the cached app shell for SPA navigations that miss
    // the cache, so deep links / refreshes work offline.
    navigateFallback: "index.html",
    // CRITICAL: only fall back to the shell for the app's OWN routes (ALLOWLIST).
    // The app shares its origin with the auth BFF's own routes AND same-origin
    // external IdPs (e.g. Noah at `/erp/noah_oidc/...`). Any navigation NOT
    // matched here — every `/oauth`, `/ui`, `/idps`, `/erp/...`, `/api`, etc. —
    // bypasses the SW and hits the network, so sign-in always reaches the real
    // backend. An allowlist (vs. a denylist of auth paths) is intentional: a
    // missed entry only costs OFFLINE fallback for that route, never a broken
    // login. Keep in sync with `src/routes/index.tsx`.
    navigateFallbackAllowlist: [
      /^\/$/, // home (chat)
      /^\/login(?:\/|$)/,
      /^\/invite(?:\/|$)/, // invite/reset redemption
      /^\/auth(?:\/|$)/,
      /^\/chat(?:\/|$)/, // /chat, /chat/:sessionId
      /^\/chat_share(?:\/|$)/, // /chat_share/:id[/public]
      /^\/admin-dashboard(?:\/|$)/,
      /^\/docs(?:\/|$)/,
      /^\/openapi(?:\/|$)/,
      /^\/(?:outlook|gmail)-(?:connected|error)(?:\/|$)/, // OAuth connect callbacks
      /^\/connections(?:\/|$)/, // connections OAuth return
    ],

    // Runtime caching for assets that aren't part of the precache manifest
    // (e.g. cross-origin fonts, images loaded on demand).
    runtimeCaching: [
      {
        // Google Fonts stylesheets — refresh in the background.
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts-stylesheets",
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        // Google Fonts font files — immutable, cache for a year.
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          cacheableResponse: { statuses: [0, 200] },
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        // Same-origin images only — avoid SW intercepting broken cross-origin CDN URLs.
        urlPattern: ({ request, url }) =>
          request.destination === "image" &&
          url.origin === self.location.origin,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "image-cache",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
};

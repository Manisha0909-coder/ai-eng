import type { ManifestOptions } from "vite-plugin-pwa";

/**
 * Web App Manifest.
 *
 * Defined here (instead of a static `public/manifest.json`) so that
 * `vite-plugin-pwa` owns it: the plugin emits `manifest.webmanifest`, injects
 * the `<link rel="manifest">` into `index.html`, and keeps the manifest in sync
 * with the generated service worker. This avoids the classic bug where a hand
 * written manifest references `/src/assets/*` paths that only exist in dev.
 *
 * Icons live in `public/icons/` so their URLs are stable (`/icons/...`) in both
 * dev and production — public assets are copied verbatim and never hashed.
 */
export const manifest: Partial<ManifestOptions> = {
  // Full name shown on the install dialog / app listing.
  name: "Newton",
  // Short name used under the home-screen icon (keep < 12 chars).
  short_name: "Newton",
  description: "Newton",

  // Open as a real app window (no browser chrome) once installed.
  display: "standalone",
  // Lock to portrait on mobile to match the chat layout.
  orientation: "portrait",

  // Browser UI / splash colors. theme_color matches the <meta name="theme-color">
  // in index.html so the status bar and the installed app agree.
  theme_color: "#0f1216",
  background_color: "#0f1216",

  // The page loaded when the installed app launches, and the navigation scope
  // the service worker controls. "/" = the whole SPA.
  start_url: "/",
  scope: "/",

  icons: [
    {
      src: "/icons/icon-192x192.png?v=3",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512x512.png?v=3",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      // "maskable" lets Android crop the icon into its adaptive shape without
      // clipping content — required for a polished installed-icon look.
      src: "/icons/icon-512x512.png?v=3",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

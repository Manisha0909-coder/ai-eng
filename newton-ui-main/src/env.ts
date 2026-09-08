/**
 * `VITE_API_BASE_URL` — see root `.env` / `env.example`.
 * `/mid` and `/core` are appended in `config/api.ts` (and in individual API URLs where needed).
 */
function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** Normalized `VITE_API_BASE_URL` (e.g. `https://example.com/api`). */
export const VITE_API_BASE_URL = stripTrailingSlash(
  String(import.meta.env.VITE_API_BASE_URL || "").trim()
);

/** Public app origin for share links — from `VITE_API_BASE_URL` host, or current tab when unset. */
export function getPublicOrigin(): string {
  const r = VITE_API_BASE_URL;
  if (r) {
    try {
      return new URL(r.endsWith("/") ? r : `${r}/`).origin;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Theme name from `VITE_ACTIVE_THEME` (per-tenant env at build time). */
export const checkActiveTheme = (name: string) =>
  import.meta.env.VITE_ACTIVE_THEME === name;

/** Default on unless `VITE_ENABLE_UPLOAD_IMAGE=false`. */
export const ENABLE_UPLOAD_IMAGE =
  import.meta.env.VITE_ENABLE_UPLOAD_IMAGE !== "false";

/** Requires `VITE_SHOW_REASONING=true`. */
export const SHOW_REASONING = import.meta.env.VITE_SHOW_REASONING === "true";

/** Short git commit hash injected at build time (e.g. `"a1b2c3d"`). */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

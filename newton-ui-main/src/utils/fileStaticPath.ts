import { API_CONFIG } from "@/config/api";

/**
 * File GETs must use the middleware base from env (`VITE_API_BASE_URL` → `API_CONFIG.LOCAL_API_BASE_URL`),
 * not `VITE_CLIENT_URL`, so paths line up with the BFF (`/api/mid/...`).
 */

/**
 * Relative path for attachment metadata.
 */
export function middlewareFilePath(path: string): string {
  return String(path ?? "");
}

/**
 * Absolute URL for fetching a file. Uses `VITE_API_BASE_URL` via `API_CONFIG.LOCAL_API_BASE_URL`.
 */
export function fileUrl(path: string): string {
  const p = (path ?? "").trim();
  if (!p) return p;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const base = API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "");
  try {
    const baseUrl = new URL(base);
    const origin = baseUrl.origin;
    const basePath = baseUrl.pathname.replace(/\/$/, "") || "";
    let rel = p.startsWith("/") ? p : `/${p}`;

    // Backend may return paths that already include a leading "/mid/...".
    // If our base is already ".../mid", avoid producing ".../mid/mid/...".
    // Example:
    // - basePath: "/api/mid"
    // - rel: "/mid/files/abc.png"
    // Want: "/api/mid/files/abc.png"
    if (basePath.endsWith("/mid") && rel.startsWith("/mid/")) {
      rel = rel.slice("/mid".length);
    }
    if (basePath && (rel === basePath || rel.startsWith(`${basePath}/`))) {
      return `${origin}${rel}`;
    }
    return `${base}${rel}`;
  } catch {
    return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
  }
}

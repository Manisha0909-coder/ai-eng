import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope, isEnvelope } from "@/services/api/envelope";
import notify from "@/utils/notify";
import { apiFetch } from "@/services/api/sessionExpiry";

const stripSlash = (v: string) => v.replace(/\/$/, "");

/** RBAC JSON routes (`/mid`) — same base used by the dashboard's RBAC APIs. */
export const RBAC_BASE_URL = stripSlash(API_CONFIG.LOCAL_API_BASE_URL || "");

/** BFF `/core` — document HTTP APIs (same base as `dataSourcesApi` / `DASHBOARD_API_BASE_URL`). */
export const DOCUMENT_API_BASE = stripSlash(API_CONFIG.DASHBOARD_API_BASE_URL || "");

type RbacBase = "rbac" | "document";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RbacRequestOptions {
  method?: HttpMethod;
  /** JSON body — will be `JSON.stringify`-ed and sent with `Content-Type: application/json`. */
  body?: unknown;
  /** Multipart body. Mutually exclusive with `body`; the browser sets its own Content-Type. */
  form?: FormData;
  /** Flat record of query params. Skips `undefined`, `null`, empty strings, and empty arrays. */
  query?: Record<string, string | number | boolean | string[] | number[] | undefined | null>;
  /** Which backend to hit; defaults to `"rbac"` (`/mid`). */
  base?: RbacBase;
  /** Suppresses envelope success/error toasts for this call. */
  silent?: boolean;
}

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const baseUrl = (base: RbacBase): string =>
  base === "document" ? DOCUMENT_API_BASE : RBAC_BASE_URL;

const buildQuery = (query: RbacRequestOptions["query"]): string => {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      params.set(key, raw.join(","));
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      params.set(key, trimmed);
      continue;
    }
    params.set(key, String(raw));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const parseError = async (
  response: Response,
  silent: boolean
): Promise<never> => {
  let errorData: unknown;
  try {
    errorData = await response.json();
  } catch {
    errorData = {
      error: { message: `HTTP error ${response.status}: ${response.statusText}` },
    };
  }

  const isEnv = isEnvelope(errorData) && !errorData.success;
  const envMessage = isEnv ? (errorData as { message: string }).message : undefined;
  const shaped = errorData as { error?: { message?: string }; message?: string };
  const serverMessage =
    envMessage || shaped.error?.message || shaped.message;

  const statusFallback =
    response.status === 403
      ? "Admin privileges required for this operation"
      : response.status === 401
        ? "Authentication required"
        : `HTTP error ${response.status}`;

  const message =
    typeof serverMessage === "string" && serverMessage.trim()
      ? serverMessage
      : statusFallback;

  const toasted = isEnv && !silent;
  if (toasted) notify.error(message);
  const err = new Error(message) as Error & {
    envelopeToasted?: boolean;
    status?: number;
    details?: unknown;
  };
  if (toasted) err.envelopeToasted = true;
  // The envelope's `data` carries machine-readable context the message can't —
  // e.g. the provider API's 422 `{ rule }`, which lets a caller bind the failure
  // to the field that caused it instead of settling for a toast.
  err.status = response.status;
  if (isEnv) err.details = (errorData as { data?: unknown }).data;
  throw err;
};

/**
 * Unified RBAC fetch wrapper. Handles base URL, auth cookies, JSON/form bodies,
 * query-string building, and envelope unwrapping + toast notifications.
 *
 * Returns the unwrapped envelope data, or the raw body for non-envelope responses.
 */
// Endpoints whose last path segment ends in `list` (e.g. `/users/list`,
// `/users/user_list`) are read-only collections — failures usually surface
// inline in the UI, so suppress the default error toast unless a caller
// explicitly opts in with `silent: false`.
const LIST_PATH_PATTERN = /\/[^/?]*list$/i;

export async function rbacRequest<T = any>(
  path: string,
  opts: RbacRequestOptions = {}
): Promise<T> {
  const method = opts.method ?? "GET";
  const url = `${baseUrl(opts.base ?? "rbac")}${path}${buildQuery(opts.query)}`;

  const silent =
    opts.silent !== undefined ? opts.silent : LIST_PATH_PATTERN.test(path);

  const init: RequestInit = {
    method,
    credentials: "include",
  };

  if (opts.form) {
    init.body = opts.form;
  } else if (opts.body !== undefined) {
    init.headers = JSON_HEADERS;
    init.body = JSON.stringify(opts.body);
  } else {
    init.headers = JSON_HEADERS;
  }

  const response = await apiFetch(url, init);
  if (!response.ok) await parseError(response, silent);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    const text = await response.text().catch(() => "Unable to read response");
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }

  return unwrapEnvelope<T>(body, {
    method: method.toLowerCase(),
    silent,
  });
}

/** Binary download (e.g. document download). Bypasses envelope/JSON parsing. */
export async function rbacDownload(
  path: string,
  opts: { base?: RbacBase } = {}
): Promise<Blob> {
  const response = await apiFetch(
    `${baseUrl(opts.base ?? "rbac")}${path}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (response.ok) return response.blob();

  let errorData: { detail?: string; message?: string } = {};
  try {
    errorData = (await response.json()) as { detail?: string; message?: string };
  } catch {
    errorData.message = `HTTP error ${response.status}`;
  }
  throw new Error(
    errorData.detail || errorData.message || `HTTP error ${response.status}`
  );
}

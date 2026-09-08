import notify from "@/utils/notify";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export function isEnvelope(body: unknown): body is ApiResponse<unknown> {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { success?: unknown }).success === "boolean" &&
    "data" in (body as object)
  );
}

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * For fetch callers: on a non-ok response, parse the body, fire `notify.error`
 * with the envelope message when present, and throw a marked error so
 * downstream `notify.error(err)` calls won't double-toast.
 *
 * Usage:
 *   const res = await fetch(url);
 *   if (!res.ok) await throwEnvelopeErrorFromResponse(res);
 *   const data = unwrapEnvelope<T>(await res.json());
 */
export async function throwEnvelopeErrorFromResponse(
  response: Response,
  opts: { silent?: boolean; fallbackMessage?: string } = {}
): Promise<never> {
  const fallback = opts.fallbackMessage ?? `Request failed (${response.status})`;
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // not JSON
  }
  let message = fallback;
  if (isEnvelope(body)) {
    message = body.message || fallback;
  } else if (body && typeof body === "object") {
    const b = body as { message?: unknown; detail?: unknown; error?: { message?: unknown } };
    if (typeof b.message === "string") message = b.message;
    else if (typeof b.detail === "string") message = b.detail;
    else if (b.error && typeof b.error === "object" && typeof b.error.message === "string") message = b.error.message;
  }
  if (!opts.silent) notify.error(message);
  const err = new Error(message) as Error & {
    envelopeToasted?: boolean;
    status?: number;
  };
  if (!opts.silent) err.envelopeToasted = true;
  err.status = response.status;
  throw err;
}

/**
 * Unwrap an `ApiResponse` envelope. Throws when `success: false`.
 * Fires a success toast on mutations when `message` is non-empty, unless `silent`.
 * Passes through non-envelope bodies unchanged (streaming/binary/legacy).
 */
export function unwrapEnvelope<T>(
  body: unknown,
  opts: { method?: string; silent?: boolean } = {}
): T {
  if (!isEnvelope(body)) return body as T;

  if (!body.success) {
    const message = body.message || "Request failed";
    if (!opts.silent) notify.error(message);
    const err = new Error(message) as Error & { envelopeToasted?: boolean };
    if (!opts.silent) err.envelopeToasted = true;
    throw err;
  }

  const method = (opts.method || "").toLowerCase();
  if (MUTATION_METHODS.has(method) && body.message && !opts.silent) {
    notify.success(body.message);
  }

  return body.data as T;
}

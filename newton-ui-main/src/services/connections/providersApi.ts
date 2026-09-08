import { rbacRequest } from "@/services/rbac/rbacClient";
import type {
  CreateProviderResponse,
  DeleteProviderResponse,
  GetProviderResponse,
  ListProvidersResponse,
  ProviderMeta,
  ProviderRule,
  ProviderWriteRequest,
  ReplaceProviderResponse,
  UpdateProviderRequest,
  UpdateProviderResponse,
} from "./types";

/** Reads the 422 `data.rule` a provider write failed on, if any. */
export function providerRuleOf(error: unknown): ProviderRule | null {
  const details = (error as { details?: { rule?: unknown } } | null)?.details;
  return typeof details?.rule === "string" ? details.rule : null;
}

export const providersApi = {
  list: async (opts?: { silent?: boolean }) =>
    rbacRequest<ListProvidersResponse>("/connections/providers", {
      silent: opts?.silent,
    }),

  /** Environment facts (redirect URI) — available before the first provider exists. */
  meta: async () =>
    rbacRequest<ProviderMeta>("/connections/providers/meta", { silent: true }),

  get: async (key: string) =>
    rbacRequest<GetProviderResponse>(`/connections/providers/${encodeURIComponent(key)}`),

  /** Single typed write — `body.confirm_oauth_endpoints` carries the confirmation gate. */
  create: async (body: ProviderWriteRequest) =>
    rbacRequest<CreateProviderResponse>("/connections/providers", {
      method: "POST",
      body,
      silent: true,
    }),

  /** Full-document replace, single write. Credentials are write-only — omit/empty to keep. */
  replace: async (key: string, body: ProviderWriteRequest) =>
    rbacRequest<ReplaceProviderResponse>(
      `/connections/providers/${encodeURIComponent(key)}`,
      { method: "PUT", body, silent: true },
    ),

  /** Narrow rotation of credentials / enabled flag — no spec fields here. */
  update: async (key: string, body: UpdateProviderRequest) =>
    rbacRequest<UpdateProviderResponse>(
      `/connections/providers/${encodeURIComponent(key)}`,
      { method: "PATCH", body, silent: true },
    ),

  remove: async (key: string) =>
    rbacRequest<DeleteProviderResponse>(
      `/connections/providers/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    ),
};

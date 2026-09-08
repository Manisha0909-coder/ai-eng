import { rbacRequest } from "@/services/rbac/rbacClient";
import type {
  AuthorizeConnectionResponse,
  ConnectionCatalogResponse,
  CreateConnectionRequest,
  CreateConnectionResponse,
  GetConnectionResponse,
  ListConnectionsResponse,
  TestConnectionResponse,
} from "./types";

/**
 * Per-user connection endpoints (`/connections`).
 *
 * Note: Settings "Connect with …" still uses the legacy auth-server login
 * routers until Phase 4. Use this API for the Connections tab and new
 * integrations — do not mix both for the same user+provider.
 */
export const connectionsApi = {
  catalog: async () =>
    rbacRequest<ConnectionCatalogResponse>("/connections/catalog"),

  list: async () => rbacRequest<ListConnectionsResponse>("/connections"),

  get: async (id: string) =>
    rbacRequest<GetConnectionResponse>(
      `/connections/${encodeURIComponent(id)}`,
    ),

  create: async (body: CreateConnectionRequest) =>
    rbacRequest<CreateConnectionResponse>("/connections", {
      method: "POST",
      body,
      silent: true,
    }),

  delete: async (id: string) =>
    rbacRequest<null>(`/connections/${encodeURIComponent(id)}`, {
      method: "DELETE",
      // Caller shows a provider-specific success toast.
      silent: true,
    }),

  test: async (id: string) =>
    rbacRequest<TestConnectionResponse>(
      `/connections/${encodeURIComponent(id)}/test`,
      { method: "POST", silent: true },
    ),

  /** Redirect with `window.location.href = data.authorization_url`. */
  authorize: async (id: string) =>
    rbacRequest<AuthorizeConnectionResponse>(
      `/connections/${encodeURIComponent(id)}/authorize`,
      { silent: true },
    ),
};

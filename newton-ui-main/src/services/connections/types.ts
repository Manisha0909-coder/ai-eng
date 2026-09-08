/**
 * Narrowed to two modes server-side: `basic`, `none` and `oauth2_cc` went away
 * when the middleware stopped composing requests and started vending
 * credentials. Anything else is a 422.
 */
export type ProviderAuthMode = "oauth2" | "api_key";

export type ConnectionStatus =
  | "pending"
  | "active"
  | "needs_reauth"
  | "error";

/** Single source of truth for auth-mode display text (was duplicated in 3 components). */
export const AUTH_MODE_LABEL: Record<ProviderAuthMode, string> = {
  oauth2: "OAuth2",
  api_key: "API key",
};

export const isOAuthMode = (mode: ProviderAuthMode): boolean => mode === "oauth2";

export interface ProviderSummary {
  key: string;
  display_name: string;
  auth_mode: ProviderAuthMode;
  is_enabled: boolean;
  has_credentials: boolean;
}

/** Response shape of a provider's OAuth2 config — includes the read-only `refresh_style`. */
export interface ProviderOAuth2 {
  authorization_url: string;
  token_url: string;
  default_scopes: string[];
  scope_separator: string;
  pkce: boolean;
  token_request_auth: "body" | "basic";
  extra_authorize_params: Record<string, string>;
  token_response: {
    access_token: string;
    refresh_token: string;
    expires_in: string;
  };
  /**
   * Set only by a migration (e.g. noah's `json_body`), never by an API write —
   * rule D15 rejects it on the request path. Read-only here; the form must
   * never echo it back.
   */
  refresh_style?: string | null;
}

/** Request shape of the `oauth2` block — everything in {@link ProviderOAuth2} except `refresh_style`. */
export type ProviderOAuth2Write = Omit<ProviderOAuth2, "refresh_style">;

export interface ProviderDetail extends ProviderSummary {
  /** `null` for `api_key` providers. */
  oauth2: ProviderOAuth2 | null;
  /** Computed OAuth callback URL to register in the provider's own console. `null` for non-OAuth auth modes. */
  redirect_uri: string | null;
}

export interface ListProvidersResponse {
  providers: ProviderSummary[];
}

export interface GetProviderResponse {
  provider: ProviderDetail;
}

export interface UpdateProviderRequest {
  client_id?: string;
  client_secret?: string;
  api_key?: string;
  is_enabled?: boolean;
}

export interface UpdateProviderResponse {
  provider: ProviderDetail;
}

/**
 * Single-write request body for POST/PUT /connections/providers.
 *
 * A provider has one job — acquiring a credential — so the body is exactly
 * identity fields, optional write-only credentials, and an `oauth2` block
 * (required for `oauth2` auth mode, forbidden for `api_key`). The server
 * forbids unknown fields, so a stray `oauth2.refresh_style` or `api_key` on an
 * `oauth2` provider is a 422, not a field it silently ignores.
 *
 * `key` is required on create; PUT takes it from the path instead, so callers
 * building a replace body simply omit it.
 */
export interface ProviderWriteRequest {
  key?: string;
  display_name: string;
  auth_mode: ProviderAuthMode;
  is_enabled: boolean;
  /** Write-only; omitted/empty keeps the currently stored value. */
  client_id?: string;
  /** Write-only; omitted/empty keeps the currently stored value. */
  client_secret?: string;
  /** Write-only, system-level credential for `api_key` providers; omitted/empty keeps the currently stored value. */
  api_key?: string;
  /** Acknowledges the hosts an OAuth endpoint change will send users to. */
  confirm_oauth_endpoints?: boolean;
  /** Required for `oauth2` auth mode, forbidden for `api_key`. */
  oauth2?: ProviderOAuth2Write;
}

export interface ProviderWriteResponse {
  provider: ProviderDetail;
  /** Hosts an OAuth endpoint change points users' browsers at — the visible half of the confirmation gate. */
  destination_hosts: string[];
}

export type CreateProviderResponse = ProviderWriteResponse;
export type ReplaceProviderResponse = ProviderWriteResponse;

/** Environment-level facts, readable before any provider exists. */
export interface ProviderMeta {
  redirect_uri: string;
}

/**
 * Machine-readable half of a provider write failure (422 `data.rule`).
 * `confirm_oauth_endpoints` is the one an admin can resolve in the form.
 */
export type ProviderRule =
  | "schema"
  | "confirm_oauth_endpoints"
  | "key_immutable"
  | (string & {});

export interface DeleteProviderResponse {
  // Empty response on successful deletion
}

export interface Connection {
  id: string;
  provider_key: string;
  owner_scope: string;
  owner_id: string;
  status: ConnectionStatus;
  display_name: string | null;
  last_error: string | null;
  conn_metadata: Record<string, unknown>;
  expires_at: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionRequest {
  provider_key: string;
  display_name?: string;
}

export interface CreateConnectionResponse {
  connection: Connection;
}

export interface ListConnectionsResponse {
  connections: Connection[];
}

export interface CatalogConnection {
  id: string;
  provider_key: string;
  status: ConnectionStatus;
  display_name: string | null;
  last_error: string | null;
  expires_at: string | null;
  last_refreshed_at: string | null;
}

export interface ConnectionCatalogItem {
  provider_key: string;
  display_name: string;
  auth_mode: ProviderAuthMode;
  is_connectable: boolean;
  connection: CatalogConnection | null;
}

export interface ConnectionCatalogResponse {
  items: ConnectionCatalogItem[];
}

export interface GetConnectionResponse {
  connection: Connection;
}

export interface TestConnectionResponse {
  /** Only that the request was handled — a not-applicable test is not a failure. */
  success: boolean;
  status: ConnectionStatus;
  message: string;
  last_error: string | null;
  /**
   * Three-valued, and the field to render: `true` the provider accepted the
   * credential, `false` it refused (status becomes `error`), `null` the
   * question could not be asked — an `api_key` connection, an OAuth one with
   * no refresh token, or one refreshed within the last five minutes. A `null`
   * result leaves `status` untouched and must not read as success or failure.
   */
  verified: boolean | null;
}

export interface AuthorizeConnectionResponse {
  success: boolean;
  authorization_url: string;
  message: string | null;
}

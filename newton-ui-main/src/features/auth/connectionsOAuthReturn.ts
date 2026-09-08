/** Set before redirecting to an OAuth authorize URL from the Connections tab. */
export const CONNECTIONS_OAUTH_RETURN_KEY = "connections_oauth_return";
export const CONNECTIONS_OAUTH_CONNECTION_ID_KEY = "connections_oauth_connection_id";
export const CONNECTIONS_OAUTH_PROVIDER_KEY = "connections_oauth_provider";

/** Result written by the OAuth landing route after the provider callback. */
export const CONNECTIONS_OAUTH_RESULT_KEY = "connections_oauth_result";

export const CONNECTION_PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  noah: "Noah",
  connectsecure: "ConnectSecure",
  ibm_loyalty: "IBM Loyalty",
};

export type ConnectionsOAuthResult = {
  status: "active" | "error";
  connectionId: string | null;
  message: string | null;
  provider: string | null;
};

export const markConnectionsOAuthReturn = (
  connectionId: string,
  provider?: string,
): void => {
  try {
    globalThis.sessionStorage?.setItem(CONNECTIONS_OAUTH_RETURN_KEY, "true");
    globalThis.sessionStorage?.setItem(
      CONNECTIONS_OAUTH_CONNECTION_ID_KEY,
      connectionId,
    );
    if (provider) {
      globalThis.sessionStorage?.setItem(CONNECTIONS_OAUTH_PROVIDER_KEY, provider);
    } else {
      globalThis.sessionStorage?.removeItem(CONNECTIONS_OAUTH_PROVIDER_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const storeConnectionsOAuthResult = (
  result: ConnectionsOAuthResult,
): void => {
  try {
    globalThis.sessionStorage?.setItem(
      CONNECTIONS_OAUTH_RESULT_KEY,
      JSON.stringify(result),
    );
  } catch {
    // ignore storage errors
  }
};

const readConnectionsOAuthResult = (): ConnectionsOAuthResult | null => {
  try {
    const raw = globalThis.sessionStorage?.getItem(CONNECTIONS_OAUTH_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConnectionsOAuthResult;
    const provider =
      globalThis.sessionStorage?.getItem(CONNECTIONS_OAUTH_PROVIDER_KEY) ?? null;
    return { ...parsed, provider: parsed.provider ?? provider };
  } catch {
    return null;
  }
};

/** Read without clearing — used to open the Connections tab before the tab consumes the result. */
export const peekConnectionsOAuthResult = (): ConnectionsOAuthResult | null =>
  readConnectionsOAuthResult();

export const consumeConnectionsOAuthResult = (): ConnectionsOAuthResult | null => {
  const result = readConnectionsOAuthResult();
  if (!result) return null;

  try {
    globalThis.sessionStorage?.removeItem(CONNECTIONS_OAUTH_RESULT_KEY);
    globalThis.sessionStorage?.removeItem(CONNECTIONS_OAUTH_RETURN_KEY);
    globalThis.sessionStorage?.removeItem(CONNECTIONS_OAUTH_CONNECTION_ID_KEY);
    globalThis.sessionStorage?.removeItem(CONNECTIONS_OAUTH_PROVIDER_KEY);
  } catch {
    // ignore storage errors
  }

  return result;
};

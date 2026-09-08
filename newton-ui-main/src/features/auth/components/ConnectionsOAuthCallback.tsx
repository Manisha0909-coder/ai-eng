import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CONNECTIONS_OAUTH_PROVIDER_KEY,
  storeConnectionsOAuthResult,
} from "@/features/auth/connectionsOAuthReturn";

/**
 * OAuth landing handler for the connections flow.
 * Backend redirects to `/connections?status=active|error&connection_id=…`
 * (legacy: `/connections/oauth/return`). Stores the result and immediately
 * returns to home — ConnectionsTab shows the toast and refreshes the list.
 */
export function ConnectionsOAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  useEffect(() => {
    const status = params.get("status");
    const connectionId = params.get("connection_id");
    const message = params.get("message");
    const provider =
      globalThis.sessionStorage?.getItem(CONNECTIONS_OAUTH_PROVIDER_KEY) ??
      null;

    storeConnectionsOAuthResult({
      status: status === "active" ? "active" : "error",
      connectionId,
      message,
      provider,
    });

    navigate("/", { replace: true });
  }, [navigate, params]);

  return null;
}

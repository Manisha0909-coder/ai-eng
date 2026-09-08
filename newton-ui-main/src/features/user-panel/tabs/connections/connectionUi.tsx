import {
  CheckCircle2,
  Clock,
  Plug,
  XCircle,
} from "lucide-react";
import type {
  ConnectionStatus,
  ProviderAuthMode,
  TestConnectionResponse,
} from "@/services/connections/types";
import { CONNECTION_PROVIDER_LABELS } from "@/features/auth/connectionsOAuthReturn";
import notify from "@/utils/notify";
import { cn } from "@/lib/utils";

const gmailLogo = "/icons/Gmail_Logo.svg";
const microsoftLogo = "/icons/Microsoft_Logo.svg";

export { AUTH_MODE_LABEL } from "@/services/connections/types";

export const STATUS_LABEL: Record<ConnectionStatus, string> = {
  pending: "Pending authorization",
  active: "Connected",
  needs_reauth: "Needs reconnection",
  error: "Error",
};

export function providerDisplayName(key: string, fallback?: string) {
  return fallback ?? CONNECTION_PROVIDER_LABELS[key] ?? key;
}

export function providerLogo(key: string) {
  switch (key) {
    case "google":
      return <img src={gmailLogo} alt="Google" className="w-3.5 h-3.5" />;
    case "microsoft":
      return <img src={microsoftLogo} alt="Microsoft" className="w-3.5 h-3.5" />;
    case "noah":
      return (
        <span className="font-display font-bold text-sm text-text-main">N</span>
      );
    case "connectsecure":
      return (
        <span className="font-display font-bold text-xs text-text-muted">CS</span>
      );
    case "ibm_loyalty":
      return (
        <span className="font-display font-bold text-[10px] text-text-muted">IBM</span>
      );
    default:
      return <Plug size={14} className="text-text-muted" />;
  }
}

export function logoOnWhiteBackground(key: string) {
  return key === "google" || key === "microsoft";
}

export function isOAuthUserFlow(mode: ProviderAuthMode | null | undefined) {
  return mode === "oauth2";
}

export function isAuthorizeStatus(status: ConnectionStatus) {
  return status === "pending" || status === "needs_reauth";
}

/**
 * Reports a connection test, whose result is three-valued.
 *
 * A test forces an OAuth refresh, so it cannot always be run: an `api_key`
 * connection has nothing to refresh, an OAuth one may have no refresh token,
 * and a repeat click inside five minutes is debounced. Those all come back
 * `verified: null` with `success: true` and leave the connection's status
 * untouched — so they get a neutral toast carrying the server's explanation,
 * never a green tick and never an error.
 */
export function notifyTestResult(result: TestConnectionResponse) {
  if (result.verified === true) {
    notify.success(result.message || "Connection verified");
  } else if (result.verified === false) {
    notify.error(
      result.last_error || result.message || "The provider refused this credential",
    );
  } else {
    notify.info(result.message || "Can't verify this connection");
  }
}

export function ConnectionStatusInline({
  status,
  displayName,
}: {
  status: ConnectionStatus;
  displayName?: string | null;
}) {
  const connected = status === "active";

  return (
    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
      {connected ? (
        <CheckCircle2 size={10} className="text-status-success shrink-0" />
      ) : status === "error" ? (
        <XCircle size={10} className="text-status-error shrink-0" />
      ) : (
        <Clock size={10} className="text-status-warning shrink-0" />
      )}
      <span
        className={cn(
          "text-xs truncate",
          connected
            ? "text-status-success"
            : status === "error"
              ? "text-status-error"
              : "text-text-muted",
        )}
      >
        {STATUS_LABEL[status]}
      </span>
      {displayName && (
        <span className="text-xs text-text-muted truncate">· {displayName}</span>
      )}
    </div>
  );
}

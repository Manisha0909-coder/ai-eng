import { clearUserProfileCache } from "@/services/user/userApi";
import { clearAllCookies } from "@/utils/helper";
import { clearStoredSessionId } from "@/store/useStore";

/**
 * Session-expiry handling.
 *
 * The backend owns session lifetime. The frontend's only job: when an
 * authenticated request comes back 401, the session is gone — redirect to
 * /login so the next load can reset state cleanly. On the login page /
 * during logout, 401s are left alone.
 */

export const isOnLoginPage = (): boolean => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return path === "/login" || path.startsWith("/login/");
};

const isLogoutInProgress = (): boolean =>
  typeof window !== "undefined" &&
  window.sessionStorage.getItem("logout_in_progress") === "true";

const isPublicChatSharePage = (): boolean => {
  if (typeof window === "undefined") return false;
  return /^\/chat_share\/[^/]+\/public\/?$/.test(window.location.pathname);
};

/** True when a 401 should NOT trigger logout: on the login page or mid-logout. */
export const shouldSkipAuthHandling = (): boolean =>
  isOnLoginPage() || isLogoutInProgress() || isPublicChatSharePage();

// Guard so concurrent 401s don't each fire their own logout + redirect.
let sessionExpiredHandled = false;

/** Redirect to /login after session expiry (full page load resets in-memory state). */
export const handleSessionExpired = (): void => {
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;
  console.error("Session expired - redirecting to login");

  // Do NOT call useStore.getState().logout() here — it flips isAuthenticated
  // synchronously and the header/sidebar flash before navigation completes.
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem("logout_in_progress", "true");
    } catch {
      // ignore storage errors
    }
  }
  clearUserProfileCache();
  clearAllCookies();
  clearStoredSessionId();
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
};

/**
 * The fetch transport's session guard — the `fetch()` counterpart of the axios
 * 401 interceptor in `client.ts`. Always sends the session cookie and, on a
 * 401, clears all data + redirects to /login (skipped on the login page /
 * mid-logout). Use for any `fetch()` that hits the app backend so its 401s
 * behave like the axios calls.
 */
export const apiFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(input, { credentials: "include", ...init });
  if (response.status === 401 && !shouldSkipAuthHandling()) {
    handleSessionExpired();
  }
  return response;
};

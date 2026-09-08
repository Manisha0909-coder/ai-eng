import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { fetchUserProfile, clearUserProfileCache } from "@/services/user/userApi";
import { clearAllCookies } from "@/utils/helper";

/** Throttle: avoid calling /me again if we verified successfully recently (e.g. after route change). */
const SESSION_VERIFY_THROTTLE_MS = 60_000;
let lastSuccessfulVerifyAt = 0;

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const {
    logout,
    isAuthenticated,
    login,
    setIsAdmin,
    setUserId,
    setIsAuthChecked,
  } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isChatShare = location.pathname.includes("chat_share");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isOAuthCallbackInProgress = new URLSearchParams(location.search).has(
    "code"
  );

  // Verify session on mount using cached userApi (other components get cache hits).
  // Throttled so navigating between protected routes doesn't call /me again.
  // 401 → clear throttle, logout, redirect to /login.
  useEffect(() => {
    if (location.pathname === "/login" || location.pathname.startsWith("/login/")) {
      setIsCheckingAuth(false);
      setIsAuthChecked(true);
      return;
    }

    const isPublicChatShare = /^\/chat_share\/[^/]+\/public\/?$/.test(
      location.pathname
    );
    if (isPublicChatShare) {
      setIsCheckingAuth(false);
      setIsAuthChecked(true);
      return;
    }

    const now = Date.now();
    if (now - lastSuccessfulVerifyAt < SESSION_VERIFY_THROTTLE_MS) {
      setIsCheckingAuth(false);
      return;
    }

    let cancelled = false;

    const verifySession = async () => {
      try {
        const profile = await fetchUserProfile();
        if (cancelled) return;
        lastSuccessfulVerifyAt = Date.now();
        login();
        setIsAdmin(profile?.is_admin === true);
        if (profile?.email) {
          setUserId(profile.email);
        }
      } catch (error: any) {
        if (cancelled) return;
        const status = error?.response?.status ?? error?.status;
        if (status === 401) {
          lastSuccessfulVerifyAt = 0;
          // 401 from /me on refresh: clear local state and send user to /login,
          // but DO NOT call backend logout API. Session may already be invalid/expired.
          clearAllCookies();
          clearUserProfileCache();
          logout();
          if (!isChatShare) {
            navigate("/login", {
              replace: true,
              state: { returnUrl: location.pathname + location.search },
            });
          }
        }
      } finally {
        if (!cancelled) {
          setIsCheckingAuth(false);
          setIsAuthChecked(true);
        }
      }
    };

    verifySession();
    return () => {
      cancelled = true;
    };
  }, []); // Intentional: run once per mount; throttle prevents extra /me on route changes

  useEffect(() => {
    // Skip while checking auth
    if (isCheckingAuth) {
      return;
    }

    // If we landed with an OAuth callback code, let the callback handler finish first.
    // Redirecting to /login during the exchange can cause multiple callback executions.
    if (isOAuthCallbackInProgress) {
      return;
    }

    // Skip if logout is in progress
    if (typeof window !== "undefined" && window.sessionStorage.getItem("logout_in_progress") === "true") {
      return;
    }
    
    // Skip if already on auth page to avoid redirect loops
    if (location.pathname === "/login" || location.pathname.startsWith("/login/")) {
      // Clear logout flag if we're on auth page
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("logout_in_progress");
      }
      return;
    }

    // For cookie-based auth: only check isAuthenticated
    if (!isAuthenticated) {
      if (!isChatShare) {
        // Only call logout if not already logged out
        if (isAuthenticated) {
          logout();
        }
        navigate("/login");
      }
    }
  }, [
    navigate,
    logout,
    isChatShare,
    isAuthenticated,
    location.pathname,
    location.search,
    isCheckingAuth,
    isOAuthCallbackInProgress,
  ]);

  // Show nothing while checking auth to prevent flash
  if (isCheckingAuth) {
    return null;
  }

  return <>{children}</>;
};

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import axios from "axios";
import notify from "@/utils/notify";

import { API_CONFIG } from "@/config/api";
import { clearUserProfileCache } from "@/services/user/userApi";

const LAST_CALLBACK_KEY = "oauth_last_callback";

export const OAuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Finalizing authentication…");
  const callbackKey = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  const provider = useMemo(() => {
    if (location.pathname.includes("outlook")) return "Outlook";
    if (location.pathname.includes("gmail")) return "Gmail";
    return "Email";
  }, [location.pathname]);

  useEffect(() => {
    let isCancelled = false;

    const handleCallback = async () => {
      if (globalThis.sessionStorage?.getItem(LAST_CALLBACK_KEY) === callbackKey) {
        return;
      }
      globalThis.sessionStorage?.setItem(LAST_CALLBACK_KEY, callbackKey);

      const searchParams = new URLSearchParams(location.search);
      const errorParam = searchParams.get("error") || searchParams.get("message");
      const path = location.pathname;
      const isExplicitErrorRoute =
        path.includes("error") ||
        searchParams.get("status") === "error" ||
        Boolean(errorParam);
      const isServiceCallback = path.includes("/emails/auth/");

      try {
        if (isServiceCallback && !isExplicitErrorRoute) {
          setStatusMessage(`Linking ${provider} account…`);
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          await axios.get(
            `${API_CONFIG.LOCAL_API_BASE_URL}${path}${location.search}`,
            {
              headers,
              withCredentials: true,
            },
          );
        }

        if (isExplicitErrorRoute) {
          const message = errorParam
            ? `${provider} auth failed: ${errorParam}`
            : `${provider} authentication failed.`;
          notify.error(message);
          setStatusMessage("Authentication failed. Redirecting…");
        } else {
          notify.success(`${provider} connected successfully`);
          setStatusMessage(`${provider} connected. Redirecting…`);
          clearUserProfileCache();
          window.dispatchEvent(new Event("newton:user-profile-refresh"));
        }
      } catch (error) {
        console.error("OAuth callback error", error);
        notify.error(`Failed to complete ${provider} authentication`);
        setStatusMessage("Authentication failed. Redirecting…");
      } finally {
        if (!isCancelled) {
          setTimeout(() => {
            globalThis.sessionStorage?.removeItem(LAST_CALLBACK_KEY);
            navigate("/", { replace: true });
          }, 1500);
        }
      }
    };

    handleCallback();

    return () => {
      isCancelled = true;
    };
  }, [callbackKey, location.pathname, location.search, navigate, provider]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background text-text-main">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{statusMessage}</p>
      </div>
    </div>
  );
};

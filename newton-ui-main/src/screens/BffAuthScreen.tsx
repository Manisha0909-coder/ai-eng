import { tenantAssets } from "@/config/tenant";
import { NewtonStacked } from "@/components/branding/NewtonLogo";
import { RefractionField } from "@/components/branding/RefractionField";
import { fetchUserProfile } from "@/services/user/userApi";
import { useStore } from "@/store/useStore";
import { Loader2, LogIn } from "lucide-react";
import { authErrorMessage, localLogin } from "@/services/auth/authApi";
import React, { useCallback, useEffect, useState } from "react";
import notify from "@/utils/notify";
import { useLocation, useNavigate } from "react-router-dom";

// Only accept same-origin relative paths — rejects protocol-relative ("//evil")
// and absolute URLs ("https://evil") to prevent open-redirect via location.state.
export function sanitizeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "/";
  if (!/^\/[^/\\]/.test(value)) return "/";
  return value;
}

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-text-main antialiased overflow-hidden">
      <RefractionField />
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}

function LoginLogo() {
  if (tenantAssets.hasCustomLogo) {
    return (
      <img
        src={tenantAssets.logoUrl}
        alt="Logo"
        className="h-12 w-auto max-w-full"
      />
    );
  }

  return <NewtonStacked size={84} />;
}

const BffAuthScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, setUserId, setIsAdmin, setIsAuthChecked } = useStore();

  // Some deployments canonicalize `/login` ↔ `/login/` on refresh.
  // Normalize to `/login` (no trailing slash) to keep URLs consistent.
  useEffect(() => {
    if (location.pathname === "/login/") {
      navigate("/login", { replace: true, state: location.state });
    }
  }, [location.pathname, location.state, navigate]);

  // When the user hits Back after submitting the form, browsers may restore
  // this page from bfcache mid-request — leaving the button stuck on
  // "Signing in…" and a stray toast on screen. Reset on bfcache restore.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsSubmitting(false);
        notify.dismiss();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // If the user already has a valid session (cookie set and /me working),
  // skip the auth screen and return them to the app.
  useEffect(() => {
    let cancelled = false;

    const checkExistingSession = async () => {
      // If we landed here via logout redirect, do not probe `/me` (it can race with cookie clearing).
      try {
        if (window.sessionStorage.getItem("logout_in_progress") === "true") {
          window.sessionStorage.removeItem("logout_in_progress");
          setIsAuthChecked(true);
          return;
        }
      } catch {
        // ignore storage errors and continue best-effort
      }
      try {
        const profile = await fetchUserProfile();

        if (cancelled) return;

        if (profile && profile.email) {
          login();
          setUserId(profile.email);
          setIsAdmin(profile.is_admin === true);

          const state = location.state as { returnUrl?: string } | null;
          const returnUrl = sanitizeReturnPath(state?.returnUrl);
          navigate(returnUrl, { replace: true });
        }
      } catch (error: any) {
        // If /me fails (e.g. 401), stay on auth screen
        if (error?.status === 401) {
          return;
        }
      } finally {
        if (!cancelled) {
          setIsAuthChecked(true);
        }
      }
    };

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [login, setUserId, setIsAdmin, setIsAuthChecked, navigate, location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLocalLogin = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        await localLogin(email.trim(), password);
        // Cookies are set by the BFF; hydrate the app state like the
        // existing-session probe does, then return the user where they were.
        const profile = await fetchUserProfile();
        login();
        setUserId(profile?.email ?? email.trim());
        setIsAdmin(profile?.is_admin === true);
        const state = location.state as { returnUrl?: string } | null;
        navigate(sanitizeReturnPath(state?.returnUrl), { replace: true });
      } catch (error) {
        notify.error(
          authErrorMessage(error, "Sign-in didn’t complete. Please try again.")
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, isSubmitting, login, setUserId, setIsAdmin, navigate, location.state]
  );

  const inputClassName =
    "w-full h-11 rounded-lg bg-background border border-border-main px-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40";

  const ssoButtonClassName =
    "w-full h-11 rounded-lg border border-border-main bg-background text-text-main font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-surface transition-colors";

  const showComingSoon = (provider: string) => {
    notify.info(`${provider} sign-in is coming soon`);
  };

  return (
    <AuthPageShell>
      <section className="w-full max-w-md bg-surface border border-border-main rounded-2xl shadow-lift overflow-hidden">
        <div className="spectrum-rule" />
        <div className="p-10 flex flex-col items-center text-center">
          <div className="mb-8">
            <LoginLogo />
          </div>

          <h1 className="font-display font-semibold text-xl mb-1.5">
            Welcome back
          </h1>
          <p className="text-sm text-text-muted mb-8">
            Sign in with your email, or use single sign-on.
          </p>

          <form onSubmit={handleLocalLogin} className="w-full flex flex-col gap-3 text-left">
            <label className="sr-only" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
            />
            <label className="sr-only" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:bg-primary/70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in
                </>
              )}
            </button>
          </form>

          <div className="w-full flex items-center gap-3 my-6" role="separator">
            <span className="h-px flex-1 bg-border-main" />
            <span className="text-xs text-text-muted uppercase tracking-wider">or</span>
            <span className="h-px flex-1 bg-border-main" />
          </div>

          <div className="w-full flex flex-col gap-2.5">
            {/* Noah ERP is federated SSO (Noah OIDC); its direct BFF flow
                (the Noah RP integration) is a later phase. */}
            <button
              type="button"
              onClick={() => showComingSoon("Noah ERP")}
              className={ssoButtonClassName}
            >
              <span
                className="h-4 w-4 flex items-center justify-center font-display font-bold text-sm leading-none"
                aria-hidden="true"
              >
                N
              </span>
              Sign in with Noah ERP
            </button>

            <button
              type="button"
              onClick={() => showComingSoon("Google")}
              className={ssoButtonClassName}
            >
              <img
                src="/icons/Google_Logo.svg"
                alt=""
                className="h-4 w-4"
                aria-hidden="true"
              />
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={() => showComingSoon("Microsoft")}
              className={ssoButtonClassName}
            >
              <img
                src="/icons/Microsoft_Logo.svg"
                alt=""
                className="h-4 w-4"
                aria-hidden="true"
              />
              Sign in with Microsoft
            </button>
          </div>
        </div>
      </section>
    </AuthPageShell>
  );
};

export default React.memo(BffAuthScreen);

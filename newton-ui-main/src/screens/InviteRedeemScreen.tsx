import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { AuthPageShell } from "./BffAuthScreen";
import { NewtonStacked } from "@/components/branding/NewtonLogo";
import { tenantAssets } from "@/config/tenant";
import { fetchUserProfile } from "@/services/user/userApi";
import { useStore } from "@/store/useStore";
import notify from "@/utils/notify";
import {
  authErrorMessage,
  redeemInvitation,
  validateInvitation,
  type InvitationInfo,
} from "@/services/auth/authApi";

const MIN_PASSWORD_LENGTH = 10;

function InviteLogo() {
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

type ScreenState = "validating" | "invalid" | "ready";

const inputClassName =
  "w-full h-11 rounded-lg bg-background border border-border-main px-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40";

/**
 * Public redemption screen for both invite (`?token=`) and password-reset
 * links minted from the admin Invitations section. Reads the bound email via
 * `GET /auth/invitations/validate`, then submits `POST /auth/invitations/redeem`.
 *
 * - `kind=invite`: redemption sets login cookies (auto-login) — hydrate app
 *   state like `BffAuthScreen`'s local login does, then go to `/`.
 * - `kind=password_reset`: no session is created — send the user to `/login`.
 */
export default function InviteRedeemScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, setUserId, setIsAdmin } = useStore();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<ScreenState>("validating");
  const [invalidMessage, setInvalidMessage] = useState(
    "This link is invalid or has expired."
  );
  const [info, setInfo] = useState<InvitationInfo | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setInvalidMessage("This link is missing its invitation token.");
      setState("invalid");
      return;
    }

    (async () => {
      try {
        const result = await validateInvitation(token);
        if (cancelled) return;
        setInfo(result);
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setInvalidMessage(
          authErrorMessage(error, "This link is invalid or has expired.")
        );
        setState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const isInvite = info?.kind === "invite";

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmitting || !info) return;

      if (password.length < MIN_PASSWORD_LENGTH) {
        notify.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        notify.error("Passwords don’t match.");
        return;
      }

      setIsSubmitting(true);
      try {
        await redeemInvitation({
          token,
          password,
          display_name:
            info.kind === "invite" ? displayName.trim() || undefined : undefined,
        });

        if (info.kind === "invite") {
          // Redemption already set the login cookies — hydrate app state the
          // same way the local login handler on BffAuthScreen does.
          const profile = await fetchUserProfile();
          login();
          setUserId(profile?.email ?? info.email);
          setIsAdmin(profile?.is_admin === true);
          notify.success("Welcome! Your account is ready.");
          navigate("/", { replace: true });
        } else {
          notify.success("Password updated. Please sign in.");
          navigate("/login", { replace: true });
        }
      } catch (error) {
        notify.error(
          authErrorMessage(error, "Couldn’t complete this request. Please try again.")
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      info,
      password,
      confirmPassword,
      token,
      displayName,
      login,
      setUserId,
      setIsAdmin,
      navigate,
    ]
  );

  if (state === "validating") {
    return (
      <AuthPageShell>
        <section className="w-full max-w-md bg-surface border border-border-main rounded-2xl shadow-lift overflow-hidden">
          <div className="spectrum-rule" />
          <div className="p-10 flex flex-col items-center text-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-muted">Checking your invitation…</p>
          </div>
        </section>
      </AuthPageShell>
    );
  }

  if (state === "invalid") {
    return (
      <AuthPageShell>
        <section className="w-full max-w-md bg-surface border border-border-main rounded-2xl shadow-lift overflow-hidden">
          <div className="spectrum-rule" />
          <div className="p-10 flex flex-col items-center text-center">
            <div className="mb-6">
              <InviteLogo />
            </div>
            <h1 className="font-display font-semibold text-xl mb-1.5">
              Link unavailable
            </h1>
            <p className="text-sm text-text-muted mb-8">{invalidMessage}</p>
            <Link
              to="/login"
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Go to sign in
            </Link>
          </div>
        </section>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <section className="w-full max-w-md bg-surface border border-border-main rounded-2xl shadow-lift overflow-hidden">
        <div className="spectrum-rule" />
        <div className="p-10 flex flex-col items-center text-center">
          <div className="mb-8">
            <InviteLogo />
          </div>

          <h1 className="font-display font-semibold text-xl mb-1.5">
            {isInvite ? "You’ve been invited" : "Reset your password"}
          </h1>
          <p className="text-sm text-text-muted mb-6">
            {isInvite
              ? "Create your account to get started."
              : "Choose a new password for your account."}
          </p>

          <div className="w-full mb-5 rounded-lg border border-border-main bg-background px-3 py-2.5 text-left">
            <p className="text-2xs uppercase tracking-wider text-text-muted mb-0.5">
              Email
            </p>
            <p className="text-sm text-text-main truncate">{info?.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3 text-left">
            {isInvite && (
              <>
                <label className="sr-only" htmlFor="invite-display-name">
                  Display name
                </label>
                <input
                  id="invite-display-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClassName}
                />
              </>
            )}
            <label className="sr-only" htmlFor="invite-password">
              Password
            </label>
            <input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
            />
            <label className="sr-only" htmlFor="invite-confirm-password">
              Confirm password
            </label>
            <input
              id="invite-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {isInvite ? "Creating account…" : "Updating password…"}
                </>
              ) : (
                <>
                  {isInvite ? (
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isInvite ? "Create account" : "Update password"}
                </>
              )}
            </button>
          </form>

          <Link
            to="/login"
            className="mt-5 text-xs text-text-muted hover:text-text-main transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </section>
    </AuthPageShell>
  );
}

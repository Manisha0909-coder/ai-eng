import { useCallback, useEffect, useState } from "react";
import { Info, KeyRound, Laptop, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDashboardDate } from "@/utils/helper";
import notify from "@/utils/notify";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";
import {
  authErrorMessage,
  changePassword,
  listSessions,
  revokeSession,
  type LocalSession,
} from "@/services/auth/authApi";

const MIN_PASSWORD_LENGTH = 10;

const inputClassName =
  "w-full h-10 rounded-lg bg-surface border border-border-main px-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40";

export function SecurityTab({ isActive }: { isActive: boolean }) {
  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Active sessions
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<LocalSession | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const result = await listSessions();
      setSessions(result);
    } catch (error) {
      notify.error(error, authErrorMessage(error, "Failed to load active sessions."));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) fetchSessions();
  }, [isActive, fetchSessions]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      notify.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error("New passwords don’t match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      notify.success("Password updated. Your other sessions were signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await fetchSessions();
    } catch (error) {
      notify.error(error, authErrorMessage(error, "Failed to change password."));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) return;
    setRevokingId(sessionToRevoke.id);
    try {
      await revokeSession(sessionToRevoke.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToRevoke.id));
      setSessionToRevoke(null);
    } catch (error) {
      notify.error(error, authErrorMessage(error, "Failed to revoke session."));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-main scrollbar-track-transparent px-5 py-4 space-y-6 min-h-0">
        {/* Change password */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
            <KeyRound size={13} aria-hidden />
            Change password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-2.5">
            <label className="sr-only" htmlFor="security-current-password">
              Current password
            </label>
            <input
              id="security-current-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClassName}
            />
            <label className="sr-only" htmlFor="security-new-password">
              New password
            </label>
            <input
              id="security-new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClassName}
            />
            <label className="sr-only" htmlFor="security-confirm-password">
              Confirm new password
            </label>
            <input
              id="security-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClassName}
            />
            <p className="text-xs text-text-muted flex items-start gap-1.5">
              <Info size={12} className="shrink-0 mt-px" />
              Changing your password signs you out of every other active session.
            </p>
            <Button type="submit" disabled={isChangingPassword} className="h-9 rounded-lg">
              {isChangingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" aria-hidden="true" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </section>

        <div className="h-px bg-border-main" />

        {/* Active sessions */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
            <Laptop size={13} aria-hidden />
            Active sessions
          </h3>

          {sessionsLoading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl border border-border-main bg-surface animate-pulse"
                />
              ))}
            </div>
          )}

          {!sessionsLoading && sessions.length === 0 && (
            <p className="text-xs text-text-muted">No active sessions found.</p>
          )}

          {!sessionsLoading && sessions.length > 0 && (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 bg-surface border border-border-main rounded-xl px-3.5 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {session.user_agent || "Unknown device"}
                      </p>
                      {session.current && (
                        <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-status-success/10 text-status-success border border-status-success/20">
                          <ShieldCheck size={10} aria-hidden />
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {session.ip_address ? `${session.ip_address} · ` : ""}
                      Last used {formatDashboardDate(session.last_used_at)}
                    </p>
                  </div>
                  {!session.current && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSessionToRevoke(session)}
                      disabled={revokingId === session.id}
                      title="Sign out this session"
                      className="shrink-0 h-9 w-9"
                    >
                      {revokingId === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DeleteConfirmationModal
        isOpen={sessionToRevoke !== null}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={handleConfirmRevoke}
        title="Sign out this session?"
        description="This device will be signed out immediately."
        itemName={sessionToRevoke?.user_agent || sessionToRevoke?.ip_address || ""}
        confirmLabel="Sign out"
        isLoading={sessionToRevoke !== null && revokingId === sessionToRevoke.id}
        layerClassName="z-[9100]"
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Info, Loader2, XCircle } from "lucide-react";
import { FaDiscord, FaSlack, FaTelegramPlane, FaWhatsapp } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import notify from "@/utils/notify";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";
import {
  telegramApi,
  type TelegramUserStatus,
} from "@/services/communications/telegramApi";

const LAYER = "z-[9100]";

const COMING_SOON_CHANNELS: {
  key: string;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "discord", label: "Discord", icon: <FaDiscord size={16} className="text-[#5865F2]" /> },
  { key: "slack", label: "Slack", icon: <FaSlack size={16} className="text-[#611f69] dark:text-[#e0a8e8]" /> },
  { key: "whatsapp", label: "WhatsApp", icon: <FaWhatsapp size={16} className="text-[#25D366]" /> },
];

const ID_GUIDE_STEPS = [
  "Open Telegram and search for @userinfobot.",
  "Start a chat with it and send any message (or tap Start).",
  "It replies with your account info — copy the numeric “Id” value.",
  "Paste that number below and press Save.",
];

export function CommunicationsTab({ isActive }: { isActive: boolean }) {
  const [status, setStatus] = useState<TelegramUserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idInput, setIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await telegramApi.status();
      setStatus(data);
      setIdInput(data.telegram_user_id ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load Telegram status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) fetchStatus();
  }, [isActive, fetchStatus]);

  const handleSave = async () => {
    const trimmed = idInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      notify.error(
        "Telegram user ID must be a number (e.g. 12499292). Get yours from @userinfobot.",
      );
      return;
    }
    setSaving(true);
    try {
      const data = await telegramApi.connect(trimmed);
      setStatus(data);
      setIdInput(data.telegram_user_id ?? trimmed);
      notify.success("Telegram account connected");
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const data = await telegramApi.disconnect();
      setStatus(data);
      setIdInput("");
      notify.success("Telegram account disconnected");
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-main bg-surface animate-pulse"
          >
            <div className="w-7 h-7 rounded-lg bg-surface-2 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-surface-2" />
              <div className="h-2.5 w-40 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="flex-1 flex items-center justify-center px-5 py-4">
        <div className="text-center space-y-2">
          <XCircle size={36} className="mx-auto text-status-error" />
          <p className="text-sm text-status-error">{error}</p>
          <button
            type="button"
            onClick={fetchStatus}
            className="text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const connected = Boolean(status?.connected);
  const telegramEnabled = Boolean(status?.enabled);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-main scrollbar-track-transparent px-5 pt-4 pb-4 space-y-4 min-h-0">
        <p className="text-xs text-text-muted flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-px" />
          Chat with Newton from your favourite messaging apps. Conversations stay in
          sync with GoTalk, with the same history and memory.
        </p>

        {/* ── Telegram ─────────────────────────────────────────────── */}
        <div className="bg-surface border border-border-main rounded-xl">
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-3">
            <div className="w-7 h-7 rounded-lg border border-border-main bg-surface-2 flex items-center justify-center shrink-0">
              <FaTelegramPlane size={15} className="text-[#229ED9]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">Telegram</div>
              {connected ? (
                <p className="text-2xs text-status-success flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={11} /> Connected
                  {status?.telegram_user_id && (
                    <span className="text-text-muted font-mono">
                      · ID {status.telegram_user_id}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-2xs text-text-muted mt-0.5">Not Connected</p>
              )}
            </div>
            {telegramEnabled && status?.deep_link && (
              <a
                href={status.deep_link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                title={`Open ${status.bot_username ? `@${status.bot_username}` : "the Newton bot"} in Telegram`}
              >
                <ExternalLink size={11} /> Open Telegram Bot
              </a>
            )}
          </div>

          <div className="border-t border-border-main px-3.5 py-3 space-y-3">
            {!telegramEnabled ? (
              <p className="text-xs text-text-muted">
                Telegram isn&apos;t enabled for this workspace yet. Ask your
                administrator to configure the Newton Telegram bot.
              </p>
            ) : (
              <>
                {status?.bot_username && (
                  <p className="text-xs text-text-muted">
                    This workspace&apos;s bot is{" "}
                    <span className="font-mono text-text-main">@{status.bot_username}</span>.
                    Connect your Telegram user ID below, then message the bot to chat
                    with Newton.
                  </p>
                )}

                <div>
                  <label
                    htmlFor="telegram-user-id"
                    className="block text-2xs font-mono uppercase tracking-widest text-text-muted mb-1"
                  >
                    Telegram user ID
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="telegram-user-id"
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 12499292"
                      value={idInput}
                      onChange={(e) => setIdInput(e.target.value)}
                      disabled={saving || disconnecting}
                      className={cn(
                        "flex-1 h-8 px-2.5 rounded-lg text-xs font-mono bg-surface-2 border border-border-main",
                        "focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-text-muted/60",
                        "disabled:opacity-50",
                      )}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      disabled={
                        saving ||
                        !idInput.trim() ||
                        idInput.trim() === (status?.telegram_user_id ?? "")
                      }
                      onClick={handleSave}
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                    </Button>
                    {connected && (
                      <button
                        type="button"
                        disabled={disconnecting}
                        onClick={() => setConfirmDisconnect(true)}
                        className="shrink-0 h-8 px-2.5 rounded-lg text-xs font-medium border border-status-error/40 text-status-error hover:bg-status-error/5 disabled:opacity-50 transition-colors"
                      >
                        {disconnecting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Disconnect"
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                  <p className="text-2xs font-mono uppercase tracking-widest text-text-muted mb-1.5">
                    How to find your Telegram user ID
                  </p>
                  <ol className="space-y-1">
                    {ID_GUIDE_STEPS.map((step, i) => (
                      <li key={step} className="text-xs text-text-muted flex gap-2">
                        <span className="text-text-main font-medium shrink-0">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="text-2xs text-text-muted mt-1.5">
                    We use your numeric ID (not your @username) because usernames can
                    change.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Coming soon ──────────────────────────────────────────── */}
        <div>
          <p className="text-xs text-text-muted mb-2 font-mono uppercase tracking-widest">
            More channels
          </p>
          <div className="space-y-2">
            {COMING_SOON_CHANNELS.map((channel) => (
              <div
                key={channel.key}
                className="flex items-center gap-3 bg-surface border border-border-main rounded-xl px-3.5 py-3 opacity-60"
                aria-disabled="true"
              >
                <div className="w-7 h-7 rounded-lg border border-border-main bg-surface-2 flex items-center justify-center shrink-0">
                  {channel.icon}
                </div>
                <div className="flex-1 min-w-0 text-xs font-medium">{channel.label}</div>
                <span className="shrink-0 h-6 px-2 inline-flex items-center rounded-full border border-border-main text-2xs font-medium text-text-muted bg-surface-2">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Telegram?"
        description="The Newton bot will stop responding to your Telegram messages until you connect again. Your GoTalk conversation history is kept."
        itemName={status?.telegram_user_id ? `ID ${status.telegram_user_id}` : undefined}
        confirmLabel="Disconnect"
        isLoading={disconnecting}
        layerClassName={LAYER}
      />
    </div>
  );
}

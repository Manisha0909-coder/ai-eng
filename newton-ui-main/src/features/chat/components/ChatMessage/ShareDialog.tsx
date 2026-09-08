import React, { useCallback, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  Link,
  Lock,
  Share2,
  X,
} from "lucide-react";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { getPublicOrigin } from "@/env";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import notify from "@/utils/notify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ShareDialogVariant = "full" | "simple";
type ShareVisibility = "private" | "public";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: ShareDialogVariant;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onOpenChange,
  variant = "full",
}) => {
  const [visibility, setVisibility] = useState<ShareVisibility>(
    variant === "simple" ? "public" : "private",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setVisibility(variant === "simple" ? "public" : "private");
      setLoading(false);
      setError(false);
      setCopied(false);
    }
  };

  const handleCreateAndCopy = useCallback(async () => {
    const { sessionId } = useStore.getState();
    if (!sessionId) {
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);
    setCopied(false);

    try {
      const response = await fetch(
        `${API_CONFIG.LOCAL_API_BASE_URL}/chat_share/create`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            session_id: sessionId,
            is_public: visibility === "public",
          }),
        },
      );

      if (!response.ok) {
        console.error("Failed to share chat:", await response.json().catch(() => null));
        setError(true);
        return;
      }

      const data = unwrapEnvelope<{ shareable_url?: string }>(
        await response.json(),
      );
      const path = data.shareable_url ?? "";
      if (!path) {
        setError(true);
        return;
      }

      const url = `${getPublicOrigin()}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify.success("Link copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to share chat:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [visibility]);

  const caption =
    visibility === "public"
      ? "Anyone with this link can view this chat."
      : "Only people in your organization can view this chat.";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-w-md w-[90%] gap-0 overflow-hidden rounded-2xl border border-border-main bg-surface p-0 text-text-main shadow-dialog",
          "[&>button]:hidden",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border-main px-5 py-3.5">
          <Share2 size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <DialogTitle className="flex-1 font-display text-sm font-semibold text-text-main">
            Share message
          </DialogTitle>
          <DialogDescription className="sr-only">
            Generate a shareable link for this chat session.
          </DialogDescription>
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {variant === "full" && (
            <div className="flex rounded-lg border border-border-main bg-surface-2/60 p-1">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                disabled={loading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  visibility === "private"
                    ? "bg-surface text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main",
                )}
              >
                <Lock size={12} aria-hidden="true" />
                Organisation
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                disabled={loading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  visibility === "public"
                    ? "bg-surface text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main",
                )}
              >
                <Eye size={12} aria-hidden="true" />
                Public
              </button>
            </div>
          )}

          <div>
            {error && (
              <p className="mb-2 text-xs text-status-error">
                Couldn&apos;t generate link. Check your connection and try again.
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleCreateAndCopy()}
              disabled={loading}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60",
                copied
                  ? "border-status-success/40 bg-status-success/5 text-status-success"
                  : "border-border-main bg-surface text-text-main hover:bg-surface-2",
              )}
            >
              {loading ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
                    aria-hidden="true"
                  />
                  Generating…
                </>
              ) : copied ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : (
                <>
                  {error ? <Copy size={14} /> : <Link size={14} />}
                  {error ? "Try again" : "Copy link"}
                </>
              )}
            </button>
            <p className="mt-2 text-2xs text-text-muted">{caption}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;

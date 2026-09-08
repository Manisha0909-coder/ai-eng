import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Trash2,
  Link,
  Copy,
  Check,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope, throwEnvelopeErrorFromResponse } from "@/services/api/envelope";
import { getPublicOrigin } from "@/env";
import { formatDashboardDate } from "@/utils/helper";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "@/features/dashboard/utils/dashboardRowActionStyles";

const PAGE_SIZE = 20;

interface SharedLink {
  id: string;
  chat_title: string;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
  shareable_url: string;
}

export function SharedLinksTab({ isActive }: { isActive: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [totalLinks, setTotalLinks] = useState(0);
  const [page, setPage] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<SharedLink | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    setSharedLinks([]);
    try {
      const base = API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "");
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const res = await fetch(`${base}/chat_share/all?${params}`, {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 500) return;
        await throwEnvelopeErrorFromResponse(res, {
          fallbackMessage: "Failed to load shared links",
        });
      }
      const data = unwrapEnvelope<{ shared_chats: SharedLink[]; total: number }>(
        await res.json(),
      );
      setSharedLinks(data.shared_chats ?? []);
      setTotalLinks(data.total ?? 0);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (isActive) fetchLinks();
  }, [isActive, fetchLinks]);

  const handleCopy = (link: SharedLink) => {
    navigator.clipboard.writeText(`${getPublicOrigin()}${link.shareable_url}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!linkToDelete) return;

    setDeletingId(linkToDelete.id);
    try {
      const base = API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "");
      await fetch(`${base}/chat_share/${linkToDelete.id}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
        credentials: "include",
      });
      setSharedLinks((prev) => prev.filter((l) => l.id !== linkToDelete.id));
      setTotalLinks((prev) => {
        const nextTotal = Math.max(0, prev - 1);
        const maxPage = Math.max(0, Math.ceil(nextTotal / PAGE_SIZE) - 1);
        if (page > maxPage) setPage(maxPage);
        return nextTotal;
      });
      setLinkToDelete(null);
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(totalLinks / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        className={cn(
          "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-main scrollbar-track-transparent px-5 py-4 space-y-3 min-h-0",
          (totalPages <= 1 || isLoading) && "pb-4",
        )}
      >
      <p className="text-xs text-text-muted flex items-start gap-1.5">
        <Info size={12} className="shrink-0 mt-px" />
        Share new links from the chat via the Share button. This panel manages
        your existing shared links.
      </p>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border-main bg-surface animate-pulse"
            >
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-44 rounded bg-surface-2" />
                  <div className="h-4 w-14 rounded-full bg-surface-2" />
                </div>
                <div className="h-2.5 w-24 rounded bg-surface-2" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-9 w-9 rounded-lg bg-surface-2" />
                <div className="h-9 w-9 rounded-lg bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && totalLinks === 0 && (
        <div className="flex flex-col items-center text-center gap-2.5 py-10">
          <div className="w-11 h-11 rounded-xl bg-surface-2 flex items-center justify-center">
            <Link size={20} className="text-text-muted" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium mb-0.5">No shared links yet</p>
            <p className="text-xs text-text-muted">
              Use the Share button in any chat to create a shareable link.
            </p>
          </div>
        </div>
      )}

      {sharedLinks.length > 0 && (
        <div className="space-y-2">
          {sharedLinks.map((link) => (
            <div
              key={link.id}
              className={cn(
                "group flex items-center gap-3 bg-surface border border-border-main rounded-xl px-3.5 py-3 hover:border-primary/20 transition-all",
                deletingId === link.id && "opacity-60",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-xs font-medium truncate">{link.chat_title}</p>
                  {link.is_public ? (
                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-status-success/10 text-status-success border border-status-success/20">
                      Public
                    </span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-surface-2 text-text-muted border border-border-main">
                      Organisation
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Shared {formatDashboardDate(link.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(link)}
                  disabled={deletingId === link.id}
                  className={cn(
                    dashboardRowEditIconButtonClass,
                    copiedId === link.id &&
                      "border-status-success/40 text-status-success hover:bg-status-success/10 hover:text-status-success",
                  )}
                  title={copiedId === link.id ? "Copied!" : "Copy link"}
                >
                  {copiedId === link.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLinkToDelete(link)}
                  disabled={deletingId === link.id}
                  className={dashboardRowDeleteIconButtonClass}
                  title="Delete shared link"
                >
                  {deletingId === link.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between px-5 pb-4 pt-1 shrink-0">
          <span className="text-xs text-text-muted">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalLinks)} of{" "}
            {totalLinks}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-text-muted px-1">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={linkToDelete !== null}
        onClose={() => setLinkToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete shared link?"
        description="This action cannot be undone."
        itemName={linkToDelete?.chat_title}
        isLoading={linkToDelete !== null && deletingId === linkToDelete.id}
        layerClassName="z-[9100]"
      />
    </div>
  );
}

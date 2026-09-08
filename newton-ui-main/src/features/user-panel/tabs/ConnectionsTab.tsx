import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { connectionsApi } from "@/services/connections/connectionsApi";
import type {
  CatalogConnection,
  Connection,
  ConnectionCatalogItem,
} from "@/services/connections/types";
import {
  consumeConnectionsOAuthResult,
  markConnectionsOAuthReturn,
} from "@/features/auth/connectionsOAuthReturn";
import notify from "@/utils/notify";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";
import { ConnectionDetailsDialog } from "./connections/ConnectionDetailsDialog";
import {
  AUTH_MODE_LABEL,
  ConnectionStatusInline,
  isAuthorizeStatus,
  isOAuthUserFlow,
  logoOnWhiteBackground,
  notifyTestResult,
  providerDisplayName,
  providerLogo,
} from "./connections/connectionUi";

const LAYER = "z-[9100]";
const PAGE_SIZE = 20;

function toCatalogConnection(connection: Connection): CatalogConnection {
  return {
    id: connection.id,
    provider_key: connection.provider_key,
    status: connection.status,
    display_name: connection.display_name,
    last_error: connection.last_error,
    expires_at: connection.expires_at,
    last_refreshed_at: connection.last_refreshed_at,
  };
}

export function ConnectionsTab({ isActive }: { isActive: boolean }) {
  const [items, setItems] = useState<ConnectionCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogConnection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await connectionsApi.catalog();
      setItems(data.items ?? []);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load connections";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) fetchCatalog();
  }, [isActive, fetchCatalog]);

  useEffect(() => {
    if (!isActive) return;
    const handler = () => fetchCatalog();
    window.addEventListener("newton:connections-refresh", handler);
    return () => window.removeEventListener("newton:connections-refresh", handler);
  }, [isActive, fetchCatalog]);

  useEffect(() => {
    if (!isActive) return;

    const result = consumeConnectionsOAuthResult();
    if (!result) return;

    const label = result.provider
      ? providerDisplayName(result.provider)
      : "Connection";

    if (result.status === "active") {
      notify.success(`${label} is connected`);
    } else {
      const detail =
        result.message?.replace(/_/g, " ") ||
        "Connection could not be completed. Please try again.";
      notify.error(`${label} failed: ${detail}`);
    }

    fetchCatalog();
  }, [isActive, fetchCatalog]);

  const visibleItems = items;

  const totalItems = visibleItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const pagedItems = useMemo(
    () => visibleItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [visibleItems, page],
  );

  const detailsItem = useMemo(
    () => items.find((item) => item.connection?.id === detailsId) ?? null,
    [items, detailsId],
  );

  const upsertConnection = useCallback((connection: Connection) => {
    setItems((prev) =>
      prev.map((item) =>
        item.provider_key === connection.provider_key
          ? { ...item, connection: toCatalogConnection(connection) }
          : item,
      ),
    );
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.connection?.id === connectionId
          ? { ...item, connection: null }
          : item,
      ),
    );
  }, []);

  const startAuthorize = async (
    connection: CatalogConnection,
    providerKey: string,
  ) => {
    const auth = await connectionsApi.authorize(connection.id);
    if (!auth.authorization_url) {
      throw new Error("Authorization URL was not returned");
    }
    markConnectionsOAuthReturn(connection.id, providerKey);
    window.location.assign(auth.authorization_url);
  };

  const handleQuickConnect = async (item: ConnectionCatalogItem) => {
    if (!item.is_connectable) return;

    setBusyProvider(item.provider_key);
    try {
      let connection = item.connection;

      if (!connection) {
        try {
          const created = await connectionsApi.create({
            provider_key: item.provider_key,
          });
          connection = toCatalogConnection(created.connection);
          upsertConnection(created.connection);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "";
          if (/already exists|409/i.test(message)) {
            const data = await connectionsApi.catalog();
            setItems(data.items ?? []);
            connection =
              (data.items ?? []).find(
                (row) => row.provider_key === item.provider_key,
              )?.connection ?? null;
            if (!connection) throw e;
          } else {
            throw e;
          }
        }
      }

      // `api_key` providers have no authorize redirect — the write above
      // either activates the connection immediately (a system-level key is
      // stored) or fails, so there is nothing further to do here.
      if (
        connection &&
        isOAuthUserFlow(item.auth_mode) &&
        isAuthorizeStatus(connection.status)
      ) {
        await startAuthorize(connection, item.provider_key);
        return;
      }

      if (connection?.status === "active") {
        notify.success(
          `${providerDisplayName(item.provider_key, item.display_name)} is connected`,
        );
      }
    } catch (e: unknown) {
      const err = e as Error & { envelopeToasted?: boolean };
      if (!err.envelopeToasted) notify.error(err);
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (connection: CatalogConnection) => {
    setDeleting(true);
    setBusyProvider(connection.provider_key);
    try {
      await connectionsApi.delete(connection.id);
      await fetchCatalog();
      notify.success(`${providerDisplayName(connection.provider_key)} disconnected`);
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setBusyProvider(null);
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleTest = async (connection: CatalogConnection) => {
    setTestingId(connection.id);
    try {
      const result = await connectionsApi.test(connection.id);
      const refreshed = await connectionsApi.get(connection.id);
      upsertConnection(refreshed.connection);
      notifyTestResult(result);
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setTestingId(null);
    }
  };

  if (loading && items.length === 0) {
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
            <div className="h-7 w-20 rounded-lg bg-surface-2 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-5 py-4">
        <div className="text-center space-y-2">
          <XCircle size={36} className="mx-auto text-status-error" />
          <p className="text-sm text-status-error">{error}</p>
          <button
            type="button"
            onClick={fetchCatalog}
            className="text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-main scrollbar-track-transparent px-5 pt-4 pb-3 space-y-4 min-h-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-text-muted flex items-start gap-1.5 flex-1">
            <Info size={12} className="shrink-0 mt-px" />
            Manage your integrations and reconnect them when authorization needs
            attention.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={loading}
              onClick={fetchCatalog}
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-muted mb-2 font-mono uppercase tracking-widest">
            Your connections ({totalItems})
          </p>
          <div className="space-y-2">
            {pagedItems.map((item) => {
              const connection = item.connection;
              const busy = busyProvider === item.provider_key;

              if (!connection) {
                return (
                  <div
                    key={item.provider_key}
                    className="flex items-center gap-3 bg-surface border border-border-main rounded-xl px-3.5 py-3"
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg border border-border-main flex items-center justify-center shrink-0",
                        logoOnWhiteBackground(item.provider_key)
                          ? "bg-white"
                          : "bg-surface-2",
                      )}
                    >
                      {providerLogo(item.provider_key)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {providerDisplayName(item.provider_key, item.display_name)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!item.is_connectable || busy}
                      onClick={() => handleQuickConnect(item)}
                      className={cn(
                        "shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "border-primary/40 text-primary hover:bg-primary/5",
                      )}
                    >
                      {busy ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <>
                          <LogIn size={11} /> Connect
                        </>
                      )}
                    </button>
                  </div>
                );
              }

              const canReconnect =
                item.is_connectable &&
                isOAuthUserFlow(item.auth_mode) &&
                isAuthorizeStatus(connection.status);

              return (
                <div
                  key={connection.id}
                  className="flex items-center gap-3 bg-surface border border-border-main rounded-xl px-3.5 py-3"
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg border border-border-main flex items-center justify-center shrink-0",
                      logoOnWhiteBackground(item.provider_key)
                        ? "bg-white"
                        : "bg-surface-2",
                    )}
                  >
                    {providerLogo(item.provider_key)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {providerDisplayName(item.provider_key, item.display_name)}
                    </div>
                    <ConnectionStatusInline
                      status={connection.status}
                      displayName={connection.display_name}
                    />
                    <p className="text-2xs text-text-muted font-mono mt-0.5">
                      {AUTH_MODE_LABEL[item.auth_mode]}
                    </p>
                    {connection.last_error && connection.status === "error" && (
                      <p className="text-xs text-status-error mt-1 truncate">
                        {connection.last_error}
                      </p>
                    )}
                    {!item.is_connectable && (
                      <p className="text-xs text-text-muted mt-1">
                        This provider is no longer connectable, but you can still
                        review or delete the saved connection.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDetailsId(connection.id)}
                      title="View details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={busy || testingId === connection.id}
                      onClick={() => handleTest(connection)}
                      title="Test connection — re-checks consent by forcing a token refresh"
                    >
                      {testingId === connection.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {canReconnect && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleQuickConnect(item)}
                        className="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-primary/40 text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <>
                            <LogIn size={11} />
                            {connection.status === "needs_reauth"
                              ? "Reconnect"
                              : "Authorize"}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleteTarget(connection)}
                      className="shrink-0 flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium border border-status-error/40 text-status-error hover:bg-status-error/5 disabled:opacity-50"
                      title="Delete connection"
                    >
                      {busy ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <LogOut size={11} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {totalItems === 0 && (
              <div className="px-4 py-8 text-center text-xs text-text-muted border border-border-main rounded-xl">
                No integrations available.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 shrink-0 border-t border-border-main">
        <span className="text-xs text-text-muted">
          {totalItems === 0
            ? "0 of 0"
            : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, totalItems)} of ${totalItems}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || totalPages <= 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs text-text-muted px-1 tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || totalPages <= 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <ConnectionDetailsDialog
        connectionId={detailsId}
        open={detailsId !== null}
        onClose={() => setDetailsId(null)}
        authMode={detailsItem?.auth_mode ?? null}
        isConnectable={detailsItem?.is_connectable ?? true}
        onUpdated={upsertConnection}
        onDeleted={async (id) => {
          removeConnection(id);
          setDetailsId(null);
          await fetchCatalog();
        }}
      />

      <DeleteConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          return handleDisconnect(deleteTarget);
        }}
        title="Delete connection?"
        description="This removes stored credentials for this integration."
        itemName={
          deleteTarget
            ? providerDisplayName(deleteTarget.provider_key)
            : undefined
        }
        confirmLabel="Delete"
        isLoading={deleting}
        layerClassName={LAYER}
      />
    </div>
  );
}

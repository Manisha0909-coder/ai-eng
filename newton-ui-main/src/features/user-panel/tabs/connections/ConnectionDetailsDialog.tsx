import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  HelpCircle,
  Loader2,
  LogIn,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { connectionsApi } from "@/services/connections/connectionsApi";
import type {
  Connection,
  TestConnectionResponse,
} from "@/services/connections/types";
import { markConnectionsOAuthReturn } from "@/features/auth/connectionsOAuthReturn";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";
import { formatDashboardDate } from "@/utils/helper";
import notify from "@/utils/notify";
import { cn } from "@/lib/utils";
import {
  AUTH_MODE_LABEL,
  ConnectionStatusInline,
  isAuthorizeStatus,
  isOAuthUserFlow,
  notifyTestResult,
  providerDisplayName,
} from "./connectionUi";

const LAYER = "z-[9100]";

interface ConnectionDetailsDialogProps {
  connectionId: string | null;
  open: boolean;
  onClose: () => void;
  authMode?: string | null;
  isConnectable?: boolean;
  onUpdated: (connection: Connection) => void;
  onDeleted: (connectionId: string) => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
      <span className="text-text-muted font-mono uppercase tracking-wide">{label}</span>
      <span className="text-text-main break-all">{value}</span>
    </div>
  );
}

/**
 * The outcome of the last test, in three states.
 *
 * `verified: null` is not a failure and not a success — the test forces an
 * OAuth refresh, and there are connections where that question cannot be
 * asked at all. It keeps the neutral treatment and shows the server's reason.
 */
function TestResultRow({ result }: { result: TestConnectionResponse }) {
  const verified = result.verified;
  const Icon =
    verified === true ? CheckCircle2 : verified === false ? XCircle : HelpCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs",
        verified === true
          ? "border-status-success/30 bg-status-success/5 text-status-success"
          : verified === false
            ? "border-status-error/30 bg-status-error/5 text-status-error"
            : "border-border-main bg-surface-2/50 text-text-muted",
      )}
    >
      <Icon size={12} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">
        <span className="font-medium">
          {verified === true
            ? "Verified"
            : verified === false
              ? "Not verified"
              : "Can't verify"}
        </span>
        {" · "}
        {(verified === false ? result.last_error : null) ?? result.message}
      </span>
    </div>
  );
}

export function ConnectionDetailsDialog({
  connectionId,
  open,
  onClose,
  authMode,
  isConnectable = true,
  onUpdated,
  onDeleted,
}: ConnectionDetailsDialogProps) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const data = await connectionsApi.get(connectionId);
      setConnection(data.connection);
    } catch (e: unknown) {
      notify.error(e);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [connectionId, onClose]);

  useEffect(() => {
    if (open && connectionId) {
      fetchConnection();
    } else {
      setConnection(null);
      setTestResult(null);
    }
  }, [open, connectionId, fetchConnection]);

  const handleTest = async () => {
    if (!connection) return;
    setTesting(true);
    try {
      const result = await connectionsApi.test(connection.id);
      const refreshed = await connectionsApi.get(connection.id);
      setConnection(refreshed.connection);
      onUpdated(refreshed.connection);
      setTestResult(result);
      notifyTestResult(result);
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setTesting(false);
    }
  };

  const handleAuthorize = async () => {
    if (!connection) return;
    setAuthorizing(true);
    try {
      const auth = await connectionsApi.authorize(connection.id);
      if (!auth.authorization_url) {
        throw new Error("Authorization URL was not returned");
      }
      markConnectionsOAuthReturn(connection.id, connection.provider_key);
      window.location.assign(auth.authorization_url);
    } catch (e: unknown) {
      const err = e as Error & { envelopeToasted?: boolean };
      if (!err.envelopeToasted) notify.error(err);
      setAuthorizing(false);
    }
  };

  const handleDelete = async () => {
    if (!connection) return;
    setDeleting(true);
    try {
      await connectionsApi.delete(connection.id);
      onDeleted(connection.id);
      setConfirmDelete(false);
      onClose();
      notify.success(
        `${providerDisplayName(connection.provider_key)} disconnected`,
      );
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const mode = authMode as keyof typeof AUTH_MODE_LABEL | null | undefined;
  const canAuthorize =
    connection &&
    isConnectable &&
    isOAuthUserFlow(mode ?? null) &&
    isAuthorizeStatus(connection.status);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogPortal>
          <DialogOverlay className={LAYER} />
          <DialogPrimitive.Content
            className={cn(
              LAYER,
              "fixed left-[50%] top-[50%] w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%]",
              "bg-surface border border-border-main rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[min(85vh,640px)]",
            )}
          >
            <div className="spectrum-rule shrink-0" />
            <div className="px-5 pt-4 pb-3 border-b border-border-main shrink-0">
              <DialogPrimitive.Title className="font-display font-semibold text-base">
                Connection details
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-text-muted mt-0.5">
                {connection
                  ? providerDisplayName(connection.provider_key)
                  : "Loading connection…"}
              </DialogPrimitive.Description>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {loading || !connection ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                </div>
              ) : (
                <>
                  <ConnectionStatusInline
                    status={connection.status}
                    displayName={connection.display_name}
                  />

                  {testResult && <TestResultRow result={testResult} />}

                  <div className="space-y-2.5 rounded-xl border border-border-main bg-surface-2/50 p-3">
                    <DetailRow label="ID" value={connection.id} />
                    <DetailRow label="Provider" value={connection.provider_key} />
                    {mode && (
                      <DetailRow label="Auth" value={AUTH_MODE_LABEL[mode]} />
                    )}
                    <DetailRow
                      label="Owner"
                      value={`${connection.owner_scope}:${connection.owner_id}`}
                    />
                    <DetailRow
                      label="Created"
                      value={formatDashboardDate(connection.created_at)}
                    />
                    <DetailRow
                      label="Updated"
                      value={formatDashboardDate(connection.updated_at)}
                    />
                    {connection.expires_at && (
                      <DetailRow
                        label="Expires"
                        value={formatDashboardDate(connection.expires_at)}
                      />
                    )}
                    {connection.last_refreshed_at && (
                      <DetailRow
                        label="Refreshed"
                        value={formatDashboardDate(connection.last_refreshed_at)}
                      />
                    )}
                    {connection.last_error && (
                      <DetailRow
                        label="Error"
                        value={
                          <span className="text-status-error">{connection.last_error}</span>
                        }
                      />
                    )}
                  </div>

                  {Object.keys(connection.conn_metadata ?? {}).length > 0 && (
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5">
                        Metadata
                      </p>
                      <pre className="text-xs font-mono bg-surface-2 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(connection.conn_metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>

            {connection && (
              <div className="px-5 py-4 border-t border-border-main flex flex-wrap gap-2 justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing || authorizing || deleting}
                  onClick={fetchConnection}
                  className="h-8"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing || authorizing || deleting}
                  onClick={handleTest}
                  className="h-8"
                  title="Re-checks consent by forcing a token refresh"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Test
                </Button>
                {canAuthorize && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={testing || authorizing || deleting}
                    onClick={handleAuthorize}
                    className="h-8"
                  >
                    {authorizing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <LogIn className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {connection.status === "needs_reauth" ? "Reconnect" : "Authorize"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing || authorizing || deleting}
                  onClick={() => setConfirmDelete(true)}
                  className="h-8 border-status-error/40 text-status-error hover:bg-status-error/5"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8">
                  Close
                </Button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <DeleteConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete connection?"
        description="This removes stored credentials for this integration."
        itemName={
          connection
            ? providerDisplayName(connection.provider_key)
            : undefined
        }
        confirmLabel="Delete"
        isLoading={deleting}
        layerClassName={LAYER}
      />
    </>
  );
}

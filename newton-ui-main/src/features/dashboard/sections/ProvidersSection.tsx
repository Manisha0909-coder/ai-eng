import { useCallback, useEffect, useMemo, useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { DashboardPill } from "../components/DashboardPill";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorRetry } from "../components/ErrorRetry";
import { ProviderAvatar, ProviderSidebar } from "../components/ProviderSidebar";
import { ProviderForm } from "../components/ProviderForm";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { providersApi } from "@/services/connections/providersApi";
import {
  AUTH_MODE_LABEL,
  isOAuthMode,
  type ProviderDetail,
  type ProviderSummary,
} from "@/services/connections/types";
import notify from "@/utils/notify";
import { cn } from "@/lib/utils";
import { Plus, RefreshCw, SquarePen, Trash2 } from "lucide-react";

export interface ProvidersSectionProps {
  isAdmin: boolean;
  isMobile: boolean;
  activeTab?: string;
}

export const ProvidersSection = ({
  isAdmin,
  activeTab,
}: Readonly<ProvidersSectionProps>) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One form for both create and edit: `null` key creates, a key edits.
  const [formOpen, setFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailProvider, setDetailProvider] = useState<ProviderDetail | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProviderSummary | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchProviders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await providersApi.list();
      setProviders(data.providers ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load providers");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "providers") fetchProviders();
  }, [activeTab, fetchProviders]);

  const openCreate = useCallback(() => {
    setEditingKey(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((key: string) => {
    setDetailsOpen(false);
    setEditingKey(key);
    setFormOpen(true);
  }, []);

  const openDetails = useCallback(async (summary: ProviderSummary) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const data = await providersApi.get(summary.key);
      setDetailProvider(data.provider);
    } catch (e: unknown) {
      notify.error(e);
      setDetailsOpen(false);
      setDetailProvider(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const openDeleteDialog = useCallback((summary: ProviderSummary) => {
    setDeleteTarget(summary);
    setDeleteOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await providersApi.remove(deleteTarget.key);
      notify.success("Provider deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await fetchProviders(true);
    } catch (e: unknown) {
      notify.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ColumnConfig<ProviderSummary>[] = useMemo(
    () => [
      {
        key: "key",
        header: "Key",
        type: "text",
        width: 140,
        render: (_, row) => (
          <DashboardPill intent="entity" label={row.key} mono truncate className="max-w-[140px]" />
        ),
      },
      {
        key: "display_name",
        header: "Display name",
        type: "text",
        width: 220,
        render: (_, row) => (
          <div className="flex min-w-0 items-center gap-3 py-1">
            <ProviderAvatar providerKey={row.key} displayName={row.display_name} size="sm" />
            <span className="truncate text-sm font-semibold text-text-main">
              {row.display_name}
            </span>
          </div>
        ),
      },
      {
        key: "auth_mode",
        header: "Auth mode",
        type: "custom",
        width: 120,
        render: (_, row) => (
          <DashboardPill intent="entity" label={AUTH_MODE_LABEL[row.auth_mode]} mono />
        ),
      },
      {
        key: "is_enabled",
        header: "Status",
        type: "custom",
        width: 120,
        render: (_, row) => (
          <StatusBadge
            status={row.is_enabled ? "success" : "neutral"}
            label={row.is_enabled ? "Enabled" : "Disabled"}
          />
        ),
      },
      {
        key: "has_credentials",
        header: "Credentials",
        type: "custom",
        width: 120,
        render: (_, row) => {
          if (!isOAuthMode(row.auth_mode)) {
            return <span className="text-sm text-text-muted">—</span>;
          }
          if (row.has_credentials) {
            return <StatusBadge status="success" label="Configured" />;
          }
          // The follow-up affordance for a provider created without credentials.
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isAdmin) openEdit(row.key);
              }}
              disabled={!isAdmin}
              title="Finish setup — add client ID and secret"
              className="disabled:cursor-not-allowed"
            >
              <StatusBadge status="warning" label="Not set" />
            </button>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        width: 120,
        render: (_, row) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.key);
              }}
              className={dashboardRowEditIconButtonClass}
              title="Edit provider"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={(e) => {
                e.stopPropagation();
                openDeleteDialog(row);
              }}
              className={dashboardRowDeleteIconButtonClass}
              title="Delete provider"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [isAdmin, openEdit, openDeleteDialog],
  );

  return (
    <>
      <TabsContent
        value="providers"
        className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
      >
        <Card className={cn("relative", dashboardTabCardClassName)}>
          <DashboardTabCardChrome />
          <DashboardTabHeader
            title="Provider Catalog"
            description="Configure OAuth client credentials and provider settings"
            titleColumnClassName="text-left pb-2 sm:pb-0"
            descriptionClassName="mb-0"
            actions={
              <DashboardTabToolbar
                primary={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openCreate}
                    disabled={!isAdmin}
                    className="h-10 max-lg:px-2 shrink-0"
                    title={!isAdmin ? "Admin privileges required" : "Add provider"}
                  >
                    <Plus className="h-4 w-4 lg:mr-1" />
                    <span
                      className={`text-xs sm:text-sm ${dashboardTabToolbarButtonLabelClassName}`}
                    >
                      Add provider
                      {!isAdmin && <span className="ml-1 text-xs">(Admin Only)</span>}
                    </span>
                  </Button>
                }
                refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0"
                    onClick={() => fetchProviders()}
                    disabled={loading}
                    title="Refresh providers"
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                }
              />
            }
          />

          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0">
            {error ? (
              <ErrorRetry error={error} onRetry={fetchProviders} />
            ) : (
              <DataTable
                columns={columns}
                data={providers}
                isLoading={loading}
                {...dashboardTableLoadingProps}
                enableGlobalSearch={false}
                enableFilters={false}
                getRowId={(row) => row.key}
                onRowClick={(row) => openDetails(row)}
                emptyMessage="No providers found. Add one above, or check that the middleware's YAML catalog was seeded."
                className={dashboardAdminTableClassName}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <ProviderForm
        open={formOpen}
        editingKey={editingKey}
        onOpenChange={setFormOpen}
        onSaved={() => fetchProviders(true)}
      />

      <ProviderSidebar
        provider={detailsOpen ? detailProvider : null}
        open={detailsOpen}
        loading={detailsLoading && detailsOpen}
        providers={providers}
        canConfigure={isAdmin}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailProvider(null);
        }}
        onNavigate={(summary) => {
          void openDetails(summary);
        }}
        onConfigure={(provider) => openEdit(provider.key)}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="bg-surface border-border-main">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-main flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete provider
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-main">
              Permanently delete <strong>{deleteTarget?.display_name}</strong>. This fails if any
              connections still reference it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface hover:bg-background">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Working…" : "Delete provider"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

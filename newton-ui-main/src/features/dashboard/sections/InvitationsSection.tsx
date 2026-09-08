import { useState, useCallback, useEffect, useMemo } from "react";
import { Ban, Copy, Check, RefreshCw, Plus, TriangleAlert } from "lucide-react";
import notify from "@/utils/notify";
import { DashboardPill } from "../components/DashboardPill";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { dashboardRowDeleteIconButtonClass } from "../utils/dashboardRowActionStyles";
import {
  authErrorMessage,
  createInvitation,
  listInvitations,
  revokeInvitation,
  type Invitation,
} from "@/services/auth/authApi";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { ErrorRetry } from "../components/ErrorRetry";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabSearchableSelect,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
} from "../components/DashboardTabFilterUi";
import { InvitationForm, type InvitationFormValues } from "../components/Forms/InvitationForm";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { AdminFormDialog } from "../components/Forms/AdminFormDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";
import { cn } from "@/lib/utils";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import { formatExactDate } from "../utils/dashboardHelper";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";

/** Invitations list page size (matches GET /auth/invitations). */
const INVITATIONS_LIST_PAGE_SIZE = 20;

const KIND_LABEL: Record<Invitation["kind"], string> = {
  invite: "Invite",
  password_reset: "Password reset",
};

const STATUS_PILL_CONFIG: Record<
  Invitation["status"],
  { label: string; status: "success" | "error" | "warning" | "pending" }
> = {
  pending: { label: "Pending", status: "pending" },
  redeemed: { label: "Redeemed", status: "success" },
  revoked: { label: "Revoked", status: "error" },
  expired: { label: "Expired", status: "warning" },
};

export interface InvitationsSectionProps {
  isUserAdmin: boolean;
  isSuperAdmin: boolean;
  activeTab: string;
}

export const InvitationsSection = ({
  isUserAdmin,
  isSuperAdmin,
  activeTab,
}: Readonly<InvitationsSectionProps>) => {
  const canAccess = isUserAdmin || isSuperAdmin;

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, DASHBOARD_SEARCH_DEBOUNCE_MS);
  /** `invite` | `password_reset` — empty = all */
  const [kindFilter, setKindFilter] = useState<string>("");
  const [invitationPage, setInvitationPage] = useState(1);
  const [invitationTotal, setInvitationTotal] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [createdInvitation, setCreatedInvitation] = useState<{
    invitation: Invitation;
    link: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [invitationToRevoke, setInvitationToRevoke] = useState<Invitation | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const hasActiveFilters = searchTerm.trim().length > 0 || kindFilter.trim().length > 0;

  const clearAllFilters = () => {
    setSearchTerm("");
    setKindFilter("");
  };

  const fetchInvitations = useCallback(
    async (showSuccessToast = false) => {
      if (!canAccess || activeTab !== "invitations") return;

      setInvitationsLoading(true);
      setInvitationsError(null);
      try {
        const offset = (invitationPage - 1) * INVITATIONS_LIST_PAGE_SIZE;
        const response = await listInvitations({
          limit: INVITATIONS_LIST_PAGE_SIZE,
          offset,
          kind: kindFilter.trim() || undefined,
          email: debouncedSearchTerm.trim() || undefined,
        });
        setInvitations(response.invitations || []);
        setInvitationTotal(response.total || 0);

        if (showSuccessToast) {
          notify.success("Invitations refreshed successfully");
        }
      } catch (error: unknown) {
        console.error("Error fetching invitations:", error);
        const errorMessage = authErrorMessage(error, "Failed to fetch invitations. Please try again.");
        setInvitationsError(errorMessage);
        notify.error(error, errorMessage);
      } finally {
        setInvitationsLoading(false);
      }
    },
    [canAccess, activeTab, invitationPage, debouncedSearchTerm, kindFilter],
  );

  useEffect(() => {
    if (activeTab === "invitations" && canAccess) {
      fetchInvitations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canAccess, invitationPage, debouncedSearchTerm, kindFilter]);

  useEffect(() => {
    setInvitationPage(1);
  }, [debouncedSearchTerm, kindFilter]);

  const handleCreateInvitation = async (values: InvitationFormValues) => {
    setFormLoading(true);
    try {
      const created = await createInvitation(values);
      setIsFormOpen(false);
      setCreatedInvitation({ invitation: created.invitation, link: created.link });
      setLinkCopied(false);
      setInvitationPage(1);
      await fetchInvitations();
    } catch (error) {
      console.error("Error creating invitation:", error);
      notify.error(error, authErrorMessage(error, "Failed to create invitation."));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  const handleCopyLink = useCallback(() => {
    if (!createdInvitation) return;
    navigator.clipboard
      .writeText(createdInvitation.link)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => notify.error("Couldn't copy the link. Please copy it manually."));
  }, [createdInvitation]);

  const handleRevokeClick = useCallback((invitation: Invitation) => {
    setInvitationToRevoke(invitation);
    setIsRevokeDialogOpen(true);
  }, []);

  const handleConfirmRevoke = async () => {
    if (!invitationToRevoke) return;
    setRevokeLoading(true);
    try {
      await revokeInvitation(invitationToRevoke.id);
      notify.success("Invitation revoked");
      await fetchInvitations();
      setIsRevokeDialogOpen(false);
      setInvitationToRevoke(null);
    } catch (error) {
      console.error("Error revoking invitation:", error);
      notify.error(error, authErrorMessage(error, "Failed to revoke invitation."));
    } finally {
      setRevokeLoading(false);
    }
  };

  const columns: ColumnConfig<Invitation>[] = useMemo(
    () => [
      {
        key: "email",
        header: "EMAIL",
        type: "custom",
        width: 240,
        align: "left",
        render: (_value, row) => (
          <span className="block truncate font-medium text-text-main">{row.email}</span>
        ),
      },
      {
        key: "kind",
        header: "TYPE",
        type: "custom",
        width: 140,
        align: "left",
        render: (_value, row) => (
          <span className="text-sm text-text-muted">{KIND_LABEL[row.kind]}</span>
        ),
      },
      {
        key: "status",
        header: "STATUS",
        type: "custom",
        width: 120,
        align: "left",
        render: (_value, row) => {
          const cfg = STATUS_PILL_CONFIG[row.status];
          return <DashboardPill intent="status" status={cfg.status} label={cfg.label} />;
        },
      },
      {
        key: "invited_by",
        header: "INVITED BY",
        type: "custom",
        width: 200,
        align: "left",
        render: (_value, row) => (
          <span className="block truncate text-sm text-text-muted">{row.invited_by || "—"}</span>
        ),
      },
      {
        key: "created_at",
        header: "CREATED / EXPIRES",
        type: "custom",
        width: 180,
        align: "left",
        render: (_value, row) => (
          <div className="text-sm text-text-muted">
            <div>{formatExactDate(row.created_at)}</div>
            <div className="text-xs">
              {row.status === "pending" ? `Expires ${formatExactDate(row.expires_at)}` : " "}
            </div>
          </div>
        ),
      },
      {
        key: "actions",
        header: "ACTIONS",
        type: "custom",
        width: 100,
        align: "left",
        render: (_value, row) => (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {row.status === "pending" ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRevokeClick(row);
                }}
                className={dashboardRowDeleteIconButtonClass}
                title="Revoke invitation"
              >
                <Ban className="h-4 w-4" />
              </Button>
            ) : (
              <span className="text-xs text-text-muted">—</span>
            )}
          </div>
        ),
      },
    ],
    [handleRevokeClick],
  );

  if (!canAccess) {
    return (
      <TabsContent value="invitations" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need User Admin privileges to access this section.
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="invitations" className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Invitations"
          description="Invite new accounts or send password reset links"
          titleRowEnd={
            <Button
              className="flex md:hidden lg:hidden p-1"
              variant="outline"
              size="sm"
              disabled={invitationsLoading}
              onClick={() => setIsFormOpen(true)}
            >
              <span className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                New invitation
              </span>
            </Button>
          }
          actions={
            <DashboardTabToolbar
              primary={
                <>
                  <DashboardTabSearchInput
                    placeholder="Search by email"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <DashboardTabFiltersPopover
                    filterCount={kindFilter ? 1 : 0}
                    onClear={() => setKindFilter("")}
                    align="end"
                    triggerClassName="shrink-0"
                  >
                    <DashboardTabSearchableSelect
                      label="Type"
                      options={[
                        { label: "All types", value: "" },
                        { label: "Invite", value: "invite" },
                        { label: "Password reset", value: "password_reset" },
                      ]}
                      value={kindFilter}
                      onValueChange={setKindFilter}
                      placeholder="Search types..."
                    />
                  </DashboardTabFiltersPopover>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 max-lg:px-2 hidden sm:flex shrink-0"
                    onClick={() => setIsFormOpen(true)}
                    disabled={invitationsLoading}
                    title="New invitation"
                  >
                    <Plus className="h-4 w-4 lg:mr-1" />
                    <span className={dashboardTabToolbarButtonLabelClassName}>New invitation</span>
                  </Button>
                </>
              }
              refresh={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => fetchInvitations(true)}
                  disabled={invitationsLoading}
                  title="Refresh invitations"
                >
                  <RefreshCw className={`h-4 w-4 ${invitationsLoading ? "animate-spin" : ""}`} />
                </Button>
              }
            />
          }
        />

        {hasActiveFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllFilters}>
            {kindFilter.trim() ? (
              <DashboardTabFilterChip
                onRemove={() => setKindFilter("")}
                ariaLabel="Clear type filter"
              >
                <span className="truncate">Type: {KIND_LABEL[kindFilter as Invitation["kind"]] ?? kindFilter}</span>
              </DashboardTabFilterChip>
            ) : null}
            <DashboardTabSearchFilterChip query={searchTerm} onClear={() => setSearchTerm("")} />
          </DashboardTabActiveFiltersBar>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {invitationsError && (
            <div className="flex-shrink-0 p-4 sm:p-6 pt-2">
              <ErrorRetry
                error={invitationsError}
                onRetry={fetchInvitations}
                isLoading={invitationsLoading}
              />
            </div>
          )}

          {!invitationsError && (
            <CardContent className="flex-1 min-h-0 p-4 sm:p-6 overflow-hidden relative z-10">
              <DataTable
                columns={columns}
                data={invitations}
                isLoading={invitationsLoading}
                {...dashboardTableLoadingProps}
                enableFilters={false}
                enableGlobalSearch={false}
                disablePagination
                emptyMessage={
                  hasActiveFilters
                    ? "No invitations found matching your filters."
                    : "No invitations yet. Create one to invite someone."
                }
                getRowId={(row) => row.id}
                className={cn("invitations-table", dashboardAdminTableClassName)}
              />
            </CardContent>
          )}

          {!invitationsError && invitationTotal > INVITATIONS_LIST_PAGE_SIZE && (
            <div className="mt-auto border-t border-border-main">
              <div className="p-3 sm:p-4">
                <EnhancedPagination
                  currentPage={invitationPage}
                  setCurrentPage={(page) => setInvitationPage(page)}
                  totalItems={invitationTotal}
                  pageSize={INVITATIONS_LIST_PAGE_SIZE}
                  setPageSize={() => {}}
                  pageSizeOptions={[INVITATIONS_LIST_PAGE_SIZE]}
                  displayedItemsCount={invitations.length}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* New Invitation Form Modal */}
      <InvitationForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateInvitation}
        isLoading={formLoading}
      />

      {/* One-time link reveal modal */}
      <AdminFormDialog
        isOpen={createdInvitation !== null}
        onClose={() => setCreatedInvitation(null)}
        title="Invitation created"
        icon={<Check size={15} />}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setCreatedInvitation(null)}
              className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
            >
              Done
            </Button>
          </div>
        }
      >
        {createdInvitation && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2.5 text-xs text-text-main">
              <TriangleAlert className="h-4 w-4 shrink-0 text-status-warning mt-0.5" />
              <span>
                This link is shown only once and can&apos;t be retrieved again. Copy it now and
                share it with <strong>{createdInvitation.invitation.email}</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-lg border border-border-main bg-background px-3 py-2.5 font-mono text-xs text-text-main">
                {createdInvitation.link}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                title={linkCopied ? "Copied!" : "Copy link"}
                className={cn(
                  "h-10 w-10 shrink-0",
                  linkCopied && "border-status-success/40 text-status-success hover:text-status-success",
                )}
              >
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </AdminFormDialog>

      {/* Revoke Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isRevokeDialogOpen}
        onClose={() => {
          setIsRevokeDialogOpen(false);
          setInvitationToRevoke(null);
        }}
        onConfirm={handleConfirmRevoke}
        title="Revoke invitation?"
        description="This link will stop working immediately. This action cannot be undone."
        itemName={invitationToRevoke?.email || ""}
        confirmLabel="Revoke"
        isLoading={revokeLoading}
      />
    </TabsContent>
  );
};

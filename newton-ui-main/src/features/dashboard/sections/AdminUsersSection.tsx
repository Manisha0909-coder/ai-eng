import { useState, useCallback, useEffect, useMemo } from "react";
import {
  SquarePen,
  Trash2,
  RefreshCw,
  Plus,
} from "lucide-react";
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
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { apiFetch } from "@/services/api/sessionExpiry";
import { rbacApi, AdminUser } from "@/services/rbac/rbacApi";
import type { DirectoryUserRow } from "../components/Forms/AdminUserForm";
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
import { AdminUserForm } from "../components/Forms/AdminUserForm";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";
import { cn } from "@/lib/utils";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import { UserAvatar } from "../components/UserAvatar";
import {
  formatExactDate,
  formatLastUpdated,
} from "../utils/dashboardHelper";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";

/** Admin list API always requests pages of this size (matches GET /admin/users/list). */
const ADMIN_USERS_LIST_PAGE_SIZE = 50;

const ADMIN_ROLE_BADGE_CONFIG: Record<
  string,
  { label: string; emphasis?: boolean; neutral?: boolean }
> = {
  super_admin: { label: "Super Admin", emphasis: true },
  user_admin: { label: "User Admin", neutral: true },
  system_admin: { label: "System Admin", neutral: true },
};

export interface AdminUsersSectionProps {
  isSuperAdmin: boolean;
  activeTab: string;
}

export const AdminUsersSection = ({
  isSuperAdmin,
  activeTab,
}: Readonly<AdminUsersSectionProps>) => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, DASHBOARD_SEARCH_DEBOUNCE_MS);
  /** `super_admin` | `user_admin` | `system_admin` — empty = all */
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [adminUserPage, setAdminUserPage] = useState(1);
  const [adminUserTotal, setAdminUserTotal] = useState(0);
  const [isAdminUserFormOpen, setIsAdminUserFormOpen] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState<AdminUser | undefined>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [adminUserToDelete, setAdminUserToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [directoryPickerUsers, setDirectoryPickerUsers] = useState<DirectoryUserRow[]>([]);
  const [directoryPickerLoading, setDirectoryPickerLoading] = useState(false);

  const hasActiveAdminUserFilters =
    searchTerm.trim().length > 0 || roleFilter.trim().length > 0;

  const clearAllAdminUserListFilters = () => {
    setSearchTerm("");
    setRoleFilter("");
  };

  const fetchAdminUsers = useCallback(async (showSuccessToast = false) => {
    if (!isSuperAdmin || activeTab !== "admin") return;
    
    setAdminUsersLoading(true);
    setAdminUsersError(null);
    try {
      const offset = (adminUserPage - 1) * ADMIN_USERS_LIST_PAGE_SIZE;
      const response = await rbacApi.adminUsers.list({
        limit: ADMIN_USERS_LIST_PAGE_SIZE,
        offset,
        search: debouncedSearchTerm.trim() || undefined,
        role: roleFilter.trim() || undefined,
      });
      setAdminUsers(response.data || []);
      setAdminUserTotal(response.total || 0);
      
      if (showSuccessToast) {
        notify.success("Admin users refreshed successfully");
      }
    } catch (error: any) {
      console.error("Error fetching admin users:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to fetch admin users. Please try again.";
      setAdminUsersError(errorMessage);
      notify.error(error);
    } finally {
      setAdminUsersLoading(false);
    }
  }, [
    isSuperAdmin,
    activeTab,
    adminUserPage,
    debouncedSearchTerm,
    roleFilter,
  ]);

  // Fetch admin users when tab becomes active
  useEffect(() => {
    if (activeTab === "admin" && isSuperAdmin) {
      fetchAdminUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    isSuperAdmin,
    adminUserPage,
    debouncedSearchTerm,
    roleFilter,
  ]);

  useEffect(() => {
    setAdminUserPage(1);
  }, [debouncedSearchTerm, roleFilter]);

  useEffect(() => {
    if (!isAdminUserFormOpen || editingAdminUser) return;

    let cancelled = false;
    const loadDirectoryUsers = async () => {
      setDirectoryPickerLoading(true);
      try {
        const base = (API_CONFIG.LOCAL_API_BASE_URL || "").replace(/\/$/, "");
        const params = new URLSearchParams();
        params.set("limit", "50");
        params.set("offset", "0");

        const response = await apiFetch(`${base}/admin/users/non-admins?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          let message = `Failed to load users (${response.status})`;
          try {
            const errBody = await response.json();
            message =
              errBody?.message ||
              errBody?.detail ||
              errBody?.error?.message ||
              message;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }

        const data = unwrapEnvelope<{ users?: DirectoryUserRow[] }>(await response.json());
        const users: DirectoryUserRow[] = Array.isArray(data.users) ? data.users : [];
        if (!cancelled) setDirectoryPickerUsers(users);
      } catch (error: unknown) {
        console.error("Error loading users for admin form:", error);
        if (!cancelled) {
          setDirectoryPickerUsers([]);
          notify.error(error);
        }
      } finally {
        if (!cancelled) setDirectoryPickerLoading(false);
      }
    };

    loadDirectoryUsers();
    return () => {
      cancelled = true;
    };
  }, [isAdminUserFormOpen, editingAdminUser]);

  const handleAssignAdminRole = async (emails: string[], role: string) => {
    setFormLoading(true);
    try {
      await rbacApi.adminUsers.bulkAssignRole({ emails, role });
      await fetchAdminUsers();
      setIsAdminUserFormOpen(false);
      setEditingAdminUser(undefined);
    } catch (error: any) {
      console.error("Error assigning admin role:", error);
      notify.error(error);
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = useCallback((userEmail: string) => {
    setAdminUserToDelete(userEmail);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleRemoveAdminRole = async () => {
    if (!adminUserToDelete) return;
    setDeleteLoading(true);
    try {
      await rbacApi.adminUsers.bulkAssignRole({ emails: [adminUserToDelete], role: null });
      await fetchAdminUsers();
      setIsDeleteDialogOpen(false);
      setAdminUserToDelete(null);
    } catch (error: any) {
      console.error("Error removing admin role:", error);
      notify.error(error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddAdminUser = () => {
    setEditingAdminUser(undefined);
    setDirectoryPickerUsers([]);
    setIsAdminUserFormOpen(true);
  };

  const handleEditAdminUser = useCallback((user: AdminUser) => {
    setEditingAdminUser(user);
    setIsAdminUserFormOpen(true);
  }, []);

  const columns: ColumnConfig<AdminUser>[] = useMemo(
    () => [
      {
        key: "user",
        header: "USER",
        type: "custom",
        width: 280,
        align: "left",
        render: (_value, row) => {
          const displayName = row.display_name?.trim() || row.user_name || row.email;
          const showSecondary =
            row.email &&
            displayName.toLowerCase() !== row.email.toLowerCase();
          return (
            <div className="flex min-w-0 items-center gap-3 py-1">
              <UserAvatar label={displayName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-text-main">
                  {displayName}
                </div>
                {showSecondary ? (
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {row.email}
                  </p>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        key: "roles",
        header: "ROLES",
        type: "custom",
        width: 220,
        align: "left",
        render: (_value, row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.roles
              .filter((r) => ADMIN_ROLE_BADGE_CONFIG[r])
              .map((r) => {
                const cfg = ADMIN_ROLE_BADGE_CONFIG[r];
                return (
                  <DashboardPill
                    key={r}
                    intent={cfg.neutral ? "neutral" : "entity"}
                    entity={cfg.neutral ? undefined : "role"}
                    label={cfg.label}
                    emphasis={cfg.emphasis}
                  />
                );
              })}
            {row.roles.length === 0 ? (
              <span className="text-xs text-text-muted">—</span>
            ) : null}
          </div>
        ),
      },
      {
        key: "added_at",
        header: "ADDED",
        type: "custom",
        width: 100,
        align: "left",
        render: (_value, row) => (
          <span className="block whitespace-nowrap text-left text-sm text-text-muted">
            {formatExactDate(row.added_at)}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: "UPDATED",
        type: "custom",
        width: 100,
        align: "left",
        render: (_value, row) => (
          <span className="block whitespace-nowrap text-left text-sm text-text-muted">
            {formatLastUpdated(row.updated_at)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "ACTIONS",
        type: "custom",
        width: 120,
        align: "left",
        render: (_value, row) => (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleEditAdminUser(row);
              }}
              className={dashboardRowEditIconButtonClass}
              title="Edit admin user"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(row.email);
              }}
              className={dashboardRowDeleteIconButtonClass}
              title="Remove admin privileges"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDeleteClick, handleEditAdminUser]
  );

  if (!isSuperAdmin) {
    return (
      <TabsContent value="admin" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need Super Admin privileges to access this section.
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="admin" className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
        <Card className={cn("relative", dashboardTabCardClassName)}>
          <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Admin Users Management"
          description="Manage admin users and their permissions"
          titleRowEnd={
            <Button
              className="flex md:hidden lg:hidden p-1"
              variant="outline"
              size="sm"
              disabled={adminUsersLoading}
              onClick={handleAddAdminUser}
            >
              <span className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add Admin
              </span>
            </Button>
          }
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                    <DashboardTabSearchInput
                      placeholder="Search by name"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <DashboardTabFiltersPopover
                      filterCount={roleFilter ? 1 : 0}
                      onClear={() => setRoleFilter("")}
                      align="end"
                      triggerClassName="shrink-0"
                    >
                      <DashboardTabSearchableSelect
                        label="Role"
                        options={[
                          { label: "All roles", value: "" },
                          { label: "super_admin", value: "super_admin" },
                          { label: "user_admin", value: "user_admin" },
                          { label: "system_admin", value: "system_admin" },
                        ]}
                        value={roleFilter}
                        onValueChange={setRoleFilter}
                        placeholder="Search roles..."
                      />
                    </DashboardTabFiltersPopover>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 max-lg:px-2 hidden sm:flex shrink-0"
                      onClick={handleAddAdminUser}
                      disabled={adminUsersLoading}
                      title="Add admin user"
                    >
                      <Plus className="h-4 w-4 lg:mr-1" />
                      <span className={dashboardTabToolbarButtonLabelClassName}>Add Admin</span>
                    </Button>
                  </>
                }
                refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={() => fetchAdminUsers(true)}
                    disabled={adminUsersLoading}
                    title="Refresh admin users"
                  >
                    <RefreshCw className={`h-4 w-4 ${adminUsersLoading ? "animate-spin" : ""}`} />
                  </Button>
                }
              />
          }
        />

        {hasActiveAdminUserFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllAdminUserListFilters}>
            {roleFilter.trim() ? (
              <DashboardTabFilterChip
                onRemove={() => setRoleFilter("")}
                ariaLabel="Clear role filter"
              >
                <span className="truncate">Role: {roleFilter}</span>
              </DashboardTabFilterChip>
            ) : null}
            <DashboardTabSearchFilterChip
              query={searchTerm}
              onClear={() => setSearchTerm("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Error State */}
          {adminUsersError && (
            <div className="flex-shrink-0 p-4 sm:p-6 pt-2">
              <ErrorRetry
                error={adminUsersError}
                onRetry={fetchAdminUsers}
                isLoading={adminUsersLoading}
              />
            </div>
          )}

          {/* Admin Users Table */}
          {!adminUsersError && (
            <CardContent className="flex-1 min-h-0 p-4 sm:p-6 overflow-hidden relative z-10">
              <DataTable
                columns={columns}
                data={adminUsers}
                isLoading={adminUsersLoading}
                {...dashboardTableLoadingProps}
                enableFilters={false}
                enableGlobalSearch={false}
                enableRowSelection
                disablePagination
                emptyMessage={
                  hasActiveAdminUserFilters
                    ? "No admin users found matching your filters."
                    : "No admin users found."
                }
                getRowId={(row) => row.id}
                className={cn("admin-users-table", dashboardAdminTableClassName)}
              />
            </CardContent>
          )}

          {/* Pagination - Outside scrollable area */}
          {!adminUsersError && adminUserTotal > ADMIN_USERS_LIST_PAGE_SIZE && (
            <div className="mt-auto border-t border-border-main">
              <div className="p-3 sm:p-4">
                <EnhancedPagination
                  currentPage={adminUserPage}
                  setCurrentPage={(page) => {
                    setAdminUserPage(page);
                  }}
                  totalItems={adminUserTotal}
                  pageSize={ADMIN_USERS_LIST_PAGE_SIZE}
                  setPageSize={() => {}}
                  pageSizeOptions={[ADMIN_USERS_LIST_PAGE_SIZE]}
                  displayedItemsCount={adminUsers.length}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Admin User Form Modal */}
      <AdminUserForm
        isOpen={isAdminUserFormOpen}
        onClose={() => {
          setIsAdminUserFormOpen(false);
          setEditingAdminUser(undefined);
        }}
        onSubmit={handleAssignAdminRole}
        adminUser={editingAdminUser}
        isLoading={formLoading}
        directoryPicker={
          editingAdminUser
            ? null
            : {
                users: directoryPickerUsers,
                loading: directoryPickerLoading,
              }
        }
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setAdminUserToDelete(null);
        }}
        onConfirm={handleRemoveAdminRole}
        title="Remove Admin Privileges?"
        description="This action cannot be undone."
        itemName={adminUserToDelete || ""}
        confirmLabel="Remove"
        isLoading={deleteLoading}
      />
    </TabsContent>
  );
};

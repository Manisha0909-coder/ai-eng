import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SquarePen,
  Trash2,
  X,
  RefreshCw,
  Plus,
  CheckSquare,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import axios from "axios";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../../utils/dashboardRowActionStyles";
import { UserAvatar } from "../../components/UserAvatar";
import { DashboardPill } from "../../components/DashboardPill";
import notify from "@/utils/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import { rbacApi, Role, User } from "@/services/rbac/rbacApi";
import { AccessGraphView } from "./AccessGraphView";
import {
  buildAccessLookups,
  findRoleObject,
  roleNeedsDetailFetch,
  roleIdOf,
  enrichRole,
  type AccessLookups,
} from "./accessTree";
import type { BulkCreateFromCsvResponse } from "@/services/rbac/services/usersService";
import { ErrorRetry } from "../../components/ErrorRetry";
import { DeleteConfirmationModal } from "../../components/DeleteConfirmationModal";
import { DashboardLoader } from "@/components/ContentLoader";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { TableQueryParams } from "@/components/DataTable/types";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
} from "../../components/DashboardTabFilterUi";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
  dashboardAdminTableClickableRowClassName,
} from "../../components/DashboardTabLayout";
import { formatDashboardDate } from "@/utils/helper";
import { formatLastUpdated } from "../../utils/dashboardHelper";
import { cn } from "@/lib/utils";

export interface UsersSectionProps {
  isAdmin: boolean;
  isMobile: boolean;
  usersLoading: boolean;
  users: User[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  availableRoles: string[];
  selectedUserRoles: string[];
  setSelectedUserRoles: (roles: string[]) => void;
  setEditingUser: (user?: User) => void;
  setIsUserFormOpen: (open: boolean) => void;
  handleDeleteClick: (userId: number | string, user?: User) => void;
  userPage: number;
  setUserPage: (page: number) => void;
  userPageSize: number;
  setUserPageSize: (size: number) => void;
  userTotal: number;
  usersError: string | null;
  onRetryUsers: () => void;
}


interface AccessCounts {
  roles: number;
  personas: number;
  toolTags: number;
  docTags: number;
}

/**
 * Access summary for a user. Prefers the server-provided `unique_*` fields and
 * falls back to deriving counts from the nested role -> persona -> tag shape so
 * the table chips and the modal stat strip always agree.
 */
const getAccessCounts = (user: any): AccessCounts => {
  const roles = user.roles || [];
  const personaSet = new Set<unknown>();
  const toolSet = new Set<unknown>();
  const docSet = new Set<unknown>();

  roles.forEach((role: any) => {
    if (role && typeof role === "object") {
      (role.document_tags || []).forEach((d: any) => docSet.add(d?.id ?? d?.name ?? d));
      (role.personas || []).forEach((p: any) => {
        personaSet.add(p?.id ?? p?.persona_name ?? p);
        (p.tool_tags || []).forEach((t: any) => toolSet.add(t?.id ?? t?.name ?? t));
        (p.document_tags || []).forEach((d: any) => docSet.add(d?.id ?? d?.name ?? d));
      });
    }
  });

  return {
    roles: roles.length,
    personas: user.unique_personas?.length ?? personaSet.size,
    toolTags: user.unique_tools?.length ?? toolSet.size,
    docTags: user.unique_doc_tags?.length ?? docSet.size,
  };
};

/** Compact inline chips for the table "Access" cell. */
const AccessChips = ({ counts }: { counts: AccessCounts }) => {
  const tags = counts.toolTags + counts.docTags;
  return (
    <DashboardPill
      intent="count"
      countParts={[
        { n: counts.roles, label: counts.roles === 1 ? "role" : "roles" },
        { n: counts.personas, label: "personas" },
        { n: tags, label: "tags" },
      ]}
    />
  );
};

/**
 * Assemble a fully-nested access-graph user from a list row. Each role name is
 * resolved against the lookups; when a role carries no personas inline we fetch
 * its detail (`/roles/{id}`) so personas → tool tags / doc tags are populated.
 * Per-role failures degrade to a childless role node rather than breaking the
 * whole drawer.
 */
async function buildAccessGraphUser(
  user: User,
  lookups: AccessLookups
): Promise<any> {
  const roleRefs: any[] = (user as any).roles ?? [];
  const roles = await Promise.all(
    roleRefs.map(async (ref) => {
      let role = findRoleObject(ref, lookups);
      if (!role || roleNeedsDetailFetch(role)) {
        const id = roleIdOf(ref, role);
        if (typeof id === "number") {
          try {
            const detail = await rbacApi.roles.getById(id);
            if (detail) role = detail;
          } catch (error) {
            console.error("Failed to load role detail for access graph:", error);
          }
        }
      }
      return role && typeof role === "object" ? enrichRole(role, lookups) : ref;
    })
  );
  return { ...user, roles };
}

export const UsersSection = ({
  isAdmin,
  usersLoading,
  users,
  searchTerm,
  setSearchTerm,
  selectedUserRoles,
  setSelectedUserRoles,
  setEditingUser,
  setIsUserFormOpen,
  handleDeleteClick,
  userPage,
  setUserPage,
  userPageSize,
  setUserPageSize,
  userTotal,
  usersError,
  onRetryUsers,
}: Readonly<UsersSectionProps>) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [isImportingUsers, setIsImportingUsers] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<BulkCreateFromCsvResponse | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  /** Filled on first filter dropdown use; avoids repeated roles.list calls on open/search. */
  const cachedAvailableRolesRef = useRef<string[] | null>(null);

  // Row-details drawer: shows the user's access graph (roles → personas →
  // tags → tools). `detailsUser` is the clicked row (renders the header
  // instantly); `detailsFull` is the nested detail fetched on open.
  const [detailsUser, setDetailsUser] = useState<User | null>(null);
  const [detailsFull, setDetailsFull] = useState<User | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  /** Guards against a slow fetch resolving after the drawer reopened on another user. */
  const detailsReqIdRef = useRef(0);
  /** Cached id/name → object lookups used to resolve the detail user's refs. */
  const accessLookupsRef = useRef<AccessLookups | null>(null);

  /**
   * Roles/personas/tags/doc-tags lists, indexed for reference resolution. The
   * detail user often carries roles → personas → tags as bare ids/names; these
   * lists let us expand them into the full tree. Fetched once, then cached;
   * `allSettled` so a permission-gated list (e.g. tool tags) degrades to
   * partial enrichment instead of failing the whole drawer.
   */
  const loadAccessLookups = useCallback(async (): Promise<AccessLookups> => {
    if (accessLookupsRef.current) return accessLookupsRef.current;
    const [roles, personas, tags, docTags] = await Promise.allSettled([
      rbacApi.roles.list({ limit: 1000, offset: 0 }),
      rbacApi.personas.list({ limit: 1000, offset: 0, roots_only: true }),
      rbacApi.tags.list({ limit: 1000, offset: 0 }),
      rbacApi.documentTags.list({ limit: 1000, offset: 0 }),
    ]);
    const dataOf = (r: PromiseSettledResult<{ data: any[] }>) =>
      r.status === "fulfilled" ? r.value.data ?? [] : [];
    const lookups = buildAccessLookups({
      roles: dataOf(roles),
      personas: dataOf(personas),
      tags: dataOf(tags),
      docTags: dataOf(docTags),
    });
    accessLookupsRef.current = lookups;
    return lookups;
  }, []);

  const closeUserDetails = useCallback(() => {
    detailsReqIdRef.current += 1;
    setDetailsUser(null);
    setDetailsFull(null);
    setDetailsLoading(false);
  }, []);

  const fetchAvailableRoles = useCallback(
    async (searchQuery?: string): Promise<string[]> => {
      let all = cachedAvailableRolesRef.current;
      if (all === null) {
        try {
          const response = await rbacApi.roles.list({ limit: 1000, offset: 0 });
          if (response.success) {
            all = response.data.map((role: Role) => role.name);
          } else {
            all = [];
          }
        } catch (error) {
          console.error("Error fetching roles:", error);
          all = [];
        }
        cachedAvailableRolesRef.current = all;
      }
      const q = (searchQuery ?? "").trim().toLowerCase();
      if (!q) return all;
      return all.filter((name) => name.toLowerCase().includes(q));
    },
    []
  );

  const addRole = (roleName: string | string[]) => {
    if (Array.isArray(roleName)) {
      setSelectedUserRoles(roleName);
    } else if (!selectedUserRoles.includes(roleName)) {
      setSelectedUserRoles([...selectedUserRoles, roleName]);
    }
  };

  const removeRole = (roleName: string) => {
    setSelectedUserRoles(selectedUserRoles.filter((r) => r !== roleName));
  };

  const hasActiveUserListFilters = useMemo(
    () =>
      searchTerm.trim().length > 0 || selectedUserRoles.length > 0,
    [searchTerm, selectedUserRoles]
  );

  const clearAllUserListFilters = () => {
    setSearchTerm("");
    setSelectedUserRoles([]);
  };

  const handleAddUser = () => {
    setEditingUser(undefined);
    setIsUserFormOpen(true);
  };

  const handleExportUsersCSV = async () => {
    if (isExportingUsers) return;
    setIsExportingUsers(true);
    try {
      const blob = await rbacApi.users.exportCSV();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `users_export_${timestamp}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify.success("Users exported successfully");
    } catch (error) {
      console.error("Failed to export users:", error);
      notify.error(error, "Failed to export users.");
    } finally {
      setIsExportingUsers(false);
    }
  };

  const handleImportUsersClick = () => {
    csvFileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still triggers onChange.
    e.target.value = "";
    if (!file) return;
    setPendingImportFile(file);
  };

  const handleCancelImport = () => {
    if (isImportingUsers) return;
    setPendingImportFile(null);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile || isImportingUsers) return;
    setIsImportingUsers(true);
    try {
      const result = await rbacApi.users.bulkCreateFromCSV(pendingImportFile);
      const rows = result.results ?? [];
      const created = result.total_created ?? 0;
      const updated = result.total_updated ?? 0;
      // Trust per-row results over total_failed: the backend can report
      // total_failed=0 while still emitting a failed row (e.g. CSV decode errors).
      const failedFromRows = rows.filter((r) => !r.success).length;
      const failed = Math.max(result.total_failed ?? 0, failedFromRows);

      setPendingImportFile(null);
      setImportResult(result);

      const summary = `${created} created, ${updated} updated, ${failed} failed`;
      if (failed > 0 || (created === 0 && updated === 0)) {
        // Either an explicit row failure or the file produced no work — surface
        // the backend message when present so the user sees the real reason.
        notify.error(rows[0]?.message || result.message || summary);
      } else {
        notify.success(summary);
      }

      if (created > 0 || updated > 0) onRetryUsers();
    } catch (error) {
      console.error("Failed to import users CSV:", error);
      notify.error(error, "Failed to import users CSV.");
    } finally {
      setIsImportingUsers(false);
    }
  };

  const handleSelectModeToggle = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedUsers([]);
    }
  };

  const handleUserSelect = (userId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedUsers((prev) => [...prev, userId]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleSelectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((user) => user.user_id));
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedUsers.length === 0) return;

    setIsBulkDeleting(true);
    try {
      await axios.post(
        `${API_CONFIG.LOCAL_API_BASE_URL}/users/bulk_delete`,
        { user_ids: selectedUsers },
        {
          headers: {
            ...API_CONFIG.API_HEADERS,
          },
          withCredentials: true,
        }
      );

      setSelectedUsers([]);
      setIsDeleteDialogOpen(false);
      setIsSelectionMode(false);
      onRetryUsers();
    } catch (error: any) {
      console.error("Error bulk deleting users:", error);
      notify.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openUserDetails = useCallback((user: User) => {
    setDetailsUser(user);
    setDetailsFull(null);
    setDetailsLoading(true);
    const reqId = ++detailsReqIdRef.current;
    // The row carries role-name strings only. Resolve them against the
    // roles/personas/tags lists, fetching each role's detail when the list
    // doesn't carry its personas, to assemble the full nested access graph.
    // (The single-user detail endpoint is intentionally not used — it 404s on
    // this backend — so we build the tree from the row + the lookups.)
    loadAccessLookups()
      .then(async (lookups) => {
        if (detailsReqIdRef.current !== reqId) return;
        const enriched = await buildAccessGraphUser(user, lookups);
        if (detailsReqIdRef.current === reqId) setDetailsFull(enriched);
      })
      .catch((error) => {
        console.error("Error loading user access graph:", error);
        // Fall back to the row so the header + role names still render.
        if (detailsReqIdRef.current === reqId) setDetailsFull(user);
      })
      .finally(() => {
        if (detailsReqIdRef.current === reqId) setDetailsLoading(false);
      });
  }, [loadAccessLookups]);

  // Keep DataTable's pagination in sync with the parent-owned page state.
  // Search/role filters are driven by the header controls (parent fetch), so
  // they are intentionally not handled here.
  const handleTableQueryChange = useCallback(
    (query: TableQueryParams) => {
      const nextPage = query.page ?? 1;
      const nextLimit = query.limit ?? userPageSize;
      if (nextLimit !== userPageSize) setUserPageSize(nextLimit);
      if (nextPage !== userPage) setUserPage(nextPage);
    },
    [userPage, userPageSize, setUserPage, setUserPageSize]
  );

  const handleRowClick = useCallback(
    (user: User) => {
      if (isSelectionMode) {
        handleUserSelect(user.user_id, !selectedUsers.includes(user.user_id));
        return;
      }
      openUserDetails(user);
    },
    [isSelectionMode, selectedUsers, openUserDetails]
  );

  const columns: ColumnConfig<User>[] = useMemo(() => {
    const cols: ColumnConfig<User>[] = [];

    if (isSelectionMode) {
      cols.push({
        key: "__select",
        header: "",
        type: "custom",
        width: 56,
        render: (_, user) => (
          <Checkbox
            checked={selectedUsers.includes(user.user_id)}
            onCheckedChange={(checked) =>
              handleUserSelect(user.user_id, checked === true)
            }
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-border-main text-primary"
          />
        ),
      });
    }

    cols.push(
      {
        key: "user_id",
        header: "User",
        type: "text",
        width: 240,
        searchable: true,
        render: (_, user) => (
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar label={user.user_id} size="sm" />
            <span className="truncate text-sm font-medium text-text-main">
              {user.user_id}
            </span>
          </div>
        ),
      },
      {
        key: "access",
        header: "Access",
        type: "custom",
        width: 280,
        render: (_, user) => {
          const counts = getAccessCounts(user);
          if (counts.roles === 0) {
            return (
              <span className="text-xs text-text-muted">
                No access assigned
              </span>
            );
          }
          return <AccessChips counts={counts} />;
        },
      },
      {
        key: "created_at",
        header: "Created At",
        type: "date",
        width: 150,
        render: (_, user) => (
          <span className="text-sm text-text-muted">
            {formatDashboardDate(user.created_at)}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: "Last Updated",
        type: "date",
        width: 150,
        render: (_, user) => (
          <span className="text-sm text-text-muted tabular-nums whitespace-nowrap">
            {formatLastUpdated(user.updated_at)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        width: 180,
        render: (_, user) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                openUserDetails(user);
              }}
              className={dashboardRowEditIconButtonClass}
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUser(user);
                    setIsUserFormOpen(true);
                  }}
                  className={dashboardRowEditIconButtonClass}
                  title="Attach roles"
                >
                  <SquarePen className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(user.id ?? user.user_id, user);
                  }}
                  className={dashboardRowDeleteIconButtonClass}
                  title="Delete user"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ),
      }
    );

    return cols;
  }, [
    isAdmin,
    isSelectionMode,
    selectedUsers,
    openUserDetails,
    setEditingUser,
    setIsUserFormOpen,
    handleDeleteClick,
  ]);

  const openDetailsUserForm = useCallback(() => {
    const user = detailsUser;
    if (!user) return;
    closeUserDetails();
    setEditingUser(user);
    setIsUserFormOpen(true);
  }, [detailsUser, closeUserDetails, setEditingUser, setIsUserFormOpen]);

  return (
    <TabsContent
      value="users"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="User Management"
          description="Enable users and manage roles and access"
          descriptionClassName="mb-0"
          titleRowEnd={
            <Button
              className="flex md:hidden lg:hidden p-1"
              variant="outline"
              size="sm"
              disabled={!isAdmin}
              onClick={handleAddUser}
              title={!isAdmin ? "Admin privileges required" : ""}
            >
              <span className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Enable Users
                {!isAdmin && (
                  <span className="ml-1 text-xs text-text-main">(Admin Only)</span>
                )}
              </span>
            </Button>
          }
          actions={
              !isSelectionMode ? (
                <>
                  <DashboardTabToolbar
                    primary={
                      <>
                        <DashboardTabSearchInput
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <DashboardTabFiltersPopover
                          filterCount={selectedUserRoles.length}
                          onClear={() => setSelectedUserRoles([])}
                          align="end"
                        >
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-text-main">Roles</span>
                            <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto sm:max-h-none">
                              {selectedUserRoles.map((roleName) => (
                                <Badge
                                  key={roleName}
                                  variant="secondary"
                                  className="flex items-center gap-1 border-border-main bg-background text-text-main"
                                >
                                  {roleName}
                                  <button
                                    type="button"
                                    onClick={() => removeRole(roleName)}
                                    className="ml-1 rounded-full p-0.5 hover:bg-surface"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <Combobox
                              placeholder="Search and select roles to add..."
                              onOpen={fetchAvailableRoles}
                              onSelect={addRole}
                              defaultValue={selectedUserRoles}
                              className="text-text-main border-border-main"
                            />
                          </div>
                        </DashboardTabFiltersPopover>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hidden h-10 max-lg:px-2 sm:flex"
                          disabled={!isAdmin}
                          onClick={handleAddUser}
                          title={!isAdmin ? "Admin privileges required" : "Enable users"}
                        >
                          <Plus className="h-4 w-4" />
                          <span className={dashboardTabToolbarButtonLabelClassName}>
                            Enable Users
                            {!isAdmin && (
                              <span className="ml-1 text-xs text-text-main">
                                (Admin Only)
                              </span>
                            )}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10"
                          disabled={!isAdmin || isImportingUsers}
                          onClick={handleImportUsersClick}
                          title={
                            !isAdmin
                              ? "Admin privileges required"
                              : "Import users from CSV"
                          }
                        >
                          <Upload
                            className={`h-4 w-4 ${isImportingUsers ? "animate-pulse" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10"
                          disabled={isExportingUsers}
                          onClick={handleExportUsersCSV}
                          title="Export users to CSV"
                        >
                          <Download
                            className={`h-4 w-4 ${isExportingUsers ? "animate-pulse" : ""}`}
                          />
                        </Button>
                      </>
                    }
                    refresh={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 border-border-main text-text-main hover:bg-surface"
                        onClick={onRetryUsers}
                        disabled={usersLoading}
                        title="Refresh users"
                      >
                        <RefreshCw className={`h-4 w-4 ${usersLoading ? "animate-spin" : ""}`} />
                      </Button>
                    }
                  />
                </>
              ) : (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:flex-nowrap sm:gap-2 sm:overflow-visible">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1 text-sm text-primary">
                      <span className="font-semibold">{selectedUsers.length}</span>
                      <span>selected</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={handleSelectAllUsers}
                    title="Select all"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={selectedUsers.length === 0 || !isAdmin}
                    title="Delete selected"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={handleSelectModeToggle}
                    title="Cancel selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                </div>
              )
          }
        />

        {hasActiveUserListFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllUserListFilters}>
            {selectedUserRoles.map((roleName) => (
              <DashboardTabFilterChip
                key={roleName}
                onRemove={() => removeRole(roleName)}
                ariaLabel={`Remove role ${roleName}`}
              >
                <span className="truncate">Role: {roleName}</span>
              </DashboardTabFilterChip>
            ))}
            <DashboardTabSearchFilterChip
              query={searchTerm}
              onClear={() => setSearchTerm("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <CardContent className="relative z-10 flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {(() => {
            if (usersError && !usersLoading) {
              return (
                <div className="p-4">
                  <ErrorRetry error={usersError} onRetry={onRetryUsers} isLoading={usersLoading} />
                </div>
              );
            }
            return (
              <DataTable
                columns={columns}
                data={users}
                isLoading={usersLoading}
                {...dashboardTableLoadingProps}
                enableFilters={false}
                enableGlobalSearch={false}
                enableRowSelection
                serverSide={true}
                totalItems={userTotal}
                onQueryChange={handleTableQueryChange}
                onRowClick={handleRowClick}
                emptyMessage={
                  searchTerm.trim() || selectedUserRoles.length > 0
                    ? "No users match your filters. Try clearing the search or role filter."
                    : "No users yet. Enable your first user or import a CSV to get started."
                }
                loadingMessage="Loading users..."
                pageSizeOptions={[10, 25, 50, 100]}
                defaultPageSize={userPageSize}
                getRowId={(user) => `user-${user.id ?? user.user_id}`}
                className={cn(
                  dashboardAdminTableClassName,
                  dashboardAdminTableClickableRowClassName,
                )}
              />
            );
          })()}
        </CardContent>
      </Card>

      {/*
        Access-graph drawer: slides in from the right when a table row is
        clicked. The Sheet (Radix Dialog) gives the slide animation,
        backdrop-click close, Escape-to-close, focus trapping, and
        role="dialog" for free. `hideClose` suppresses the default ✕ so the
        view can render its own header chrome. AccessGraphView shows the user's
        access hierarchy as a step-wise expandable tree (USER → ROLE → PERSONA
        → DOC/TOOL TAG → TOOL) wired to the nested detail user.
      */}
      <Sheet
        open={detailsUser !== null}
        onOpenChange={(open) => {
          if (!open) closeUserDetails();
        }}
      >
        <SheetContent
          side="right"
          hideClose
          className="w-full gap-0 border-l border-border-main bg-background p-0 sm:max-w-[760px]"
        >
          {detailsUser && (
            <AccessGraphView
              user={detailsUser}
              treeUser={detailsFull}
              isAdmin={isAdmin}
              loading={detailsLoading}
              onAddRole={openDetailsUserForm}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Hidden file input for CSV import */}
      <Input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {/* CSV Import Confirmation Dialog */}
      <Dialog
        open={pendingImportFile !== null}
        onOpenChange={(open) => {
          if (!open && !isImportingUsers) setPendingImportFile(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import users from CSV?</DialogTitle>
            <DialogDescription>
              This will create or update users based on the rows in the file.
              This action cannot be undone — please confirm before proceeding.
            </DialogDescription>
          </DialogHeader>
          {pendingImportFile && (
            <div className="flex items-start gap-3 rounded-md border border-border-main p-3">
              <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{pendingImportFile.name}</div>
                <div className="text-xs text-text-muted">
                  {(pendingImportFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          )}
          {isImportingUsers && (
            <div className="flex flex-col items-center justify-center gap-2 py-4">
              <DashboardLoader size="sm" />
              <p className="text-sm text-text-muted">
                Importing users…
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelImport}
              disabled={isImportingUsers}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={isImportingUsers}>
              {isImportingUsers ? "Importing…" : "Confirm Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Results Dialog */}
      <Dialog
        open={importResult !== null}
        onOpenChange={(open) => {
          if (!open) setImportResult(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>CSV Import Results</DialogTitle>
            {importResult?.message ? (
              <DialogDescription>{importResult.message}</DialogDescription>
            ) : null}
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-border-main p-3 text-center">
                  <div className="text-xs text-text-muted">Processed</div>
                  <div className="text-lg font-semibold">
                    {importResult.total_processed ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-border-main p-3 text-center">
                  <div className="text-xs text-text-muted">Created</div>
                  <div className="text-lg font-semibold text-green-600">
                    {importResult.total_created ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-border-main p-3 text-center">
                  <div className="text-xs text-text-muted">Updated</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {importResult.total_updated ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-border-main p-3 text-center">
                  <div className="text-xs text-text-muted">Failed</div>
                  <div className="text-lg font-semibold text-status-error">
                    {Math.max(
                      importResult.total_failed ?? 0,
                      (importResult.results ?? []).filter((r) => !r.success).length
                    )}
                  </div>
                </div>
              </div>
              {importResult.results && importResult.results.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-md border border-border-main">
                  <ul className="divide-y divide-border-main text-sm">
                    {importResult.results.map((row, idx) => (
                      <li
                        key={`${row.user_id}-${idx}`}
                        className="flex items-start gap-2 px-3 py-2"
                      >
                        {row.success ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-error" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {row.user_id || "(blank user_id)"}
                          </div>
                          <div className="truncate text-xs text-text-muted">
                            {row.message}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportResult(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${selectedUsers.length} User${selectedUsers.length !== 1 ? "s" : ""}?`}
        description="This action cannot be undone."
        itemName={`${selectedUsers.length} user${selectedUsers.length !== 1 ? "s" : ""}`}
        isLoading={isBulkDeleting}
      />
    </TabsContent>
  );
};

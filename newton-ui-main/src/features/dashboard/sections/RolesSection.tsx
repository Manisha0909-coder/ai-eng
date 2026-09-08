import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardPill } from "../components/DashboardPill";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { ErrorRetry } from "../components/ErrorRetry";
import { rbacApi, type DocumentTag, type Persona, type Role } from "@/services/rbac/rbacApi";
import { ChevronDown, ChevronUp, SquarePen, Trash2, RefreshCw, Plus, X } from "lucide-react";
import { formatDashboardDate } from "@/utils/helper";
import { formatLastUpdated } from "../utils/dashboardHelper";
import axios from "axios";
import { API_CONFIG } from "@/config/api";
import notify from "@/utils/notify";
import { useIsTextTruncated } from "@/hooks/useIsTextTruncated";
import { cn } from "@/lib/utils";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
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
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
} from "../components/DashboardTabFilterUi";
interface RoleDescriptionProps {
  description: string;
  roleId: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const RoleDescription = ({ description, roleId: _roleId, isExpanded, onToggle }: RoleDescriptionProps) => {
  const { ref, isTruncated } = useIsTextTruncated(description, true, false, isExpanded, 2);

  return (
    <>
      <p
        ref={ref}
        className={`text-sm text-text-muted whitespace-pre-wrap leading-normal ${
          isExpanded ? "" : "line-clamp-2"
        }`}
      >
        {description}
      </p>
      {description && description !== "No description available" && isTruncated && (
        <button
          className="mt-1.5 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
          onClick={onToggle}
        >
          {isExpanded ? (
            <>
              <span>Show less</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Show more</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </>
  );
};

const normalizeLabelList = (
  items?: Array<any>,
  fallbackPrefix = "Item"
): string[] => {
  if (!items) return [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (typeof item === "number") {
        return `${fallbackPrefix} #${item}`;
      }
      if (typeof item === "object" && item !== null) {
        if ("name" in item && item.name) {
          return item.name as string;
        }
        if ("persona_name" in item && item.persona_name) {
          return item.persona_name as string;
        }
        if ("id" in item && typeof item.id === "number") {
          return `${fallbackPrefix} #${item.id}`;
        }
      }
      return "";
    })
    .filter((label): label is string => Boolean(label));
};

export interface RolesSectionProps {
  isAdmin: boolean;
  isMobile: boolean;
  roles: Role[];
  rolesLoading: boolean;
  rolesError: string | null;
  retryRoles: () => void;
  roleSearch: string;
  setRoleSearch: (value: string) => void;
  setEditingRole: (role?: Role) => void;
  setIsRoleFormOpen: (open: boolean) => void;
  handleDeleteRole: (roleId: number, roleName: string) => void;
  expandedRoleDescriptions: Set<number>;
  setExpandedRoleDescriptions: Dispatch<SetStateAction<Set<number>>>;
  rolePage: number;
  setRolePage: (page: number) => void;
  rolePageSize: number;
  setRolePageSize: (size: number) => void;
  roleTotal: number;
  roleDocumentTagIds: number[];
  setRoleDocumentTagIds: Dispatch<SetStateAction<number[]>>;
  rolePersonaIds: number[];
  setRolePersonaIds: Dispatch<SetStateAction<number[]>>;
  activeTab?: string;
}

/** Separates numeric id from display name in Combobox values (avoids ambiguity with "|" in names). */
const ID_NAME_SEP = "\u001f";

function extractPaginatedData<T>(res: { data?: T[] } | null | undefined): T[] {
  const d = res?.data;
  return Array.isArray(d) ? d : [];
}

function encodeDocTag(t: Pick<DocumentTag, "id" | "name">): string {
  const name = (t.name ?? "").split(ID_NAME_SEP).join(" ");
  return `${t.id}${ID_NAME_SEP}${name}`;
}

function encodePersona(p: Pick<Persona, "id" | "persona_name">): string {
  const label = (p.persona_name?.trim() || `Persona #${p.id}`).split(ID_NAME_SEP).join(" ");
  return `${p.id}${ID_NAME_SEP}${label}`;
}

function decodePrefixedId(s: string): number | null {
  const i = s.indexOf(ID_NAME_SEP);
  if (i === -1) return null;
  const id = Number(s.slice(0, i));
  return Number.isFinite(id) ? id : null;
}

function decodePrefixedLabel(s: string): string {
  const i = s.indexOf(ID_NAME_SEP);
  return i === -1 ? s : s.slice(i + 1);
}

export const RolesSection = ({
  isAdmin,
  isMobile,
  roles,
  rolesLoading,
  rolesError,
  retryRoles,
  roleSearch,
  setRoleSearch,
  setEditingRole,
  setIsRoleFormOpen,
  handleDeleteRole,
  expandedRoleDescriptions,
  setExpandedRoleDescriptions,
  rolePage,
  setRolePage,
  rolePageSize,
  setRolePageSize,
  roleTotal,
  roleDocumentTagIds,
  setRoleDocumentTagIds,
  rolePersonaIds,
  setRolePersonaIds,
  activeTab,
}: Readonly<RolesSectionProps>) => {
  const [docTagOptions, setDocTagOptions] = useState<DocumentTag[]>([]);
  const [personaOptions, setPersonaOptions] = useState<Persona[]>([]);

  const mergeById = <T extends { id: number }>(prev: T[], next: T[]): T[] => {
    const map = new Map<number, T>();
    prev.forEach((x) => map.set(x.id, x));
    next.forEach((x) => map.set(x.id, x));
    return Array.from(map.values());
  };

  const loadDocTagDropdownItems = useCallback(async (query?: string) => {
    try {
      const res = await rbacApi.documentTags.list({
        limit: 500,
        offset: 0,
        search: query?.trim() || undefined,
      });
      const list = extractPaginatedData(res);
      setDocTagOptions((prev) => mergeById(prev, list));
      return list.map((t) => encodeDocTag(t));
    } catch (e) {
      console.error("Failed to load document tags for filters:", e);
      notify.error("Could not load document tags for filters.");
      return [];
    }
  }, []);

  const loadPersonaDropdownItems = useCallback(async (query?: string) => {
    try {
      const res = await rbacApi.personas.list({
        limit: 500,
        offset: 0,
        roots_only: true,
        search: query?.trim() || undefined,
      });
      const list = extractPaginatedData(res);
      setPersonaOptions((prev) => mergeById(prev, list));
      return list.map((p) => encodePersona(p));
    } catch (e) {
      console.error("Failed to load personas for filters:", e);
      notify.error("Could not load personas for filters.");
      return [];
    }
  }, []);

  /** Prefetch when the roles tab is active so chips and dropdowns have labels (mount can run before auth/cookies are ready). */
  useEffect(() => {
    if (activeTab !== undefined && activeTab !== "roles") return;
    let cancelled = false;
    (async () => {
      try {
        const [dt, pers] = await Promise.all([
          rbacApi.documentTags.list({ limit: 500, offset: 0 }),
          rbacApi.personas.list({ limit: 500, offset: 0, roots_only: true }),
        ]);
        if (cancelled) return;
        setDocTagOptions(extractPaginatedData(dt));
        setPersonaOptions(extractPaginatedData(pers));
      } catch (e) {
        console.error("Failed to load role filter options:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const roleFilterCount =
    roleDocumentTagIds.length +
    rolePersonaIds.length;

  const clearRoleFilters = () => {
    setRoleDocumentTagIds([]);
    setRolePersonaIds([]);
  };

  const hasActiveRoleListFilters =
    roleSearch.trim().length > 0 || roleFilterCount > 0;

  const clearAllRoleListFilters = () => {
    setRoleSearch("");
    clearRoleFilters();
  };

  const docTagEncodedSelection = useMemo(
    () =>
      roleDocumentTagIds.map((id) => {
        const t = docTagOptions.find((x) => x.id === id);
        return t ? encodeDocTag(t) : `${id}${ID_NAME_SEP}`;
      }),
    [roleDocumentTagIds, docTagOptions]
  );

  const personaEncodedSelection = useMemo(
    () =>
      rolePersonaIds.map((id) => {
        const p = personaOptions.find((x) => x.id === id);
        return p ? encodePersona(p) : `${id}${ID_NAME_SEP}`;
      }),
    [rolePersonaIds, personaOptions]
  );

  const handleDocTagFilterSelect = useCallback(
    (value: string | string[]) => {
      const arr = Array.isArray(value) ? value : [value];
      const ids = arr.map(decodePrefixedId).filter((x): x is number => x != null);
      setRoleDocumentTagIds(ids);
    },
    [setRoleDocumentTagIds]
  );

  const handlePersonaFilterSelect = useCallback(
    (value: string | string[]) => {
      const arr = Array.isArray(value) ? value : [value];
      const ids = arr.map(decodePrefixedId).filter((x): x is number => x != null);
      setRolePersonaIds(ids);
    },
    [setRolePersonaIds]
  );

  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string | number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleConfirmDelete = async () => {
    if (selectedRoleIds.size === 0) return;

    setIsBulkDeleting(true);
    try {
      await axios.post(
        `${API_CONFIG.LOCAL_API_BASE_URL}/roles/bulk_delete`,
        { role_ids: [...selectedRoleIds] },
        {
          headers: {
            ...API_CONFIG.API_HEADERS,
          },
          withCredentials: true,
        }
      );

      setSelectedRoleIds(new Set());
      setIsDeleteDialogOpen(false);
      retryRoles();

    } catch (error: any) {
      console.error("Error bulk deleting roles:", error);
      notify.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleDescription = (roleId: number) => {
    setExpandedRoleDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const [expandedRolePersonas, setExpandedRolePersonas] = useState<Set<number>>(new Set());
  const [expandedRoleDocTags, setExpandedRoleDocTags] = useState<Set<number>>(new Set());

  const toggleRolePersonaExpansion = (roleId: number) => {
    setExpandedRolePersonas((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const toggleRoleDocTagExpansion = (roleId: number) => {
    setExpandedRoleDocTags((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const columns: ColumnConfig<Role>[] = useMemo(() => {
    const baseColumns: ColumnConfig<Role>[] = [
      {
        key: "name",
        header: "Name",
        type: "text",
        width: 300,
        className: "min-w-0 overflow-hidden",
        render: (_, role) => (
          <DashboardPill
            intent="entity"
            entity="role"
            label={role.name}
            truncate
            className="max-w-full"
            title={role.name}
          />
        ),
      },
      {
        key: "description",
        header: "Description",
        type: "custom",
        width: 280,
        className: "min-w-0 overflow-hidden",
        render: (_, role) => (
          <div className="min-w-0 max-w-full overflow-hidden">
            <RoleDescription
              description={role.description || "No description available"}
              roleId={role.id}
              isExpanded={expandedRoleDescriptions.has(role.id)}
              onToggle={() => toggleDescription(role.id)}
            />
          </div>
        ),
      },
      {
        key: "personas",
        header: "Personas",
        type: "custom",
        width: 280,
        className: "min-w-0 overflow-hidden",
        render: (_, role) => {
          const personaLabels = normalizeLabelList(role.personas, "Persona");
          const visiblePersonas = personaLabels.slice(0, 1);
          const hiddenPersonas = personaLabels.slice(1);
          const personaChip = (label: string, key: string) => (
            <DashboardPill
              key={key}
              intent="entity"
              entity="persona"
              label={label}
              truncate
              className="max-w-full"
              title={label}
            />
          );

          if (personaLabels.length === 0) {
            return (
              <span className="text-xs text-text-muted italic">No personas assigned</span>
            );
          }

          return (
            <div className="flex w-full min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                {visiblePersonas.map((label) =>
                  personaChip(label, `${role.id}-persona-${label}`),
                )}
              </div>
              {hiddenPersonas.length > 0 && (
                <div className="shrink-0">
                <Popover
                  open={expandedRolePersonas.has(role.id)}
                  onOpenChange={() => toggleRolePersonaExpansion(role.id)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-3 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 transition-all duration-200 rounded-full border border-primary/20 hover:border-primary/40"
                    >
                      +{hiddenPersonas.length} more
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-72 max-h-60 overflow-y-auto bg-background text-text-main"
                  >
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      All personas ({personaLabels.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {personaLabels.map((label) =>
                        personaChip(label, `${role.id}-all-persona-${label}`),
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "document_tags",
        header: "Document Tags",
        type: "custom",
        width: 280,
        className: "min-w-0 overflow-hidden",
        render: (_, role) => {
          const documentTagLabels = normalizeLabelList(role.document_tags, "Document Tag");
          const visibleDocTags = documentTagLabels.slice(0, 1);
          const hiddenDocTags = documentTagLabels.slice(1);
          const docTagChip = (label: string, key: string) => (
            <DashboardPill
              key={key}
              intent="entity"
              entity="doc-tag"
              label={label}
              truncate
              className="max-w-full"
              title={label}
            />
          );

          if (documentTagLabels.length === 0) {
            return (
              <span className="text-xs text-text-muted italic">No document tags</span>
            );
          }

          return (
            <div className="flex w-full min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                {visibleDocTags.map((label) =>
                  docTagChip(label, `${role.id}-doc-${label}`),
                )}
              </div>
              {hiddenDocTags.length > 0 && (
                <div className="shrink-0">
                <Popover
                  open={expandedRoleDocTags.has(role.id)}
                  onOpenChange={() => toggleRoleDocTagExpansion(role.id)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-3 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 transition-all duration-200 rounded-full border border-primary/20 hover:border-primary/40"
                    >
                      +{hiddenDocTags.length} more
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-72 max-h-60 overflow-y-auto bg-background text-text-main"
                  >
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      All document tags ({documentTagLabels.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {documentTagLabels.map((label) =>
                        docTagChip(label, `${role.id}-all-doc-${label}`),
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "created_at",
        header: "Created At",
        type: "date",
        width: 160,
        render: (_, role) => (
          <span className="text-sm text-text-muted">
            {formatDashboardDate(role.created_at)}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: "Last Updated",
        type: "date",
        width: 160,
        render: (_, role) => (
          <span className="text-sm text-text-muted tabular-nums whitespace-nowrap">
            {formatLastUpdated(role.updated_at)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        width: 120,
        render: (_, role) => (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={() => {
                setEditingRole(role);
                setIsRoleFormOpen(true);
              }}
              title={!isAdmin ? "Admin privileges required" : "Edit role"}
              className={dashboardRowEditIconButtonClass}
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={() => handleDeleteRole(role.id, role.name || `Role #${role.id}`)}
              title={!isAdmin ? "Admin privileges required" : "Delete role"}
              className={dashboardRowDeleteIconButtonClass}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];

    return baseColumns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAdmin,
    expandedRoleDescriptions,
    expandedRolePersonas,
    expandedRoleDocTags,
    setEditingRole,
    setIsRoleFormOpen,
    handleDeleteRole,
  ]);

  return (
    <TabsContent value="roles" className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Role Management"
          description="Manage user roles and their associated permissions"
          titleRowEnd={
            <Button
              className="flex sm:hidden p-1"
              variant="outline"
              size="sm"
              disabled={!isAdmin}
              onClick={() => {
                setEditingRole(undefined);
                setIsRoleFormOpen(true);
              }}
              title={!isAdmin ? "Admin privileges required" : ""}
            >
              <Plus className="h-4 w-4" />
              Add Role
              {!isAdmin && (
                <span className="ml-1 text-xs text-text-main">
                  (Admin Only)
                </span>
              )}
            </Button>
          }
          actions={
              <DashboardTabToolbar
                  primary={
                    <>
                  <DashboardTabSearchInput
                    placeholder="Search roles..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                  />
                  <DashboardTabFiltersPopover
                    filterCount={roleFilterCount}
                    onClear={clearRoleFilters}
                    align="end"
                  >
                    <div className="space-y-2">
                      <Label className="text-text-main">Document tags</Label>
                      <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto sm:max-h-none">
                        {roleDocumentTagIds.map((id) => {
                          const tag = docTagOptions.find((t) => t.id === id);
                          const label = tag?.name ?? `Tag #${id}`;
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="flex flex-wrap items-center gap-1 border-border-main bg-background text-text-main"
                            >
                              <span className="truncate max-w-[200px]">{label}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRoleDocumentTagIds((prev) => prev.filter((x) => x !== id))
                                }
                                className="ml-0.5 rounded-full p-0.5 hover:bg-surface"
                                aria-label={`Remove ${label}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                      <Combobox
                        placeholder="Search and add document tags..."
                        onOpen={loadDocTagDropdownItems}
                        onSelect={handleDocTagFilterSelect}
                        defaultValue={docTagEncodedSelection}
                        className="text-xs sm:text-sm text-text-main border-border-main h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-text-main">Personas</Label>
                      <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto sm:max-h-none">
                        {rolePersonaIds.map((id) => {
                          const p = personaOptions.find((x) => x.id === id);
                          const label = p?.persona_name ?? `Persona #${id}`;
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="flex flex-wrap items-center gap-1 border-border-main bg-background text-text-main"
                            >
                              <span className="truncate max-w-[200px]">{label}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRolePersonaIds((prev) => prev.filter((x) => x !== id))
                                }
                                className="ml-0.5 rounded-full p-0.5 hover:bg-surface"
                                aria-label={`Remove ${label}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                      <Combobox
                        placeholder="Search and add personas..."
                        onOpen={loadPersonaDropdownItems}
                        onSelect={handlePersonaFilterSelect}
                        defaultValue={personaEncodedSelection}
                        formatItemLabel={decodePrefixedLabel}
                        className="text-xs sm:text-sm text-text-main border-border-main h-10"
                      />
                    </div>
                  </DashboardTabFiltersPopover>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden max-lg:px-2 sm:flex h-10"
                    disabled={!isAdmin}
                    onClick={() => {
                      setEditingRole(undefined);
                      setIsRoleFormOpen(true);
                    }}
                    title={!isAdmin ? "Admin privileges required" : "Add role"}
                  >
                    <Plus className="h-4 w-4" />
                    <span className={dashboardTabToolbarButtonLabelClassName}>
                      Add Role
                      {!isAdmin && (
                        <span className="ml-1 text-xs text-text-main">
                          (Admin Only)
                        </span>
                      )}
                    </span>
                  </Button>
                    </>
                  }
                  refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={retryRoles}
                    disabled={rolesLoading}
                    title="Refresh roles"
                  >
                    <RefreshCw className={`h-4 w-4 ${rolesLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  }
                />
          }
        />

        {hasActiveRoleListFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllRoleListFilters}>
            {roleDocumentTagIds.map((id) => {
              const tag = docTagOptions.find((t) => t.id === id);
              const label = tag?.name ?? `Tag #${id}`;
              return (
                <DashboardTabFilterChip
                  key={`dt-${id}`}
                  onRemove={() =>
                    setRoleDocumentTagIds((prev) => prev.filter((x) => x !== id))
                  }
                  ariaLabel={`Remove document tag ${label}`}
                >
                  <span className="truncate">Doc tag: {label}</span>
                </DashboardTabFilterChip>
              );
            })}
            {rolePersonaIds.map((id) => {
              const p = personaOptions.find((x) => x.id === id);
              const label = p?.persona_name ?? `Persona #${id}`;
              return (
                <DashboardTabFilterChip
                  key={`p-${id}`}
                  onRemove={() =>
                    setRolePersonaIds((prev) => prev.filter((x) => x !== id))
                  }
                  ariaLabel={`Remove persona ${label}`}
                >
                  <span className="truncate">Persona: {label}</span>
                </DashboardTabFilterChip>
              );
            })}
            <DashboardTabSearchFilterChip
              query={roleSearch}
              onClear={() => setRoleSearch("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <CardContent className="text-text-main flex-1 min-h-0 overflow-y-auto relative z-10">
          {rolesError && !rolesLoading ? (
            <div className="p-4">
              <ErrorRetry error={rolesError} onRetry={retryRoles} isLoading={rolesLoading} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={roles}
              isLoading={rolesLoading}
                {...dashboardTableLoadingProps}
              disablePagination
              enableFilters={false}
              enableGlobalSearch={false}
              enableRowSelection
              onSelectionChange={(ids) => setSelectedRoleIds(ids)}
              renderBulkActions={(_ids, clear) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-status-error hover:text-status-error border-status-error/30 hover:border-status-error/60"
                  disabled={!isAdmin}
                  onClick={() => setIsDeleteDialogOpen(true)}
                  title={!isAdmin ? "Admin privileges required" : "Delete selected roles"}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
              emptyMessage={
                roleSearch.trim()
                  ? "No roles match your search. Try different keywords."
                  : "No roles found. Create your first role to get started."
              }
              loadingMessage="Loading roles..."
              getRowId={(role) => role.id}
              className={dashboardAdminTableClassName}
            />
          )}
        </CardContent>
        <EnhancedPagination
          currentPage={rolePage}
          setCurrentPage={setRolePage}
          pageSize={rolePageSize}
          setPageSize={setRolePageSize}
          totalItems={roleTotal}
          displayedItemsCount={roles.length}
          isMobile={isMobile}
        />
      </Card>

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${selectedRoleIds.size} Role${selectedRoleIds.size !== 1 ? "s" : ""}?`}
        description="This action cannot be undone."
        itemName={`${selectedRoleIds.size} role${selectedRoleIds.size !== 1 ? "s" : ""}`}
        isLoading={isBulkDeleting}
      />
    </TabsContent>
  );
};



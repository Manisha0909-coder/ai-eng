import { useCallback, useEffect, useState, useMemo } from "react";
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
import { DashboardPill } from "../components/DashboardPill";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminFormDialog, FormDialogFooter } from "../components/Forms/AdminFormDialog";
import { FormField } from "../components/Forms/FormField";
import notify from "@/utils/notify";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import {
  Plus,
  CloudSync,
  RefreshCw,
  Trash2,
  AlertCircle,
  SquarePen,
  Eye,
  EyeOff,
  Copy,
  Loader2,
  Server,
} from "lucide-react";
import {
  AttachToolServerRequest,
  HealthCheckToolServerResponse,
  rbacApi,
  ToolServer,
} from "@/services/rbac/rbacApi";
import { ErrorRetry } from "../components/ErrorRetry";
import { formatDashboardDate } from "@/utils/helper";
import { formatLastUpdated } from "../utils/dashboardHelper";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { TableQueryParams } from "@/components/DataTable/types";
import { DashboardLoader } from "@/components/ContentLoader";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabSearchableSelect,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
} from "../components/DashboardTabFilterUi";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";
import { cn } from "@/lib/utils";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";

export interface ToolServersSectionProps {
  isAdmin: boolean;
  isMobile: boolean;
  activeTab?: string;
}


export const ToolServersSection = ({
  isAdmin,
  activeTab,
}: Readonly<ToolServersSectionProps>) => {
  const [servers, setServers] = useState<ToolServer[]>([]);
  const [serversTotal, setServersTotal] = useState(0);
  const [tableQuery, setTableQuery] = useState<TableQueryParams>({
    page: 1,
    limit: 10,
    offset: 0,
    sort_by: "created_at",
    sort_order: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  /** Exact API filter: custom | mcp-sse | mcp-http | mcp-stdio */
  const [serverTypeFilter, setServerTypeFilter] = useState<string | null>(null);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversError, setServersError] = useState<string | null>(null);
  const [isAttachFormOpen, setIsAttachFormOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isDetachDialogOpen, setIsDetachDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ToolServer | null>(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncingServerName, setSyncingServerName] = useState<string | null>(null);
  const [detachLoading, setDetachLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [healthStatuses, setHealthStatuses] = useState<
    Record<string, HealthCheckToolServerResponse>
  >({});
  const [attachFormData, setAttachFormData] = useState<AttachToolServerRequest>(
    {
      name: "",
      url: "",
      type: "custom",
      envs: {},
    }
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    current_name: "",
    new_name: "",
    url: "",
    type: "custom" as "custom" | "mcp-sse" | "mcp-http" | "mcp-stdio",
    envs: {} as Record<string, string>,
  });
  const [envFields, setEnvFields] = useState<
    Array<{ key: string; value: string, id: number }>
  >([]);
  const [editEnvFields, setEditEnvFields] = useState<
    Array<{ key: string; value: string }>
  >([]);
  const [envIndex, setEnvIndex] = useState(0);
  const [expandedEnvRows, setExpandedEnvRows] = useState<Set<string>>(new Set());
  const [showEnvVarsInModal, setShowEnvVarsInModal] = useState(true);
  const [revealedEnvValues, setRevealedEnvValues] = useState<Set<string>>(new Set());
  const MASKED_ENV_VALUE = "••••••••";

  const normalizeTableQuery = useCallback(
    (query: TableQueryParams): TableQueryParams => ({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      offset: query.offset ?? 0,
      sort_by: query.sort_by ?? "created_at",
      sort_order: query.sort_order ?? "desc",
      search: query.search?.trim() || undefined,
      filters: query.filters,
    }),
    []
  );

  const isSameTableQuery = useCallback(
    (a: TableQueryParams, b: TableQueryParams) =>
      a.page === b.page &&
      a.limit === b.limit &&
      a.offset === b.offset &&
      a.sort_by === b.sort_by &&
      a.sort_order === b.sort_order &&
      (a.search ?? undefined) === (b.search ?? undefined),
    []
  );

  const handleTableQueryChange = useCallback(
    (nextQuery: TableQueryParams) => {
      setTableQuery((prev) => {
        const normalizedPrev = normalizeTableQuery(prev);
        const normalizedNext = normalizeTableQuery(nextQuery);

        // Search is controlled by the header input; DataTable has no global search here.
        normalizedNext.search = normalizedPrev.search;

        return isSameTableQuery(normalizedPrev, normalizedNext) ? prev : normalizedNext;
      });
    },
    [normalizeTableQuery, isSameTableQuery]
  );

  const fetchServers = useCallback(async (options?: { skipHealthCheck?: boolean; silent?: boolean }) => {
    const skipHealthCheck = options?.skipHealthCheck === true;
    const silent = options?.silent === true;
    try {
      if (!silent) setServersLoading(true);
      setServersError(null);
      const offset = tableQuery.offset ?? 0;
      const limit = tableQuery.limit ?? 10;
      const sortBy =
        tableQuery.sort_by === "created_at" ||
        tableQuery.sort_by === "updated_at" ||
        tableQuery.sort_by === "name" ||
        tableQuery.sort_by === "type"
          ? tableQuery.sort_by
          : "created_at";
      const sortOrder =
        tableQuery.sort_order === "asc" || tableQuery.sort_order === "desc"
          ? tableQuery.sort_order
          : "desc";

      // Wrap in try-catch to handle any unexpected errors
      let response;
      try {
        response = await rbacApi.toolServers.list({
          limit,
          offset,
          search: tableQuery.search,
          type: serverTypeFilter?.trim() || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        });
      } catch (fetchError: any) {
        // Handle fetch errors (network issues, etc.)
        console.error("Error calling tool servers API:", fetchError);
        const errorMsg = fetchError?.message || "Failed to fetch tool servers";
        setServersError(errorMsg);
        notify.error(errorMsg);
        setServers([]);
        setServersTotal(0);
        return;
      }

      // Check if the API call was successful
      // The API returns { success: false } instead of throwing on some errors
      // Explicitly check for false (not just falsy) to avoid issues with undefined
      if (!response) {
        const errorMsg = "No response from server. Please try again.";
        setServersError(errorMsg);
        notify.error(errorMsg);
        setServers([]);
        setServersTotal(0);
        return;
      }

      // Check if the API call was successful
      // The API returns { success: false } instead of throwing on some errors
      // Also check for error indicators in the response
      const isError =
        response.success === false ||
        (response as any)?.error !== undefined ||
        (response as any)?.error?.message !== undefined;

      if (isError) {
        const errorMsg =
          (response as any)?.error?.message ||
          (response as any)?.message ||
          "Failed to fetch tool servers.";
        console.error("Tool servers API returned error:", response);
        setServersError(errorMsg);
        notify.error(errorMsg);
        setServers([]);
        setServersTotal(0);
        return;
      }

      // Success case - clear any previous errors and update data
      // Ensure response has valid structure
      if (
        response &&
        typeof response === "object" &&
        ("data" in response || "total" in response)
      ) {
        const fetchedServers = response.data || [];
        setServers(fetchedServers);
        setServersTotal(response.total || 0);
        setServersError(null);

        if (fetchedServers.length > 0 && !skipHealthCheck) {
          const visibleRows = fetchedServers.slice(0, limit);
          // Run health checks in parallel for current visible rows
          // Don't await - let them run in background
          visibleRows.forEach(async (server) => {
            try {
              setHealthLoading((prev) => ({ ...prev, [server.name]: true }));
              const healthResponse: HealthCheckToolServerResponse =
                await rbacApi.toolServers.health({
                  server_name: server.name,
                });
              setHealthStatuses((prev) => ({
                ...prev,
                [server.name]: healthResponse,
              }));
            } catch (error: any) {
              console.error(`Error checking health for ${server.name}:`, error);
              const errorMsg = error?.message || "Failed to check tool server health";
              setHealthStatuses((prev) => ({
                ...prev,
                [server.name]: {
                  status: "error",
                  message: errorMsg,
                  error: errorMsg,
                  server_name: server.name,
                  server_url: server.url,
                  health_status: 0,
                  health_response: {},
                },
              }));
            } finally {
              setHealthLoading((prev) => ({ ...prev, [server.name]: false }));
            }
          });
        }
      } else {
        // Invalid response structure - treat as error
        const errorMsg = "Invalid response from server. Please try again.";
        console.error("Invalid tool servers response structure", response);
        setServersError(errorMsg);
        notify.error(errorMsg);
        setServers([]);
        setServersTotal(0);
      }
    } catch (error: any) {
      console.error("Error fetching tool servers:", error);
      const errorMsg =
        error?.message ||
        error?.response?.data?.message ||
        "Failed to fetch tool servers";
      setServersError(errorMsg);
      notify.error(errorMsg);
      setServers([]);
      setServersTotal(0);
    } finally {
      if (!silent) setServersLoading(false);
    }
  }, [tableQuery, serverTypeFilter]);

  useEffect(() => {
    if (activeTab !== "tool-servers") return;
    setTableQuery((prev) => ({
      ...prev,
      page: 1,
      offset: 0,
    }));
  }, [serverTypeFilter, activeTab]);

  // Only fetch when tool-servers tab is active
  useEffect(() => {
    if (activeTab === "tool-servers") {
      fetchServers();
    }
  }, [fetchServers, activeTab]);

  useEffect(() => {
    if (activeTab !== "tool-servers") return;
    const timeoutId = window.setTimeout(() => {
      const normalizedSearch = searchTerm.trim() || undefined;
      setTableQuery((prev) => {
        const next: TableQueryParams = {
          ...prev,
          page: 1,
          offset: 0,
          search: normalizedSearch,
        };
        return isSameTableQuery(normalizeTableQuery(prev), normalizeTableQuery(next))
          ? prev
          : next;
      });
    }, DASHBOARD_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, searchTerm, normalizeTableQuery, isSameTableQuery]);

  const handleAddEnvField = () => {
    setEnvFields(prev => [
      ...prev,
      { id: envIndex, key: "", value: "" }
    ]);
    setEnvIndex(c => c + 1);
  };

  const handleRemoveEnvField = (index: number) => {
    setEnvFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnvFieldChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    setEnvFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddEditEnvField = () => {
    setEditEnvFields((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveEditEnvField = (index: number) => {
    setEditEnvFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditEnvFieldChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    setEditEnvFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAttachSubmit = async () => {
    if (!attachFormData.name.trim() || !attachFormData.url.trim()) {
      notify.error("Name and URL are required");
      return;
    }

    setAttachLoading(true);
    try {
      const envs: Record<string, string> = {};
      envFields.forEach((field) => {
        if (field.key.trim() && field.value.trim()) {
          envs[field.key.trim()] = field.value.trim();
        }
      });

      const attachResponse = await rbacApi.toolServers.attach({
        name: attachFormData.name.trim(),
        url: attachFormData.url.trim(),
        type: attachFormData.type,
        envs: Object.keys(envs).length > 0 ? envs : undefined,
      });

      const attachedServer: ToolServer = attachResponse.server ?? {
        id: 0,
        name: attachFormData.name.trim(),
        url: attachFormData.url.trim(),
        type: attachFormData.type,
        envs: Object.keys(envs).length > 0 ? envs : {},
        created_at: "",
        updated_at: "",
      };

      setAttachFormData({ name: "", url: "", type: "custom", envs: {} });
      setEnvFields([]);
      setIsAttachFormOpen(false);

      // Refresh list without bulk health checks — only check the newly attached server
      try {
        await fetchServers({ skipHealthCheck: true, silent: true });
        await handleHealthCheck(attachedServer, false);
      } catch (fetchError) {
        console.error("Error refreshing servers after attach:", fetchError);
      }
    } catch (error: any) {
      console.error("Error attaching tool server:", error);
      notify.error(error);
    } finally {
      setAttachLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedServer) return;

    setSyncLoading(true);
    const server = selectedServer; 
    setSyncingServerName(server.name);
    try {
      await rbacApi.toolServers.sync({
        name: server.name,
      });

      // Close dialog and clear state first
      setIsSyncDialogOpen(false);
      setSelectedServer(null);

      // Then refresh the list silently (no full-table loading skeleton) and skip
      // the bulk health check — only the synced server's health is refreshed.
      try {
        await fetchServers({ skipHealthCheck: true, silent: true });
        await handleHealthCheck(server, false);
      } catch (fetchError) {
        console.error("Error refreshing servers after sync:", fetchError);
        // Don't show error toast for refresh failure, just log it
      }
    } catch (error: any) {
      console.error("Error syncing tool server:", error);
      notify.error(error);
      // Still close the dialog even on error
      setIsSyncDialogOpen(false);
      setSelectedServer(null);
    } finally {
      setSyncLoading(false);
      setSyncingServerName(null);
    }
  };

  const handleDetach = async () => {
    if (!selectedServer) return;

    setDetachLoading(true);
    const serverName = selectedServer.name; // Store name before clearing state
    try {
      await rbacApi.toolServers.detach({
        name: serverName,
      });

      // Close dialog and clear state first
      setIsDetachDialogOpen(false);
      setSelectedServer(null);

      // Clear cached health for the detached server
      setHealthStatuses((prev) => {
        const next = { ...prev };
        delete next[serverName];
        return next;
      });
      setHealthLoading((prev) => {
        const next = { ...prev };
        delete next[serverName];
        return next;
      });

      // Refresh list without re-checking health on remaining servers
      try {
        await fetchServers({ skipHealthCheck: true, silent: true });
      } catch (fetchError) {
        console.error("Error refreshing servers after detach:", fetchError);
        // Don't show error toast for refresh failure, just log it
      }
    } catch (error: any) {
      console.error("Error detaching tool server:", error);
      notify.error(error);
      // Still close the dialog even on error
      setIsDetachDialogOpen(false);
      setSelectedServer(null);
    } finally {
      setDetachLoading(false);
    }
  };

  const openSyncDialog = (server: ToolServer) => {
    setSelectedServer(server);
    setIsSyncDialogOpen(true);
  };

  const openDetachDialog = (server: ToolServer) => {
    setSelectedServer(server);
    setIsDetachDialogOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setIsEditMode(false);
    setSelectedServer(null);
    setEditEnvFields([]);
    setShowEnvVarsInModal(false);
    setRevealedEnvValues(new Set());
  };

  const handleHealthCheck = async (server: ToolServer, showToast = true) => {
    setHealthLoading((prev) => ({ ...prev, [server.name]: true }));
    try {
      const response: HealthCheckToolServerResponse =
        await rbacApi.toolServers.health({
          server_name: server.name,
        });

      setHealthStatuses((prev) => ({
        ...prev,
        [server.name]: response,
      }));

      // Show toast based on health status (only if explicitly requested)
      if (showToast) {
        if (isHealthy(response)) {
          notify.success(response.message || "Tool server is healthy");
        } else {
          notify.error(response.message || "Tool server is unhealthy");
        }
      }
    } catch (error: any) {
      console.error("Error checking tool server health:", error);
      const errorMsg = error?.message || "Failed to check tool server health";

      if (showToast) {
        notify.error(errorMsg);
      }

      // Set error status
      setHealthStatuses((prev) => ({
        ...prev,
        [server.name]: {
          status: "error",
          message: errorMsg,
          error: errorMsg,
          server_name: server.name,
          server_url: server.url,
          health_status: 0,
          health_response: {},
        },
      }));
    } finally {
      setHealthLoading((prev) => ({ ...prev, [server.name]: false }));
    }
  };
  const startRowEdit = (server: ToolServer) => {
    setSelectedServer(server);
    setEditForm({
      current_name: server.name,
      new_name: server.name,
      url: server.url,
      type: server.type || "custom",
      envs: { ...server.envs },
    });
    // Initialize edit env fields from server envs
    const envFieldsArray = Object.entries(server.envs || {}).map(([key, value]) => ({
      key,
      value,
    }));
    setEditEnvFields(envFieldsArray);
    setIsEditMode(true);
    setShowEnvVarsInModal(true); // Show env vars by default when opening modal
    setIsDetailsModalOpen(true);
  };

  const handleSaveServer = async () => {
    if (!selectedServer) return;

    try {
      // Convert editEnvFields to envs object
      const envs: Record<string, string> = {};
      editEnvFields.forEach((field) => {
        if (field.key.trim() && field.value.trim()) {
          envs[field.key.trim()] = field.value.trim();
        }
      });

      const previousName = editForm.current_name;

      const updateResponse = await rbacApi.toolServers.update({
        current_name: editForm.current_name,
        new_name: editForm.new_name,
        url: editForm.url,
        type: editForm.type,
        envs: Object.keys(envs).length > 0 ? envs : undefined,
      });

      const updatedServer: ToolServer = updateResponse.server ?? {
        ...selectedServer,
        name: editForm.new_name.trim() || previousName,
        url: editForm.url,
        type: editForm.type,
        envs: Object.keys(envs).length > 0 ? envs : {},
      };

      setIsEditMode(false);
      setIsDetailsModalOpen(false);
      setSelectedServer(null);
      setEditEnvFields([]);

      // Drop stale health entry if the server was renamed
      if (previousName !== updatedServer.name) {
        setHealthStatuses((prev) => {
          const next = { ...prev };
          delete next[previousName];
          return next;
        });
        setHealthLoading((prev) => {
          const next = { ...prev };
          delete next[previousName];
          return next;
        });
      }

      // Refresh list without bulk health checks — only recheck the updated server
      try {
        await fetchServers({ skipHealthCheck: true, silent: true });
        await handleHealthCheck(updatedServer, false);
      } catch (fetchError) {
        console.error("Error refreshing servers after update:", fetchError);
      }
    } catch (error: any) {
      notify.error(error);
    }
  };

  const toggleEnvExpansion = useCallback((serverId: string) => {
    setExpandedEnvRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serverId)) {
        newSet.delete(serverId);
      } else {
        newSet.add(serverId);
      }
      return newSet;
    });
  }, []);

  const toggleEnvValueExpansion = useCallback((envKey: string) => {
    setRevealedEnvValues((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(envKey)) {
        newSet.delete(envKey);
      } else {
        newSet.add(envKey);
      }
      return newSet;
    });
  }, []);

  const copyEnvValue = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify.success("Copied");
    } catch (error) {
      console.error("Failed to copy env value:", error);
      notify.error("Copy failed");
    }
  }, []);

  const isHealthy = (h: HealthCheckToolServerResponse | undefined) =>
    !!h && (h.status === "success" || h.health_status === 200);

  const getHealthStatusBadge = (server: ToolServer, showRefreshButton = false) => {
    const healthStatus = healthStatuses[server.name];
    const isLoading = healthLoading[server.name];

    const badgeContent = (() => {
      if (isLoading) {
        return (
          <span className="flex items-center justify-center w-24">
            {/* <DashboardLoader size="xs" variant="inline" className="mr-1" /> */}
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Checking...
          </span>
        );
      }

      if (!healthStatus) {
        return (
          <span className="flex items-center justify-center w-24">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Checked
            {showRefreshButton && isAdmin && (
              <RefreshCw className="h-3 w-3 ml-1" />
            )}
          </span>
        );
      }

      if (isHealthy(healthStatus)) {
        return (
          <span className="flex items-center justify-center w-24">
            {showRefreshButton && isAdmin && (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Healthy
          </span>
        );
      }

      return (
        <span className="flex items-center justify-center w-24">
          {showRefreshButton && isAdmin && (
            <RefreshCw className="h-3 w-3 mr-1 " />
          )}
          Unhealthy
        </span>
      );
    })();

    const healthBadgeStatus = isLoading || !healthStatus
      ? "neutral"
      : isHealthy(healthStatus)
        ? "success"
        : "error";

    if (showRefreshButton && isAdmin && !isLoading) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleHealthCheck(server, true);
          }}
          disabled={healthLoading[server.name]}
          className="inline-flex items-center justify-center min-w-[6rem]"
          title="Check health status"
        >
          <StatusBadge status={healthBadgeStatus} label="" icon={badgeContent} className="min-w-[6rem] justify-center" />
        </button>
      );
    }

    return <StatusBadge status={healthBadgeStatus} label="" icon={badgeContent} className="min-w-[6rem] justify-center" />;
  };

  // Define columns for DataTable
  const columns: ColumnConfig<ToolServer>[] = useMemo(() => [
    {
      key: "name",
      header: "Name",
      type: "text",
      width: 150,
      searchable: true,
      sortable: true,
      render: (_, server) => (
        <DashboardPill intent="entity" entity="server" label={server.name} />
      ),
    },
    {
      key: "url",
      header: "URL",
      type: "text",
      width: 250,
      searchable: true,
      // Remove custom render to let DataTable handle text display with show more/less
    },
    {
      key: "type",
      header: "Type",
      type: "text",
      width: 120,
      sortable: true,
      render: (_, server) => {
        const serverType = server.type || "custom";
        const isMcpType = serverType.startsWith("mcp-");
        return (
          <DashboardPill
            intent="status"
            status={isMcpType ? "info" : "neutral"}
            label={serverType}
          />
        );
      },
    },

    {
      key: "envs",
      header: "Environment Variables",
      type: "custom",
      width: 300,
      render: (_, server) => {
        const serverId = String(server.id ?? server.name);
        const isExpanded = expandedEnvRows.has(serverId);
        const envEntries = server.envs ? Object.entries(server.envs) : [];
        const envCount = envEntries.length;
        const maxVisible = 1; // Show max 1 env var when collapsed

        if (envCount === 0) {
          return <span className="text-text-muted text-xs">None</span>;
        }

        const visibleEnvs = isExpanded ? envEntries : envEntries.slice(0, maxVisible);
        const hasMore = envCount > maxVisible;

        return (
          <div className="w-full min-w-0">
            <div className="flex flex-col gap-2">
              {visibleEnvs.map(([key, value]) => {
                const envId = `${serverId}-${key}`;
                const isRevealed = revealedEnvValues.has(envId);
                const valueStr = String(value ?? "");
                const displayValue = isRevealed ? valueStr : MASKED_ENV_VALUE;

                return (
                  <div key={envId} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="group relative w-full rounded-xl border border-border-main/60 bg-surface/60 backdrop-blur-md px-3 py-2 overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
                        <div className="relative flex items-center justify-between gap-2">
                          <div
                            className="text-xs text-text-main font-mono break-all min-w-0 flex-1"
                            title={isRevealed ? `${key}: ${valueStr}` : `${key}: ${MASKED_ENV_VALUE}`}
                          >
                            <span className="text-text-main/80">{key}</span>
                            <span className="text-text-main/60">:</span>
                            <span className="ml-1 inline-flex items-center rounded-md bg-black/10 dark:bg-white/10 px-2 py-0.5">
                              {displayValue}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEnvValueExpansion(envId);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border-main/60 bg-background/40 hover:bg-background/70 text-text-muted hover:text-text-main transition-all"
                              title={isRevealed ? "Hide value" : "Show value"}
                            >
                              {isRevealed ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyEnvValue(valueStr);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border-main/60 bg-background/40 hover:bg-background/70 text-text-muted hover:text-text-main transition-all"
                              title="Copy value"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEnvExpansion(serverId);
                }}
                className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
              >
                {isExpanded ? (
                  <span>Show less</span>
                ) : (
                  <>
                    <span>Show {envCount - maxVisible} more</span>
                    <span className="text-text-muted">({envCount} total)</span>
                  </>
                )}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "Created At",
      type: "date",
      width: 150,
      sortable: true,
      render: (_, server) => (
        <span className="text-sm text-text-muted">
          {formatDashboardDate(server.created_at)}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Last Updated",
      type: "date",
      width: 150,
      sortable: true,
      render: (_, server) => (
        <span className="text-sm text-text-muted tabular-nums whitespace-nowrap">
          {formatLastUpdated(server.updated_at)}
        </span>
      ),
    },
    {
      key: "health",
      header: "Health Status",
      type: "custom",
      width: 150,
      render: (_, server) => getHealthStatusBadge(server, true),
    },
    {
      key: "actions",
      header: "Actions",
      type: "custom",
      width: 220,
      render: (_, server) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              startRowEdit(server);
            }}
            className={dashboardRowEditIconButtonClass}
            title="Edit server"
          >
            <SquarePen className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openSyncDialog(server);
                }}
                className={cn(
                  dashboardRowEditIconButtonClass,
                  "h-9 w-auto min-w-0 gap-1.5 px-2 sm:px-2.5 transition-all",
                  syncingServerName === server.name &&
                    "animate-pulse ring-2 ring-primary/50"
                )}
                title="Re-discover and register tools from this server (different from refreshing the list)"
                disabled={syncLoading}
              >
                <CloudSync
                  className={cn(
                    "h-4 w-4 shrink-0",
                    syncingServerName === server.name &&
                      "animate-spin text-primary"
                  )}
                />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetachDialog(server);
                }}
                className={dashboardRowDeleteIconButtonClass}
                title="Detach server"
                disabled={detachLoading}
              >
                {detachLoading && selectedServer?.name === server.name ? (
                  <DashboardLoader variant="inline" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ], [isAdmin, healthStatuses, healthLoading, syncLoading, syncingServerName, detachLoading, selectedServer, startRowEdit, openSyncDialog, openDetachDialog, handleHealthCheck, expandedEnvRows, toggleEnvExpansion, revealedEnvValues, toggleEnvValueExpansion, servers]);

  const hasActiveToolServerListFilters =
    searchTerm.trim().length > 0 || Boolean(serverTypeFilter);

  const clearAllToolServerListFilters = () => {
    setSearchTerm("");
    setServerTypeFilter(null);
  };

  return (
    <TabsContent
      value="tool-servers"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Tool Servers Management"
          description="Attach servers, sync tools from a server into the registry, and detach"
          titleColumnClassName="text-left pb-2 sm:pb-0"
          descriptionClassName="mb-0"
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                    <DashboardTabSearchInput
                      placeholder="Search tool servers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <DashboardTabFiltersPopover
                      filterCount={serverTypeFilter ? 1 : 0}
                      onClear={() => setServerTypeFilter(null)}
                      align="end"
                      triggerClassName="shrink-0"
                    >
                      <DashboardTabSearchableSelect
                        label="Type"
                        options={[
                          { label: "All types", value: "" },
                          { label: "custom", value: "custom" },
                          { label: "mcp-sse", value: "mcp-sse" },
                          { label: "mcp-http", value: "mcp-http" },
                          { label: "mcp-stdio", value: "mcp-stdio" },
                        ]}
                        value={serverTypeFilter ?? ""}
                        onValueChange={(v) => setServerTypeFilter(v || null)}
                        placeholder="Search types..."
                      />
                    </DashboardTabFiltersPopover>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAttachFormOpen(true)}
                      disabled={!isAdmin}
                      className="h-10 max-lg:px-2 shrink-0"
                      title={!isAdmin ? "Admin privileges required" : "Attach server"}
                    >
                      <Plus className="h-4 w-4 lg:mr-1" />
                      <span
                        className={`text-xs sm:text-sm ${dashboardTabToolbarButtonLabelClassName}`}
                      >
                        Attach Server
                        {!isAdmin && <span className="ml-1 text-xs">(Admin Only)</span>}
                      </span>
                    </Button>
                  </>
                }
                refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0"
                    onClick={fetchServers}
                    disabled={serversLoading}
                    title="Reload the tool server list (does not sync tools from servers)"
                  >
                    <RefreshCw
                      className={`h-4 w-4 lg:mr-1 ${serversLoading ? "animate-spin" : ""}`}
                    />
                  </Button>
                }
              />
          }
        />

        {hasActiveToolServerListFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllToolServerListFilters}>
            {serverTypeFilter ? (
              <DashboardTabFilterChip
                onRemove={() => setServerTypeFilter(null)}
                ariaLabel="Clear type filter"
              >
                <span className="truncate">Type: {serverTypeFilter}</span>
              </DashboardTabFilterChip>
            ) : null}
            <DashboardTabSearchFilterChip
              query={searchTerm}
              onClear={() => setSearchTerm("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
          {(() => {
            if (serversError && !serversLoading) {
              return (
                <div className="p-4">
                  <ErrorRetry
                    error={serversError}
                    onRetry={fetchServers}
                    isLoading={serversLoading}
                  />
                </div>
              );
            }
            return (
              <DataTable
                columns={columns}
                data={servers}
                isLoading={serversLoading}
                {...dashboardTableLoadingProps}
                enableFilters={false}
                enableGlobalSearch={false}
                enableRowSelection
                serverSide={true}
                totalItems={serversTotal}
                onQueryChange={handleTableQueryChange}
                emptyMessage={
                  searchTerm.trim()
                    ? "No tool servers found matching your search."
                    : "No tool servers found. Attach your first server to get started."
                }
                loadingMessage="Loading tool servers..."
                pageSizeOptions={[10, 25, 50, 100]}
                defaultPageSize={10}
                // onRefresh={fetchServers}
                getRowId={(server) => {
                  // Ensure unique key: use id if available, otherwise use name
                  // If id is 0 or falsy but name exists, combine them for uniqueness
                  if (server.id !== null && server.id !== undefined) {
                    return `server-${server.id}-${server.name}`;
                  }
                  return `server-${server.name}`;
                }}
                className={dashboardAdminTableClassName}
              />
            );
          })()}
        </CardContent>
      </Card>

      <AdminFormDialog
        isOpen={isAttachFormOpen}
        onClose={() => {
          setIsAttachFormOpen(false);
          setAttachFormData({ name: "", url: "", type: "custom", envs: {} });
          setEnvFields([]);
        }}
        title="Attach Tool Server"
        icon={<Server size={15} />}
        size="md"
        footer={
          <FormDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAttachFormOpen(false);
                setAttachFormData({ name: "", url: "", type: "custom", envs: {} });
                setEnvFields([]);
              }}
              disabled={attachLoading}
              className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAttachSubmit}
              disabled={attachLoading || !attachFormData.name.trim() || !attachFormData.url.trim()}
              className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
            >
              {attachLoading ? (
                <>
                  <DashboardLoader variant="inline" className="mr-2" />
                  <span>Attaching...</span>
                </>
              ) : (
                "Attach Server"
              )}
            </Button>
          </FormDialogFooter>
        }
      >
        <div className="space-y-4">
          <FormField label="Server Name" required>
            <Input
              value={attachFormData.name}
              onChange={(e) => setAttachFormData({ ...attachFormData, name: e.target.value })}
              placeholder="e.g., dummy_service"
              className="bg-background border-border-main text-text-main"
            />
          </FormField>

          <FormField label="Server URL" required>
            <Input
              type="url"
              value={attachFormData.url}
              onChange={(e) => setAttachFormData({ ...attachFormData, url: e.target.value })}
              placeholder="e.g., http://localhost:8001"
              className="bg-background border-border-main text-text-main"
            />
          </FormField>

          <FormField label="Server Type" required>
            <Select
              value={attachFormData.type}
              onValueChange={(value: "custom" | "mcp-sse" | "mcp-http" | "mcp-stdio") =>
                setAttachFormData({ ...attachFormData, type: value })
              }
            >
              <SelectTrigger className="bg-background border-border-main text-text-main">
                <SelectValue placeholder="Select server type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="mcp-sse">MCP SSE</SelectItem>
                <SelectItem value="mcp-http">MCP HTTP</SelectItem>
                <SelectItem value="mcp-stdio">MCP STDIO</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Environment Variables">
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddEnvField}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Env Var
                </Button>
              </div>
              {envFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <Input
                    placeholder="Key"
                    value={field.key}
                    onChange={(e) => handleEnvFieldChange(index, "key", e.target.value)}
                    className="flex-1 bg-background border-border-main text-text-main"
                  />
                  <span className="text-text-muted">=</span>
                  <Input
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => handleEnvFieldChange(index, "value", e.target.value)}
                    className="flex-1 bg-background border-border-main text-text-main"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEnvField(index)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </FormField>
        </div>
      </AdminFormDialog>

      <AlertDialog
        open={isSyncDialogOpen}
        onOpenChange={(open) => {
          if (!open && !syncLoading) {
            setIsSyncDialogOpen(false);
            setSelectedServer(null);
          }
        }}
      >
        <AlertDialogContent className="bg-surface border-border-main">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-main flex items-center gap-2">
              <CloudSync className="h-4 w-4" />
              Sync tools from server
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-main">
              This updates the tool registry for{" "}
              <strong>{selectedServer?.name}</strong> by re-discovering tools
              on that server. It does not reload this page&apos;s server list
              (use &quot;Refresh list&quot; in the header for that).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface hover:bg-background">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSync}
              disabled={syncLoading}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {syncLoading ? (
                <CloudSync className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CloudSync className="h-4 w-4 mr-2" />
              )}
              {syncLoading ? "Syncing..." : "Sync tools"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDetachDialogOpen}
        onOpenChange={(open) => {
          if (!open && !detachLoading) {
            setIsDetachDialogOpen(false);
            setSelectedServer(null);
          }
        }}
      >
        <AlertDialogContent className="bg-surface border-border-main">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-main flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Detach Tool Server
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-main">
              Are you sure you want to detach{" "}
              <strong>{selectedServer?.name}</strong>? This will This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface hover:bg-background">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetach}
              disabled={detachLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {detachLoading && (
                <DashboardLoader variant="inline" className="mr-2" />
              )}
              Detach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="bg-surface border-border-main max-w-[95%] md:max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-text-main flex items-center gap-2">
              <Badge className="bg-primary text-white text-sm px-3 py-1">
                {selectedServer?.name}
              </Badge>
            </DialogTitle>

            <DialogDescription className="text-text-muted mt-2">
              Tool Server Details
            </DialogDescription>
          </DialogHeader>

          {selectedServer && (
            <div className="space-y-4 py-4 pt-0">
              {/* Server Name */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-text-main">
                  Server Name
                </div>
                {isEditMode ? (
                  <Input
                    value={editForm.new_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, new_name: e.target.value })
                    }
                    className="bg-background border p-2"
                  />
                ) : (
                  <div className="text-sm bg-background p-2 rounded border">
                    {selectedServer.name}
                  </div>
                )}
              </div>

              {/* Server URL */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-text-main">
                  Server URL
                </div>
                {isEditMode ? (
                  <Input
                    value={editForm.url}
                    onChange={(e) =>
                      setEditForm({ ...editForm, url: e.target.value })
                    }
                    className="bg-background border p-2"
                  />
                ) : (
                  <div className="text-sm bg-background p-2 rounded border">
                    <code>{selectedServer.url}</code>
                  </div>
                )}
              </div>

              {/* Server Type */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-text-main">
                  Server Type
                </div>
                {isEditMode ? (
                  <Select
                    value={editForm.type}
                    onValueChange={(value: "custom" | "mcp-sse" | "mcp-http" | "mcp-stdio") =>
                      setEditForm({
                        ...editForm,
                        type: value,
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border-main text-text-main">
                      <SelectValue placeholder="Select server type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="mcp-sse">MCP SSE</SelectItem>
                      <SelectItem value="mcp-http">MCP HTTP</SelectItem>
                      <SelectItem value="mcp-stdio">MCP STDIO</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm bg-background p-2 rounded border">
                    <StatusBadge
                      status={(selectedServer.type || "custom").startsWith("mcp-") ? "info" : "neutral"}
                      label={selectedServer.type || "custom"}
                    />
                  </div>
                )}
              </div>



              {/* Environment Variables */}
              {isEditMode ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-text-main">
                      Environment Variables
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddEditEnvField}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Env Var
                    </Button>
                  </div>
                  {editEnvFields.length === 0 ? (
                    <div className="text-sm text-text-muted p-2">
                      No environment variables. Click "Add Env Var" to add one.
                    </div>
                  ) : (
                    editEnvFields.map((field, index) => (
                      <div key={`edit-env-${index}`} className="flex gap-2 items-center">
                        <Input
                          placeholder="Key"
                          value={field.key}
                          onChange={(e) =>
                            handleEditEnvFieldChange(index, "key", e.target.value)
                          }
                          className="flex-1 bg-background border-border-main text-text-main"
                        />
                        <span className="text-text-muted">=</span>
                        <Input
                          placeholder="Value"
                          value={field.value}
                          onChange={(e) =>
                            handleEditEnvFieldChange(index, "value", e.target.value)
                          }
                          className="flex-1 bg-background border-border-main text-text-main"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEditEnvField(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-text-main">
                      Environment Variables
                    </div>
                    {selectedServer.envs && Object.keys(selectedServer.envs).length > 0 && (
                      <button
                        onClick={() => setShowEnvVarsInModal(!showEnvVarsInModal)}
                        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-main transition-colors"
                        title={showEnvVarsInModal ? "Hide environment variables" : "Show environment variables"}
                      >
                        {showEnvVarsInModal ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            <span>Show</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {showEnvVarsInModal && selectedServer.envs && (
                    <div className="space-y-2 bg-background rounded border border-border-main">
                      {(() => {
                        const envEntries = Object.entries(selectedServer.envs || {});
                        const envCount = envEntries.length;
                        const maxVisibleInModal = 5; // Show max 5 env vars before "show more"
                        const shouldShowMore = envCount > maxVisibleInModal && !expandedEnvRows.has(selectedServer.name);
                        const visibleEnvs = shouldShowMore
                          ? envEntries.slice(0, maxVisibleInModal)
                          : envEntries;

                        return (
                          <>
                            {visibleEnvs.map(([key, value]) => {
                              const envId = `${selectedServer.name}-${key}`;
                              const isRevealed = revealedEnvValues.has(envId);
                              const valueStr = String(value ?? "");
                              const displayValue = isRevealed ? valueStr : MASKED_ENV_VALUE;

                              return (
                                <div
                                  key={envId}
                                  className="w-full px-4 py-2 border-b border-border-main last:border-b-0"
                                >
                                  <div className="group relative rounded-xl border border-border-main/60 bg-surface/60 backdrop-blur-md px-3 py-2 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
                                    <div className="relative flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0 text-xs text-text-main font-mono break-all">
                                        <span className="text-text-main/80">{key}</span>
                                        <span className="text-text-main/60">:</span>
                                        <span className="ml-1 inline-flex items-center rounded-md bg-black/10 dark:bg-white/10 px-2 py-0.5">
                                          {displayValue}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                          onClick={() => toggleEnvValueExpansion(envId)}
                                          className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border-main/60 bg-background/40 hover:bg-background/70 text-text-muted hover:text-text-main transition-all"
                                          title={isRevealed ? "Hide value" : "Show value"}
                                        >
                                          {isRevealed ? (
                                            <EyeOff className="h-4 w-4" />
                                          ) : (
                                            <Eye className="h-4 w-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() => copyEnvValue(valueStr)}
                                          className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border-main/60 bg-background/40 hover:bg-background/70 text-text-muted hover:text-text-main transition-all"
                                          title="Copy value"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {shouldShowMore && (
                              <button
                                onClick={() => toggleEnvExpansion(selectedServer.name)}
                                className="w-full text-xs text-primary hover:underline text-center py-2"
                              >
                                Show {envCount - maxVisibleInModal} more environment {envCount - maxVisibleInModal === 1 ? 'variable' : 'variables'}
                              </button>
                            )}
                            {!shouldShowMore && envCount > maxVisibleInModal && (
                              <button
                                onClick={() => toggleEnvExpansion(selectedServer.name)}
                                className="w-full text-xs text-primary hover:underline text-center py-2"
                              >
                                Show less
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {!showEnvVarsInModal && selectedServer.envs && Object.keys(selectedServer.envs).length > 0 && (
                    <div className="text-xs text-text-muted p-2 bg-background rounded border border-border-main">
                      {Object.keys(selectedServer.envs).length} environment {Object.keys(selectedServer.envs).length === 1 ? 'variable' : 'variables'} hidden. Click "Show" to view them.
                    </div>
                  )}
                </div>
              )}

              {/* Created At */}

              {/* <div className="space-y-2">
                <div className="text-sm font-semibold text-text-main">
                  Created At
                </div>
                <div className="text-sm text-text-main bg-background p-2 rounded border border-border-main">
                  {formatDashboardDate(selectedServer.created_at)}
                </div>
              </div> */}

              {/* Health Status */}

              {/* <div className="space-y-2">
                <div className="text-sm font-semibold text-text-main">
                  Health Status
                </div>
                <div className="bg-background p-2 rounded border border-border-main">
                  {healthStatuses[selectedServer.name] &&
                  !healthLoading[selectedServer.name] ? (
                    getHealthStatusBadge(selectedServer)
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not Checked
                    </Badge>
                  )}
                </div>
              </div> */}
            </div>
          )}

          {/* Footer (Edit Mode) */}
          {isEditMode && (
            <DialogFooter className="flex flex-row justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditMode(false);
                  closeDetailsModal();
                }}
                className="border-border-main text-text-main hover:bg-background rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveServer}
                className="hover:bg-primary/90 text-white rounded-md"
              >
                Update Server
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
};

import {
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";
import type { TableQueryParams } from "@/components/DataTable/types";
import axios from "axios";
import notify from "@/utils/notify";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { API_CONFIG } from "@/config/api";
import { formatDashboardDate } from "@/utils/helper";
import { ErrorRetry } from "../components/ErrorRetry";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import FeedbackSnapshotModal from "../components/Modals/FeedbackSnapshotModal";
import { DashboardLoader } from "@/components/ContentLoader";
import {
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
  dashboardTabCardHeaderClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
  dashboardAdminTableClickableRowClassName,
} from "../components/DashboardTabLayout";
import { cn } from "@/lib/utils";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowPrimaryIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { StatusBadge } from "../components/StatusBadge";

export interface FeedbackSectionProps {
  feedbackSearch: string;
  setFeedbackSearch: (value: string) => void;
  feedbackStatusFilter: string;
  setFeedbackStatusFilter: (value: string) => void;
  feedbackRatingFilter: string;
  setFeedbackRatingFilter: (value: string) => void;
  feedbackDateFrom: string;
  setFeedbackDateFrom: (value: string) => void;
  feedbackDateTo: string;
  setFeedbackDateTo: (value: string) => void;
  isExporting: boolean;
  handleExportFeedback: () => void | Promise<void>;
  activeTab?: string;
}

// Types
interface FeedbackItem {
  id: number;
  user_id: string;
  message_id: string;
  user_query: string;
  ai_response: string;
  feedback_type: string;
  reason?: string | null;
  created_at: string;
  is_resolved?: boolean;
  resolution_comment?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  response_metadata: any;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function csvEscapeField(value: string): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

/** One-row CSV matching Dashboard bulk feedback export columns. */
function exportFeedbackRowToCsv(feedback: FeedbackItem) {
  const headers = [
    "ID",
    "User ID",
    "Message ID",
    "User Query",
    "AI Response",
    "Feedback Type",
    "Reason",
    "Status",
    "Resolution Comment",
    "Created At",
    "Resolved At",
  ];
  const row = [
    String(feedback.id),
    csvEscapeField(feedback.user_id || ""),
    csvEscapeField(feedback.message_id || ""),
    csvEscapeField(feedback.user_query || ""),
    csvEscapeField(feedback.ai_response || ""),
    feedback.feedback_type || "",
    csvEscapeField(feedback.reason || ""),
    feedback.is_resolved ? "Resolved" : "Unresolved",
    csvEscapeField(feedback.resolution_comment || ""),
    feedback.created_at || "",
    feedback.resolved_at || "",
  ];
  const csvContent = [headers.join(","), row.join(",")].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 10);
  link.setAttribute("download", `feedback_${feedback.id}_${stamp}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Survives React Strict Mode remounts: share one in-flight GET per exact URL, and
 * ignore duplicate automatic fetches right after a successful response (second effect run).
 */
const FEEDBACK_LIST_AUTOREFETCH_DEDUP_MS = 750;
const feedbackAllInFlightByUrl = new Map<string, Promise<void>>();
const feedbackAllLastSuccessAtByUrl = new Map<string, number>();

function clearFeedbackListDedupState() {
  feedbackAllInFlightByUrl.clear();
  feedbackAllLastSuccessAtByUrl.clear();
}

export const FeedbackSection = ({
  feedbackSearch,
  setFeedbackSearch,
  feedbackStatusFilter,
  setFeedbackStatusFilter,
  feedbackRatingFilter,
  setFeedbackRatingFilter,
  feedbackDateFrom,
  setFeedbackDateFrom,
  feedbackDateTo,
  setFeedbackDateTo,
  isExporting,
  handleExportFeedback,
  activeTab,
}: Readonly<FeedbackSectionProps>) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Feedback data state
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [resolveComment, setResolveComment] = useState("");
  const [pendingBulkIds, setPendingBulkIds] = useState<number[]>([]);
  const [isBulkResolving, setIsBulkResolving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const clearSelectionRef = useRef<(() => void) | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  /** Single-row delete confirmation (reuses same API as bulk). */
  const [feedbackPendingDelete, setFeedbackPendingDelete] =
    useState<FeedbackItem | null>(null);
  const [exportingFeedbackId, setExportingFeedbackId] = useState<number | null>(
    null,
  );
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);

  const debouncedFeedbackSearch = useDebouncedValue(
    feedbackSearch,
    DASHBOARD_SEARCH_DEBOUNCE_MS
  );
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const lastServerQueryRef = useRef<TableQueryParams>({
    page: 1,
    limit: 10,
    offset: 0,
    sort_by: "created_at",
    sort_order: "desc",
  });
  /** Cancels in-flight list fetches when a new one starts or the user leaves the tab. */
  const feedbackFetchAbortRef = useRef<AbortController | null>(null);

  const isFeedbackTabActive = activeTab === "feedback";

  const hasDateFilter = useMemo(
    () =>
      Boolean(
        (feedbackDateFrom && feedbackDateFrom.trim() !== "") ||
          (feedbackDateTo && feedbackDateTo.trim() !== "")
      ),
    [feedbackDateFrom, feedbackDateTo]
  );

  const mapSortColumnToApi = useCallback((col: string | null | undefined) => {
    const m: Record<string, string> = {
      created_at: "created_at",
      resolved_at: "resolved_at",
      feedback_type: "feedback_type",
      type: "feedback_type",
      is_resolved: "is_resolved",
    };
    return m[col || ""] || "created_at";
  }, []);

  // Snapshot modal states
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string>("");
  const [selectedFeedbackForSnapshot, setSelectedFeedbackForSnapshot] = useState<FeedbackItem | null>(null);

  const feedbackFilterCount = useMemo(() => {
    let n = 0;
    if (
      feedbackStatusFilter &&
      feedbackStatusFilter !== "all" &&
      feedbackStatusFilter !== ""
    ) {
      n += 1;
    }
    if (
      feedbackRatingFilter &&
      feedbackRatingFilter !== "all" &&
      feedbackRatingFilter !== ""
    ) {
      n += 1;
    }
    if (feedbackDateFrom?.trim()) n += 1;
    if (feedbackDateTo?.trim()) n += 1;
    return n;
  }, [
    feedbackStatusFilter,
    feedbackRatingFilter,
    feedbackDateFrom,
    feedbackDateTo,
  ]);

  const handleClearFilters = () => {
    setFeedbackStatusFilter("");
    setFeedbackRatingFilter("");
    setFeedbackDateFrom("");
    setFeedbackDateTo("");
  };

  const hasActiveFeedbackListFilters =
    feedbackSearch.trim().length > 0 || feedbackFilterCount > 0;

  const clearAllFeedbackListFilters = () => {
    setFeedbackSearch("");
    handleClearFilters();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFeedback();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleConfirmResolve = async () => {
    if (pendingBulkIds.length === 0) return;

    setIsBulkResolving(true);
    try {
      const resolveData = {
        feedbacks: pendingBulkIds.map(id => ({
          feedback_id: id,
          resolution_comment: "Bulk resolved via admin panel"
        }))
      };

      await axios.patch(
        `${API_CONFIG.LOCAL_API_BASE_URL}/feedback/bulk/resolve`,
        resolveData,
        {
          headers: {
            ...API_CONFIG.API_HEADERS,
          },
          withCredentials: true,
        }
      );

      setPendingBulkIds([]);
      setIsResolveDialogOpen(false);
      clearSelectionRef.current?.();
      fetchFeedback();

    } catch (error: any) {
      console.error("Error bulk resolving feedback:", error);
      notify.error(error);
    } finally {
      setIsBulkResolving(false);
    }
  };

  const handleConfirmDelete = async () => {
    const ids = feedbackPendingDelete
      ? [feedbackPendingDelete.id]
      : pendingBulkIds;
    if (ids.length === 0) return;

    const isSingle = feedbackPendingDelete !== null;
    setIsBulkDeleting(true);
    try {
      await axios.delete(
        `${API_CONFIG.LOCAL_API_BASE_URL}/feedback/bulk/delete`,
        {
          data: { feedback_ids: ids },
          headers: {
            ...API_CONFIG.API_HEADERS,
          },
          withCredentials: true,
        }
      );

      setFeedbackPendingDelete(null);
      setIsDeleteDialogOpen(false);
      if (!isSingle) {
        setPendingBulkIds([]);
        clearSelectionRef.current?.();
      }
      fetchFeedback();

    } catch (error: any) {
      console.error("Error bulk deleting feedback:", error);
      notify.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const fetchFeedbackServer = useCallback(
    async (query: TableQueryParams, options?: { force?: boolean }) => {
      if (!isFeedbackTabActive) return;

      const baseUrl = API_CONFIG.LOCAL_API_BASE_URL || "";
      const limit = query.limit ?? 10;
      const offset = query.offset ?? 0;
      const sortBy = mapSortColumnToApi(query.sort_by);
      const sortOrder = query.sort_order === "asc" ? "asc" : "desc";

      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (
        feedbackStatusFilter &&
        feedbackStatusFilter !== "all" &&
        feedbackStatusFilter !== ""
      ) {
        params.append("status", feedbackStatusFilter);
      }
      if (
        feedbackRatingFilter &&
        feedbackRatingFilter !== "all" &&
        feedbackRatingFilter !== ""
      ) {
        params.append("feedback_type", feedbackRatingFilter);
      }
      if (debouncedFeedbackSearch.trim()) {
        params.append("search", debouncedFeedbackSearch.trim());
      }

      const url = `${baseUrl.replace(/\/$/, "")}/feedback/all?${params.toString()}`;

      const shared = feedbackAllInFlightByUrl.get(url);
      if (shared && !options?.force) {
        await shared;
        return;
      }

      if (!options?.force) {
        const lastOk = feedbackAllLastSuccessAtByUrl.get(url);
        if (
          lastOk != null &&
          Date.now() - lastOk < FEEDBACK_LIST_AUTOREFETCH_DEDUP_MS
        ) {
          return;
        }
      }

      feedbackFetchAbortRef.current?.abort();
      const controller = new AbortController();
      feedbackFetchAbortRef.current = controller;

      const runPromise = (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await axios.get(url, {
            signal: controller.signal,
            headers: {
              ...API_CONFIG.API_HEADERS,
            },
            withCredentials: true,
          });

          if (feedbackFetchAbortRef.current !== controller) return;

          const data = response.data;
          const items = data.feedback || [];
          setFeedbackItems(items);
          setFeedbackTotal(
            typeof data.total === "number" ? data.total : items.length
          );
          setError(null);
          feedbackAllLastSuccessAtByUrl.set(url, Date.now());
        } catch (error: any) {
          if (feedbackFetchAbortRef.current !== controller) return;
          if (
            error?.code === "ERR_CANCELED" ||
            error?.name === "CanceledError" ||
            axios.isCancel?.(error)
          ) {
            return;
          }
          console.error("Failed to fetch feedback:", error);

          const errorMessage =
            error.response?.status === 500
              ? "Server error: Please try again later"
              : error.response?.data?.message || "Failed to load feedback.";

          setError(errorMessage);
          notify.error(errorMessage);

          setFeedbackItems([]);
          setFeedbackTotal(0);
        } finally {
          if (feedbackFetchAbortRef.current === controller) {
            feedbackFetchAbortRef.current = null;
            setIsLoading(false);
          }
        }
      })();

      feedbackAllInFlightByUrl.set(url, runPromise);
      try {
        await runPromise;
      } finally {
        if (feedbackAllInFlightByUrl.get(url) === runPromise) {
          feedbackAllInFlightByUrl.delete(url);
        }
      }
    },
    [
      isFeedbackTabActive,
      debouncedFeedbackSearch,
      feedbackStatusFilter,
      feedbackRatingFilter,
      mapSortColumnToApi,
    ]
  );

  const fetchFeedbackClientDates = useCallback(
    async (options?: { force?: boolean }) => {
      if (!isFeedbackTabActive) return;

      const baseUrl = API_CONFIG.LOCAL_API_BASE_URL || "";

      const params = new URLSearchParams({
        limit: "10000",
        offset: "0",
        sort_by: "created_at",
        sort_order: "desc",
      });

      if (
        feedbackStatusFilter &&
        feedbackStatusFilter !== "all" &&
        feedbackStatusFilter !== ""
      ) {
        params.append("status", feedbackStatusFilter);
      }
      if (
        feedbackRatingFilter &&
        feedbackRatingFilter !== "all" &&
        feedbackRatingFilter !== ""
      ) {
        params.append("feedback_type", feedbackRatingFilter);
      }
      if (debouncedFeedbackSearch.trim()) {
        params.append("search", debouncedFeedbackSearch.trim());
      }

      const url = `${baseUrl.replace(/\/$/, "")}/feedback/all?${params.toString()}`;

      const shared = feedbackAllInFlightByUrl.get(url);
      if (shared && !options?.force) {
        await shared;
        return;
      }

      if (!options?.force) {
        const lastOk = feedbackAllLastSuccessAtByUrl.get(url);
        if (
          lastOk != null &&
          Date.now() - lastOk < FEEDBACK_LIST_AUTOREFETCH_DEDUP_MS
        ) {
          return;
        }
      }

      feedbackFetchAbortRef.current?.abort();
      const controller = new AbortController();
      feedbackFetchAbortRef.current = controller;

      const runPromise = (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await axios.get(url, {
            signal: controller.signal,
            headers: {
              ...API_CONFIG.API_HEADERS,
            },
            withCredentials: true,
          });

          if (feedbackFetchAbortRef.current !== controller) return;

          const data = response.data;
          let items: FeedbackItem[] = data.feedback || [];

          items = items.filter((item) => {
            if (!item.created_at) return false;

            const itemDate = new Date(item.created_at);
            itemDate.setHours(0, 0, 0, 0);

            let matchesFrom = true;
            let matchesTo = true;

            if (feedbackDateFrom && feedbackDateFrom.trim() !== "") {
              const fromDate = new Date(feedbackDateFrom);
              fromDate.setHours(0, 0, 0, 0);
              matchesFrom = itemDate >= fromDate;
            }

            if (feedbackDateTo && feedbackDateTo.trim() !== "") {
              const toDate = new Date(feedbackDateTo);
              toDate.setHours(23, 59, 59, 999);
              matchesTo = itemDate <= toDate;
            }

            return matchesFrom && matchesTo;
          });

          setFeedbackItems(items);
          setFeedbackTotal(items.length);
          setError(null);
          feedbackAllLastSuccessAtByUrl.set(url, Date.now());
        } catch (error: any) {
          if (feedbackFetchAbortRef.current !== controller) return;
          if (
            error?.code === "ERR_CANCELED" ||
            error?.name === "CanceledError" ||
            axios.isCancel?.(error)
          ) {
            return;
          }
          console.error("Failed to fetch feedback:", error);

          const errorMessage =
            error.response?.status === 500
              ? "Server error: Please try again later"
              : error.response?.data?.message || "Failed to load feedback.";

          setError(errorMessage);
          notify.error(errorMessage);

          setFeedbackItems([]);
          setFeedbackTotal(0);
        } finally {
          if (feedbackFetchAbortRef.current === controller) {
            feedbackFetchAbortRef.current = null;
            setIsLoading(false);
          }
        }
      })();

      feedbackAllInFlightByUrl.set(url, runPromise);
      try {
        await runPromise;
      } finally {
        if (feedbackAllInFlightByUrl.get(url) === runPromise) {
          feedbackAllInFlightByUrl.delete(url);
        }
      }
    },
    [
    isFeedbackTabActive,
    debouncedFeedbackSearch,
    feedbackStatusFilter,
    feedbackRatingFilter,
    feedbackDateFrom,
    feedbackDateTo,
  ]);

  const fetchFeedback = useCallback(async () => {
    if (!isFeedbackTabActive) return;
    if (hasDateFilter) {
      await fetchFeedbackClientDates({ force: true });
    } else {
      await fetchFeedbackServer(lastServerQueryRef.current, { force: true });
    }
  }, [isFeedbackTabActive, hasDateFilter, fetchFeedbackClientDates, fetchFeedbackServer]);

  const onFeedbackQueryChange = useCallback(
    (q: TableQueryParams) => {
      lastServerQueryRef.current = q;
      fetchFeedbackServer(q);
    },
    [fetchFeedbackServer]
  );

  useEffect(() => {
    if (activeTab !== "feedback") return;
    if (hasDateFilter) {
      fetchFeedbackClientDates();
    }
  }, [
    activeTab,
    hasDateFilter,
    debouncedFeedbackSearch,
    feedbackStatusFilter,
    feedbackRatingFilter,
    feedbackDateFrom,
    feedbackDateTo,
    fetchFeedbackClientDates,
  ]);

  useEffect(() => {
    if (activeTab === "feedback") return;
    feedbackFetchAbortRef.current?.abort();
    feedbackFetchAbortRef.current = null;
    clearFeedbackListDedupState();
    setIsLoading(false);
  }, [activeTab]);

  useEffect(() => {
    return () => {
      feedbackFetchAbortRef.current?.abort();
      feedbackFetchAbortRef.current = null;
      clearFeedbackListDedupState();
    };
  }, []);

  const handleResolve = async (id: number) => {
    if (!resolveComment.trim()) return;

    try {
      setResolvingId(id);
      const baseUrl = API_CONFIG.LOCAL_API_BASE_URL || "";
      const url = `${baseUrl.replace(/\/$/, "")}/feedback/${id}/resolve`;

      await axios.patch(
        url,
        { resolution_comment: resolveComment },
        {
          headers: {
            ...API_CONFIG.API_HEADERS,
          },
          withCredentials: true,
        }
      );

      fetchFeedback();
      setResolveDialogOpen(false);
      setResolveComment("");
      setSelectedFeedback(null);
    } catch (error) {
      console.error("Failed to resolve feedback:", error);
    } finally {
      setResolvingId(null);
    }
  };

  const openResolveDialog = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setResolveComment("");
    setResolveDialogOpen(true);
  };

  const handleExportSingleFeedback = useCallback((feedback: FeedbackItem) => {
    setExportingFeedbackId(feedback.id);
    try {
      exportFeedbackRowToCsv(feedback);
      notify.success("Exported row to CSV");
    } catch (err) {
      console.error("Row export failed:", err);
      notify.error("Could not export this row");
    } finally {
      window.setTimeout(() => setExportingFeedbackId(null), 200);
    }
  }, []);

  const getFeedbackIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "thumbs_up":
        return <ThumbsUp className="text-primary" size={18} />;
      case "thumbs_down":
        return <ThumbsDown className="text-destructive" size={18} />;
      default:
        return <MessageCircle className="text-text-muted" size={18} />;
    }
  };

  const getStatusBadge = (isResolved: boolean) => {
    if (isResolved) {
      return (
        <StatusBadge status="success" label="Resolved" icon={<CheckCircle size={14} />} />
      );
    }
    return (
      <StatusBadge status="warning" label="Unresolved" icon={<Clock size={14} />} />
    );
  };

  const formatUserId = (userId: string) => {
    if (!userId) return "-";
    if (userId.length > 40) {
      return `${userId.substring(0, 3)}...${userId.substring(userId.length - 3)}`;
    }
    return userId;
  };

  // Define columns for DataTable
  const columns: ColumnConfig<FeedbackItem>[] = useMemo(() => {
    const baseColumns: ColumnConfig<FeedbackItem>[] = [
      {
        key: "feedback_type",
        header: "Type",
        type: "custom",
        width: 80,
        align: "center",
        sortable: true,
        accessor: (row) => row.feedback_type,
        render: (_, feedback) => (
          <div className="flex items-center justify-center">
            {getFeedbackIcon(feedback.feedback_type)}
          </div>
        ),
      },
      {
        key: "user_id",
        header: "User",
        type: "text",
        width: 150,
        searchable: true,
        render: (_, feedback) => (
          <div className="flex items-center">
            {/* <User className="mr-1 sm:mr-2 text-text-muted flex-shrink-0" size={18} /> */}
            <span className="font-mono text-xs bg-background px-1.5 py-0.5  border-border-main text-text-main truncate">
              {formatUserId(feedback.user_id)}
            </span>
          </div>
        ),
      },
      {
        key: "user_query",
        header: "Query",
        type: "text",
        width: 200,
        searchable: true,
      },
      {
        key: "ai_response",
        header: "Response",
        type: "text",
        width: 200,
        searchable: true,
      },
      {
        key: "reason",
        header: "Reason",
        type: "text",
        width: 150,
        searchable: true,
        render: (_, feedback) => (
          <div className="text-xs sm:text-sm text-text-main break-words">
            {feedback.reason ? (
              feedback.reason
            ) : (
              <span className="text-text-muted italic">No reason</span>
            )}
          </div>
        ),
      },
      {
        key: "is_resolved",
        header: "Status",
        type: "custom",
        width: 120,
        sortable: true,
        accessor: (row) => (row.is_resolved ? 1 : 0),
        render: (_, feedback) => (
          <div className="flex justify-start">
            {getStatusBadge(!!feedback.is_resolved)}
          </div>
        ),
      },
      {
        key: "resolved_by_user_id",
        header: "Resolved By",
        type: "text",
        width: 170,
        searchable: true,
        render: (_, feedback) => (
          <div className="text-xs text-text-muted whitespace-nowrap">
            {feedback.resolved_by_user_id ? formatUserId(feedback.resolved_by_user_id) : "-"}
          </div>
        ),
      },
      {
        key: "resolved_at",
        header: "Resolved At",
        type: "date",
        width: 180,
        sortable: true,
        render: (_, feedback) => (
          <div className="text-xs text-text-muted whitespace-nowrap">
            {feedback.resolved_at ? formatDashboardDate(feedback.resolved_at) : "-"}
          </div>
        ),
      },
      {
        key: "created_at",
        header: "Date",
        type: "date",
        width: 210,
        sortable: true,
        render: (_, feedback) => (
          <div className="text-xs text-text-muted whitespace-nowrap">
            {formatDashboardDate(feedback.created_at)}
          </div>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        /* Fits 2× icon buttons (36px) + gap + cell padding (px-4) without overlapping Date */
        width: 132,
        align: "left",
        render: (_, feedback) => {
          const exportInFlight = exportingFeedbackId !== null;
          const deleteBlockedForRow =
            isBulkDeleting ||
            isDeleteDialogOpen ||
            (feedbackPendingDelete !== null &&
              feedbackPendingDelete.id !== feedback.id);
          return (
            <div
              className="flex shrink-0 flex-nowrap items-center justify-start gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={dashboardRowPrimaryIconButtonClass}
                title="Export this row as CSV"
                aria-label="Export this row as CSV"
                disabled={exportInFlight}
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportSingleFeedback(feedback);
                }}
              >
                {exportingFeedbackId === feedback.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={dashboardRowDeleteIconButtonClass}
                title="Delete feedback"
                aria-label="Delete feedback"
                disabled={deleteBlockedForRow || exportInFlight}
                onClick={(e) => {
                  e.stopPropagation();
                  setFeedbackPendingDelete(feedback);
                }}
              >
                {isBulkDeleting && feedbackPendingDelete?.id === feedback.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          );
        },
      },
    ];

    return baseColumns;
  }, [
    isBulkDeleting,
    feedbackPendingDelete,
    isDeleteDialogOpen,
    exportingFeedbackId,
    handleExportSingleFeedback,
  ]);

  return (
    <TabsContent
      value="feedback"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="User Feedback"
          description="Review and manage user feedback and ratings"
          headerClassName={cn(dashboardTabCardHeaderClassName, "shrink-0")}
          actionsColumnClassName="w-full"
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                    {/* <DashboardTabSearchInput
                      placeholder="Search feedback..."
                      value={feedbackSearch}
                      onChange={(e) => setFeedbackSearch(e.target.value)}
                    /> */}
                    <DashboardTabFiltersPopover
                      filterCount={feedbackFilterCount}
                      onClear={handleClearFilters}
                      align="end"
                      triggerClassName="shrink-0"
                    >
                    <DashboardTabSearchableSelect
                      label="Status"
                      options={[
                        { label: "All Status", value: "" },
                        { label: "Resolved", value: "resolved" },
                        { label: "Unresolved", value: "unresolved" },
                      ]}
                      value={feedbackStatusFilter}
                      onValueChange={setFeedbackStatusFilter}
                      placeholder="Search status..."
                    />
                    <DashboardTabSearchableSelect
                      label="Feedback type"
                      options={[
                        { label: "All Feedbacks", value: "" },
                        { label: "Positive", value: "thumbs_up" },
                        { label: "Negative", value: "thumbs_down" },
                      ]}
                      value={feedbackRatingFilter}
                      onValueChange={setFeedbackRatingFilter}
                      placeholder="Search feedback type..."
                    />
                    </DashboardTabFiltersPopover>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 max-lg:px-2 shrink-0 border-border-main text-text-main hover:bg-surface"
                      onClick={handleExportFeedback}
                      disabled={isExporting}
                      title="Export feedback"
                    >
                      {isExporting ? (
                        <DashboardLoader size="xs" variant="inline" />
                      ) : (
                        <Download size={18} />
                      )}
                    </Button>
                  </>
                }
                refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 border-border-main text-text-main hover:bg-surface"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Refresh feedback"
                  >
                    <RefreshCw
                      size={18}
                      className={isRefreshing ? "animate-spin" : ""}
                    />
                  </Button>
                }
              />
          }
        />

        {hasActiveFeedbackListFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllFeedbackListFilters}>
            {feedbackStatusFilter &&
              feedbackStatusFilter !== "all" &&
              feedbackStatusFilter !== "" && (
                <DashboardTabFilterChip
                  onRemove={() => setFeedbackStatusFilter("")}
                  ariaLabel="Clear status filter"
                >
                  <span className="truncate">
                    Status:{" "}
                    {feedbackStatusFilter === "resolved"
                      ? "Resolved"
                      : feedbackStatusFilter === "unresolved"
                        ? "Unresolved"
                        : feedbackStatusFilter}
                  </span>
                </DashboardTabFilterChip>
              )}
            {feedbackRatingFilter &&
              feedbackRatingFilter !== "all" &&
              feedbackRatingFilter !== "" && (
                <DashboardTabFilterChip
                  onRemove={() => setFeedbackRatingFilter("")}
                  ariaLabel="Clear feedback type filter"
                >
                  <span className="truncate">
                    Type:{" "}
                    {feedbackRatingFilter === "thumbs_up"
                      ? "Positive"
                      : feedbackRatingFilter === "thumbs_down"
                        ? "Negative"
                        : feedbackRatingFilter}
                  </span>
                </DashboardTabFilterChip>
              )}
            {feedbackDateFrom?.trim() ? (
              <DashboardTabFilterChip
                onRemove={() => setFeedbackDateFrom("")}
                ariaLabel="Clear date from filter"
              >
                <span className="truncate">From: {feedbackDateFrom.trim()}</span>
              </DashboardTabFilterChip>
            ) : null}
            {feedbackDateTo?.trim() ? (
              <DashboardTabFilterChip
                onRemove={() => setFeedbackDateTo("")}
                ariaLabel="Clear date to filter"
              >
                <span className="truncate">To: {feedbackDateTo.trim()}</span>
              </DashboardTabFilterChip>
            ) : null}
            <DashboardTabSearchFilterChip
              query={feedbackSearch}
              onClear={() => setFeedbackSearch("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
          {isFeedbackTabActive ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {error && !isLoading ? (
                <div className="min-h-0 flex-1 overflow-auto p-1">
                  <ErrorRetry error={error} onRetry={fetchFeedback} isLoading={isLoading} />
                </div>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <DataTable
                    key={
                      hasDateFilter
                        ? `fb-client-${feedbackDateFrom}-${feedbackDateTo}`
                        : `fb-srv-${debouncedFeedbackSearch}-${feedbackStatusFilter}-${feedbackRatingFilter}`
                    }
                    columns={columns}
                    data={feedbackItems}
                    isLoading={isLoading}
                {...dashboardTableLoadingProps}
                    emptyMessage="No feedback found. Try adjusting your search criteria."
                    loadingMessage="Loading feedback..."
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    defaultPageSize={10}
                    disablePagination={false}
                    enableFilters={false}
                    enableGlobalSearch={false}
                    serverSide={!hasDateFilter}
                    totalItems={hasDateFilter ? undefined : feedbackTotal}
                    onQueryChange={hasDateFilter ? undefined : onFeedbackQueryChange}
                    onRowClick={(feedback) => {
                      setSelectedFeedbackId(feedback.id);
                      setSelectedMessageId(feedback.message_id);
                      setSelectedFeedbackForSnapshot(feedback);
                      setSnapshotModalOpen(true);
                    }}
                    getRowId={(feedback) => feedback.id}
                    className={cn(
                      dashboardAdminTableClassName,
                      dashboardAdminTableClickableRowClassName,
                    )}
                    enableRowSelection
                    renderBulkActions={(selectedIds, clearSelection) => {
                      clearSelectionRef.current = clearSelection;
                      const ids = [...selectedIds] as number[];
                      return (
                        <>
                          <button
                            onClick={() => {
                              const resolvedIdSet = new Set(feedbackItems.filter(f => f.is_resolved).map(f => f.id));
                              const alreadyResolvedCount = ids.filter(id => resolvedIdSet.has(id)).length;
                              if (alreadyResolvedCount > 0) {
                                notify.error(
                                  `${alreadyResolvedCount} selected feedback${alreadyResolvedCount === 1 ? " is" : "s are"} already resolved. Please deselect ${alreadyResolvedCount === 1 ? "it" : "them"} to resolve the rest.`
                                );
                                return;
                              }
                              setPendingBulkIds(ids);
                              setIsResolveDialogOpen(true);
                            }}
                            disabled={isBulkResolving}
                            className="flex items-center gap-2 px-3 py-1.5 border border-border-main bg-background hover:bg-surface rounded-md text-sm font-medium text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            {isBulkResolving ? (
                              <DashboardLoader size="xs" variant="inline" />
                            ) : (
                              <CheckCircle size={16} />
                            )}
                            <span className="whitespace-nowrap">Resolve</span>
                          </button>
                          <button
                            onClick={() => {
                              setPendingBulkIds(ids);
                              setFeedbackPendingDelete(null);
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={isBulkDeleting}
                            className="flex items-center gap-2 px-3 py-1.5 border border-status-error/30 bg-background hover:bg-status-error/10 hover:border-status-error/60 rounded-md text-sm font-medium text-status-error transition-colors focus:outline-none focus:ring-2 focus:ring-status-error/30"
                          >
                            {isBulkDeleting ? (
                              <DashboardLoader size="xs" variant="inline" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                            <span className="whitespace-nowrap">Delete</span>
                          </button>
                        </>
                      );
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
        </div>
      </Card>

      {/* Dialogs */}
      {isResolveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-lg shadow-lg max-w-md w-full mx-4 border border-border-main">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-status-success/20 rounded-full">
                <CheckCircle className="text-status-success" size={18} />
              </div>
              <h3 className="text-lg font-semibold text-text-main">Mark as Resolved</h3>
            </div>

            <p className="text-text-main mb-6">
              Are you sure you want to mark {pendingBulkIds.length} feedback{pendingBulkIds.length !== 1 ? 's' : ''} as resolved?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsResolveDialogOpen(false)}
                disabled={isBulkResolving}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:bg-surface rounded-md transition-colors disabled:opacity-50 border border-border-main"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                disabled={isBulkResolving}
                className="px-4 py-2 text-sm font-medium bg-status-success text-white hover:bg-status-success/90 rounded-md transition-colors disabled:opacity-50"
              >
                {isBulkResolving ? "Resolving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen || feedbackPendingDelete !== null}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setFeedbackPendingDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={
          feedbackPendingDelete
            ? "Delete Feedback?"
            : `Delete ${pendingBulkIds.length} Feedback${pendingBulkIds.length !== 1 ? " entries" : " entry"}?`
        }
        description="This action cannot be undone."
        itemName={
          feedbackPendingDelete
            ? feedbackPendingDelete.user_query || `Feedback #${feedbackPendingDelete.id}`
            : `${pendingBulkIds.length} feedback${pendingBulkIds.length !== 1 ? " entries" : " entry"}`
        }
        isLoading={isBulkDeleting}
      />

      {resolveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-md w-full p-6 shadow-xl border border-border-main">
            <h3 className="text-lg font-semibold text-text-main mb-2">Mark as Resolved</h3>
            <p className="text-sm text-text-muted mb-4">
              Add a resolution comment for this feedback item. This will mark it as resolved.
          </p>

            {selectedFeedback && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-text-main block mb-1">User ID</label>
                  <div className="p-3 border border-input rounded-md text-sm bg-muted font-mono text-text-main">
                    {selectedFeedback?.user_id}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-main block mb-1">User Query</label>
                  <div className="p-3 border border-input rounded-md text-sm bg-muted max-h-20 overflow-y-auto text-text-main">
                    {selectedFeedback?.user_query}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-main block mb-1">AI Response</label>
                  <div className="p-3 border border-input rounded-md text-sm bg-muted max-h-20 overflow-y-auto text-text-main">
                    {selectedFeedback?.ai_response}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="resolve-comment" className="text-sm font-medium text-text-main block mb-1">
                Resolution Comment *
              </label>
              <Textarea
                id="resolve-comment"
                placeholder="Enter resolution comment..."
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setResolveDialogOpen(false)}
                className="px-4 py-2 border border-input rounded-md text-sm font-medium text-text-main bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedFeedback && handleResolve(selectedFeedback.id)}
                disabled={!resolveComment.trim() || resolvingId !== null}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
              >
                {resolvingId ? "Resolving..." : "Mark as Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFeedbackId && selectedFeedbackForSnapshot && (
        <FeedbackSnapshotModal
          feedbackId={selectedFeedbackId}
          highlightMessageId={selectedMessageId}
          isOpen={snapshotModalOpen}
          isResolved={selectedFeedbackForSnapshot?.is_resolved ?? false}
          onResolve={() => {
            setSnapshotModalOpen(false);
            if (selectedFeedbackForSnapshot) {
              openResolveDialog(selectedFeedbackForSnapshot);
            }
          }}
          onClose={() => {
            setSnapshotModalOpen(false);
            setSelectedFeedbackId(null);
            setSelectedMessageId("");
            setSelectedFeedbackForSnapshot(null);
          }}
        />
      )}
    </TabsContent>
  );
};


import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";
import { motion, AnimatePresence } from "framer-motion";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ChevronRight,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
// @ts-ignore Syncfusion charts expected to be available in the project
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ErrorRetry } from "../components/ErrorRetry";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { apiFetch } from "@/services/api/sessionExpiry";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import {
  FeedbackTimeRangeSelect,
  type TimeRange,
  FEEDBACK_QUICK_RANGES,
  type FeedbackQuickRange,
  QUICK_RANGES,
} from "../components/TimeRangePicker";
import { getActiveThemeName } from "@/store/useStore";
import { chartColors, toRgba } from "@/utils/chartColors";
import { Combobox } from "@/components/ui/combobox";
import { DashboardLoader } from "@/components/ContentLoader";
import { SystemMetrics } from "../components/SystemMetrics";
import {
  cardDefault,
  cardElevated,
  cardElevatedHover,
} from "@/lib/card-styles";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";
import { DashboardPill } from "../components/DashboardPill";
import { logLevelToStatus } from "../utils/dashboardPillUtils";
import { cn } from "@/lib/utils";
interface AdminOverviewSectionProps {
  activeTab?: string;
  onFeedbackTabClick?: () => void;
}

type LogEntry = {
  timestamp?: string | number;
  time?: string | number;
  ts?: string | number;
  created_at?: string | number;
  datetime?: string | number;
  date?: string | number;
  level?: string;
  message?: string;
  service_name?: string;
  user_id?: string;
  session_id?: string;
  endpoint?: string;
  [key: string]: unknown;
};

type FeedbackMetrics = {
  resolution_rate: number;
  resolved: number;
  thumbs_down: number;
  thumbs_up: number;
  total: number;
  unresolved: number;
  pending: number;
};

type AggregatedBin = {
  label: string;
  INFO: number;
  WARNING: number;
  ERROR: number;
};

type AggregatedInterval = {
  count: number;
  level_counts: {
    INFO?: number;
    WARNING?: number;
    WARN?: number;
    ERROR?: number;
  };
  timestamp: string | number;
};

const Baseurl = `${(API_CONFIG.LOCAL_API_BASE_URL || "").replace(
  /\/$/,
  ""
)}`;
const OBSERVABILITY_BASE_URL = `${Baseurl}/observability`;
const FEEDBACK_METRICS_URL = `${Baseurl}/feedback/metrics`;
const LOG_VOLUME_URL = `${OBSERVABILITY_BASE_URL}/logs/volume`;
const SERVICES_URL = `${OBSERVABILITY_BASE_URL}/services`;

const normalizeLevel = (level?: string): string => {
  if (!level) return "INFO";
  const upper = level.toUpperCase();
  if (upper === "WARN") return "WARNING";
  if (upper === "ERR") return "ERROR";
  return upper;
};

const toDateFromEpochLike = (value: string | number | Date) => {
  if (value instanceof Date) return value;

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const big = BigInt(value);
    const len = value.length;
    const ms =
      len > 16
        ? Number(big / 1_000_000n) // nanoseconds -> ms
        : len > 13
        ? Number(big / 1_000n) // microseconds -> ms
        : Number(big) * 1000; // seconds -> ms
    return new Date(ms);
  }

  if (typeof value === "number") {
    const abs = Math.abs(value);
    const ms =
      abs > 1e15
        ? value / 1e6
        : abs > 1e12
        ? value / 1e3
        : value * 1000;
    return new Date(ms);
  }

  return new Date(value);
};

const formatLogDate = (value?: string | number | Date) => {
  if (value === undefined || value === null) return "—";
  const parsed = toDateFromEpochLike(value);
  if (Number.isNaN(parsed.getTime())) return typeof value === "string" ? value : "—";
  const dateStr = parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr}, ${timeStr}`;
};

const resolveTimestamp = (log: LogEntry): Date | null => {
  const candidates: Array<string | number | undefined> = [
    log.timestamp,
    log.time,
    log.ts,
    log.datetime,
    log.created_at,
    log.date,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;

    const date = toDateFromEpochLike(candidate as string | number | Date);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
};

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, ChartTooltip, ChartLegend);

// Convert seconds to groupBy string format
const secondsToGroupBy = (seconds: number): string => {
  if (seconds < 60) {
    // Show as seconds, use decimal if needed
    return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    // Show as minutes
    const minutes = seconds / 60;
    return minutes % 1 === 0 ? `${minutes}m` : `${minutes.toFixed(1)}m`;
  } else if (seconds < 86400) {
    // Show as hours
    const hours = seconds / 3600;
    return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
  } else {
    // Show as days
    const days = seconds / 86400;
    return days % 1 === 0 ? `${days}d` : `${days.toFixed(1)}d`;
  }
};

// Calculate interval for a time range to get approximately 100 labels
const calculateIntervalFor100Labels = (durationSeconds: number): { seconds: number; groupBy: string; label: string } => {
  // Target: 100 intervals
  const intervalSeconds = durationSeconds / 100;
  const groupBy = secondsToGroupBy(intervalSeconds);
  return {
    seconds: Math.round(intervalSeconds),
    groupBy,
    label: groupBy,
  };
};

// Calculate aggregation interval based on quick range selection
const getAggregationInterval = (timeRange: TimeRange): { seconds: number; label: string; groupBy: string } => {
  const quickRange = timeRange.quickRange;
  
  // Map quick ranges to their durations in seconds
  const rangeDurations: Record<string, number> = {
    "last-5-minutes": 300,
    "last-15-minutes": 900,
    "last-30-minutes": 1800,
    "last-1-hour": 3600,
    "last-2-hours": 7200,
    "last-3-hours": 10800,
    "last-4-hours": 14400,
    "last-6-hours": 21600,
    "last-8-hours": 28800,
    "last-12-hours": 43200,
    "last-24-hours": 86400,
  };
  
  // If quick range is specified, calculate interval for 100 labels
  if (quickRange && rangeDurations[quickRange]) {
    const durationSeconds = rangeDurations[quickRange];
    return calculateIntervalFor100Labels(durationSeconds);
  }
  
  // Fallback: same window as UI max (24h)
  const durationMs = timeRange.to.getTime() - timeRange.from.getTime();
  const durationSeconds = Math.min(durationMs / 1000, 86400);

  return calculateIntervalFor100Labels(durationSeconds);
};

export const AdminOverviewSection = ({
  activeTab,
  onFeedbackTabClick,
}: Readonly<AdminOverviewSectionProps>) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(["middleware"]);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, DASHBOARD_SEARCH_DEBOUNCE_MS);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [sessionIdFilter, setSessionIdFilter] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [tableLineLimit, setTableLineLimit] = useState(100);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [feedbackMetrics, setFeedbackMetrics] = useState<FeedbackMetrics | null>(null);
  const [, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [volumeLogs, setVolumeLogs] = useState<LogEntry[]>([]);
  const [aggregatedIntervals, setAggregatedIntervals] = useState<AggregatedInterval[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState(0);
  const [chartFilter, setChartFilter] = useState<{
    timeRange: { from: Date; to: Date } | null;
    logType: "INFO" | "WARNING" | "ERROR" | "ALL" | null;
  } | null>(null);

  // Get active theme from localStorage
  const getActiveThemeFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem("newton-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.state?.activeThemeName || getActiveThemeName() || null;
      }
    } catch (error) {
      console.error("Error reading theme from localStorage:", error);
    }
    return getActiveThemeName() || null;
  }, []);

  const [activeTheme, setActiveTheme] = useState<string | null>(() => getActiveThemeFromStorage());

  const createDefaultTimeRange = useCallback((): TimeRange => {
    const to = new Date();
    const from = new Date(to.getTime() - 60 * 60 * 1000); // Default to last 1 hour
    return {
      from,
      to,
      quickRange: "last-1-hour",
    };
  }, []);

  /** Applied range: drives API, chart, and table. Only updates on Apply / Clear / initial load. */
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 60 * 60 * 1000);
    return {
      from,
      to,
      quickRange: "last-1-hour",
    };
  });
  /** Draft range: tracks pill selection; mirrors timeRange after each pill click. */
  const [draftTimeRange, setDraftTimeRange] = useState<TimeRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 60 * 60 * 1000);
    return {
      from,
      to,
      quickRange: "last-1-hour",
    };
  });
  const [feedbackQuickRange, setFeedbackQuickRange] = useState<FeedbackQuickRange>("last-7-days");

  const validateRange = (range: TimeRange) => {
    const startAt = range.from;
    const endAt = range.to;

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setDateError("Please provide both start and end dates.");
      return false;
    }

    if (startAt > endAt) {
      setDateError("Start date must be before end date.");
      return false;
    }

    const maxSpanMs = 24 * 60 * 60 * 1000;
    if (endAt.getTime() - startAt.getTime() > maxSpanMs) {
      setDateError("Time range cannot exceed 24 hours.");
      return false;
    }

    setDateError(null);
    return true;
  };

  const fetchServices = useCallback(async () => {
    if (activeTab !== "overview") return;

    setServicesLoading(true);
    setServicesError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "*/*",
      };


      const response = await apiFetch(SERVICES_URL, {
        method: "GET",
        headers,
        credentials: "include", 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = unwrapEnvelope<unknown>(await response.json());

      // Handle different possible response formats
      let servicesList: string[] = [];
      if (Array.isArray(data)) {
        servicesList = data;
      } else if (data && typeof data === "object" && Array.isArray((data as { services?: unknown }).services)) {
        servicesList = (data as { services: string[] }).services;
      } else if (typeof data === "object" && data !== null) {
        // If it's an object, try to extract array values
        servicesList = Object.values(data).filter(
          (v): v is string => typeof v === "string"
        );
      }

      if (servicesList.length > 0) {
        setServices(servicesList);
        // Set default service if current selection is empty or none selected services are in the list
        const validSelectedServices = selectedServices.filter(s => servicesList.includes(s));
        if (validSelectedServices.length === 0) {
          setSelectedServices([servicesList[0]]);
        } else if (validSelectedServices.length !== selectedServices.length) {
          // Some selected services are no longer available, update to only valid ones
          setSelectedServices(validSelectedServices);
        }
      } else {
        // Fallback to default services if API returns empty
        setServices(["middleware", "gateway", "ui", "analytics"]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch services.";
      setServicesError(message);
      console.error("Error fetching services:", err);
      // Fallback to default services on error
      setServices(["middleware", "gateway", "ui", "analytics"]);
    } finally {
      setServicesLoading(false);
    }
  }, [activeTab, selectedServices]);

  const clearFilters = useCallback(() => {
    setSelectedServices(services.length > 0 ? [services[0]] : ["middleware"]);
    setSearchTerm("");
    setUserIdFilter("");
    setSessionIdFilter("");
    setSelectedLevels([]);
    setDateError(null);
    const reset = createDefaultTimeRange();
    setTimeRange(reset);
    setDraftTimeRange(reset);
  }, [services, createDefaultTimeRange]);

  const fetchFeedbackMetrics = useCallback(
    async (range?: { from?: string; to?: string }) => {
      setMetricsLoading(true);
      setMetricsError(null);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        const url = new URL(FEEDBACK_METRICS_URL);
        if (range?.from) url.searchParams.set("from_date", range.from);
        if (range?.to) url.searchParams.set("to_date", range.to);

        const response = await apiFetch(url.toString(), {
          method: "GET",
          headers,
          credentials: "include", // Include cookies (access_token) in the request
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }

        const data = unwrapEnvelope<{ metrics?: FeedbackMetrics } | FeedbackMetrics | null>(
          await response.json()
        );
        const metrics =
          data && typeof data === "object" && "metrics" in data
            ? (data as { metrics?: FeedbackMetrics }).metrics
            : (data as FeedbackMetrics | null);
        setFeedbackMetrics(metrics || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch feedback metrics.";
        setMetricsError(message);
        console.error("Error fetching feedback metrics:", err);
      } finally {
        setMetricsLoading(false);
      }
    },
    []
  );

  const applyFeedbackQuickRange = useCallback(
    (range: FeedbackQuickRange) => {
      const quickRange = FEEDBACK_QUICK_RANGES.find((r) => r.value === range);
      if (!quickRange) return;

      const to = new Date();
      const from = new Date(to.getTime() - quickRange.minutes * 60 * 1000);

      setFeedbackQuickRange(range);

      fetchFeedbackMetrics({
        from: from.toISOString(),
        to: to.toISOString(),
      });
    },
    [fetchFeedbackMetrics]
  );

  const fetchVolumeLogs = useCallback(async (rangeOverride?: TimeRange) => {
    if (activeTab !== "overview") return;
    const range = rangeOverride ?? timeRange;
    if (!validateRange(range)) return;

    setVolumeLoading(true);
    setVolumeError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Use exact times from range - no normalization for time-based ranges
      const startDate = new Date(range.from);
      const endDate = new Date(range.to);

      // Calculate group_by value based on time range
      const interval = getAggregationInterval(range);
      const groupBy = interval.groupBy;

      const body: Record<string, unknown> = {
        service_name: selectedServices.length > 0 ? selectedServices.join(",") : undefined,
        search: debouncedSearchTerm.trim() || undefined,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        group_by: groupBy,
      };

      // Add user_id and session_id filters if provided
      if (userIdFilter.trim()) {
        body.user_id = userIdFilter.trim();
      }
      if (sessionIdFilter.trim()) {
        body.session_id = sessionIdFilter.trim();
      }
      // Add level filter if provided
      if (selectedLevels.length > 0) {
        body.level = selectedLevels.join(",");
      }

      const response = await apiFetch(LOG_VOLUME_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "include", // Include cookies (access_token) in the request
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const responseData = unwrapEnvelope<unknown>(await response.json());

      // Handle response format: { data: [...], total_error_count: ... } or direct array
      const data = Array.isArray(responseData)
        ? responseData
        : (responseData as { data?: unknown })?.data || responseData;
      
      // Handle new aggregated response format: [{ count, level_counts, timestamp }, ...]
      if (Array.isArray(data)) {
        // Check if it's the new aggregated format
        if (data.length > 0 && typeof data[0] === 'object' && 'count' in data[0] && 'level_counts' in data[0] && 'timestamp' in data[0]) {
          // Format: [{ count: number, level_counts: { INFO?: number, WARN?: number, ERROR?: number }, timestamp: string }, ...]
          setAggregatedIntervals(data as AggregatedInterval[]);
          setVolumeLogs([]); // Clear volume logs since we're using aggregated data
        } else if (data.length > 0 && typeof data[0] === 'object' && 'range' in data[0] && 'data' in data[0]) {
          // Legacy format with range and data: [{ range: "1-100", data: [...] }, ...]
          const allLogs: LogEntry[] = [];
          data.forEach((interval: { range: string; data: LogEntry[] }) => {
            if (Array.isArray(interval.data)) {
              allLogs.push(...interval.data);
            }
          });
          setVolumeLogs(
            allLogs.map((log: LogEntry) => ({
              ...log,
              timestamp:
                log.timestamp ||
                log.time ||
                log.ts ||
                log.datetime ||
                log.created_at ||
                log.date,
              service_name: (log as Record<string, string>)?.service_name || (log as Record<string, string>)?.service || (selectedServices.length > 0 ? selectedServices[0] : "middleware"),
              level: normalizeLevel(log.level as string),
            }))
          );
          setAggregatedIntervals([]);
        } else {
          // Legacy format: array of logs
          setVolumeLogs(
            data.map((log: LogEntry) => ({
              ...log,
              timestamp:
                log.timestamp ||
                log.time ||
                log.ts ||
                log.datetime ||
                log.created_at ||
                log.date,
              service_name: (log as Record<string, string>)?.service_name || (log as Record<string, string>)?.service || (selectedServices.length > 0 ? selectedServices[0] : "middleware"),
              level: normalizeLevel(log.level as string),
            }))
          );
          setAggregatedIntervals([]);
        }
      } else if (typeof data === 'object' && data !== null) {
        // Format: { "1-100": [...], "101-200": [...] }
        const allLogs: LogEntry[] = [];
        Object.values(data).forEach((intervalData: unknown) => {
          if (Array.isArray(intervalData)) {
            allLogs.push(...intervalData);
          }
        });
        setVolumeLogs(
          allLogs.map((log: LogEntry) => ({
            ...log,
            timestamp:
              log.timestamp ||
              log.time ||
              log.ts ||
              log.datetime ||
              log.created_at ||
              log.date,
            service_name: (log as Record<string, string>)?.service_name || (log as Record<string, string>)?.service || (selectedServices.length > 0 ? selectedServices[0] : "middleware"),
            level: normalizeLevel(log.level as string),
          }))
        );
        setAggregatedIntervals([]);
      } else {
        throw new Error("Unexpected volume response format.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch log volume.";
      setVolumeError(message);
      console.error("Error fetching log volume:", err);
    } finally {
      setVolumeLoading(false);
    }
  }, [
    activeTab,
    timeRange,
    debouncedSearchTerm,
    selectedServices,
    userIdFilter,
    sessionIdFilter,
    selectedLevels,
  ]);

  const fetchLogs = async (
    isRefresh = false,
    options?: { limit?: number; fetchVolume?: boolean; rangeOverride?: TimeRange }
  ) => {
    if (activeTab !== "overview") return;
    const range = options?.rangeOverride ?? timeRange;
    if (!validateRange(range)) return;
    
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Use exact times from applied range (or explicit override from Apply)
      const startDate = new Date(range.from);
      const endDate = new Date(range.to);

      const body: Record<string, unknown> = {
        service_name: selectedServices.length > 0 ? selectedServices.join(",") : undefined,
        search: debouncedSearchTerm.trim() || undefined,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        limit: Math.min(Math.max(options?.limit ?? tableLineLimit, 50), 1000),
        /** POST /v1/observability/logs — timestamp sort */
        sort_order: "desc",
      };

      // Add user_id and session_id filters if provided
      if (userIdFilter.trim()) {
        body.user_id = userIdFilter.trim();
      }
      if (sessionIdFilter.trim()) {
        body.session_id = sessionIdFilter.trim();
      }
      // Add level filter if provided
      if (selectedLevels.length > 0) {
        body.level = selectedLevels.join(",");
      }

      const response = await apiFetch(`${OBSERVABILITY_BASE_URL}/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "include", // Include cookies (access_token) in the request
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = unwrapEnvelope<unknown>(await response.json());
      const rawLogs =
        (data && typeof data === "object" && Array.isArray((data as { logs?: unknown }).logs) && (data as { logs: LogEntry[] }).logs) ||
        (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data) && (data as { data: LogEntry[] }).data) ||
        (Array.isArray(data) && data) ||
        (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results) && (data as { results: LogEntry[] }).results);

      if (!rawLogs || !Array.isArray(rawLogs)) {
        throw new Error("Unexpected logs response format.");
      }

      const prepared = rawLogs.map((log: LogEntry) => {
        const derivedLevel =
          log.level ||
          (log as { labels?: { level?: string; detected_level?: string } })?.labels
            ?.detected_level ||
          (log as { labels?: { level?: string; detected_level?: string } })?.labels?.level;

        const ts =
          log.timestamp ||
          log.time ||
          log.ts ||
          log.datetime ||
          log.created_at ||
          log.date;

        return {
          ...log,
          timestamp: ts,
          service_name: (log as Record<string, string>)?.service_name || (log as Record<string, string>)?.service || (selectedServices.length > 0 ? selectedServices[0] : "middleware"),
          level: normalizeLevel(derivedLevel as string),
        };
      });

      setLogs(prepared);
      if (options?.fetchVolume) {
        fetchVolumeLogs(options?.rangeOverride);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch logs.";
      setError(message);
      console.error("Error fetching observability logs:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Refetch logs (only) when the line limit changes
  const prevTableLineLimitRef = useRef<number>(tableLineLimit);
  useEffect(() => {
    
    if (activeTab !== "overview") return;
    if (prevTableLineLimitRef.current === tableLineLimit) return;
    prevTableLineLimitRef.current = tableLineLimit;
    fetchLogs(false, { limit: tableLineLimit, fetchVolume: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableLineLimit, activeTab]);

  useEffect(() => {
    if (activeTab === "overview") {
      setDraftTimeRange({
        from: new Date(timeRange.from),
        to: new Date(timeRange.to),
        quickRange: timeRange.quickRange,
      });
      fetchServices();
      fetchLogs(false, { limit: tableLineLimit, fetchVolume: false });
      fetchVolumeLogs();
      
      const quick = FEEDBACK_QUICK_RANGES.find((r) => r.value === feedbackQuickRange);
      const to = new Date();
      const from = new Date(
        to.getTime() - (quick?.minutes ?? 7 * 24 * 60) * 60 * 1000
      );

      fetchFeedbackMetrics({
        from: from.toISOString(),
        to: to.toISOString(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Listen for theme changes to update chart colors
  useEffect(() => {
    const THEME_CHANGED_EVENT = "activeThemeChanged";
    const handleThemeChange = () => {
      const newTheme = getActiveThemeFromStorage();
      setActiveTheme(newTheme);
      setThemeKey((prev) => prev + 1);
    };
    
    // Check localStorage periodically for theme changes
    const checkTheme = () => {
      const newTheme = getActiveThemeFromStorage();
      if (newTheme !== activeTheme) {
        setActiveTheme(newTheme);
        setThemeKey((prev) => prev + 1);
      }
    };
    
    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChange);
    const interval = setInterval(checkTheme, 500);
    
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChange);
      clearInterval(interval);
    };
  }, [activeTheme, getActiveThemeFromStorage]);

  const logColumns = useMemo<ColumnConfig<LogEntry>[]>(() => {
    return [
      {
        key: "timestamp",
        header: "Timestamp",
        type: "date",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 210,
        accessor: (row) => resolveTimestamp(row) || row.timestamp || row.time || row.ts || row.datetime || row.created_at || row.date,
        render: (_value, row) => formatLogDate(resolveTimestamp(row) ?? row.timestamp),
      },
      {
        key: "level",
        header: "Level",
        type: "enum",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 120,
        accessor: (row) => normalizeLevel(row.level as string),
        render: (value) => (
          <DashboardPill
            intent="status"
            status={logLevelToStatus(String(value))}
            label={String(value)}
            mono
            className="uppercase"
          />
        ),
      },
      {
        key: "service_name",
        header: "Service",
        type: "enum",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 140,
        accessor: (row) =>
          (row as Record<string, string>)?.service_name ||
          (row as Record<string, string>)?.service ||
          "—",
      },
      {
        key: "endpoint",
        header: "Endpoint",
        type: "text",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 220,
        accessor: (row) =>
          (row as { endpoint?: string; labels?: { endpoint?: string } }).endpoint ||
          (row as { labels?: { endpoint?: string } }).labels?.endpoint ||
          "—",
      },
      {
        key: "message",
        header: "Message",
        type: "text",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 360,
        accessor: (row) =>
          (row.message as string) ||
          (row as Record<string, string>)?.error ||
          "",
        // Remove custom render to let DataTable handle text display with show more/less
      },
      {
        key: "user_id",
        header: "User ID",
        type: "text",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 180,
        accessor: (row) => (row as Record<string, string>)?.user_id || "—",
      },
      {
        key: "session_id",
        header: "Session ID",
        type: "text",
        sortable: true,
        searchable: true,
        filterable: false,
        width: 220,
        accessor: (row) => (row as Record<string, string>)?.session_id || "—",
      },
    ];
  }, []);

  const chartTotals = useMemo(() => {
    // If we have aggregated intervals, calculate from them
    if (aggregatedIntervals.length > 0) {
      return aggregatedIntervals.reduce<{
        total: number;
        info: number;
        warning: number;
        error: number;
      }>(
        (acc, interval) => {
          const levelCounts = interval.level_counts || {};
          acc.total += interval.count;
          acc.info += levelCounts.INFO || 0;
          acc.warning += (levelCounts.WARNING || levelCounts.WARN || 0);
          acc.error += levelCounts.ERROR || 0;
          return acc;
        },
        { total: 0, info: 0, warning: 0, error: 0 }
      );
    }
    
    // Fallback to original logic
    const source = volumeLogs.length ? volumeLogs : logs;
    return source.reduce<{
      total: number;
      info: number;
      warning: number;
      error: number;
    }>(
      (acc, log) => {
        const lvl = normalizeLevel(log.level as string);
        acc.total += 1;
        if (lvl === "ERROR") acc.error += 1;
        else if (lvl === "WARNING") acc.warning += 1;
        else acc.info += 1;
        return acc;
      },
      { total: 0, info: 0, warning: 0, error: 0 }
    );
  }, [logs, volumeLogs, aggregatedIntervals]);


  const aggregatedBins: Array<AggregatedBin & { timestamp: string; isIntervalMarker?: boolean }> = useMemo(() => {
    // If we have pre-aggregated intervals from the API, use them directly
    if (aggregatedIntervals.length > 0) {
      const interval = getAggregationInterval(timeRange);
      
      // Helper function to create appropriate x-axis label based on interval
      const createDisplayLabel = (date: Date, intervalSeconds: number): string => {
        const hour = `${date.getHours()}`.padStart(2, "0");
        const minute = `${date.getMinutes()}`.padStart(2, "0");
        const second = `${date.getSeconds()}`.padStart(2, "0");
        const day = `${date.getDate()}`.padStart(2, "0");
        const month = `${date.getMonth() + 1}`.padStart(2, "0");
        const year = date.getFullYear();
        
        // Format based on interval size
        if (intervalSeconds < 60) {
          return `${hour}:${minute}:${second}`;
        } else if (intervalSeconds < 3600) {
          return `${hour}:${minute}`;
        } else if (intervalSeconds < 86400) {
          return `${month}/${day} ${hour}:00`;
        } else {
          return `${year}-${month}-${day}`;
        }
      };
      
      // Convert aggregated intervals to bins
      return aggregatedIntervals.map((intervalData) => {
        // Convert timestamp (nanoseconds) to Date
        const timestampStr = String(intervalData.timestamp);
        let date: Date;
        
        if (timestampStr.length > 13) {
          // Nanoseconds - divide by 1e6 to get milliseconds
          const ms = Number(BigInt(timestampStr) / 1_000_000n);
          date = new Date(ms);
        } else if (timestampStr.length > 10) {
          // Milliseconds
          date = new Date(Number(timestampStr));
        } else {
          // Seconds
          date = new Date(Number(timestampStr) * 1000);
        }
        
        const levelCounts = intervalData.level_counts || {};
        const displayLabel = createDisplayLabel(date, interval.seconds);
        
        return {
          timestamp: date.toISOString(),
          label: displayLabel,
          INFO: levelCounts.INFO || 0,
          WARNING: (levelCounts.WARNING || levelCounts.WARN || 0),
          ERROR: levelCounts.ERROR || 0,
          isIntervalMarker: true,
        };
      }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    
    // Fallback to original logic for legacy format
    const sourceLogs = volumeLogs.length ? volumeLogs : logs;
    
    console.log("=== AGGREGATION DEBUG ===");
    console.log("Time Range FROM:", timeRange.from.toISOString());
    console.log("Time Range TO:", timeRange.to.toISOString());
    console.log("Quick Range:", timeRange.quickRange);
    console.log("Duration (minutes):", (timeRange.to.getTime() - timeRange.from.getTime()) / (1000 * 60));
    
    // Get dynamic aggregation interval based on time range (for x-axis display)
    const interval = getAggregationInterval(timeRange);
    const intervalMs = interval.seconds * 1000;
    
    // Helper function to create appropriate x-axis label based on interval
    const createDisplayLabel = (date: Date, intervalSeconds: number): string => {
      const hour = `${date.getHours()}`.padStart(2, "0");
      const minute = `${date.getMinutes()}`.padStart(2, "0");
      const second = `${date.getSeconds()}`.padStart(2, "0");
      const day = `${date.getDate()}`.padStart(2, "0");
      const month = `${date.getMonth() + 1}`.padStart(2, "0");
      const year = date.getFullYear();
      
      // Format based on interval size
      if (intervalSeconds < 60) {
        return `${hour}:${minute}:${second}`;
      } else if (intervalSeconds < 3600) {
        return `${hour}:${minute}`;
      } else if (intervalSeconds < 86400) {
        return `${month}/${day} ${hour}:00`;
      } else {
        return `${year}-${month}-${day}`;
      }
    };
    
    // Step 1: Generate all interval markers first
    const startTime = timeRange.from;
    const endTime = timeRange.to;
    
    const roundedStart = new Date(startTime);
    const startTimeMs = roundedStart.getTime();
    const roundedStartMs = Math.floor(startTimeMs / intervalMs) * intervalMs;
    roundedStart.setTime(roundedStartMs);
    
    const roundedEnd = new Date(endTime);
    const endTimeMs = roundedEnd.getTime();
    const roundedEndMs = Math.ceil(endTimeMs / intervalMs) * intervalMs;
    roundedEnd.setTime(roundedEndMs);
    
    // For ranges within 24 hours, extend by +1 interval
    const rangeDurationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (rangeDurationHours <= 24) {
      roundedEnd.setTime(roundedEnd.getTime() + intervalMs);
      console.log(`Extended range by +1 interval (${interval.label}) for 24hr range`);
    }
    
    const intervalMarkers = new Set<string>();
    const allDataPoints = new Map<string, AggregatedBin & { isIntervalMarker?: boolean }>();
    const current = new Date(roundedStart);
    
    // Create interval markers with labels
    while (current < roundedEnd) {
      const timestamp = current.toISOString();
      const displayLabel = createDisplayLabel(current, interval.seconds);
      intervalMarkers.add(timestamp);
      
      allDataPoints.set(timestamp, { 
        label: displayLabel, 
        INFO: 0, 
        WARNING: 0, 
        ERROR: 0,
        isIntervalMarker: true
      });
      
      current.setTime(current.getTime() + intervalMs);
    }
    
    // Step 2: Add individual log data points
    sourceLogs.forEach((log) => {
      const date = resolveTimestamp(log);
      if (!date) return;

      // Use exact timestamp (rounded to second for uniqueness)
      const exactTime = new Date(date);
      exactTime.setMilliseconds(0);
      
      const timestamp = exactTime.toISOString();
      
      // Get or create the data point
      const current = allDataPoints.get(timestamp) ?? { 
        label: "", // Empty label for non-marker data points
        INFO: 0, 
        WARNING: 0, 
        ERROR: 0,
        isIntervalMarker: false
      };
      
      const normalizedLevel = normalizeLevel(log.level as string);

      if (normalizedLevel === "ERROR") current.ERROR += 1;
      else if (normalizedLevel === "WARNING") current.WARNING += 1;
      else current.INFO += 1;

      allDataPoints.set(timestamp, current);
    });

    const result = Array.from(allDataPoints.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([timestamp, value]) => ({ ...value, timestamp }));
    
    const logCount = result.filter(r => !r.isIntervalMarker || (r.INFO + r.WARNING + r.ERROR > 0)).length;
    const intervalMarkerCount = result.filter(r => r.isIntervalMarker).length;
    console.log(`Created ${result.length} total data points`);
    console.log(`  - ${intervalMarkerCount} interval markers (will show labels)`);
    console.log(`  - ${logCount - intervalMarkerCount} individual logs (no labels)`);
    console.log(`Interval: ${interval.label} (${interval.seconds}s)`);
    
    return result;
  }, [logs, volumeLogs, aggregatedIntervals, timeRange.from, timeRange.to, timeRange.quickRange]);

  // Map timestamps to their date ranges
  const timestampToDateRange = useMemo(() => {
    const map = new Map<string, { from: Date; to: Date }>();
    
    if (aggregatedBins.length === 0) return map;
    
    const sourceLogs = volumeLogs.length ? volumeLogs : logs;
    const logTimestamps = new Set<string>();
    
    // Identify which timestamps are actual log data points
    sourceLogs.forEach((log) => {
      const date = resolveTimestamp(log);
      if (!date) return;
      const exactTime = new Date(date);
      exactTime.setMilliseconds(0);
      logTimestamps.add(exactTime.toISOString());
    });
    
    const interval = getAggregationInterval(timeRange);
    const intervalMs = interval.seconds * 1000;
    
    // Map each bin's timestamp to its time range
    aggregatedBins.forEach((bin) => {
      const from = new Date(bin.timestamp);
      
      // If this is an actual log data point, use a 1-second window
      // Otherwise, use the full interval range
      const isLogDataPoint = logTimestamps.has(bin.timestamp);
      const to = new Date(from.getTime() + (isLogDataPoint ? 1000 : intervalMs));
      
      map.set(bin.timestamp, { from, to });
    });
    
    return map;
  }, [aggregatedBins, timeRange.from, timeRange.to, logs, volumeLogs]);

  const columnData = useMemo(
    () =>
      aggregatedBins.map((bin) => ({
        label: bin.label,
        INFO: bin.INFO,
        WARNING: bin.WARNING,
        ERROR: bin.ERROR,
        timestamp: bin.timestamp,
        isIntervalMarker: bin.isIntervalMarker,
      })),
    [aggregatedBins]
  );

  // Filter chart data based on log type filter (for chart display only)
  const filteredColumnData = useMemo(() => {
    if (!chartFilter?.logType || chartFilter.logType === "ALL") {
      return columnData;
    }
    
    // Filter to show only the selected log type
    return columnData.map((bin) => ({
      label: bin.label,
      INFO: chartFilter.logType === "INFO" ? bin.INFO : 0,
      WARNING: chartFilter.logType === "WARNING" ? bin.WARNING : 0,
      ERROR: chartFilter.logType === "ERROR" ? bin.ERROR : 0,
      timestamp: bin.timestamp,
      isIntervalMarker: bin.isIntervalMarker,
    }));
  }, [columnData, chartFilter]);

  // Drive y-axis scale from currently displayed chart series (so legend filtering rescales y)
  const maxStack = useMemo(() => {
    if (!filteredColumnData.length) return 1;
    return filteredColumnData.reduce((max, bin) => {
      const total = (bin.INFO || 0) + (bin.WARNING || 0) + (bin.ERROR || 0);
      return Math.max(max, total);
    }, 1);
  }, [filteredColumnData]);

  // Filter logs for table (only by time range, not by log type)
  const filteredLogs = useMemo(() => {
    if (!chartFilter?.timeRange) return logs;
    
    return logs.filter((log) => {
      const logDate = resolveTimestamp(log);
      if (!logDate) return false;
      return logDate >= chartFilter.timeRange!.from && logDate < chartFilter.timeRange!.to;
    });
  }, [logs, chartFilter]);

  // Pass all filtered logs to DataTable - it will handle pagination internally
  const limitedLogsForTable = useMemo(() => {
    return filteredLogs;
  }, [filteredLogs]);


  // Format numbers with K notation for thousands (Grafana style)
  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)} K`.replace(/\.?0+$/, "");
    }
    return num.toString();
  };

  const chartData = useMemo(() => {
    const c = chartColors();
    return {
      labels: filteredColumnData.map((d) => d.label),
      datasets: [
        {
          label: `INFO`,
          data: filteredColumnData.map((d) => d.INFO),
          backgroundColor: toRgba(c.success, 0.85),
          borderColor: c.success,
          borderWidth: 0,
          stack: "logs",
          borderRadius: 0,
          barThickness: 1,
          maxBarThickness: 1,
          borderSkipped: false,
        },
        {
          label: `WARN`,
          data: filteredColumnData.map((d) => d.WARNING),
          backgroundColor: toRgba(c.warning, 0.85),
          borderColor: c.warning,
          borderWidth: 0,
          stack: "logs",
          borderRadius: 0,
          barThickness: 1,
          maxBarThickness: 1,
          borderSkipped: false,
        },
        {
          label: `ERROR`,
          data: filteredColumnData.map((d) => d.ERROR),
          backgroundColor: toRgba(c.error, 0.85),
          borderColor: c.error,
          borderWidth: 0,
          stack: "logs",
          borderRadius: 0,
          barThickness: 1,
          maxBarThickness: 1,
          borderSkipped: false,
        },
      ],
    };
  }, [filteredColumnData, themeKey]);

  const chartOptions = useMemo(() => {
    const isDarkTheme = activeTheme === "Gemini";
    const c = chartColors();

    const textColor = c.textMuted;
    const titleColor = c.text;
    const surfaceColor = c.background;
    const borderColor = toRgba(c.border, 0.2);
    const gridColor = isDarkTheme ? toRgba(c.text, 0.04) : toRgba(c.text, 0.06);
    const tickColor = isDarkTheme ? toRgba(c.text, 0.5) : toRgba(c.text, 0.6);

    return {
      responsive: true,
      maintainAspectRatio: false,
      color: textColor,
      // Ensure animations don't interfere
      animation: {
        duration: 300,
      },
      layout: {
        padding: { top: 10, right: 10, left: 0, bottom: 5 },
      },
      plugins: {
        legend: {
          display: false, // We'll show custom legend below chart
        },
        tooltip: {
          enabled: true,
          mode: "index" as const,
          intersect: false,
          titleColor: titleColor,
          bodyColor: titleColor,
          footerColor: titleColor,
          backgroundColor: surfaceColor,
          borderColor,
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13, weight: "bold" as const },
          bodyFont: { size: 12 },
          displayColors: true,
          callbacks: {
            title: (tooltipItems: any[]) => {
              // Show full timestamp (YYYY-MM-DD HH:MM:SS) on hover
              if (tooltipItems && tooltipItems.length > 0) {
                const index = tooltipItems[0].dataIndex;
                if (index !== undefined && filteredColumnData && filteredColumnData[index]) {
                const bin = filteredColumnData[index];
                if (bin && (bin as any).timestamp) {
                  const timestamp = (bin as any).timestamp;
                  const dateRange = timestampToDateRange.get(timestamp);
                  if (dateRange) {
                    const date = dateRange.from;
                    const year = date.getFullYear();
                    const month = `${date.getMonth() + 1}`.padStart(2, "0");
                    const day = `${date.getDate()}`.padStart(2, "0");
                    const hour = `${date.getHours()}`.padStart(2, "0");
                    const minute = `${date.getMinutes()}`.padStart(2, "0");
                    const second = `${date.getSeconds()}`.padStart(2, "0");
                    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                    }
                  }
                  // Fallback: use the label if timestamp is not available
                  if (bin && (bin as any).label) {
                    return (bin as any).label;
                  }
                }
              }
              return "";
            },
            label: (context: any) => {
              // For stacked charts, get the actual value from the chart data
              const datasetIndex = context.datasetIndex;
              const dataIndex = context.dataIndex;
              const label = context.dataset.label || "";
              
              // Get the actual value from filteredColumnData
              if (filteredColumnData && filteredColumnData[dataIndex]) {
                const bin = filteredColumnData[dataIndex];
                let value = 0;
                
                if (datasetIndex === 0) {
                  value = bin.INFO || 0;
                } else if (datasetIndex === 1) {
                  value = bin.WARNING || 0;
                } else if (datasetIndex === 2) {
                  value = bin.ERROR || 0;
                }
                
                return `${label}: ${value}`;
              }
              
              // Fallback
              const value = context.parsed?.y ?? 0;
              return `${label}: ${value}`;
            },
            afterBody: (tooltipItems: any[]) => {
              // Show total count for all log types at this timestamp
              if (tooltipItems && tooltipItems.length > 0) {
                const dataIndex = tooltipItems[0].dataIndex;
                if (filteredColumnData && filteredColumnData[dataIndex]) {
                  const bin = filteredColumnData[dataIndex];
                  const total = (bin.INFO || 0) + (bin.WARNING || 0) + (bin.ERROR || 0);
                  if (total > 0) {
                    return [`Total: ${total}`];
                  }
                }
              }
              return [];
            },
            labelColor: (context: any) => {
              const colors: Record<string, string> = {
                INFO: toRgba(c.success, 0.9),
                WARN: toRgba(c.warning, 0.9),
                ERROR: toRgba(c.error, 0.9),
              };
              const label = context.dataset.label || "";
              return {
                borderColor: colors[label] || "transparent",
                backgroundColor: colors[label] || "transparent",
                borderWidth: 2,
                borderDash: [0, 0] as [number, number],
              };
            },
            footer: () => {
              return ""; // Remove footer
            },
          },
        },
      onClick: (_event: any, elements: any[]) => {
        if (elements.length > 0) {
          const element = elements[0];
          const index = element.index;
          const datasetIndex = element.datasetIndex;
          const bin = filteredColumnData[index];
            
            if (bin && (bin as any).timestamp) {
              const timestamp = (bin as any).timestamp;
              const dateRange = timestampToDateRange.get(timestamp);
              const logTypes: ("INFO" | "WARNING" | "ERROR")[] = ["INFO", "WARNING", "ERROR"];
              const logType = logTypes[datasetIndex] || "ALL";
              
              if (dateRange) {
                setChartFilter({
                  timeRange: dateRange,
                  logType: logType,
                });
              }
            }
          } else {
            // Click outside bars - clear filter
            setChartFilter(null);
          }
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { 
            display: true,
            color: gridColor,
            drawBorder: false,
            lineWidth: 0.5,
            drawTicks: false,
          },
          ticks: { 
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: 8,
            includeBounds: true,
            align: 'center' as const,
            maxTicksLimit: 50,
            color: tickColor,
            padding: 3,
            font: { size: 9 },
            callback: function(_value: any, index: number) {
              // Only show labels for interval markers, hide individual data points
              const dataPoint = filteredColumnData[index];
              if (dataPoint && (dataPoint as any).isIntervalMarker) {
                return dataPoint.label || "";
              }
              return ""; // Hide labels for non-interval data points
            },
          },
          title: {
            display: false,
          },
          categoryPercentage: 1,
          barPercentage: 0.5,
        },
        y: {
          stacked: true,
          grid: { 
            color: gridColor,
            drawBorder: false,
            lineWidth: 0.5,
            drawTicks: false,
          },
          ticks: { 
            color: tickColor,
            padding: 8,
            font: { size: 10 },
            stepSize: maxStack > 100 ? Math.ceil(maxStack / 6) : undefined,
            precision: 0,
          },
          title: {
            display: false,
          },
          beginAtZero: true,
          min: 0,
          suggestedMax: maxStack > 0 ? Math.ceil(maxStack * 1.15) : 10,
        },
      },
    };
  }, [maxStack, themeKey, activeTheme, filteredColumnData, timestampToDateRange, chartFilter]);

  const legendColors = useMemo(() => {
    const c = chartColors();
    return {
      info: toRgba(c.success, 0.85),
      warn: toRgba(c.warning, 0.85),
      error: toRgba(c.error, 0.85),
    };
  }, [themeKey]);

  if (activeTab !== "overview") return null;

  if (error && !logs.length) {
    return (
      <TabsContent value="overview" className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
        <Card className={cn("flex h-full w-full flex-col relative overflow-hidden group", cardElevated, cardElevatedHover)}>
          <DashboardTabCardChrome />
          <CardContent className="flex-1 flex items-center justify-center relative z-10">
            <ErrorRetry error={error} onRetry={() => fetchLogs(false, { limit: tableLineLimit, fetchVolume: false })} />
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
  };

  const metricCardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20,
      },
    },
    hover: {
      scale: 1.02,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 17,
      },
    },
  };

  return (
    <TabsContent
      value="overview"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("flex h-full w-full flex-col relative overflow-hidden group", cardElevated, cardElevatedHover)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Overview"
          description="System health · observability · feedback"
        />
        <CardContent className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 p-4 sm:p-6">
      <motion.div
        className="space-y-5 pb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
            {/* ── Section 1: System Metrics ── */}
            <motion.div variants={cardVariants}>
              <SystemMetrics activeTab={activeTab ?? "overview"} />
            </motion.div>

            {/* ── Section 2: Log Volume + Feedback ── */}
            <motion.div
              variants={cardVariants}
              className="grid grid-cols-1 gap-4 xl:grid-cols-3"
            >
              {/* Log Volume chart (xl: 2/3 width) */}
              <Card className={cn("xl:col-span-2 relative overflow-hidden flex flex-col", cardDefault)}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <CardTitle className="text-sm font-semibold text-text-main">
                          Log Volume
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Events per interval · stacked by severity
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <Combobox
                          options={
                            services.length > 0
                              ? services
                              : ["middleware", "gateway", "ui", "analytics"]
                          }
                          selectedValues={selectedServices}
                          onSelect={(value) => {
                            if (!selectedServices.includes(value))
                              setSelectedServices([...selectedServices, value]);
                          }}
                          onRemove={(value) => {
                            const next = selectedServices.filter((s) => s !== value);
                            setSelectedServices(
                              next.length > 0 ? next : [services[0] ?? "middleware"]
                            );
                          }}
                          placeholder={servicesLoading ? "Loading…" : "Select services…"}
                          searchPlaceholder="Search services…"
                          emptyMessage="No services found."
                          disabled={servicesLoading}
                          className="w-44"
                          keepOpenOnSelect={true}
                          compact
                        />
                        <div className="flex gap-0.5 bg-surface-2 p-0.5 rounded-lg border border-border-main">
                          {(["last-1-hour", "last-6-hours", "last-24-hours"] as const).map((val) => {
                            const labels: Record<string, string> = { "last-1-hour": "1h", "last-6-hours": "6h", "last-24-hours": "24h" };
                            return (
                              <button
                                key={val}
                                onClick={() => {
                                  const preset = QUICK_RANGES.find((r) => r.value === val)!;
                                  const to = new Date();
                                  const from = new Date(to.getTime() - preset.minutes * 60 * 1000);
                                  const applied: TimeRange = { from, to, quickRange: val };
                                  setDraftTimeRange(applied);
                                  setTimeRange(applied);
                                  setDateError(null);
                                  fetchLogs(false, { limit: tableLineLimit, fetchVolume: true, rangeOverride: applied });
                                }}
                                className={cn(
                                  "px-2.5 h-7 rounded-md text-xs transition-colors",
                                  draftTimeRange.quickRange === val
                                    ? "bg-surface border border-border-main font-medium shadow-sm"
                                    : "text-text-muted hover:text-text-main"
                                )}
                              >
                                {labels[val]}
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          onClick={clearFilters}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-text-muted hover:text-text-main"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {dateError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 text-xs text-status-error bg-status-error/10 border border-status-error/20 rounded-md px-3 py-2 overflow-hidden"
                        >
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{dateError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-4 sm:p-5 space-y-3">
                  {/* Legend row */}
                  {/* <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() =>
                        setChartFilter(
                          chartFilter?.logType === "INFO"
                            ? null
                            : { timeRange: null, logType: "INFO" }
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                        chartFilter?.logType === "INFO" ? "bg-surface-2" : "hover:bg-surface"
                      )}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: legendColors.info }}
                      />
                      <span className="text-text-muted">INFO</span>
                      <span className="font-medium text-text-main tabular-nums">
                        {formatNumber(chartTotals.info)}
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        setChartFilter(
                          chartFilter?.logType === "WARNING"
                            ? null
                            : { timeRange: null, logType: "WARNING" }
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                        chartFilter?.logType === "WARNING" ? "bg-surface-2" : "hover:bg-surface"
                      )}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: legendColors.warn }}
                      />
                      <span className="text-text-muted">WARN</span>
                      <span className="font-medium text-text-main tabular-nums">
                        {formatNumber(chartTotals.warning)}
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        setChartFilter(
                          chartFilter?.logType === "ERROR"
                            ? null
                            : { timeRange: null, logType: "ERROR" }
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                        chartFilter?.logType === "ERROR" ? "bg-surface-2" : "hover:bg-surface"
                      )}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: legendColors.error }}
                      />
                      <span className="text-text-muted">ERROR</span>
                      <span className="font-medium text-text-main tabular-nums">
                        {formatNumber(chartTotals.error)}
                      </span>
                    </button>
                    <span className="ml-auto text-2xs text-text-muted font-mono hidden sm:inline">
                      click bar to filter table
                    </span>
                    {chartFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChartFilter(null)}
                        className="h-6 text-xs px-2 text-text-muted"
                      >
                        Clear
                      </Button>
                    )}
                  </div> */}

                  {/* Chart */}
                  {volumeLoading && !isRefreshing ? (
                    <div className="flex h-48 items-center justify-center">
                      <DashboardLoader size="md" />
                    </div>
                  ) : aggregatedBins.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center text-sm text-text-muted gap-2">
                      <Shield className="h-5 w-5" />
                      <p>No logs found for this window.</p>
                    </div>
                  ) : (
                    <div className="h-48 bg-background rounded-lg border border-border-main p-4">
                      <Bar
                        key={`chart-${themeKey}-${timeRange.from.getTime()}-${timeRange.to.getTime()}-${timeRange.quickRange ?? "custom"}`}
                        data={chartData}
                        options={chartOptions}
                      />
                    </div>
                  )}

                  {/* Totals strip */}
                  <div className="flex items-center gap-4 pt-2 border-t border-border-main/40 flex-wrap text-xs">
                    <span className="text-text-muted">Total in window:</span>
                    <span className="font-mono text-status-success">
                      INFO {formatNumber(chartTotals.info)}
                    </span>
                    <span className="font-mono text-status-warning">
                      WARN {formatNumber(chartTotals.warning)}
                    </span>
                    <span className="font-mono text-status-error">
                      ERROR {formatNumber(chartTotals.error)}
                    </span>
                    <span className="ml-auto font-mono text-text-muted">
                      Total {formatNumber(chartTotals.total)}
                    </span>
                  </div>

                  {volumeError && (
                    <div className="text-xs text-status-error">{volumeError}</div>
                  )}
                </CardContent>
              </Card>

              {/* Feedback panel (xl: 1/3 width) */}
              <Card className={cn("relative overflow-hidden flex flex-col", cardDefault)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold text-text-main">
                        Feedback
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Satisfaction snapshot
                      </CardDescription>
                    </div>
                    <FeedbackTimeRangeSelect
                      value={feedbackQuickRange}
                      onValueChange={applyFeedbackQuickRange}
                      aria-label="Time range for feedback metrics"
                      align="end"
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 sm:p-5 flex flex-col gap-3">
                  {/* Resolution progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Resolution rate</span>
                      <span className="font-mono font-medium text-text-main">
                        {feedbackMetrics?.resolution_rate?.toFixed(1) ?? "—"}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${feedbackMetrics?.resolution_rate ?? 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-2xs text-text-muted">
                      <span>{feedbackMetrics?.resolved ?? "—"} resolved</span>
                      <span>{feedbackMetrics?.total ?? "—"} total</span>
                    </div>
                  </div>

                  <div className="border-t border-border-main/50" />

                  {/* Thumbs up / down */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-status-success/10 border border-status-success/20 p-3 text-center">
                      <ThumbsUp className="h-[14px] w-[14px] mx-auto mb-1 text-status-success" />
                      <div className="font-display font-semibold text-xl text-status-success tabular-nums">
                        {feedbackMetrics?.thumbs_up ?? "—"}
                      </div>
                      <div className="text-2xs text-text-muted mt-0.5">Positive</div>
                    </div>
                    <div className="rounded-xl bg-status-error/10 border border-status-error/20 p-3 text-center">
                      <ThumbsDown className="h-[14px] w-[14px] mx-auto mb-1 text-status-error" />
                      <div className="font-display font-semibold text-xl text-status-error tabular-nums">
                        {feedbackMetrics?.thumbs_down ?? "—"}
                      </div>
                      <div className="text-2xs text-text-muted mt-0.5">Negative</div>
                    </div>
                  </div>

                  {/* Pending chip */}
                  <div className="rounded-xl border border-status-warning/20 bg-status-warning/10 px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-status-warning" />
                      <span className="text-xs text-text-muted">Pending review</span>
                    </div>
                    <span className="font-display font-semibold text-sm text-status-warning tabular-nums">
                      {feedbackMetrics?.pending ?? "—"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {metricsError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-status-error"
                      >
                        {metricsError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {onFeedbackTabClick && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onFeedbackTabClick}
                      className="w-full h-8 text-xs mt-auto border-border-main text-text-muted hover:text-text-main"
                    >
                      View all feedback
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Section 4: Observability Logs ── */}
            <motion.div variants={cardVariants}>
              <Card className={cn("relative overflow-hidden flex flex-col", cardDefault)}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold text-text-main">
                        Observability Logs
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Filter and explore log entries · click chart bars to drill in
                      </CardDescription>
                    </div>

                    {/* Filters row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-40">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search log messages…"
                          className="h-8 pl-8 pr-3 text-xs border-border-main bg-surface-2 placeholder:text-text-muted focus-visible:ring-0 focus:border-primary transition-colors"
                        />
                      </div>
                      <Combobox
                        options={["INFO", "WARNING", "ERROR"]}
                        selectedValues={selectedLevels}
                        onSelect={(value: string) => {
                          if (!selectedLevels.includes(value))
                            setSelectedLevels([...selectedLevels, value]);
                        }}
                        onRemove={(value: string) =>
                          setSelectedLevels(selectedLevels.filter((l) => l !== value))
                        }
                        placeholder="All levels"
                        searchPlaceholder="Search levels…"
                        emptyMessage="No levels found."
                        className="w-40"
                        keepOpenOnSelect={true}
                        multiSelectNoun="log levels"
                      />
                      <Input
                        value={userIdFilter}
                        onChange={(e) => setUserIdFilter(e.target.value)}
                        placeholder="User ID"
                        className="h-8 w-32 text-xs border-border-main bg-surface-2 placeholder:text-text-muted focus-visible:ring-0 focus:border-primary transition-colors"
                      />
                      <Input
                        value={sessionIdFilter}
                        onChange={(e) => setSessionIdFilter(e.target.value)}
                        placeholder="Session ID"
                        className="h-8 w-36 text-xs border-border-main bg-surface-2 placeholder:text-text-muted focus-visible:ring-0 focus:border-primary transition-colors"
                      />
                      <Select
                        value={String(tableLineLimit)}
                        onValueChange={(v) => setTableLineLimit(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs border-border-main bg-background/40">
                          <SelectValue placeholder="Limit" />
                        </SelectTrigger>
                        <SelectContent>
                          {[50, 100, 200, 500, 1000].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} rows
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() =>
                          fetchLogs(false, { limit: tableLineLimit, fetchVolume: false })
                        }
                        disabled={loading}
                        size="sm"
                        className="h-8 text-xs bg-primary hover:bg-primary/90 text-white flex-shrink-0"
                      >
                        Apply
                      </Button>
                      <Button
                        onClick={() => {
                          setSearchTerm("");
                          setUserIdFilter("");
                          setSessionIdFilter("");
                          setSelectedLevels([]);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-text-muted hover:text-text-main flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Active filter chips */}
                    <AnimatePresence>
                      {chartFilter && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-1.5 flex-wrap overflow-hidden"
                        >
                          <span className="text-2xs text-text-muted">Active filters:</span>
                          {chartFilter.timeRange && (
                            <DashboardPill
                              intent="neutral"
                              label={
                                <>
                                  {chartFilter.timeRange.from.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  })}
                                  –
                                  {chartFilter.timeRange.to.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => setChartFilter(null)}
                                    className="ml-0.5 text-text-muted hover:text-text-main"
                                    aria-label="Remove time filter"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </>
                              }
                              className="text-2xs text-primary border-primary/25 bg-primary/10"
                            />
                          )}
                          {chartFilter.logType && chartFilter.logType !== "ALL" && (
                            <DashboardPill
                              intent="status"
                              status={logLevelToStatus(chartFilter.logType)}
                              label={
                                <>
                                  {chartFilter.logType}
                                  <button
                                    type="button"
                                    onClick={() => setChartFilter(null)}
                                    className="ml-0.5 opacity-60 hover:opacity-100"
                                    aria-label="Remove level filter"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </>
                              }
                              className="text-2xs"
                            />
                          )}
                          <button
                            onClick={() => setChartFilter(null)}
                            className="text-2xs text-text-muted hover:text-text-main ml-1"
                          >
                            Clear all
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-4 sm:p-5 flex flex-col gap-3">
                  <div className="relative h-[560px]">
                    <motion.div
                      className="h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <DataTable<LogEntry>
                        key={tableLineLimit}
                        columns={logColumns}
                        data={limitedLogsForTable}
                        isLoading={loading && logs.length === 0}
                {...dashboardTableLoadingProps}
                        loadingMessage="Fetching logs..."
                        emptyMessage={
                          loading ? "Fetching logs..." : "No records for this selection."
                        }
                        enableFilters={true}
                        enableGlobalSearch={true}
                        defaultPageSize={Math.min(tableLineLimit, 1000)}
                        pageSizeOptions={[50, 100, 200, 500, 1000].filter(
                          (n) => n <= tableLineLimit
                        )}
                        getRowId={(row: LogEntry) =>
                          String(
                            row.timestamp ??
                              row.ts ??
                              row.datetime ??
                              row.created_at ??
                              row.date ??
                              (row as Record<string, string>)?.message ??
                              (row as Record<string, string>)?.session_id ??
                              (row as Record<string, string>)?.user_id ??
                              Math.random().toString(36)
                          )
                        }
                        className={dashboardAdminTableClassName}
                      />
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {error && logs.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
      </motion.div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

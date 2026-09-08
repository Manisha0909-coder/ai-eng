import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardLoader } from "@/components/ContentLoader";
import { DashboardPill } from "./DashboardPill";
import { dashboardPillBase, type DashboardPillStatus } from "./dashboardPillVariants";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { apiFetch } from "@/services/api/sessionExpiry";
import {
  QUICK_RANGES,
  type QuickRange,
} from "./TimeRangePicker";
import { chartColors, toRgba, type ChartColors } from "@/utils/chartColors";
import { cn } from "@/lib/utils";
import { COLOR_SCHEME_CHANGED } from "@/utils/theme";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  ChartTitle,
  ChartTooltip,
  ChartLegend
);

const Baseurl = `${(API_CONFIG.LOCAL_API_BASE_URL || "").replace(/\/$/, "")}`;
const OBSERVABILITY_BASE_URL = `${Baseurl}/observability`;

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

type LatencyPercentiles = { p50: number | null; p90: number | null };

type MetricChartColorKey = "info" | "error" | "success" | "warning" | "accent";
type MetricPillStatus = DashboardPillStatus | "accent";

const METRIC_CARD_HOVER: Record<MetricChartColorKey, string> = {
  info: "hover:border-primary/40",
  error: "hover:border-status-error/30",
  success: "hover:border-status-success/30",
  warning: "hover:border-status-warning/30",
  accent: "hover:border-accent/30",
};

function MetricPill({ status, label }: { status: MetricPillStatus; label: string }) {
  if (status === "accent") {
    return (
      <span
        className={cn(
          dashboardPillBase(),
          "text-[11px] bg-accent/[var(--pill-status-bg-alpha)] border-accent/[var(--pill-status-border-alpha)] text-accent",
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <DashboardPill intent="status" status={status} label={label} className="text-[11px]" />
  );
}

/** Counter metrics: use increase() query, show value + trend chart. Add new entries here and wire fetch/state in fetchObservabilityMetrics + fetchObservabilityTrends. */
const COUNTER_METRICS_CONFIG = [
  { id: "totalRequests", title: "Total Chat Requests", badge: "range", chartColorKey: "info" as const, chartLabel: "Requests", pillStatus: "neutral" as const },
  { id: "errorRequests", title: "Error Chat Requests", badge: "Errors", chartColorKey: "error" as const, chartLabel: "Errors", pillStatus: "error" as const },
  { id: "successRequests", title: "Success Chat Requests", badge: "Success", chartColorKey: "success" as const, chartLabel: "Success", pillStatus: "success" as const },
  { id: "inputTokens", title: "Input Tokens", badge: "Sent", chartColorKey: "warning" as const, chartLabel: "Input Tokens", pillStatus: "warning" as const },
  { id: "outputTokens", title: "Output Tokens", badge: "Generated", chartColorKey: "accent" as const, chartLabel: "Output Tokens", pillStatus: "accent" as const },
] as const;

/** Histogram metrics: use histogram_quantile, show p50/p90. Add new entries here and wire fetch/state in fetchObservabilityMetrics. */
const HISTOGRAM_METRICS_CONFIG = [
  { id: "fullResponseLatency", title: "Full Response Time", metric: "chat_full_response_duration_seconds" },
  { id: "ttftLatency", title: "Time to First Token", metric: "chat_request_duration_seconds" },
] as const;

interface SystemMetricsProps {
  activeTab: string;
}

export const SystemMetrics: React.FC<SystemMetricsProps> = ({ activeTab }) => {
  const [chartPalette, setChartPalette] = useState<ChartColors>(() => chartColors());

  useEffect(() => {
    const handler = () => setChartPalette(chartColors());
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const resolveMetricColor = useCallback(
    (key: MetricChartColorKey) => chartPalette[key],
    [chartPalette]
  );

  // Observability instant metric values
  const [totalRequests, setTotalRequests] = useState<number | null>(null);
  const [errorRequests, setErrorRequests] = useState<number | null>(null);
  const [successRequests, setSuccessRequests] = useState<number | null>(null);
  const [inputTokens, setInputTokens] = useState<number | null>(null);
  const [outputTokens, setOutputTokens] = useState<number | null>(null);
  const [fullResponseLatency, setFullResponseLatency] = useState<LatencyPercentiles>({ p50: null, p90: null });
  const [ttftLatency, setTtftLatency] = useState<LatencyPercentiles>({ p50: null, p90: null });
  const [metricsLoadingObs, setMetricsLoadingObs] = useState(true);
  const [metricsErrorObs, setMetricsErrorObs] = useState<string | null>(null);

  // Observability trend data
  const [totalRequestsTrend, setTotalRequestsTrend] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [errorRequestsTrend, setErrorRequestsTrend] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [successRequestsTrend, setSuccessRequestsTrend] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [inputTokensTrend, setInputTokensTrend] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [outputTokensTrend, setOutputTokensTrend] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [metricsTimeRange, setMetricsTimeRange] = useState<QuickRange>("last-24-hours");

  const fetchObservabilityMetrics = useCallback(async (range: QuickRange) => {
    setMetricsLoadingObs(true);
    setMetricsErrorObs(null);
    try {
      const extract = (data: unknown[]) => {
        if (!data || data.length === 0) return null;
        const first = data[0] as { values?: [number, string][]; value?: [number, string] };
        const arr = first.values ?? (first.value ? [first.value] : []);
        return arr.length > 0 ? parseFloat(arr.slice(-1)[0][1]) : null;
      };

      const fetchMetric = async (query: string): Promise<unknown[]> => {
        const res = await apiFetch(
          `${OBSERVABILITY_BASE_URL}/metrics?query=${encodeURIComponent(query)}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return unwrapEnvelope<unknown[]>(await res.json());
      };

      const rangeWindow =
        QUICK_RANGES.find((r) => r.value === range)?.prometheusRange ?? "24h";

      // Latency percentiles: same lookback as counters (`rangeWindow` in rate() and request step).
      const fetchLatencyQuantile = async (metric: string, quantile: number) => {
        const query = `histogram_quantile(${quantile}, sum(rate(${metric}_bucket[${rangeWindow}])) by (le))`;
        const urlParams = new URLSearchParams({
          query,
          step: rangeWindow,
        });
        const res = await apiFetch(`${OBSERVABILITY_BASE_URL}/metrics?${urlParams}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return unwrapEnvelope<unknown>(await res.json());
      };

      const [total, errors, success, inTok, outTok, fullP50, fullP90, ttftP50, ttftP90] =
        await Promise.all([
          fetchMetric(`sum(increase(chat_requests_total[${rangeWindow}]))`),
          fetchMetric(`sum(increase(chat_requests_total{status="error"}[${rangeWindow}]))`),
          fetchMetric(`sum(increase(chat_requests_total{status="success"}[${rangeWindow}]))`),
          fetchMetric(`sum(increase(chat_input_tokens_total[${rangeWindow}]))`),
          fetchMetric(`sum(increase(chat_output_tokens_total[${rangeWindow}]))`),
          fetchLatencyQuantile("chat_full_response_duration_seconds", 0.5),
          fetchLatencyQuantile("chat_full_response_duration_seconds", 0.9),
          fetchLatencyQuantile("chat_request_duration_seconds", 0.5),
          fetchLatencyQuantile("chat_request_duration_seconds", 0.9),
        ]);

      setTotalRequests(extract(total));
      setErrorRequests(extract(errors));
      setSuccessRequests(extract(success));
      setInputTokens(extract(inTok));
      setOutputTokens(extract(outTok));
      setFullResponseLatency({
        p50: extract(fullP50),
        p90: extract(fullP90),
      });
      setTtftLatency({
        p50: extract(ttftP50),
        p90: extract(ttftP90),
      });
    } catch (err) {
      setMetricsErrorObs(err instanceof Error ? err.message : "Failed to fetch metrics.");
    } finally {
      setMetricsLoadingObs(false);
      setLastFetchedAt(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    }
  }, []);

  const fetchObservabilityTrends = useCallback(async (params?: { from: Date; to: Date }) => {
    setTrendsLoading(true);
    setTrendsError(null);
    try {
      const now = params?.to ?? new Date();
      const start = params?.from ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Dynamic step: target ~24 data points regardless of time range
      const durationSeconds = (now.getTime() - start.getTime()) / 1000;
      const stepSeconds = Math.max(Math.round(durationSeconds / 24), 60);
      const step =
        stepSeconds < 3600
          ? `${Math.round(stepSeconds / 60)}m`
          : stepSeconds < 86400
            ? `${Math.round(stepSeconds / 3600)}h`
            : `${Math.round(stepSeconds / 86400)}d`;
      const increaseWindow = step;

      const fetchTrend = async (query: string, useStep?: string) => {
        const urlParams = new URLSearchParams({
          query,
          start: start.toISOString(),
          end: now.toISOString(),
          step: useStep ?? step,
        });
        const res = await apiFetch(`${OBSERVABILITY_BASE_URL}/metrics?${urlParams}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = unwrapEnvelope<Array<{ values?: [number, string][] }>>(await res.json());
        const values: [number, string][] = data.length > 0 ? data[0].values ?? [] : [];
        return {
          labels: values.map((v) => {
            const d = new Date(v[0] * 1000);
            // For ranges > 24h, include the date so repeated times are distinguishable
            if (durationSeconds > 86400) {
              return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
            }
            return d.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
          }),
          data: values.map((v) => parseFloat(v[1])),
        };
      };

      const [total, errors, success, inTok, outTok] = await Promise.all([
        fetchTrend(`sum(increase(chat_requests_total[${increaseWindow}]))`),
        fetchTrend(`sum(increase(chat_requests_total{status="error"}[${increaseWindow}]))`),
        fetchTrend(`sum(increase(chat_requests_total{status="success"}[${increaseWindow}]))`),
        fetchTrend(`sum(increase(chat_input_tokens_total[${increaseWindow}]))`),
        fetchTrend(`sum(increase(chat_output_tokens_total[${increaseWindow}]))`),
      ]);

      setTotalRequestsTrend(total);
      setErrorRequestsTrend(errors);
      setSuccessRequestsTrend(success);
      setInputTokensTrend(inTok);
      setOutputTokensTrend(outTok);
    } catch (err) {
      setTrendsError(err instanceof Error ? err.message : "Failed to fetch trends.");
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  const getMetricsRangeWindow = (range: QuickRange): { from: Date; to: Date } => {
    const to = new Date();
    const minutes = QUICK_RANGES.find((r) => r.value === range)?.minutes ?? 1440;
    const from = new Date(to.getTime() - minutes * 60 * 1000);
    return { from, to };
  };

  // Fetch on initial load (when overview tab is active) and when time range changes
  useEffect(() => {
    if (activeTab !== "overview") return;
    const { from, to } = getMetricsRangeWindow(metricsTimeRange);
    fetchObservabilityMetrics(metricsTimeRange);
    fetchObservabilityTrends({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, metricsTimeRange]);

  const buildTrendChartData = (
    trend: { labels: string[]; data: number[] },
    color: string,
    label: string
  ) => ({
    labels: trend.labels,
    datasets: [
      {
        label,
        data: trend.data,
        borderColor: color,
        backgroundColor: toRgba(color, 0.08),
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.4,
        fill: true,
      },
    ],
  });

  const miniChartOptions: ChartOptions<"line"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        padding: 8,
        callbacks: {
          title: (items: TooltipItem<"line">[]) => {
            if (!items.length) return "";
            return items[0].label ?? "";
          },
          label: (context: TooltipItem<"line">) => {
            const raw = context.parsed.y;
            const value = raw === null || raw === undefined ? 0 : raw;
            const label = context.dataset?.label ?? "";
            const formatted =
              value >= 1000
                ? `${(value / 1000).toFixed(1)}K`
                : value % 1 !== 0
                  ? value.toFixed(3)
                  : value.toString();
            return `${label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 4,
          color: toRgba(chartPalette.textMuted, 0.7),
          font: { size: 9 },
          padding: 2,
        },
        border: {
          display: false,
        },
      },
      y: {
        display: true,
        position: "right" as const,
        grid: {
          display: true,
          color: toRgba(chartPalette.textMuted, 0.08),
        },
        ticks: {
          maxTicksLimit: 3,
          color: toRgba(chartPalette.textMuted, 0.7),
          font: { size: 9 },
          padding: 2,
          callback: (value: unknown) => {
            const num = Number(value);
            if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
            if (num % 1 !== 0) return num.toFixed(2);
            return num;
          },
        },
        border: {
          display: false,
        },
        beginAtZero: true,
      },
    },
  }), [chartPalette]);

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

  const cardBaseClass =
    "rounded-lg border border-border-main/60 bg-gradient-to-br from-background/60 to-background/40 p-4 relative overflow-hidden group transition-all duration-300";
  const overlayClass = "absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300";

  return (
    <Card className="border border-border-main bg-background/80 backdrop-blur-xl shadow-[var(--shadow-elevated)] relative overflow-hidden group hover:shadow-[var(--shadow-elevated-hover)] transition-all duration-500">
      <motion.div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent z-20" />
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-text-main">Chat Metrics</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Performance &amp; token trends
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastFetchedAt && (
              <span className="text-2xs text-text-muted hidden sm:inline">Updated {lastFetchedAt}</span>
            )}
            <div className="flex gap-0.5 bg-surface-2 p-0.5 rounded-xl border border-border-main">
              {(["last-1-hour", "last-6-hours", "last-24-hours"] as const).map((val) => {
                const labels: Record<string, string> = { "last-1-hour": "1h", "last-6-hours": "6h", "last-24-hours": "24h" };
                return (
                  <button
                    key={val}
                    onClick={() => setMetricsTimeRange(val)}
                    className={cn(
                      "px-3 h-7 rounded-lg text-xs transition-colors",
                      metricsTimeRange === val
                        ? "bg-surface border border-border-main font-medium shadow-sm"
                        : "text-text-muted hover:text-text-main"
                    )}
                  >
                    {labels[val]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 relative z-10 space-y-6">
        {/* Counter metrics: value + trend chart */}
        <div>
          {/* <h3 className="text-sm font-semibold text-text-muted mb-3">Counter Metrics</h3> */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COUNTER_METRICS_CONFIG.map((cfg) => {
              const value = { totalRequests, errorRequests, successRequests, inputTokens, outputTokens }[cfg.id] as number | null;
              const trend = { totalRequests: totalRequestsTrend, errorRequests: errorRequestsTrend, successRequests: successRequestsTrend, inputTokens: inputTokensTrend, outputTokens: outputTokensTrend }[cfg.id] as { labels: string[]; data: number[] };
              const badgeText = cfg.badge === "range" ? QUICK_RANGES.find((r) => r.value === metricsTimeRange)?.label : cfg.badge;
              return (
                <motion.div
                  key={cfg.id}
                  variants={metricCardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  className={cn(cardBaseClass, METRIC_CARD_HOVER[cfg.chartColorKey])}
                >
                  <motion.div className={overlayClass} />
                  <p className="text-xs text-text-muted mb-1 relative z-10">{cfg.title}</p>
                  <div className={`flex items-end gap-2 relative z-10 ${metricsLoadingObs ? "opacity-50" : ""}`}>
                    <span className="text-2xl font-bold text-text-main">
                      {value !== null ? formatNumber(value) : "—"}
                    </span>
                    <MetricPill status={cfg.pillStatus} label={badgeText ?? ""} />
                  </div>
                  {trendsLoading ? (
                    <div className="h-12 mt-2 flex items-center justify-center">
                      <DashboardLoader size="md" variant="inline" />
                    </div>
                  ) : (
                    <div className="h-20 mt-3 relative z-10">
                      <Line
                        data={buildTrendChartData(trend, resolveMetricColor(cfg.chartColorKey), cfg.chartLabel)}
                        options={miniChartOptions}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Histogram metrics: p50, p90 */}
        <div>
          <h3 className="text-sm font-semibold text-text-muted mb-3">Latency Metrics</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HISTOGRAM_METRICS_CONFIG.map((cfg) => {
              const percentiles = { fullResponseLatency, ttftLatency }[cfg.id] as LatencyPercentiles;
              return (
                <motion.div
                  key={cfg.id}
                  variants={metricCardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  className={cardBaseClass}
                >
                  <motion.div className={overlayClass} />
                  <p className="text-xs text-text-muted mb-1 relative z-10">{cfg.title}</p>
                  <div
                    className={`flex flex-row flex-wrap items-end justify-between gap-x-1 gap-y-2 w-full min-w-0 relative z-10 ${metricsLoadingObs ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-end gap-2 min-w-0">
                      <span className="text-2xl font-bold tabular-nums text-text-main">
                        {percentiles.p50 != null ? `${percentiles.p50.toFixed(2)}s` : "—"}
                      </span>
                      <DashboardPill intent="status" status="neutral" label="p50" className="text-[11px] shrink-0" />
                    </div>
                    <div className="flex items-end gap-2 min-w-0 sm:pl-4  border-border-main/50">
                      <span className="text-2xl font-bold tabular-nums text-text-main">
                        {percentiles.p90 != null ? `${percentiles.p90.toFixed(2)}s` : "—"}
                      </span>
                      <DashboardPill intent="status" status="neutral" label="p90" className="text-[11px] shrink-0" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

        </div>
        {metricsErrorObs && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {metricsErrorObs}
          </div>
        )}
        {trendsError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {trendsError}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

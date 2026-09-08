import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Presets from 5 minutes through 24 hours (shared by chat metrics, feedback, and log volume). */
export type QuickRange =
  | "last-5-minutes"
  | "last-15-minutes"
  | "last-30-minutes"
  | "last-1-hour"
  | "last-2-hours"
  | "last-3-hours"
  | "last-4-hours"
  | "last-6-hours"
  | "last-8-hours"
  | "last-12-hours"
  | "last-24-hours";

export interface TimeRange {
  from: Date;
  to: Date;
  quickRange?: QuickRange;
}

/** Same trigger styling as Chat Metrics / SystemMetrics time range Select. */
export const DASHBOARD_TIME_RANGE_SELECT_TRIGGER_CLASS =
  "h-9 w-full min-w-[11rem] sm:w-[200px] border-border-main bg-background/40 text-xs font-medium hover:border-primary transition-all duration-300";

export const QUICK_RANGES: Array<{
  value: QuickRange;
  label: string;
  minutes: number;
  /** PromQL range vector / step duration for observability metrics APIs. */
  prometheusRange: string;
}> = [
  { value: "last-5-minutes", label: "Last 5 minutes", minutes: 5, prometheusRange: "5m" },
  { value: "last-15-minutes", label: "Last 15 minutes", minutes: 15, prometheusRange: "15m" },
  { value: "last-30-minutes", label: "Last 30 minutes", minutes: 30, prometheusRange: "30m" },
  { value: "last-1-hour", label: "Last 1 hour", minutes: 60, prometheusRange: "1h" },
  { value: "last-2-hours", label: "Last 2 hours", minutes: 120, prometheusRange: "2h" },
  { value: "last-3-hours", label: "Last 3 hours", minutes: 180, prometheusRange: "3h" },
  { value: "last-4-hours", label: "Last 4 hours", minutes: 240, prometheusRange: "4h" },
  { value: "last-6-hours", label: "Last 6 hours", minutes: 360, prometheusRange: "6h" },
  { value: "last-8-hours", label: "Last 8 hours", minutes: 480, prometheusRange: "8h" },
  { value: "last-12-hours", label: "Last 12 hours", minutes: 720, prometheusRange: "12h" },
  { value: "last-24-hours", label: "Last 24 hours", minutes: 1440, prometheusRange: "24h" },
];

export type DashboardTimeRangeSelectProps = {
  value: QuickRange;
  onValueChange: (range: QuickRange) => void;
  /** Defaults to "Time range". */
  "aria-label"?: string;
  /** Passed to `SelectContent` (e.g. `end` for header-aligned dropdowns). */
  align?: "start" | "end" | "center";
  className?: string;
};

/**
 * Single source of truth for the 5 min–24 h presets used by Chat Metrics, feedback metrics, and log volume.
 */
export function DashboardTimeRangeSelect({
  value,
  onValueChange,
  "aria-label": ariaLabel = "Time range",
  align,
  className,
}: DashboardTimeRangeSelectProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value} onValueChange={(v) => onValueChange(v as QuickRange)}>
        <SelectTrigger
          className={DASHBOARD_TIME_RANGE_SELECT_TRIGGER_CLASS}
          aria-label={ariaLabel}
        >
          <SelectValue placeholder="Time range" />
        </SelectTrigger>
        <SelectContent align={align}>
          {QUICK_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Day-level presets used by feedback metrics (not suitable for Prometheus/log queries). */
export type FeedbackQuickRange = "last-7-days" | "last-30-days" | "last-90-days";

export const FEEDBACK_QUICK_RANGES: Array<{
  value: FeedbackQuickRange;
  label: string;
  minutes: number;
}> = [
  { value: "last-7-days", label: "Last 7 days", minutes: 7 * 24 * 60 },
  { value: "last-30-days", label: "Last 30 days", minutes: 30 * 24 * 60 },
  { value: "last-90-days", label: "Last 90 days", minutes: 90 * 24 * 60 },
];

export function FeedbackTimeRangeSelect({
  value,
  onValueChange,
  align,
  className,
}: {
  value: FeedbackQuickRange;
  onValueChange: (range: FeedbackQuickRange) => void;
  align?: "start" | "end" | "center";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value} onValueChange={(v) => onValueChange(v as FeedbackQuickRange)}>
        <SelectTrigger
          className={DASHBOARD_TIME_RANGE_SELECT_TRIGGER_CLASS}
          aria-label="Feedback time range"
        >
          <SelectValue placeholder="Time range" />
        </SelectTrigger>
        <SelectContent align={align}>
          {FEEDBACK_QUICK_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
  /** Optional accessible name for the select (e.g. "Time range for logs"). */
  "aria-label"?: string;
}

export const TimeRangePicker = ({
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Time range",
}: TimeRangePickerProps) => {
  const selected = value.quickRange ?? "last-1-hour";

  const applyQuickRange = useCallback(
    (range: QuickRange) => {
      const quickRange = QUICK_RANGES.find((r) => r.value === range);
      if (!quickRange) return;

      const to = new Date();
      const from = new Date(to.getTime() - quickRange.minutes * 60 * 1000);

      onChange({
        from,
        to,
        quickRange: range,
      });
    },
    [onChange]
  );

  return (
    <DashboardTimeRangeSelect
      value={selected}
      onValueChange={applyQuickRange}
      aria-label={ariaLabel}
      className={className}
    />
  );
};

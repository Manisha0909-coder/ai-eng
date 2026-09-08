import type { DashboardPillStatus } from "../components/dashboardPillVariants";

export function logLevelToStatus(level?: string): DashboardPillStatus {
  const upper = (level ?? "INFO").toUpperCase();
  if (upper === "ERROR") return "error";
  if (upper === "WARNING" || upper === "WARN") return "warning";
  if (upper === "INFO") return "success";
  return "neutral";
}

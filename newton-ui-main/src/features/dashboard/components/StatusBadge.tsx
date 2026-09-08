import type { ReactNode } from "react";
import { DashboardPill } from "./DashboardPill";
import type { DashboardPillStatus } from "./dashboardPillVariants";

type StatusVariant = DashboardPillStatus;

interface StatusBadgeProps {
  status: StatusVariant;
  label: string;
  icon?: ReactNode;
  className?: string;
}

/** @deprecated Prefer DashboardPill intent="status" in new code */
export function StatusBadge({ status, label, icon, className }: StatusBadgeProps) {
  return (
    <DashboardPill
      intent="status"
      status={status}
      label={label}
      icon={icon}
      className={className}
    />
  );
}

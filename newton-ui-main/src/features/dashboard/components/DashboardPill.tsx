import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  dashboardPillBase,
  dashboardPillIntentVariants,
  type DashboardPillEntity,
  type DashboardPillIntent,
  type DashboardPillStatus,
} from "./dashboardPillVariants";

type CountPart = { n: number; label: string };

export interface DashboardPillProps {
  intent: DashboardPillIntent;
  entity?: DashboardPillEntity;
  status?: DashboardPillStatus;
  label?: ReactNode;
  icon?: ReactNode;
  mono?: boolean;
  truncate?: boolean;
  emphasis?: boolean;
  className?: string;
  as?: "span" | "button";
  /** For intent="count" — renders multiple count chips */
  countParts?: CountPart[];
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}

export function DashboardPill({
  intent,
  entity,
  status,
  label,
  icon,
  mono = false,
  truncate = false,
  emphasis = false,
  className,
  as = "span",
  countParts,
  buttonProps,
}: DashboardPillProps) {
  if (intent === "count" && countParts?.length) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {countParts.map((part) => (
          <DashboardPill
            key={part.label}
            intent="count"
            label={
              <>
                <strong className="font-semibold">{part.n}</strong>
                <span className="font-normal text-text-muted">{part.label}</span>
              </>
            }
          />
        ))}
      </div>
    );
  }

  const pillClass = cn(
    dashboardPillBase(),
    dashboardPillIntentVariants({
      intent,
      entity: intent === "entity" ? entity : undefined,
      status: intent === "status" ? status : undefined,
      emphasis: intent === "entity" && emphasis ? true : false,
    }),
    mono && "font-mono text-2xs",
    truncate && "truncate",
    className,
  );

  const content = (
    <>
      {icon}
      {label}
    </>
  );

  if (as === "button") {
    return (
      <button type="button" className={pillClass} {...buttonProps}>
        {content}
      </button>
    );
  }

  return <span className={pillClass}>{content}</span>;
}

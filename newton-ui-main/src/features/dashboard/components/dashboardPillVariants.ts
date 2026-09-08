import { cva } from "class-variance-authority";

export type DashboardPillIntent = "neutral" | "entity" | "status" | "count";
export type DashboardPillEntity =
  | "role"
  | "persona"
  | "doc-tag"
  | "tool-tag"
  | "server"
  | "datasource";
export type DashboardPillStatus =
  | "success"
  | "error"
  | "warning"
  | "pending"
  | "info"
  | "neutral";

export const dashboardPillBase = cva(
  "inline-flex max-w-full items-center gap-1 font-medium border whitespace-nowrap rounded-[var(--pill-radius)] px-[var(--pill-px)] py-[var(--pill-py)] text-[length:var(--pill-font-size)]",
);

export const dashboardPillIntentVariants = cva("", {
  variants: {
    intent: {
      neutral: "bg-surface border-border-main text-text-muted",
      entity: "",
      status: "",
      count: "bg-surface border-border-main text-text-main gap-1.5",
    },
    entity: {
      role: "bg-entity-role/[var(--pill-bg-alpha)] border-entity-role/[var(--pill-border-alpha)] text-entity-role",
      persona:
        "bg-entity-persona/[var(--pill-bg-alpha)] border-entity-persona/[var(--pill-border-alpha)] text-entity-persona",
      "doc-tag":
        "bg-entity-doc-tag/[var(--pill-bg-alpha)] border-entity-doc-tag/[var(--pill-border-alpha)] text-entity-doc-tag",
      "tool-tag":
        "bg-entity-tool-tag/[var(--pill-bg-alpha)] border-entity-tool-tag/[var(--pill-border-alpha)] text-entity-tool-tag",
      server:
        "bg-entity-server/[var(--pill-bg-alpha)] border-entity-server/[var(--pill-border-alpha)] text-entity-server",
      datasource:
        "bg-entity-datasource/[var(--pill-bg-alpha)] border-entity-datasource/[var(--pill-border-alpha)] text-entity-datasource",
    },
    status: {
      success:
        "bg-status-success/[var(--pill-status-bg-alpha)] border-status-success/[var(--pill-status-border-alpha)] text-status-success",
      error:
        "bg-status-error/[var(--pill-status-bg-alpha)] border-status-error/[var(--pill-status-border-alpha)] text-status-error",
      warning:
        "bg-status-warning/[var(--pill-status-bg-alpha)] border-status-warning/[var(--pill-status-border-alpha)] text-status-warning",
      pending:
        "bg-primary/[var(--pill-status-bg-alpha)] border-primary/[var(--pill-status-border-alpha)] text-primary",
      info: "bg-status-info/[var(--pill-status-bg-alpha)] border-status-info/[var(--pill-status-border-alpha)] text-status-info",
      neutral: "bg-surface-2 border-border-main text-text-muted",
    },
    emphasis: {
      true: "[--pill-bg-alpha:0.18]",
      false: "",
    },
  },
  defaultVariants: {
    emphasis: false,
  },
});

export const ENTITY_CSS_VAR: Record<DashboardPillEntity, string> = {
  role: "--color-entity-role",
  persona: "--color-entity-persona",
  "doc-tag": "--color-entity-doc-tag",
  "tool-tag": "--color-entity-tool-tag",
  server: "--color-entity-server",
  datasource: "--color-entity-datasource",
};

export const STATUS_CSS_VAR: Record<
  Exclude<DashboardPillStatus, "neutral" | "pending">,
  string
> = {
  success: "--color-success",
  error: "--color-error",
  warning: "--color-warning",
  info: "--color-info",
};

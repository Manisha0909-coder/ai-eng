import { cn } from "@/lib/utils";

const dashboardRowIconActionBase =
  "h-9 w-9 shrink-0 rounded-lg border border-border-main bg-background shadow-none transition-colors hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

/** Neutral row actions (edit / compose, sync, etc.) */
export const dashboardRowEditIconButtonClass = cn(
  dashboardRowIconActionBase,
  "text-text-main"
);

/** Destructive row actions (delete, detach) */
export const dashboardRowDeleteIconButtonClass = cn(
  dashboardRowIconActionBase,
  "text-destructive hover:bg-destructive/10 hover:text-destructive"
);

/** Accent row actions (e.g. download alongside edit) */
export const dashboardRowPrimaryIconButtonClass = cn(
  dashboardRowIconActionBase,
  "text-primary hover:text-primary"
);

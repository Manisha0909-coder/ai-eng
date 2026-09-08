import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  cardElevated,
  cardElevatedGradientBar,
  cardElevatedHover,
} from "@/lib/card-styles";
import { cn } from "@/lib/utils";

/** Pass to admin dashboard DataTable instances for skeleton row loading */
export const dashboardTableLoadingProps = {
  loadingVariant: "skeleton" as const,
};

/** Standard admin DataTable chrome: uppercase headers, left alignment, no column resize */
export const dashboardAdminTableClassName = cn(
  "h-full min-h-0 flex-1",
  "[&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wider",
  "[&_thead_th]:text-text-muted [&_thead_th]:text-left",
  "[&_thead_th>div]:justify-start [&_thead_th>div]:pr-0",
  "[&_.resize-handle]:hidden [&_.resize-handle]:pointer-events-none",
  "[&_tbody_td]:text-left",
);

/** For clickable-row tables (Personas, Shared Memory, Users, Feedback) */
export const dashboardAdminTableClickableRowClassName = cn(
  "[&_tbody_tr]:cursor-pointer",
  "[&_tbody_tr:hover]:bg-surface/50",
);

export const dashboardSelectionCheckboxClassName = cn(
  "h-3.5 w-3.5 rounded-[4px] border-border-main",
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
  "data-[state=checked]:text-background",
);

/** Standard tab card shell: glass border, hover shadow, full height */
export const dashboardTabCardClassName = cn(
  "group flex h-full min-h-0 w-full flex-col overflow-hidden",
  cardElevated,
  cardElevatedHover
);

/** Header strip: padding + bottom border (matches tabs with a clear separator) */
export const dashboardTabCardHeaderClassName =
  "relative z-10 border-b border-border-main/50 p-4 sm:p-6";

/**
 * Shared spring animation for the header block (title + toolbar).
 * Use on the motion wrapper that contains CardTitle + toolbar.
 */
export const dashboardTabCardMotionVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

/**
 * Header row: title + toolbar on one row from `sm` up (`flex-nowrap`).
 */
export const dashboardTabHeaderMotionClassName =
  "flex w-full min-w-0 flex-col gap-3 text-text-main sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-2 lg:gap-4";

/**
 * Left column: title + description — sizes to content on `sm+` so descriptions
 * stay on one line when space allows; shrinks when the toolbar needs room.
 */
export const dashboardTabHeaderTitleColumnClassName =
  "flex min-w-0 shrink flex-col items-stretch gap-0.5 w-full sm:w-max sm:max-w-full sm:items-start sm:pr-2";

/** Right column: grows to use space the title column does not take; toolbar strip scrolls horizontally if needed */
export const dashboardTabHeaderActionsColumnClassName =
  "flex w-full min-w-0 flex-col gap-3 sm:min-w-0 sm:flex-1 sm:basis-0 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2 sm:overflow-visible";

/** Merge onto CardTitle (plain text headings): full text, wraps naturally */
export const dashboardTabHeaderCardTitleClassName =
  "min-w-0 max-w-full break-words text-pretty !leading-snug whitespace-normal";

/** Merge onto CardDescription under the tab title */
export const dashboardTabHeaderCardDescriptionClassName =
  "min-w-0 max-w-full whitespace-normal";

/** Wrap primary action text next to an icon; visible from `lg` so mid-width toolbars stay icon-only with `title` tooltips */
export const dashboardTabToolbarButtonLabelClassName = "hidden lg:inline";

const defaultDescriptionClassName = cn(
  "text-text-main text-sm sm:text-base sm:mb-0 mb-4",
  dashboardTabHeaderCardDescriptionClassName
);

/** Animated tab card header: title, optional description, toolbar actions */
export function DashboardTabHeader({
  title,
  description,
  actions,
  titleRowEnd,
  titleClassName,
  descriptionClassName,
  titleColumnClassName,
  actionsColumnClassName,
  headerClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Mobile-only CTA beside title (Tags, Personas, Admin Users, etc.) */
  titleRowEnd?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
  titleColumnClassName?: string;
  actionsColumnClassName?: string;
  headerClassName?: string;
}) {
  const titleBlock = (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <CardTitle
        className={cn(
          "text-text-main text-xl sm:text-2xl",
          dashboardTabHeaderCardTitleClassName,
          titleClassName
        )}
      >
        {title}
      </CardTitle>
    </motion.div>
  );

  return (
    <CardHeader className={headerClassName ?? dashboardTabCardHeaderClassName}>
      <motion.div
        className={dashboardTabHeaderMotionClassName}
        variants={dashboardTabCardMotionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className={cn(dashboardTabHeaderTitleColumnClassName, titleColumnClassName)}>
          {titleRowEnd != null ? (
            <div className="flex min-w-0 w-full items-center justify-between">
              {titleBlock}
              {titleRowEnd}
            </div>
          ) : (
            titleBlock
          )}
          {description != null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <CardDescription
                className={cn(
                  defaultDescriptionClassName,
                  descriptionClassName
                )}
              >
                {description}
              </CardDescription>
            </motion.div>
          )}
        </div>
        {actions != null && (
          <motion.div
            className={cn(
              dashboardTabHeaderActionsColumnClassName,
              actionsColumnClassName
            )}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {actions}
          </motion.div>
        )}
      </motion.div>
    </CardHeader>
  );
}

/** DS-003 gradient accent bar + hover overlay for cardElevated tab shells */
export function DashboardTabCardChrome() {
  return (
    <>
      <div className={cardElevatedGradientBar} aria-hidden />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        initial={{ scale: 0.8, opacity: 0 }}
        whileHover={{ scale: 1, opacity: 1 }}
      />
    </>
  );
}

/**
 * Toolbar: mobile 2-col grid; from `sm`, one row (`nowrap`). Primary strip scrolls horizontally if tight; refresh stays fixed at the end.
 */
export function DashboardTabToolbar({
  primary,
  refresh,
  className,
}: {
  primary: ReactNode;
  refresh?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-3 text-text-main sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2 sm:overflow-visible",
        className
      )}
    >
      <div
        className={cn(
          "grid w-full min-w-0 grid-cols-1 gap-2 max-sm:grid-cols-2 max-sm:gap-2",
          "[&>*:first-child]:max-sm:col-span-2",
          "sm:flex sm:min-w-0 sm:flex-1 sm:basis-0 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2 sm:overflow-x-auto sm:overflow-y-visible sm:[scrollbar-width:thin]",
          "max-sm:[&>button]:min-h-11 max-sm:[&>button]:w-full sm:[&>button]:min-h-10",
          "[&>button]:shrink-0 [&>a]:shrink-0 [&_button]:shrink-0"
        )}
      >
        {primary}
      </div>
      {refresh != null && (
        <div
          className={cn(
            "flex w-full shrink-0 flex-col gap-2 text-text-main sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2",
            "[&>button]:w-full [&>button]:min-h-11 sm:[&>button]:min-h-10 sm:[&>button]:w-auto sm:[&>button]:shrink-0"
          )}
        >
          {refresh}
        </div>
      )}
    </div>
  );
}

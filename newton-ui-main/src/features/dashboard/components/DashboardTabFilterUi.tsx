import type { MouseEvent, ReactNode } from "react";
import { useId, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Combobox } from "@/components/ui/combobox";
import { dashboardTabToolbarButtonLabelClassName } from "./DashboardTabLayout";

/** Native `<select>` styling used inside filter popovers (prefer `DashboardTabSearchableSelect`) */
export const dashboardTabNativeSelectClass =
  "w-full px-3 py-2.5 text-sm bg-background border border-border-main rounded-md text-text-main focus:outline-none focus:ring-0 focus:border-border-main";

/** Datetime / date inputs inside filter popovers */
export const dashboardTabDatetimeInputClass =
  "h-10 w-full text-sm bg-background border border-border-main rounded-md px-3 text-text-main focus:outline-none focus:ring-0 focus:border-border-main";

export type DashboardTabSearchableSelectOption = { label: string; value: string };

/**
 * Single-select searchable dropdown for filter popovers (matches dashboard styling; no blue focus ring).
 */
export function DashboardTabSearchableSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  className,
  labelClassName,
  widthClassName,
  hideLabel = false,
}: {
  label: string;
  options: DashboardTabSearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  /** e.g. `sm:w-[180px] shrink-0` for toolbar filters */
  widthClassName?: string;
  /** Inline toolbar: one row, no stacked label (use a descriptive `placeholder`). */
  hideLabel?: boolean;
}) {
  const inputId = useId();
  const items = useMemo(() => options.map((o) => o.label), [options]);
  const labelForValue = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? options[0]?.label ?? "";
  }, [options, value]);

  const defaultValue = useMemo(() => (labelForValue ? [labelForValue] : []), [labelForValue]);

  const handleSelect = (selected: string[] | string) => {
    const lab = Array.isArray(selected) ? selected[0] : selected;
    const opt = options.find((o) => o.label === lab);
    if (opt) onValueChange(opt.value);
  };

  return (
    <div
      className={cn(!hideLabel && "space-y-2", widthClassName, className)}
    >
      {hideLabel ? (
        <Label htmlFor={inputId} className="sr-only">
          {label}
        </Label>
      ) : (
        <Label
          htmlFor={inputId}
          className={cn(
            "text-xs text-text-main sm:text-sm",
            labelClassName
          )}
        >
          {label}
        </Label>
      )}
      <Combobox
        multiple={false}
        items={items}
        defaultValue={defaultValue}
        onSelect={handleSelect as (items: string[]) => void}
        placeholder={placeholder}
        className="w-full min-w-0"
        inputId={inputId}
        inputClassName="h-10 py-2 rounded-md border-border-main bg-background text-text-main placeholder:text-text-muted focus:outline-none focus:ring-0 focus:border-border-main focus-visible:ring-0"
      />
    </div>
  );
}

/**
 * Same footprint on every tab: full width of the toolbar strip on narrow viewports,
 * capped at 280px so search does not crowd filters/actions. `grow-0` avoids consuming a whole flex row.
 */
const searchWrap =
  "relative w-full min-w-0 max-w-[min(100%,280px)] shrink-0 grow-0 basis-full";

/**
 * Standard dashboard tab search field: icon + full-height input (h-10, matches filter and action buttons).
 */
export function DashboardTabSearchInput({
  value,
  onChange,
  placeholder,
  className,
  id,
  disabled,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn(searchWrap, className)}>
      <Search
        size={13}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
      <Input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 border-border-main bg-input-bg pl-8 text-xs text-text-main placeholder:text-text-muted focus-visible:border-border-main focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}

/**
 * "Filters" trigger + popover shell. Footer calls `onClear` for popover-only fields (not search).
 */
export function DashboardTabFiltersPopover({
  filterCount,
  children,
  onClear,
  align = "end",
  showFooter = true,
  triggerClassName,
}: {
  filterCount: number;
  children: ReactNode;
  onClear: () => void;
  align?: "start" | "center" | "end";
  showFooter?: boolean;
  triggerClassName?: string;
}) {
  return (
    <div className="w-full min-w-0 shrink-0 sm:w-auto sm:max-w-full">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Filters"
            className={cn(
              "h-10 w-full min-w-0 justify-between gap-1.5 border-border-main px-2.5 text-xs text-text-muted hover:bg-surface-2 sm:w-auto sm:shrink-0 lg:gap-2 lg:px-2.5",
              triggerClassName
            )}
          >
          <span className="inline-flex items-center gap-1.5 lg:gap-2">
            <Filter
              size={13}
              className={cn(
                filterCount > 0
                  ? "text-primary"
                  : "text-text-muted"
              )}
              aria-hidden
            />
            <span className={dashboardTabToolbarButtonLabelClassName}>Filters</span>
          </span>
          {filterCount > 0 && (
            <span className="bg-primary/15 text-primary text-2xs font-mono px-1.5 py-0.5 rounded-full">
              {filterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-[90vw] max-w-sm border-border-main bg-background p-3 text-text-main sm:p-4 space-y-3"
      >
        {children}
        {showFooter && (
          <div className="flex justify-end border-t border-border-main pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-main hover:bg-surface"
              onClick={onClear}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
      </Popover>
    </div>
  );
}

/** Strip between the card header and table when any filter/search is active */
export function DashboardTabActiveFiltersBar({
  children,
  onClearAll,
}: {
  children: ReactNode;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-main px-4 py-2 sm:px-6">
      <span className="shrink-0 text-2xs font-mono uppercase tracking-[0.08em] text-text-muted">
        Active filters
      </span>
      {children}
      <button
        type="button"
        className="ml-auto text-2xs text-text-muted hover:text-text-main transition-colors underline underline-offset-2"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  );
}

/** Chip row used in the active filters bar */
export function DashboardTabFilterChip({
  children,
  onRemove,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onRemove: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md",
        "bg-primary/8 border border-primary/20 text-2xs text-primary",
        "min-w-0 max-w-[min(100%,360px)]",
        className
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {children}
      </span>
      <button
        type="button"
        onClick={handleRemove}
        className="w-4 h-4 rounded flex items-center justify-center hover:bg-primary/15 shrink-0"
        aria-label={ariaLabel}
      >
        <X
          size={10}
          className="pointer-events-none text-primary"
          aria-hidden
        />
      </button>
    </span>
  );
}

export function DashboardTabSearchFilterChip({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  const q = query.trim();
  if (!q) return null;
  return (
    <DashboardTabFilterChip onRemove={onClear} ariaLabel="Clear search">
      <span className="truncate" title={q}>
        Search: {q}
      </span>
    </DashboardTabFilterChip>
  );
}

/** Wrap search + filters + optional trailing actions with consistent gap */
export function DashboardTabFilterControlRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}

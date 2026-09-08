/**
 * FilterPanel Component
 * Dynamic filter panel with glassmorphism styling
 */

import { useState, useMemo } from "react";
import { X, Filter } from "lucide-react";
import { ColumnConfig, FilterOption } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterPanelProps<T = any> {
  columns: ColumnConfig<T>[];
  filters: Record<string, any>;
  onFilterChange: (key: string, value: any) => void;
  onClearFilters: () => void;
  data?: T[]; // Optional data for extracting filter options
  isMobile?: boolean;
}

export function FilterPanel<T = any>({
  columns,
  filters,
  onFilterChange,
  onClearFilters,
  data,
  isMobile = false,
}: FilterPanelProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  // Get filterable columns
  const filterableColumns = useMemo(
    () => columns.filter((col) => col.filterable && col.filterConfig),
    [columns]
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== null && v !== undefined && v !== "").length,
    [filters]
  );

  if (filterableColumns.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className={cn(
            "relative border-border-main bg-surface",
            "hover:bg-surface hover:border-primary",
            "transition-colors duration-200",
            isMobile ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm"
          )}
        >
          <Filter size={18} className="mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "ml-2 bg-primary/20 text-primary border-primary/30",
                isMobile ? "h-4 px-1 text-2xs" : "h-5 px-1.5 text-xs"
              )}
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className={cn(
          "z-[9999] pointer-events-auto",
          "w-[380px] sm:w-[420px] bg-surface",
          "border border-border-main",
          "shadow-sm",
          "p-4"
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-1 mb-4 pb-3 border-b border-border-main/30">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-text-main" />
            <h3 className="text-sm font-semibold text-text-main">Filters</h3>
          </div>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {filterableColumns.map((column) => (
            <FilterField
              key={column.key}
              column={column}
              value={filters[column.key]}
              onChange={(value) => onFilterChange(column.key, value)}
              data={data}
              isMobile={isMobile}
            />
          ))}
          {activeFilterCount > 0 && (
            <div className="pt-3 border-t border-border-main/30">
              <Button
                variant="outline"
                size="sm"
              onClick={() => {
                onClearFilters();
                setIsOpen(false);
              }}
                className="w-full border-border-main hover:bg-surface"
              >
                <X size={18} className="mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterFieldProps<T = any> {
  column: ColumnConfig<T>;
  value: any;
  onChange: (value: any) => void;
  data?: T[];
  isMobile?: boolean;
}

function FilterField<T = any>({ column, value, onChange, data, isMobile }: FilterFieldProps<T>) {
  const filterConfig = column.filterConfig!;

  // Extract options from data if enum type and no options provided
  const displayOptions = useMemo(() => {
    if (filterConfig.options) {
      return filterConfig.options;
    }
    
    // For enum types, extract unique values from data
    if (filterConfig.type === "enum" && data && data.length > 0) {
      const uniqueValues = new Set<string>();
      data.forEach((row) => {
        const cellValue = column.accessor ? column.accessor(row) : (row as any)[column.key];
        if (cellValue !== null && cellValue !== undefined) {
          uniqueValues.add(String(cellValue));
        }
      });
      return Array.from(uniqueValues).map((val) => ({
        label: val,
        value: val,
      }));
    }
    
    return [];
  }, [filterConfig, column, data]);

  const renderFilter = () => {
    switch (filterConfig.type) {
      case "text":
        return (
          <Input
            type="text"
            placeholder={filterConfig.placeholder || `Filter by ${column.header}`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            className={cn(
              "bg-surface/50 border-border-main",
              "focus:border-primary/50 focus:ring-primary/20",
              isMobile ? "h-8 text-xs" : "h-9 text-sm"
            )}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            placeholder={filterConfig.placeholder || `Filter by ${column.header}`}
            value={value || ""}
            onChange={(e) => {
              const numValue = e.target.value ? Number(e.target.value) : null;
              onChange(numValue);
            }}
            className={cn(
              "bg-surface/50 border-border-main",
              "focus:border-primary/50 focus:ring-primary/20",
              isMobile ? "h-8 text-xs" : "h-9 text-sm"
            )}
          />
        );

      case "date":
        if (filterConfig.dateRange) {
          const dateValue = value || {};
          return (
            <div className="space-y-2">
              <div>
                <Label className={cn("text-text-muted mb-1", isMobile ? "text-xs" : "text-sm")}>
                  From
                </Label>
                <Input
                  type="date"
                  value={dateValue.from || ""}
                  onChange={(e) =>
                    onChange({
                      ...dateValue,
                      from: e.target.value || undefined,
                    })
                  }
                  className={cn(
                    "bg-surface/50 border-border-main",
                    "focus:border-primary/50",
                    isMobile ? "h-8 text-xs" : "h-9 text-sm"
                  )}
                />
              </div>
              <div>
                <Label className={cn("text-text-muted mb-1", isMobile ? "text-xs" : "text-sm")}>
                  To
                </Label>
                <Input
                  type="date"
                  value={dateValue.to || ""}
                  min={dateValue.from || undefined}
                  onChange={(e) =>
                    onChange({
                      ...dateValue,
                      to: e.target.value || undefined,
                    })
                  }
                  className={cn(
                    "bg-surface/50 border-border-main",
                    "focus:border-primary/50",
                    isMobile ? "h-8 text-xs" : "h-9 text-sm"
                  )}
                />
              </div>
            </div>
          );
        }
        return (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            className={cn(
              "bg-surface/50 border-border-main",
              "focus:border-primary/50",
              isMobile ? "h-8 text-xs" : "h-9 text-sm"
            )}
          />
        );

      case "enum":
        return (
          <Select
            value={value ? String(value) : "__all__"}
            onValueChange={(val) => {
              if (val === "__all__") {
                onChange(null);
              } else {
                onChange(val);
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "bg-surface/50 border-border-main",
                "focus:border-primary/50",
                isMobile ? "h-8 text-xs" : "h-9 text-sm"
              )}
            >
              <SelectValue placeholder={filterConfig.placeholder || `Select ${column.header}`} />
            </SelectTrigger>
            <SelectContent 
              className="z-[10000] bg-surface border-border-main"
              position="popper"
              sideOffset={4}
            >
              {displayOptions.length === 0 ? (
                <div className="p-2 text-sm text-text-muted">No options available</div>
              ) : (
                <>
                  <SelectItem value="__all__">All</SelectItem>
                  {displayOptions.map((option: FilterOption) => (
                    <SelectItem key={String(option.value)} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        );

      case "boolean":
        return (
          <Select
            value={value === null || value === undefined ? "__all__" : String(value)}
            onValueChange={(val) => {
              if (val === "__all__") {
                onChange(null);
              } else {
                onChange(val === "true");
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "bg-surface/50 border-border-main",
                "focus:border-primary/50",
                isMobile ? "h-8 text-xs" : "h-9 text-sm"
              )}
            >
              <SelectValue placeholder={filterConfig.placeholder || `Select ${column.header}`} />
            </SelectTrigger>
            <SelectContent 
              className="z-[10000] bg-surface border-border-main"
              position="popper"
              sideOffset={4}
            >
              <SelectItem value="__all__">All</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <Label className={cn("text-text-main font-medium", isMobile ? "text-xs" : "text-sm")}>
        {column.header}
      </Label>
      {renderFilter()}
      {value !== null && value !== undefined && value !== "" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className={cn(
            "h-6 text-xs text-text-muted hover:text-text-main",
            "p-0"
          )}
        >
          <X size={14} className="mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}


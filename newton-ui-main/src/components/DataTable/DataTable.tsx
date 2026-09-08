/**
 * DataTable Component
 * Enterprise-grade reusable data table with client-side pagination, sorting, filtering, and search
 */

import { useMemo, useEffect, useCallback, useState, useRef, useId } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, GripVertical, RefreshCw } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useIsMobile } from "@/hooks/use-mobile";
import { DataTableProps, ColumnConfig, TableQueryParams } from "./types";
import { DashboardLoader } from "@/components/ContentLoader";
import { createTableStore, type TableStoreState } from "./useTableStore";
import { FilterPanel } from "./FilterPanel";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EnhancedPagination } from "@/features/dashboard/components/EnhancedPagination";
import { cn } from "@/lib/utils";

const CHECKBOX_COL_WIDTH = 40;

// Component to detect if text is actually truncated
const TruncatedTextCell = ({
  content,
  isExpanded,
  widthValue,
}: {
  content: string;
  isExpanded: boolean;
  widthValue: number;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [, setIsTruncated] = useState(false);
  const wasTruncatedRef = useRef(false);

  // For wider columns, show more lines before truncating
  const maxLinesWhenCollapsed = widthValue > 400 ? 5 : widthValue > 300 ? 4 : widthValue > 200 ? 3 : widthValue > 150 ? 2 : 1;

  useEffect(() => {
    const checkTruncation = () => {
      if (!contentRef.current || !measureRef.current) return;
      
      // Measure full content height without line-clamp
      const fullHeight = measureRef.current.scrollHeight;
      
      if (isExpanded) {
        // When expanded, always show "Show less" if content was ever truncated
        // Don't reset wasTruncatedRef - once content is expanded, keep showing button
        setIsTruncated(false);
      } else {
        // When collapsed, measure actual truncation
        const visibleHeight = contentRef.current.clientHeight;
        
        // Add small threshold (2px) to account for rounding differences
        const isActuallyTruncated = fullHeight > visibleHeight + 2;
        setIsTruncated(isActuallyTruncated);
        wasTruncatedRef.current = isActuallyTruncated;
      }
    };

    // Check after a short delay to ensure DOM is updated
    const timeoutId = setTimeout(checkTruncation, 10);
    
    // Recheck when window resizes or column width changes
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkTruncation, 10);
    });
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    if (measureRef.current) {
      resizeObserver.observe(measureRef.current);
    }
    
    window.addEventListener("resize", checkTruncation);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkTruncation);
    };
  }, [isExpanded, widthValue, content, maxLinesWhenCollapsed]);

  return (
    <div className="w-full relative">
      {/* Measure full text off-screen so absolutely positioned overflow cannot extend the table scroll height */}
      <div
        ref={measureRef}
        className="break-words pointer-events-none"
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: `${Math.max(widthValue, 80)}px`,
          wordBreak: "break-word",
          visibility: "hidden",
          zIndex: -1,
        }}
      >
        {content}
      </div>
      {/* Visible content with conditional line-clamp */}
      <div
        ref={contentRef}
        className="w-full break-words"
        style={
          !isExpanded
            ? {
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: maxLinesWhenCollapsed,
                WebkitBoxOrient: "vertical",
                wordBreak: "break-word",
              }
            : {
                wordBreak: "break-word",
              }
        }
        title={isExpanded ? undefined : content}
      >
        {content}
      </div>
      {/* NOTE: "Show more / Show less" control is disabled because column expansion
          already provides this behavior. Keeping the code commented-out for now
          in case we want to re-enable per-cell expansion later. */}
      {/*
      {(isTruncated || (isExpanded && wasTruncatedRef.current)) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1.5 transition-all duration-200 font-medium"
        >
          <span>{isExpanded ? 'Show less' : 'Show more'}</span>
          <ChevronDown 
            size={12} 
            className={cn(
              "transform transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      )}
      */}
    </div>
  );
};

export function DataTable<T = any>({
  columns,
  data: rawData,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize,
  enableGlobalSearch = true,
  enableFilters = true,
  disablePagination = false,
  onRefresh,
  onRowClick,
  onFilterChange,
  getRowId,
  className,
  emptyMessage = "No data available",
  isLoading = false,
  loadingVariant = "loader",
  skeletonRows,
  lineLimitSelector,
  serverSide = false,
  totalItems,
  onQueryChange,
  enableRowSelection = false,
  isRowSelectable,
  onSelectionChange,
  renderBulkActions,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  
  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const defaultWidth = 150;
    
    columns.forEach((col) => {
      if (col.width && typeof col.width === "number") {
        initial[col.key] = col.width;
      } else if (col.width && typeof col.width === "string" && col.width.endsWith("px")) {
        initial[col.key] = parseInt(col.width);
      } else {
        // Calculate default width based on available space
        initial[col.key] = defaultWidth;
      }
    });
    return initial;
  });

  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const bottomScrollbarRef = useRef<HTMLDivElement>(null);
  /** Latest onQueryChange without listing it in effect deps (avoids duplicate server fetches when parent passes an inline handler). */
  const onQueryChangeRef = useRef(onQueryChange);
  /** Skip emitting identical server queries (Strict Mode / re-renders). */
  const lastServerQueryKeyRef = useRef<string>("");

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const getRowIdValue = useCallback(
    (row: T, index: number): string | number => (getRowId ? getRowId(row) : index),
    [getRowId],
  );

  const canSelectRow = useCallback(
    (row: T) => (isRowSelectable ? isRowSelectable(row) : true),
    [isRowSelectable],
  );

  const getSelectableRows = useCallback(
    (rows: T[]) => rows.filter(canSelectRow),
    [canSelectRow],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleRow = useCallback(
    (id: string | number, row: T) => {
      if (!canSelectRow(row)) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [canSelectRow],
  );

  const toggleSelectAll = useCallback(
    (rows: T[]) => {
      const selectableRows = getSelectableRows(rows);
      setSelectedIds((prev) => {
        const allIds = selectableRows.map((row, i) => getRowIdValue(row, i));
        const allSelected =
          allIds.length > 0 && allIds.every((id) => prev.has(id));
        const next = new Set(prev);
        if (allSelected) {
          allIds.forEach((id) => next.delete(id));
        } else {
          allIds.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    [getRowIdValue, getSelectableRows],
  );

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  });
  useEffect(() => {
    if (enableRowSelection) onSelectionChangeRef.current?.(selectedIds);
  }, [selectedIds, enableRowSelection]);

  // Drop selections for rows that disappeared or became non-selectable
  useEffect(() => {
    if (!enableRowSelection) return;
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(
        rawData
          .filter(canSelectRow)
          .map((row, index) => getRowIdValue(row, index)),
      );
      const next = new Set<string | number>();
      let changed = false;
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [rawData, enableRowSelection, canSelectRow, getRowIdValue]);

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  });
  
  // Track expanded cells for show more/less functionality
  const [expandedCells] = useState<Set<string>>(new Set());

  // Generate a unique ID for this table instance to avoid store conflicts
  const tableInstanceId = useId();
  
  // Create a stable store ID that includes the component instance ID
  // The store is cached by ID in createTableStore, so this ensures persistence
  const storeIdRef = useRef<string>(`datatable-${tableInstanceId}`);
  
  // Create table store instance - the store is cached by ID, so this will return
  // the same store instance even if the component re-renders
  // Use ref to ensure store is only created once, preventing state loss in production
  const storeRef = useRef<ReturnType<typeof createTableStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createTableStore(
      storeIdRef.current,
      defaultPageSize ? { pageSize: defaultPageSize } : undefined
    );
  }
  const useStore = storeRef.current;

  // Get state and actions from store
  const storeState = useStore() as TableStoreState;
  const {
    page,
    pageSize,
    sortColumn,
    sortDirection,
    globalSearch,
    filters,
    setPage,
    setPageSize,
    setSort,
    setGlobalSearch,
    setFilter,
    clearFilters,
  } = storeState;

  // Debounce global search
  const debouncedSearch = useDebouncedValue(globalSearch, 300);

  // Get cell value helper
  const getCellValue = useCallback(
    (row: T, column: ColumnConfig<T>) => {
      if (column.accessor) {
        return column.accessor(row);
      }
      return (row as any)[column.key];
    },
    []
  );

  // Client-side filtering and sorting
  const processedData = useMemo(() => {
    if (serverSide) {
      return rawData;
    }
    let filtered = [...rawData];

    // Apply global search
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((row) => {
        return columns.some((col) => {
          if (!col.searchable) return false;
          const value = getCellValue(row, col);
          return value !== null && value !== undefined && String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, filterValue]) => {
      if (filterValue === null || filterValue === undefined || filterValue === "") return;

      const column = columns.find((col) => col.key === key);
      if (!column || !column.filterConfig) return;

      filtered = filtered.filter((row) => {
        const cellValue = getCellValue(row, column);
        const filterConfig = column.filterConfig!;

        switch (filterConfig.type) {
          case "text":
            return String(cellValue || "").toLowerCase().includes(String(filterValue).toLowerCase());

          case "number":
            return Number(cellValue) === Number(filterValue);

          case "date":
            if (filterConfig.dateRange && typeof filterValue === "object") {
              const cellDate = cellValue ? new Date(cellValue).getTime() : 0;
              const fromDate = filterValue.from ? new Date(filterValue.from).getTime() : 0;
              const toDate = filterValue.to ? new Date(filterValue.to).getTime() : Infinity;
              return cellDate >= fromDate && cellDate <= toDate;
            }
            return String(cellValue).includes(String(filterValue));

          case "enum":
          case "boolean":
            return String(cellValue) === String(filterValue);

          default:
            return true;
        }
      });
    });

    // Apply sorting
    if (sortColumn && sortDirection) {
      const column = columns.find((col) => col.key === sortColumn);
      if (column && column.sortable) {
        filtered.sort((a, b) => {
          const aValue = getCellValue(a, column);
          const bValue = getCellValue(b, column);

          // Handle null/undefined
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;

          // Compare based on type
          let comparison = 0;
          if (column.type === "number") {
            comparison = Number(aValue) - Number(bValue);
          } else if (column.type === "date") {
            comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }

          return sortDirection === "asc" ? comparison : -comparison;
        });
      }
    }

    return filtered;
  }, [rawData, debouncedSearch, filters, sortColumn, sortDirection, columns, getCellValue, serverSide]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (serverSide || disablePagination) {
      return processedData;
    }
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return processedData.slice(startIndex, endIndex);
  }, [processedData, page, pageSize, disablePagination, serverSide]);

  /** Width of all columns; table uses this so many columns extend past the viewport and scroll horizontally. */
  const tableContentWidthPx = useMemo(() => {
    if (columns.length === 0) return 900;
    const sum = columns.reduce((acc, col) => {
      const w = columnWidths[col.key] || col.width || 150;
      const widthValue = typeof w === "number" ? w : parseInt(String(w).replace("px", ""), 10) || 150;
      return acc + widthValue;
    }, 0) + (enableRowSelection ? CHECKBOX_COL_WIDTH : 0);
    return Math.max(900, sum);
  }, [columns, columnWidths, enableRowSelection]);

  const effectiveTotalItems = useMemo(() => {
    if (serverSide) {
      return totalItems ?? rawData.length;
    }
    return processedData.length;
  }, [serverSide, totalItems, rawData.length, processedData.length]);

  const selectableOnPage = useMemo(
    () => getSelectableRows(paginatedData),
    [getSelectableRows, paginatedData],
  );

  const isAllOnPageSelected =
    enableRowSelection &&
    selectableOnPage.length > 0 &&
    selectableOnPage.every((row, i) =>
      selectedIds.has(getRowIdValue(row, i)),
    );
  const isSomeOnPageSelected =
    enableRowSelection &&
    selectableOnPage.some((row, i) => selectedIds.has(getRowIdValue(row, i)));

  // Reset to first page when filters/search change
  useEffect(() => {
    if (!disablePagination) {
      setPage(1);
    }
  }, [debouncedSearch, JSON.stringify(filters), setPage, disablePagination]);

  useEffect(() => {
    if (!serverSide) return;
    const notify = onQueryChangeRef.current;
    if (!notify) return;

    const query: TableQueryParams = {
      page,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort_by: sortColumn || undefined,
      sort_order: sortDirection === "asc" || sortDirection === "desc" ? sortDirection : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    // Only the built-in global search bar should drive `search` for server queries.
    // When disabled, omit `search` so parents using external search are not cleared.
    if (enableGlobalSearch) {
      query.search = debouncedSearch.trim() || undefined;
    }

    const dedupeKey = JSON.stringify({
      page: query.page,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      sort_by: query.sort_by,
      sort_order: query.sort_order,
      filters: query.filters,
    });
    if (dedupeKey === lastServerQueryKeyRef.current) return;
    lastServerQueryKeyRef.current = dedupeKey;

    notify(query);
  }, [
    serverSide,
    page,
    pageSize,
    debouncedSearch,
    sortColumn,
    sortDirection,
    filters,
    enableGlobalSearch,
  ]);

  // Handle column resizing
  const handleResizeStart = useCallback((columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnKey] || 150);
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(80, resizeStartWidth + diff); // Minimum width of 80px
    
    setColumnWidths((prev) => ({
      ...prev,
      [resizingColumn]: newWidth,
    }));
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Keep top and bottom horizontal scrollbars in sync
  const syncScrollWidths = useCallback(() => {
    if (horizontalScrollRef.current && topScrollbarRef.current) {
      const targetWidth = horizontalScrollRef.current.scrollWidth;
      const topSpacer = topScrollbarRef.current.firstElementChild as HTMLElement | null;
      if (topSpacer) {
        topSpacer.style.width = `${targetWidth}px`;
        topSpacer.style.height = "1px";
      }
      
      // Sync bottom scrollbar as well
      if (bottomScrollbarRef.current) {
        const bottomSpacer = bottomScrollbarRef.current.firstElementChild as HTMLElement | null;
        if (bottomSpacer) {
          bottomSpacer.style.width = `${targetWidth}px`;
          bottomSpacer.style.height = "1px";
        }
      }
    }
  }, []);

  const handleMainScroll = useCallback(() => {
    if (!horizontalScrollRef.current) return;
    const main = horizontalScrollRef.current;

    // Sync top scrollbar
    if (topScrollbarRef.current && topScrollbarRef.current.scrollLeft !== main.scrollLeft) {
      topScrollbarRef.current.scrollLeft = main.scrollLeft;
    }

    // Sync bottom scrollbar
    if (bottomScrollbarRef.current && bottomScrollbarRef.current.scrollLeft !== main.scrollLeft) {
      bottomScrollbarRef.current.scrollLeft = main.scrollLeft;
    }
  }, []);

  useEffect(() => {
    // Sync scrollbar widths after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      syncScrollWidths();
    }, 0);
    
    window.addEventListener("resize", syncScrollWidths);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", syncScrollWidths);
    };
  }, [syncScrollWidths, rawData.length, columns.length, columnWidths, paginatedData.length]);

  // Also sync when table content changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      syncScrollWidths();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [syncScrollWidths, paginatedData]);

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (key: string, value: any) => {
      setFilter(key, value);
      onFilterChange?.(filters);
    },
    [setFilter, onFilterChange, filters]
  );

  // Handle sort
  const handleSort = useCallback(
    (columnKey: string) => {
      if (sortColumn === columnKey) {
        // Toggle: asc -> desc -> asc
        if (sortDirection === "asc") {
          setSort(columnKey, "desc");
        } else {
          setSort(columnKey, "asc");
        }
      } else {
        setSort(columnKey, "asc");
      }
    },
    [sortColumn, sortDirection, setSort]
  );

  // Render sort icon
  const renderSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown size={11} className="opacity-40" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp size={11} className="text-primary" />;
    }
    if (sortDirection === "desc") {
      return <ArrowDown size={11} className="text-primary" />;
    }
    return <ArrowUpDown size={11} className="opacity-40" />;
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden",
        className
      )}
    >
      {/* Header with Search and Filters - Only show if any feature is enabled */}
      {(enableGlobalSearch || enableFilters || onRefresh || lineLimitSelector) && (
        <div
          className={cn(
            "flex flex-col sm:flex-row gap-3 p-4",
            "border-b border-border-main",
            "bg-surface",
            "items-start sm:items-center"
          )}
        >
          <div className="flex items-center gap-3 flex-1 w-full">
            {enableGlobalSearch && (
              <div className="relative flex-1 w-full">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  size={18}
                />
                <Input
                  placeholder="Search..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className={cn(
                    "pl-9",
                    "bg-background",
                    "border-border-main",
                    "text-text-main",
                    "placeholder:text-text-muted",
                    "focus:border-primary",
                    "focus-visible:outline-none",
                    "focus-visible:ring-2",
                    "focus-visible:ring-primary",
                    isMobile ? "h-8 text-xs" : "h-9 text-sm"
                  )}
                  style={{
                    color: "var(--color-text)",
                    backgroundColor: "var(--color-background)",
                    borderColor: "rgb(var(--color-border))",
                  }}
                  aria-label="Global search"
                />
              </div>
            )}
            {lineLimitSelector && (
              <div className="flex items-center gap-2">
                {lineLimitSelector}
              </div>
            )}
          </div>

          {(enableFilters || onRefresh) && (
            <div className="flex items-center gap-2 sm:ml-auto">
              {enableFilters && (
                <FilterPanel
                  columns={columns}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={clearFilters}
                  data={rawData}
                  isMobile={isMobile}
                />
              )}
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(isMobile ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm")}
                  onClick={() => onRefresh()}
                  title="Refresh"
                  aria-label="Refresh table"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 overflow-hidden flex flex-col relative min-h-0 min-w-0 max-w-full" style={{ contain: "layout" }}>
        {/* Bulk action bar — absolute so it overlays the table header without shifting layout */}
        {enableRowSelection && selectedIds.size > 0 && (
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-2 bg-surface-2/95 backdrop-blur-sm border-b border-primary/20 text-xs">
            <span className="font-mono font-medium text-primary tabular-nums">
              {selectedIds.size} {selectedIds.size === 1 ? "row" : "rows"} selected
            </span>
            {renderBulkActions?.(selectedIds, clearSelection)}
            <button
              className="ml-auto text-xs text-text-muted hover:text-text-main underline underline-offset-2"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
        )}
        {isLoading && loadingVariant === "loader" ? (
          <div className="flex min-h-0 flex-1 w-full items-center justify-center p-12">
            <DashboardLoader size="md" />
          </div>
        ) : isLoading && loadingVariant === "skeleton" ? (
          <>
            <div
              ref={horizontalScrollRef}
              className="w-full flex-1 min-h-0 min-w-0 max-w-full scrollbar-themed"
              style={{
                flex: "1 1 0%",
                width: "100%",
                minWidth: 0,
                overflow: "auto",
                overflowX: "auto",
                overflowY: "auto",
                scrollPaddingBottom: 0,
                overscrollBehavior: "contain",
                maxWidth: "100%",
              }}
            >
              <table
                style={{
                  tableLayout: "fixed",
                  width: `${tableContentWidthPx}px`,
                  minWidth: "100%",
                  marginBottom: 0,
                }}
                className="caption-bottom text-sm"
              >
                <TableHeader className="sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent border-b border-border-main bg-surface-2/80">
                    {enableRowSelection && (
                      <TableHead
                        className="bg-surface-2/80 px-4"
                        style={{ width: `${CHECKBOX_COL_WIDTH}px`, minWidth: `${CHECKBOX_COL_WIDTH}px`, maxWidth: `${CHECKBOX_COL_WIDTH}px` }}
                      />
                    )}
                    {columns.map((column) => {
                      const width = columnWidths[column.key] || column.width || 150;
                      const widthValue = typeof width === "number" ? width : parseInt(String(width).replace("px", "")) || 150;
                      return (
                        <TableHead
                          key={column.key}
                          className={cn(
                            "bg-surface-2/80 font-medium font-mono text-[0.625rem] uppercase tracking-[0.1em] text-text-muted",
                            isMobile ? "px-2" : "px-4"
                          )}
                          style={{
                            width: `${widthValue}px`,
                            minWidth: `${widthValue}px`,
                            maxWidth: `${widthValue}px`,
                          }}
                        >
                          <span>{column.header}</span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-0">
                  {Array.from({ length: skeletonRows ?? defaultPageSize ?? 10 }).map((_, rowIndex) => (
                    <TableRow
                      key={`skeleton-${rowIndex}`}
                      className="border-b border-border-main"
                    >
                      {enableRowSelection && (
                        <TableCell
                          className="px-4 py-3"
                          style={{ width: `${CHECKBOX_COL_WIDTH}px`, minWidth: `${CHECKBOX_COL_WIDTH}px`, maxWidth: `${CHECKBOX_COL_WIDTH}px` }}
                        >
                          <div className="h-4 w-4 rounded schema-skeleton-cell mx-auto" />
                        </TableCell>
                      )}
                      {columns.map((column, colIndex) => {
                        const width = columnWidths[column.key] || column.width || 150;
                        const widthValue = typeof width === "number" ? width : parseInt(String(width).replace("px", "")) || 150;
                        const skelWidths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3", "w-4/5"];
                        const skelW = skelWidths[(rowIndex + colIndex) % skelWidths.length];
                        return (
                          <TableCell
                            key={column.key}
                            className={cn("px-4 py-3")}
                            style={{
                              width: `${widthValue}px`,
                              minWidth: `${widthValue}px`,
                              maxWidth: `${widthValue}px`,
                            }}
                          >
                            <div className={cn("schema-skeleton-cell h-3.5 rounded", skelW)} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          </>
        ) : paginatedData.length === 0 ? (
          <div className="flex min-h-0 flex-1 w-full items-center justify-center p-12">
            <p className="text-sm text-text-muted">{emptyMessage}</p>
          </div>
        ) : (
          <>
            {/* Top horizontal scrollbar (fixed outside scroll container, always visible) */}
            {/* <div
              ref={topScrollbarRef}
              className="w-full bg-background border-b border-border-main/20"
              onScroll={handleTopScroll}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "17px",
                minHeight: "17px",
                overflowX: "auto",
                overflowY: "hidden",
                pointerEvents: "auto",
                zIndex: 50,
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div style={{ height: "1px", minWidth: "100%" }} />
            </div> */}

            {/* Main scroll area */}
            <div
              ref={horizontalScrollRef}
              className="w-full flex-1 min-h-0 min-w-0 max-w-full scrollbar-themed"
              onScroll={handleMainScroll}
              style={{ 
                flex: "1 1 0%",
                width: "100%",
                minWidth: 0,
                overflow: 'auto',
                overflowX: 'auto',
                overflowY: 'auto',
                scrollPaddingBottom: 0,
                overscrollBehavior: 'contain',
                maxWidth: '100%',
              }}
            >
              <table
                ref={tableRef}
                style={{
                  tableLayout: "fixed",
                  width: `${tableContentWidthPx}px`,
                  minWidth: "100%",
                  marginBottom: 0,
                }}
                className="caption-bottom text-sm"
              >
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-b border-border-main bg-surface-2/80">
                {enableRowSelection && (
                  <TableHead
                    className="bg-surface-2/80 px-4"
                    style={{ width: `${CHECKBOX_COL_WIDTH}px`, minWidth: `${CHECKBOX_COL_WIDTH}px`, maxWidth: `${CHECKBOX_COL_WIDTH}px` }}
                  >
                    <Checkbox
                      checked={isAllOnPageSelected ? true : isSomeOnPageSelected ? "indeterminate" : false}
                      disabled={selectableOnPage.length === 0}
                      onCheckedChange={() => toggleSelectAll(paginatedData)}
                      aria-label="Select all rows on this page"
                    />
                  </TableHead>
                )}
                {columns.map((column, index) => {
                  const width = columnWidths[column.key] || column.width || 150;
                  const widthValue = typeof width === "number" ? width : parseInt(String(width).replace('px', '')) || 150;
                  const isLastColumn = index === columns.length - 1;
                  const isSorted = sortColumn === column.key;

                  return (
                    <TableHead
                      key={column.key}
                      className={cn(
                        "relative group bg-surface-2/80",
                        "font-medium font-mono text-[0.625rem] uppercase tracking-[0.1em] text-text-muted",
                        column.sortable && "cursor-pointer select-none",
                        "hover:text-text-main transition-colors",
                        isMobile ? "px-2" : "px-4"
                      )}
                      style={{
                        width: `${widthValue}px`,
                        minWidth: `${widthValue}px`,
                        maxWidth: `${widthValue}px`,
                        position: "relative",
                      }}
                      aria-sort={
                        isSorted
                          ? sortDirection === "asc"
                            ? "ascending"
                            : sortDirection === "desc"
                            ? "descending"
                            : "none"
                          : "none"
                      }
                    >
                      {/* Sorted-column left-border indicator */}
                      {isSorted && (
                        <div className="absolute left-0 top-[0.35rem] bottom-[0.35rem] w-0.5 rounded-sm bg-primary" aria-hidden />
                      )}
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(column.key)}
                          title={`Sort by ${column.header}`}
                          className={cn(
                            "flex items-center gap-1 w-full font-mono font-medium text-[0.625rem] uppercase tracking-[0.1em] text-inherit",
                            "rounded-sm outline-none",
                            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            column.align === "right" && "justify-end",
                            column.align === "center" && "justify-center",
                            !isLastColumn && "pr-4"
                          )}
                        >
                          <span>{column.header}</span>
                          {renderSortIcon(column.key)}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            column.align === "right" && "justify-end",
                            column.align === "center" && "justify-center",
                            !isLastColumn && "pr-4"
                          )}
                        >
                          <span>{column.header}</span>
                        </div>
                      )}
                      {/* Resize handle */}
                      {!isLastColumn && (
                        <div
                          className="resize-handle absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/50 transition-colors group-hover:bg-primary/30 z-50"
                          style={{
                            backgroundColor: resizingColumn === column.key ? "var(--color-primary)" : "transparent",
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleResizeStart(column.key, e);
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 pointer-events-none">
                            <GripVertical
                              size={11}
                              className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </div>
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody 
              className="[&_tr:last-child]:border-0" 
              style={{ marginBottom: 0, paddingBottom: 0 }}
            >
              {paginatedData.map((row, index) => {
                const rowId = getRowIdValue(row, index);
                const rowSelectable = canSelectRow(row);
                return (
                  <TableRow
                    key={rowId}
                    className={cn(
                      "border-b border-border-main",
                      "hover:bg-surface-2/40 transition-colors",
                      onRowClick && "cursor-pointer",
                      "group",
                      enableRowSelection && selectedIds.has(rowId) && "bg-primary/[0.04]"
                    )}
                    onClick={(e) => {
                      // Don't trigger row click if clicking on filter panel, buttons, or interactive elements
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('[data-radix-popover-content]') ||
                        target.closest('[data-radix-popover-trigger]') ||
                        target.closest('[role="listbox"]') ||
                        target.closest('[role="option"]') ||
                        target.closest('[role="checkbox"]') ||
                        target.closest('button') ||
                        target.closest('input') ||
                        target.closest('select') ||
                        target.closest('label') ||
                        target.closest('[role="button"]') ||
                        target.tagName === 'BUTTON' ||
                        target.tagName === 'INPUT' ||
                        target.tagName === 'SELECT' ||
                        target.tagName === 'LABEL'
                      ) {
                        return;
                      }
                      onRowClick?.(row);
                    }}
                  >
                  {enableRowSelection && (
                    <TableCell
                      className="px-4 py-3"
                      style={{ width: `${CHECKBOX_COL_WIDTH}px`, minWidth: `${CHECKBOX_COL_WIDTH}px`, maxWidth: `${CHECKBOX_COL_WIDTH}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rowSelectable) toggleRow(rowId, row);
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.has(rowId)}
                        disabled={!rowSelectable}
                        onCheckedChange={() => toggleRow(rowId, row)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => {
                      const value = getCellValue(row, column);
                      const width = columnWidths[column.key] || column.width || 150;
                      const widthValue = typeof width === "number" ? width : parseInt(String(width).replace('px', '')) || 150;
                      
                      const cellContent = column.render
                        ? column.render(value, row, index)
                        : value !== null && value !== undefined
                        ? String(value)
                        : "-";
                      
                      const isPlainText = !column.render;
                      const textValue = isPlainText ? (value !== null && value !== undefined ? String(value) : "-") : undefined;
                      const cellId = `${rowId}-${column.key}`;
                      const isExpanded = expandedCells.has(cellId);
                      const isLastRow = index === paginatedData.length - 1;
                      
                      return (
                        <TableCell
                          key={column.key}
                          className={cn(
                            "text-text-main",
                            column.className,
                            isMobile ? "text-xs px-2 py-2" : "text-sm px-4 py-3",
                            isLastRow && "!pb-0"
                          )}
                          style={{
                            textAlign: column.align || "left",
                            width: `${widthValue}px`,
                            minWidth: `${widthValue}px`,
                            maxWidth: `${widthValue}px`,
                            ...(isLastRow && { paddingBottom: 0 }),
                          }}
                        >
                          {isPlainText && textValue ? (
                            <TruncatedTextCell
                              content={textValue}
                              isExpanded={isExpanded}
                              widthValue={widthValue}
                            />
                          ) : (
                            <div className="w-full min-w-0 break-words">
                              {cellContent}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
          <div style={{ height: 0, width: '100%', flexShrink: 0, lineHeight: 0 }} aria-hidden="true"></div>
            </div>

          </>
        )}
      </div>

      {/* Footer with Pagination — shared EnhancedPagination so the design
          matches the rest of the dashboard (e.g. Personas). */}
      {!disablePagination && (serverSide ? effectiveTotalItems > 0 : processedData.length > 0) && (
        <div className="mt-auto border-t border-border-main bg-surface/50">
          <EnhancedPagination
            currentPage={page}
            setCurrentPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalItems={effectiveTotalItems}
            displayedItemsCount={paginatedData.length}
            pageSizeOptions={pageSizeOptions}
            isMobile={isMobile}
          />
        </div>
      )}
    </div>
  );
}

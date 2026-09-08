/**
 * Column Configuration Types for DataTable Component
 */

export type ColumnType = "text" | "number" | "date" | "enum" | "boolean" | "custom";

export type SortDirection = "asc" | "desc" | null;

export interface FilterOption {
  label: string;
  value: string | number | boolean;
}

export interface ColumnFilterConfig {
  type: "text" | "date" | "enum" | "number" | "boolean";
  options?: FilterOption[]; // For enum type
  optionsEndpoint?: string; // API endpoint to fetch filter options dynamically
  optionsTransform?: (data: any) => FilterOption[]; // Transform API response to FilterOption[]
  dateRange?: boolean; // For date type, whether to show date range picker
  placeholder?: string;
}

export interface ColumnConfig<T = any> {
  key: string;
  header: string;
  type: ColumnType;
  sortable?: boolean;
  searchable?: boolean; // Whether column is included in global search
  filterable?: boolean;
  filterConfig?: ColumnFilterConfig;
  width?: string | number;
  align?: "left" | "center" | "right";
  render?: (value: any, row: T, index: number) => React.ReactNode;
  accessor?: (row: T) => any; // Custom accessor function
  className?: string;
}

export interface TableState {
  page: number;
  pageSize: number;
  sortColumn: string | null;
  sortDirection: SortDirection;
  globalSearch: string;
  filters: Record<string, any>;
}

export interface TableQueryParams {
  page: number;
  limit: number;
  offset: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  filters?: Record<string, any>;
}

export interface TableResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface DataTableProps<T = any> {
  columns: ColumnConfig<T>[];
  data: T[]; // Data array for client-side processing
  pageSizeOptions?: number[];
  defaultPageSize?: number; // Default page size for the table
  enableGlobalSearch?: boolean;
  enableFilters?: boolean;
  /** Skip built-in pagination so parent components can control paging */
  disablePagination?: boolean;
  onRefresh?: () => void;
  onRowClick?: (row: T) => void;
  onFilterChange?: (filters: Record<string, any>) => void;
  getRowId?: (row: T) => string | number;
  className?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  isLoading?: boolean; // Loading state for external loading
  /** "loader" = centered spinner (default). "skeleton" = table with skeleton rows (keeps size). */
  loadingVariant?: "loader" | "skeleton";
  /** When loadingVariant="skeleton", number of skeleton rows to show. Defaults to pageSize. */
  skeletonRows?: number;
  /** Custom line limit selector component to display next to search bar */
  lineLimitSelector?: React.ReactNode;
  /** Enable server-side search/sort/pagination query handling */
  serverSide?: boolean;
  /** Total rows on server (required for accurate server-side pagination) */
  totalItems?: number;
  /** Called when table query state changes in server-side mode */
  onQueryChange?: (query: TableQueryParams) => void;
  /** Enable row selection checkboxes */
  enableRowSelection?: boolean;
  /** When set, rows returning false cannot be selected (header select-all skips them too). */
  isRowSelectable?: (row: T) => boolean;
  /** Called whenever the set of selected row IDs changes */
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
  /** Render bulk action buttons in the selection bar */
  renderBulkActions?: (selectedIds: Set<string | number>, clearSelection: () => void) => React.ReactNode;
}


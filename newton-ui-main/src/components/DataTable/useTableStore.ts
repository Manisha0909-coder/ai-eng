/**
 * Zustand Store for DataTable State Management
 * Handles pagination, sorting, filtering, and global search state
 */

import { create } from "zustand";
import { SortDirection, TableState } from "./types";

export interface TableStoreState extends TableState {
  // Actions
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (column: string | null, direction: SortDirection) => void;
  setGlobalSearch: (search: string) => void;
  setFilter: (key: string, value: any) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  reset: () => void;
  // URL sync
  syncFromURL: (searchParams: URLSearchParams) => void;
  syncToURL: () => URLSearchParams;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_STATE: TableState = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortColumn: null,
  sortDirection: null,
  globalSearch: "",
  filters: {},
};

// Cache stores by ID to prevent recreation and state loss
// Zustand's create() returns a hook function, so we cache the hook itself
type StoreHook = () => TableStoreState;
const storeCache = new Map<string, StoreHook>();

// Create a store factory function to support multiple table instances
export const createTableStore = (tableId: string, initialState?: Partial<TableState>) => {
  // Return cached store if it exists
  if (storeCache.has(tableId)) {
    return storeCache.get(tableId)!;
  }

  // Create new store and cache it
  const store = create<TableStoreState>((set, get) => ({
    ...DEFAULT_STATE,
    ...initialState,

    setPage: (page) => set({ page }),

    setPageSize: (pageSize) => set({ pageSize, page: 1 }), // Reset to first page

    setSort: (column, direction) => {
      set({
        sortColumn: column,
        sortDirection: direction,
        page: 1, // Reset to first page when sorting changes
      });
    },

    setGlobalSearch: (search) => {
      set({
        globalSearch: search,
        page: 1, // Reset to first page when search changes
      });
    },

    setFilter: (key, value) => {
      const { filters } = get();
      const newFilters = { ...filters };
      
      if (value === null || value === undefined || value === "") {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }

      set({
        filters: newFilters,
        page: 1, // Reset to first page when filters change
      });
    },

    removeFilter: (key) => {
      const { filters } = get();
      const newFilters = { ...filters };
      delete newFilters[key];
      set({ filters: newFilters, page: 1 });
    },

    clearFilters: () => {
      set({
        filters: {},
        globalSearch: "",
        page: 1,
      });
    },

    reset: () => {
      set({
        ...DEFAULT_STATE,
        ...initialState,
      });
    },

    syncFromURL: (searchParams: URLSearchParams) => {
      const state: Partial<TableState> = {};

      // Parse page
      const page = searchParams.get("page");
      if (page) state.page = parseInt(page, 10);

      // Parse pageSize
      const pageSize = searchParams.get("pageSize");
      if (pageSize) state.pageSize = parseInt(pageSize, 10);

      // Parse sort
      const sortColumn = searchParams.get("sort");
      const sortOrder = searchParams.get("order");
      if (sortColumn) {
        state.sortColumn = sortColumn;
        state.sortDirection = (sortOrder === "asc" || sortOrder === "desc" ? sortOrder : null) as SortDirection;
      }

      // Parse global search
      const search = searchParams.get("search");
      if (search !== null) state.globalSearch = search;

      // Parse filters
      const filters: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (!["page", "pageSize", "sort", "order", "search"].includes(key)) {
          // Try to parse as JSON, fallback to string
          try {
            filters[key] = JSON.parse(value);
          } catch {
            filters[key] = value;
          }
        }
      });
      if (Object.keys(filters).length > 0) state.filters = filters;

      set(state);
    },

    syncToURL: () => {
      const state = get();
      const params = new URLSearchParams();

      if (state.page > 1) params.set("page", state.page.toString());
      if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", state.pageSize.toString());
      if (state.sortColumn) {
        params.set("sort", state.sortColumn);
        if (state.sortDirection) params.set("order", state.sortDirection);
      }
      if (state.globalSearch) params.set("search", state.globalSearch);

      // Add filters
      Object.entries(state.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          params.set(key, typeof value === "string" ? value : JSON.stringify(value));
        }
      });

      return params;
    },
  }));

  // Cache the store
  storeCache.set(tableId, store);
  return store;
};

// Default store instance (can be used for single table scenarios)
export const useTableStore = createTableStore("default");


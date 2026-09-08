/**
 * React Query Hook for DataTable API Integration
 * Handles server-side data fetching with pagination, sorting, filtering
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { TableQueryParams, TableResponse, TableState } from "./types";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";

interface UseTableQueryOptions<T> {
  apiUrl: string;
  tableState: TableState;
  transformResponse?: (response: any) => TableResponse<T>;
  enabled?: boolean;
}

/**
 * Builds query parameters from table state
 */
export function buildQueryParams(state: TableState): TableQueryParams {
  const params: TableQueryParams = {
    page: state.page,
    limit: state.pageSize,
    offset: (state.page - 1) * state.pageSize,
  };

  if (state.sortColumn && state.sortDirection) {
    params.sort_by = state.sortColumn;
    params.sort_order = state.sortDirection;
  }

  if (state.globalSearch) {
    params.search = state.globalSearch;
  }

  if (Object.keys(state.filters).length > 0) {
    params.filters = state.filters;
  }

  return params;
}

/**
 * Fetches table data from API
 */
async function fetchTableData<T>(
  apiUrl: string,
  params: TableQueryParams,
  transformResponse?: (response: any) => TableResponse<T>
): Promise<TableResponse<T>> {


  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };



  // Build URL with query parameters
  const url = new URL(apiUrl, API_CONFIG.LOCAL_API_BASE_URL || window.location.origin);
  
  // Add query params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (key === "filters" && typeof value === "object") {
        // Handle filters object - send as JSON or individual params
        Object.entries(value).forEach(([filterKey, filterValue]) => {
          if (filterValue !== null && filterValue !== undefined && filterValue !== "") {
            url.searchParams.append(`filter_${filterKey}`, String(filterValue));
          }
        });
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  const data = unwrapEnvelope<any>(await response.json());

  // Transform response if provided
  if (transformResponse) {
    return transformResponse(data);
  }

  // Default transformation - handle common response formats
  if (data.documents && Array.isArray(data.documents)) {
    // Format: { documents: [], count: number }
    return {
      data: data.documents,
      total: data.count || data.total || 0,
      page: params.page,
      pageSize: params.limit,
    };
  }

  if (data.data && Array.isArray(data.data)) {
    // Format: { data: [], total: number }
    return {
      data: data.data,
      total: data.total || 0,
      page: params.page,
      pageSize: params.limit,
    };
  }

  if (Array.isArray(data)) {
    // Format: array directly
    return {
      data,
      total: data.length,
      page: params.page,
      pageSize: params.limit,
    };
  }

  // Fallback
  return {
    data: [],
    total: 0,
    page: params.page,
    pageSize: params.limit,
  };
}

/**
 * React Query hook for table data
 */
export function useTableQuery<T = any>(
  options: UseTableQueryOptions<T>
): UseQueryResult<TableResponse<T>, Error> {
  const { apiUrl, tableState,  transformResponse, enabled = true } = options;

  const queryParams = useMemo(
    () => buildQueryParams(tableState),
    [
      tableState.page,
      tableState.pageSize,
      tableState.sortColumn,
      tableState.sortDirection,
      tableState.globalSearch,
      JSON.stringify(tableState.filters),
    ]
  );

  return useQuery({
    queryKey: ["tableData", apiUrl, queryParams],
    queryFn: () => fetchTableData<T>(apiUrl, queryParams, transformResponse),
    enabled,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to fetch filter options dynamically
 */
export function useFilterOptions(
  endpoint: string | undefined,
  transform?: (data: any) => Array<{ label: string; value: string | number | boolean }>,
) {
  return useQuery({
    queryKey: ["filterOptions", endpoint],
    queryFn: async () => {
      if (!endpoint) return [];


      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };



      const url = new URL(endpoint, API_CONFIG.LOCAL_API_BASE_URL || window.location.origin);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch filter options: ${response.statusText}`);
      }

      const data = unwrapEnvelope<any>(await response.json());

      if (transform) {
        return transform(data);
      }

      // Default transformation
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          label: item.name || item.label || String(item),
          value: item.id || item.value || item,
        }));
      }

      if (data.data && Array.isArray(data.data)) {
        return data.data.map((item: any) => ({
          label: item.name || item.label || String(item),
          value: item.id || item.value || item,
        }));
      }

      return [];
    },
    enabled: !!endpoint,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}


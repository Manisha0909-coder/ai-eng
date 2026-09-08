import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rbacApi,
  type Tool,
  type UpdateToolRequest,
  type PaginatedResponse,
} from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";

interface UseToolsQueryParams {
  pageSize: number;
  search?: string;
  type?: string;
  toolServer?: string;
  enabled?: boolean;
}

export const TOOLS_QUERY_KEY = "dashboard-tools";

export function useToolsQuery({
  pageSize,
  search,
  type,
  toolServer,
  enabled = true,
}: UseToolsQueryParams) {
  return useQuery({
    queryKey: [TOOLS_QUERY_KEY, pageSize, search, type, toolServer],
    queryFn: async (): Promise<PaginatedResponse<Tool>> => {
      const params: any = { limit: pageSize, offset: 0 };
      if (search && search.trim().length > 0) {
        params.search = search.trim();
      }
      if (type) {
        params.type = type;
      }
      if (toolServer) {
        params.tool_server = toolServer;
      }
      return rbacApi.tools.list(params);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useToolServerFilterOptions(enabled = true) {
  return useQuery({
    queryKey: ["dashboard-tool-server-filter-options"],
    queryFn: async () => {
      try {
        const data = await rbacApi.toolServers.listNames();
        const servers = data?.servers ?? [];
        if (servers.length > 0) {
          return {
            types: Array.from(new Set(servers.map((s: any) => s.type).filter(Boolean) as string[])).sort(),
            names: Array.from(new Set(servers.map((s: any) => s.name).filter(Boolean) as string[])).sort(),
          };
        }
      } catch {
        // Fall through to fallback
      }

      const res = await rbacApi.toolServers.list({ limit: 10000, offset: 0 });
      const rows = res?.data ?? [];
      return {
        types: Array.from(new Set(rows.map((s: any) => s.type).filter(Boolean) as string[])).sort(),
        names: Array.from(new Set(rows.map((s: any) => s.name).filter(Boolean) as string[])).sort(),
      };
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ toolName, data }: { toolName: string; data: UpdateToolRequest }) =>
      rbacApi.tools.update(toolName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TOOLS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (toolName: string) => rbacApi.tools.delete(toolName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TOOLS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

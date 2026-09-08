import { rbacRequest } from "../rbacClient";
import type {
  AttachToolServerRequest,
  AttachToolServerResponse,
  DetachToolServerRequest,
  DetachToolServerResponse,
  HealthCheckToolServerRequest,
  HealthCheckToolServerResponse,
  PaginatedResponse,
  SyncToolServerRequest,
  SyncToolServerResponse,
  ToolServer,
  UpdateToolServerRequest,
  UpdateToolServerResponse,
} from "../types";

interface ListToolServersParams {
  limit?: number;
  offset?: number;
  search?: string;
  type?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

interface ListServerNamesResponse {
  servers: { name: string; type: string }[];
  status?: string;
  total?: number;
}

const normalizeServer = (server: any): ToolServer => ({
  id: server.id || 0,
  name: server.name || "",
  url: server.url || "",
  type: server.type || "custom",
  envs: server.envs || {},
  created_at: server.created_at || new Date().toISOString(),
  updated_at: server.updated_at || new Date().toISOString(),
});

export const toolServersApi = {
  attach: async (
    request: AttachToolServerRequest
  ): Promise<AttachToolServerResponse> => {
    return rbacRequest<AttachToolServerResponse>("/tool-servers/attach", {
      method: "POST",
      body: request,
    });
  },

  detach: async (
    request: DetachToolServerRequest
  ): Promise<DetachToolServerResponse> => {
    return rbacRequest<DetachToolServerResponse>("/tool-servers/detach", {
      method: "POST",
      body: request,
    });
  },

  update: async (
    request: UpdateToolServerRequest
  ): Promise<UpdateToolServerResponse> => {
    return rbacRequest<UpdateToolServerResponse>("/tool-servers/update", {
      method: "POST",
      body: request,
    });
  },

  sync: async (
    request: SyncToolServerRequest
  ): Promise<SyncToolServerResponse> => {
    return rbacRequest<SyncToolServerResponse>("/tool-servers/sync", {
      method: "POST",
      body: request,
    });
  },

  /** Silent — health UI handles its own error rendering; we don't want a global toast. */
  health: async (
    request: HealthCheckToolServerRequest
  ): Promise<HealthCheckToolServerResponse> => {
    return rbacRequest<HealthCheckToolServerResponse>("/tool-servers/health", {
      method: "POST",
      body: request,
      silent: true,
    });
  },

  /** Lightweight registry of `{name, type}` used to populate admin filter dropdowns. */
  listNames: async (): Promise<ListServerNamesResponse> => {
    return rbacRequest<ListServerNamesResponse>("/tool-servers/names");
  },

  /** Swallows any error and returns an empty page — admin tab relies on this. */
  list: async (
    params?: ListToolServersParams
  ): Promise<PaginatedResponse<ToolServer>> => {
    try {
      const data = await rbacRequest<any>("/tool-servers/list", {
        query: {
          limit: params?.limit,
          offset: params?.offset,
          search: params?.search,
          type: params?.type,
          sort_by: params?.sort_by,
          sort_order: params?.sort_order,
        },
      });
      const rawServers = data.servers || data.data || data || [];
      const servers = Array.isArray(rawServers)
        ? rawServers.map(normalizeServer)
        : [];

      return {
        success: data.success !== undefined ? data.success : true,
        data: servers,
        total: data.total || data.count || servers.length,
        limit: data.limit,
        offset: data.offset,
      };
    } catch (error) {
      console.error("Error fetching tool servers:", error);
      return { success: false, data: [], total: 0 };
    }
  },
};

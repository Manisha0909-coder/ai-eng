import { rbacRequest } from "../rbacClient";
import type {
  CreateToolRequest,
  ListToolNamesRequest,
  PaginatedResponse,
  Tool,
  UpdateToolRequest,
} from "../types";

export const toolNamesApi = {
  create: async (toolData: CreateToolRequest): Promise<Tool> => {
    const data = await rbacRequest<{ tool: Tool }>("/tool_names/", {
      method: "POST",
      body: toolData,
    });
    return data.tool;
  },

  getByName: async (toolName: string): Promise<Tool> => {
    const data = await rbacRequest<{ tool: Tool }>(`/tool_names/${toolName}`);
    return data.tool;
  },

  list: async (params: ListToolNamesRequest): Promise<PaginatedResponse<Tool>> => {
    const data = await rbacRequest<any>("/tool_names/list", {
      method: "POST",
      body: params,
    });
    return {
      // The backend returns a plain `{ tools: [...] }` payload with no envelope
      // `success` flag. Since `rbacRequest` throws on any non-OK response,
      // reaching here means the request succeeded — default to true so callers
      // that gate on `response.success` don't silently drop the results.
      success: data.success ?? true,
      data: data.tools ?? [],
      total: data.total ?? data.count ?? 0,
      limit: data.limit,
      offset: data.offset,
    };
  },

  update: async (toolName: string, updateData: UpdateToolRequest): Promise<Tool> => {
    const data = await rbacRequest<{ tool: Tool }>(`/tool_names/${toolName}`, {
      method: "PATCH",
      body: updateData,
    });
    return data.tool;
  },

  delete: async (toolName: string): Promise<void> => {
    await rbacRequest(`/tool_names/${toolName}`, { method: "DELETE" });
  },
};

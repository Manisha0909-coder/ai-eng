import { rbacRequest } from "../rbacClient";
import type {
  CreateTagRequest,
  ListToolTagsRequest,
  PaginatedResponse,
  Tag,
  UpdateTagRequest,
} from "../types";

export const tagsApi = {
  create: async (tagData: CreateTagRequest): Promise<Tag> => {
    const data = await rbacRequest<{ tag: Tag }>("/tool-tags/", {
      method: "POST",
      body: tagData,
    });
    return data.tag;
  },

  getById: async (tagId: number): Promise<Tag> => {
    const data = await rbacRequest<{ tag: Tag }>(`/tool-tags/${tagId}`);
    return data.tag;
  },

  /** Swallows `Failed to fetch` network errors and returns an empty page — callers rely on this. */
  list: async (params: ListToolTagsRequest): Promise<PaginatedResponse<Tag>> => {
    try {
      const data = await rbacRequest<any>("/tool-tags/list", {
        method: "POST",
        body: params,
      });
      return {
        success: data.success !== undefined ? data.success : true,
        data: data.tags || data.data || [],
        total: data.total || data.count || 0,
        limit: data.limit,
        offset: data.offset,
      };
    } catch (error) {
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        console.error("Network error fetching tags:", error);
        return { success: false, data: [], total: 0 };
      }
      throw error;
    }
  },

  update: async (tagId: number, updateData: UpdateTagRequest): Promise<Tag> => {
    const data = await rbacRequest<{ tag: Tag }>(`/tool-tags/${tagId}`, {
      method: "PATCH",
      body: updateData,
    });
    return data.tag;
  },

  delete: async (tagId: number): Promise<void> => {
    await rbacRequest(`/tool-tags/${tagId}`, { method: "DELETE" });
  },
};

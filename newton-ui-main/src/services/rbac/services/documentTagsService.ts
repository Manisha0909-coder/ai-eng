import { rbacRequest } from "../rbacClient";
import type {
  CreateDocumentTagRequest,
  DocumentTag,
  PaginatedResponse,
  UpdateDocumentTagRequest,
} from "../types";

interface ListDocumentTagsParams {
  limit?: number;
  offset?: number;
  search?: string;
  created_from?: string;
  created_to?: string;
}

export const documentTagsApi = {
  create: async (tagData: CreateDocumentTagRequest): Promise<DocumentTag> => {
    const data = await rbacRequest<any>("/document-tag/", {
      method: "POST",
      body: tagData,
    });
    return data.tag || data;
  },

  list: async (
    params: ListDocumentTagsParams
  ): Promise<PaginatedResponse<DocumentTag>> => {
    const data = await rbacRequest<any>("/document-tag/list", {
      query: {
        limit: params.limit,
        offset: params.offset,
        search: params.search,
        created_from: params.created_from,
        created_to: params.created_to,
      },
    });
    return {
      success: data.success !== undefined ? data.success : true,
      data: data.document_tags || data.tags || data.data || [],
      total:
        data.total ||
        data.count ||
        (data.document_tags ? data.document_tags.length : 0),
      limit: data.limit,
      offset: data.offset,
    };
  },

  update: async (
    tagId: number,
    updateData: UpdateDocumentTagRequest
  ): Promise<DocumentTag> => {
    const data = await rbacRequest<any>(`/document-tag/${tagId}`, {
      method: "PUT",
      body: updateData,
    });
    return data.tag || data;
  },

  delete: async (tagId: number): Promise<void> => {
    await rbacRequest(`/document-tag/${tagId}`, { method: "DELETE" });
  },
};

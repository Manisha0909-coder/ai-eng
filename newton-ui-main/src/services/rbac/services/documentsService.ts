import { rbacRequest, rbacDownload } from "../rbacClient";
import type {
  BatchUploadDocumentRequest,
  DocumentFile,
  ListDocumentsParams,
  ListDocumentsResponse,
  UpdateDocumentRequest,
  UploadDocumentRequest,
  UploadDocumentResponse,
} from "../types";

const buildListQuery = (params: ListDocumentsParams) => ({
  limit: params.limit,
  offset: params.offset,
  search: params.search,
  file_format: params.file_format,
  has_failed: params.has_failed,
  status: params.status,
  status_lt: params.status_lt,
  sort_by: params.sort_by,
  sort_order: params.sort_order,
});

const toListResponse = (
  data: any,
  params: ListDocumentsParams
): ListDocumentsResponse => {
  const documents = data.documents || [];
  const total = data.total ?? data.count ?? documents.length ?? 0;
  return {
    documents,
    total,
    count: data.count,
    limit: data.limit ?? params.limit,
    offset: data.offset ?? params.offset,
  };
};

const buildUploadForm = (
  request: UploadDocumentRequest,
  tagField: "doc_tag_ids" | "personal_doc_tag_ids"
): FormData => {
  const form = new FormData();
  form.append("file", request.file);
  if (request.title) form.append("title", request.title);
  if (request.description) form.append("doc_desc", request.description);

  const tagIds =
    tagField === "doc_tag_ids"
      ? request.doc_tag_ids
      : request.personal_doc_tag_ids;
  if (tagIds && tagIds.length > 0) {
    form.append(tagField, tagIds.join(","));
  }
  return form;
};

const buildBatchUploadForm = (
  request: BatchUploadDocumentRequest,
  tagField: "doc_tag_ids" | "personal_doc_tag_ids"
): FormData => {
  const form = new FormData();
  request.files.forEach((file) => form.append("files", file));
  form.append("metadata", JSON.stringify(request.metadata));

  const tagIds =
    tagField === "doc_tag_ids"
      ? request.doc_tag_ids
      : request.personal_doc_tag_ids;
  if (tagIds && tagIds.length > 0) {
    form.append(tagField, tagIds.join(","));
  }
  return form;
};

export const documentsApi = {
  listPrivate: async (
    params: ListDocumentsParams
  ): Promise<ListDocumentsResponse> => {
    const data = await rbacRequest<any>("/documents", {
      base: "document",
      query: buildListQuery(params),
    });
    return toListResponse(data, params);
  },

  listPublic: async (
    params: ListDocumentsParams
  ): Promise<ListDocumentsResponse> => {
    const data = await rbacRequest<any>("/admin/documents", {
      base: "document",
      query: buildListQuery(params),
    });
    return toListResponse(data, params);
  },

  uploadPrivate: async (
    request: UploadDocumentRequest
  ): Promise<UploadDocumentResponse> => {
    return rbacRequest<UploadDocumentResponse>("/documents/upload", {
      base: "document",
      method: "POST",
      form: buildUploadForm(request, "personal_doc_tag_ids"),
    });
  },

  uploadPublic: async (
    request: UploadDocumentRequest
  ): Promise<UploadDocumentResponse> => {
    return rbacRequest<UploadDocumentResponse>("/admin/documents/upload", {
      base: "document",
      method: "POST",
      form: buildUploadForm(request, "doc_tag_ids"),
    });
  },

  getById: async (documentId: number | string): Promise<DocumentFile> => {
    return rbacRequest<DocumentFile>(`/documents/${documentId}`, {
      base: "document",
    });
  },

  updatePrivate: async (
    documentId: number | string,
    updateData: UpdateDocumentRequest
  ): Promise<DocumentFile> => {
    return rbacRequest<DocumentFile>(`/documents/${documentId}`, {
      base: "document",
      method: "PATCH",
      body: {
        name: updateData.name,
        doc_desc: updateData.doc_desc,
        personal_doc_tag_ids: updateData.personal_doc_tag_ids,
      },
    });
  },

  updatePublic: async (
    documentId: number | string,
    updateData: UpdateDocumentRequest
  ): Promise<DocumentFile> => {
    return rbacRequest<DocumentFile>(`/admin/documents/${documentId}`, {
      base: "document",
      method: "PATCH",
      body: {
        name: updateData.name,
        doc_desc: updateData.doc_desc,
        doc_tag_ids: updateData.doc_tag_ids,
      },
    });
  },

  delete: async (
    documentId: number | string,
    opts: { silent?: boolean } = {}
  ): Promise<void> => {
    await rbacRequest(`/documents/${documentId}`, {
      base: "document",
      method: "DELETE",
      silent: opts.silent,
    });
  },

  bulkDelete: async (
    documentIds: Array<number | string>,
    opts: { silent?: boolean } = {}
  ): Promise<void> => {
    await rbacRequest(`/documents/bulk`, {
      base: "document",
      method: "DELETE",
      body: { document_ids: documentIds },
      silent: opts.silent,
    });
  },

  download: async (documentId: number | string): Promise<Blob> => {
    return rbacDownload(`/documents/download/${documentId}`, { base: "document" });
  },

  /** Batch upload private documents (max 5 files). API returns array. */
  batchUploadPrivate: async (
    request: BatchUploadDocumentRequest
  ): Promise<UploadDocumentResponse[]> => {
    const data = await rbacRequest<any>("/documents/batch-upload", {
      base: "document",
      method: "POST",
      form: buildBatchUploadForm(request, "personal_doc_tag_ids"),
    });
    return Array.isArray(data) ? data : data.documents || [];
  },

  batchUploadPublic: async (
    request: BatchUploadDocumentRequest
  ): Promise<UploadDocumentResponse[]> => {
    const data = await rbacRequest<any>("/admin/documents/batch-upload", {
      base: "document",
      method: "POST",
      form: buildBatchUploadForm(request, "doc_tag_ids"),
    });
    return Array.isArray(data) ? data : data.documents || [];
  },

  retryUpload: async (
    documentId: number | string
  ): Promise<UploadDocumentResponse> => {
    return rbacRequest<UploadDocumentResponse>("/documents/retry-upload", {
      base: "document",
      method: "POST",
      query: { document_id: documentId },
    });
  },
};

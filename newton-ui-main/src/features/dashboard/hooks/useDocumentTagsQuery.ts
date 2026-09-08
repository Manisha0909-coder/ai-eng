import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rbacApi,
  type DocumentTag,
  type CreateDocumentTagRequest,
  type UpdateDocumentTagRequest,
  type PaginatedResponse,
} from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";

interface UseDocumentTagsQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  enabled?: boolean;
}

export const DOCUMENT_TAGS_QUERY_KEY = "dashboard-document-tags";

export function useDocumentTagsQuery({
  page,
  pageSize,
  search,
  enabled = true,
}: UseDocumentTagsQueryParams) {
  return useQuery({
    queryKey: [DOCUMENT_TAGS_QUERY_KEY, page, pageSize, search],
    queryFn: async (): Promise<PaginatedResponse<DocumentTag>> => {
      const offset = (page - 1) * pageSize;
      const params: any = { limit: pageSize, offset };
      if (search && search.trim().length > 0) {
        params.search = search.trim();
      }
      return rbacApi.documentTags.list(params);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateDocumentTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentTagRequest) => rbacApi.documentTags.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_TAGS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useUpdateDocumentTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: number; data: UpdateDocumentTagRequest }) =>
      rbacApi.documentTags.update(tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_TAGS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useDeleteDocumentTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tagId: number) => rbacApi.documentTags.delete(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_TAGS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

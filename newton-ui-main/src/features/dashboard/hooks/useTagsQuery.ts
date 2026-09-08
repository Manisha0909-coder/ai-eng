import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rbacApi,
  type Tag,
  type CreateTagRequest,
  type UpdateTagRequest,
  type PaginatedResponse,
} from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";

interface UseTagsQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  toolNames?: string[];
  enabled?: boolean;
}

export const TAGS_QUERY_KEY = "dashboard-tags";

export function useTagsQuery({
  page,
  pageSize,
  search,
  toolNames,
  enabled = true,
}: UseTagsQueryParams) {
  return useQuery({
    queryKey: [TAGS_QUERY_KEY, page, pageSize, search, toolNames],
    queryFn: async (): Promise<PaginatedResponse<Tag>> => {
      const offset = (page - 1) * pageSize;
      const params: any = { limit: pageSize, offset };
      if (search && search.trim().length > 0) {
        params.search = search.trim();
      }
      if (toolNames && toolNames.length > 0) {
        params.tool_names = toolNames;
      }
      return rbacApi.tags.list(params);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => rbacApi.tags.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: number; data: UpdateTagRequest }) =>
      rbacApi.tags.update(tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tagId: number) => rbacApi.tags.delete(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

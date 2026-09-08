import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rbacApi,
  type Role,
  type CreateRoleRequest,
  type UpdateRoleRequest,
  type ListRolesRequest,
  type PaginatedResponse,
} from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";

interface UseRolesQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  documentTagIds?: number[];
  personaIds?: number[];
  enabled?: boolean;
}

export const ROLES_QUERY_KEY = "dashboard-roles";

export function useRolesQuery({
  page,
  pageSize,
  search,
  documentTagIds,
  personaIds,
  enabled = true,
}: UseRolesQueryParams) {
  return useQuery({
    queryKey: [ROLES_QUERY_KEY, page, pageSize, search, documentTagIds, personaIds],
    queryFn: async (): Promise<PaginatedResponse<Role>> => {
      const offset = (page - 1) * pageSize;
      const params: ListRolesRequest = { limit: pageSize, offset };
      if (search && search.trim().length > 0) {
        params.search = search.trim();
      }
      if (documentTagIds && documentTagIds.length > 0) {
        params.document_tag_ids = documentTagIds;
      }
      if (personaIds && personaIds.length > 0) {
        params.persona_ids = personaIds;
      }
      return rbacApi.roles.list(params);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => rbacApi.roles.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: number; data: UpdateRoleRequest }) =>
      rbacApi.roles.update(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: number) => rbacApi.roles.delete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

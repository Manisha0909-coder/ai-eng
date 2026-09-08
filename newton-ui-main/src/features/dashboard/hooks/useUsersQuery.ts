import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rbacApi,
  type User,
  type CreateUserRequest,
  type UpdateUserRequest,
  type PaginatedResponse,
} from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";

interface UseUsersQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  roles?: string[];
  enabled?: boolean;
}

export const USERS_QUERY_KEY = "dashboard-users";

export function useUsersQuery({
  page,
  pageSize,
  search,
  roles,
  enabled = true,
}: UseUsersQueryParams) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, page, pageSize, search, roles],
    queryFn: async (): Promise<PaginatedResponse<User>> => {
      const offset = (page - 1) * pageSize;
      const params: any = { limit: pageSize, offset };
      if (search && search.trim().length > 0) {
        params.search = search.trim();
      }
      if (roles && roles.length > 0) {
        params.roles = roles;
      }
      return rbacApi.users.list(params);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useAvailableRoles() {
  return useQuery({
    queryKey: ["dashboard-available-roles"],
    queryFn: async () => {
      const response = await rbacApi.roles.list({ limit: 1000, offset: 0 });
      return response.data.map((r) => r.name);
    },
    staleTime: 60_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => rbacApi.users.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string | number; data: UpdateUserRequest }) =>
      rbacApi.users.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string | number) => rbacApi.users.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
    onError: (error: any) => {
      notify.error(error);
    },
  });
}

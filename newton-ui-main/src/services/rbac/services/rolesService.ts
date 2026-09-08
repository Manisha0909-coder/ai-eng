import { rbacRequest } from "../rbacClient";
import type {
  CreateRoleRequest,
  ListRolesRequest,
  PaginatedResponse,
  Role,
  UpdateRoleRequest,
} from "../types";

interface BulkAttachUsersResponse {
  total_processed: number;
  total_succeeded: number;
  total_failed: number;
  results: Array<{
    user_id: string;
    success: boolean;
    message: string;
  }>;
}

export const rolesApi = {
  create: async (roleData: CreateRoleRequest): Promise<Role> => {
    const data = await rbacRequest<{ role: Role }>("/roles/", {
      method: "POST",
      body: roleData,
    });
    return data.role;
  },

  getById: async (roleId: number): Promise<Role> => {
    const data = await rbacRequest<{ role: Role }>(`/roles/${roleId}`);
    return data.role;
  },

  list: async (params: ListRolesRequest): Promise<PaginatedResponse<Role>> => {
    const data = await rbacRequest<any>("/roles/list", {
      method: "POST",
      body: params,
    });
    const roles = data.roles ?? data.data ?? [];
    const total =
      data.total ?? data.count ?? (Array.isArray(roles) ? roles.length : 0);
    return {
      success: data.success !== undefined ? data.success : true,
      data: Array.isArray(roles) ? roles : [],
      total,
      limit: data.limit,
      offset: data.offset,
    };
  },

  update: async (roleId: number, updateData: UpdateRoleRequest): Promise<Role> => {
    const data = await rbacRequest<{ role: Role }>(`/roles/${roleId}`, {
      method: "PATCH",
      body: updateData,
    });
    return data.role;
  },

  delete: async (roleId: number): Promise<void> => {
    await rbacRequest(`/roles/${roleId}`, { method: "DELETE" });
  },

  bulkAttachUsers: async (
    roleId: number,
    userIds: string[]
  ): Promise<BulkAttachUsersResponse> => {
    return rbacRequest<BulkAttachUsersResponse>(
      `/roles/${roleId}/bulk_attach_users`,
      { method: "POST", body: { user_ids: userIds } }
    );
  },
};

import { rbacRequest } from "../rbacClient";
import type {
  AdminUser,
  AdminUsersListApiRow,
  BulkAssignAdminRoleRequest,
  BulkAssignAdminRoleResponse,
  ListAdminUsersRequest,
  PaginatedResponse,
} from "../types";

/** Fold the three boolean role flags from the wire format into the `roles: string[]` UI shape. */
const mapAdminUsersListApiRow = (row: AdminUsersListApiRow): AdminUser => {
  const roles: string[] = [];
  if (row.is_super_admin) roles.push("super_admin");
  if (row.is_user_admin) roles.push("user_admin");
  if (row.is_system_admin) roles.push("system_admin");
  return {
    id: String(row.id),
    user_name: row.user_name,
    email: row.email,
    display_name: (row.display_name ?? row.user_name ?? row.email).trim(),
    first_name: null,
    last_name: null,
    state: null,
    roles,
    added_at: row.added_at,
    updated_at: row.updated_at,
  };
};

export const adminUsersApi = {
  /** GET /v1/admin/users/list — search filters by display name on server. */
  list: async (
    params: ListAdminUsersRequest = {}
  ): Promise<PaginatedResponse<AdminUser>> => {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const data = await rbacRequest<any>("/admin/users/list", {
      query: { limit, offset, search: params.search, role: params.role },
    });
    const raw: AdminUsersListApiRow[] = Array.isArray(data.admin_users)
      ? data.admin_users
      : [];
    return {
      success: data.success !== undefined ? data.success : true,
      data: raw.map(mapAdminUsersListApiRow),
      total: data.total ?? 0,
      limit: data.limit ?? limit,
      offset: data.offset ?? offset,
    };
  },

  bulkAssignRole: async (
    request: BulkAssignAdminRoleRequest
  ): Promise<BulkAssignAdminRoleResponse> => {
    return rbacRequest<BulkAssignAdminRoleResponse>(
      "/admin/users/bulk_assign_role",
      { method: "POST", body: request }
    );
  },
};

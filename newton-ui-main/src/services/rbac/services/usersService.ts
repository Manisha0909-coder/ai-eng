import { rbacDownload, rbacRequest } from "../rbacClient";
import type {
  BulkCreateUsersResponse,
  CreateUserRequest,
  PaginatedRequest,
  PaginatedResponse,
  UpdateUserRequest,
  User,
} from "../types";

interface UserListResponse {
  success: boolean;
  total: number;
  user_ids: string[];
  message: string | null;
}

export interface BulkCreateFromCsvResponse {
  message: string | null;
  results: Array<{
    message: string;
    success: boolean;
    user_id: string;
  }>;
  total_created: number;
  total_updated: number;
  total_failed: number;
  total_processed: number;
}

export const usersApi = {
  /** Bulk create users with roles (Admin Only) — POST /v1/users/ */
  create: async (userData: CreateUserRequest): Promise<BulkCreateUsersResponse> => {
    return rbacRequest<BulkCreateUsersResponse>("/users/", {
      method: "POST",
      body: userData,
    });
  },

  getByEmail: async (email: string): Promise<User> => {
    const data = await rbacRequest<{ user: User }>(
      `/users/by_email/${encodeURIComponent(email)}`
    );
    return data.user;
  },

  getById: async (userId: number): Promise<User> => {
    const data = await rbacRequest<{ user: User }>(`/users/${userId}`);
    return data.user;
  },

  list: async (
    params: PaginatedRequest & { search?: string }
  ): Promise<PaginatedResponse<User>> => {
    const data = await rbacRequest<any>("/users/list", {
      method: "POST",
      body: params,
    });
    return {
      success: data.success,
      data: data.users,
      total: data.total,
    };
  },

  /** GET /v1/users/user_list — directory user emails/ids for attachment flows. */
  userList: async (params?: { search?: string }): Promise<UserListResponse> => {
    const data = await rbacRequest<any>("/users/user_list", {
      query: { search: params?.search },
    });
    return {
      success: data.success !== false,
      total:
        data.total ?? (Array.isArray(data.user_ids) ? data.user_ids.length : 0),
      user_ids: Array.isArray(data.user_ids) ? data.user_ids : [],
      message: data.message ?? null,
    };
  },

  update: async (
    userIdentifier: string | number,
    updateData: UpdateUserRequest
  ): Promise<User> => {
    const id = encodeURIComponent(String(userIdentifier));
    const data = await rbacRequest<{ user: User }>(`/users/${id}`, {
      method: "PATCH",
      body: updateData,
    });
    return data.user;
  },

  delete: async (userIdentifier: string | number): Promise<void> => {
    const id = encodeURIComponent(String(userIdentifier));
    await rbacRequest(`/users/${id}`, { method: "DELETE" });
  },

  deleteByEmail: async (email: string): Promise<void> => {
    await rbacRequest(`/users/by_email/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
  },

  bulkCreateFromCSV: async (csvFile: File): Promise<BulkCreateFromCsvResponse> => {
    const form = new FormData();
    form.append("csv_file", csvFile);
    // silent: caller handles toasts based on per-row results — the envelope can
    // arrive as success=true even when every row failed (e.g. CSV decode error),
    // which would otherwise trigger a misleading auto-success toast.
    return rbacRequest<BulkCreateFromCsvResponse>("/users/bulk_create_csv", {
      method: "POST",
      form,
      silent: true,
    });
  },

  /** GET /users/export — downloads users as CSV (re-uploadable to bulk_create_csv). */
  exportCSV: async (options?: { limit?: number; offset?: number }): Promise<Blob> => {
    const params = new URLSearchParams();
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.offset != null) params.set("offset", String(options.offset));
    const qs = params.toString();
    return rbacDownload(`/users/export${qs ? `?${qs}` : ""}`);
  },
};

import { rbacRequest } from "@/services/rbac/rbacClient";

/** Safe, user-facing Telegram status — never contains token material. */
export interface TelegramUserStatus {
  enabled: boolean;
  bot_username: string | null;
  deep_link: string | null;
  connected: boolean;
  telegram_user_id: string | null;
  connected_at: string | null;
}

/** Admin view of the deployment's bot config; token only ever masked. */
export interface TelegramAdminConfig {
  bot_username: string | null;
  bot_id: number | null;
  has_token: boolean;
  token_masked: string | null;
  is_enabled: boolean;
  validated_at: string | null;
  webhook_url: string | null;
  deep_link: string | null;
}

export interface TelegramAdminConfigWrite {
  bot_token?: string;
  bot_username?: string;
  is_enabled?: boolean;
}

export interface TelegramAdminTestResult {
  ok: boolean;
  bot_username: string | null;
  bot_id: number | null;
  webhook_url: string | null;
  webhook_matches: boolean;
  pending_update_count: number;
  last_error_message: string | null;
}

export interface TelegramAdminStats {
  days: number;
  totals: {
    messages: number;
    rejected: number;
    blocked: number;
    errors: number;
    active_users: number;
  };
  series: Array<{
    day: string;
    messages: number;
    rejected: number;
    blocked: number;
    errors: number;
  }>;
}

export interface TelegramAdminBan {
  reason: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface TelegramAdminUser {
  user_id: string | null;
  telegram_user_id: string;
  connected_at: string | null;
  last_event_at: string | null;
  message_count: number;
  status: "active" | "timeout" | "banned";
  ban: TelegramAdminBan | null;
}

export interface TelegramAdminMessage {
  message_id: string;
  session_id: string;
  query: string;
  reply: string | null;
  created_at: string;
}

export const telegramApi = {
  /** User-facing endpoints (Communications tab). */
  status: async () => rbacRequest<TelegramUserStatus>("/telegram/me"),

  connect: async (telegramUserId: string) =>
    rbacRequest<TelegramUserStatus>("/telegram/me", {
      method: "PUT",
      body: { telegram_user_id: telegramUserId },
      silent: true,
    }),

  disconnect: async () =>
    rbacRequest<TelegramUserStatus>("/telegram/me", {
      method: "DELETE",
      silent: true,
    }),

  /** Admin endpoints (dashboard Communications section). */
  adminGet: async () => rbacRequest<TelegramAdminConfig>("/telegram/admin/config"),

  adminSave: async (body: TelegramAdminConfigWrite) =>
    rbacRequest<TelegramAdminConfig>("/telegram/admin/config", {
      method: "PUT",
      body,
      silent: true,
    }),

  adminTest: async () =>
    rbacRequest<TelegramAdminTestResult>("/telegram/admin/config/test", {
      method: "POST",
      silent: true,
    }),

  adminDelete: async () =>
    rbacRequest<null>("/telegram/admin/config", {
      method: "DELETE",
      silent: true,
    }),

  /** Traffic + moderation (dashboard Communications section). */
  adminStats: async (days: number) =>
    rbacRequest<TelegramAdminStats>("/telegram/admin/stats", { query: { days } }),

  adminUsers: async (days: number) =>
    rbacRequest<TelegramAdminUser[]>("/telegram/admin/users", { query: { days } }),

  adminUserMessages: async (userId: string, limit = 50) =>
    rbacRequest<TelegramAdminMessage[]>(
      `/telegram/admin/users/${encodeURIComponent(userId)}/messages`,
      { query: { limit } },
    ),

  adminRevokeLink: async (userId: string) =>
    rbacRequest<null>(`/telegram/admin/users/${encodeURIComponent(userId)}/link`, {
      method: "DELETE",
      silent: true,
    }),

  adminSetBan: async (telegramUserId: string, opts: { reason?: string; minutes?: number }) =>
    rbacRequest<{ telegram_user_id: string; status: string; expires_at: string | null }>(
      `/telegram/admin/moderation/${encodeURIComponent(telegramUserId)}`,
      { method: "POST", body: opts, silent: true },
    ),

  adminLiftBan: async (telegramUserId: string) =>
    rbacRequest<null>(`/telegram/admin/moderation/${encodeURIComponent(telegramUserId)}`, {
      method: "DELETE",
      silent: true,
    }),
};

/** `@NewtonAssistantBot` and `NewtonAssistantBot` both yield a valid link. */
export function telegramDeepLink(handle: string): string {
  return `https://t.me/${handle.trim().replace(/^@/, "")}`;
}

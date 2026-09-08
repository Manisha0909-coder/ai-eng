/**
 * Custom (cookie-based) auth API — the BFF's `/auth/*` endpoints
 * (newton-infra `src/auth_server/local_auth/router.py`, mounted at root).
 *
 * Uses a bare axios instance on purpose: the shared `apiClient` targets
 * `/mid` and its 401 interceptor redirects to /login, which must not fire
 * on the login screen itself.
 */
import axios from "axios";
import { VITE_API_BASE_URL } from "@/env";
import type { ApiResponse } from "@/services/api/envelope";

const localAuth = axios.create({
  baseURL: `${VITE_API_BASE_URL}/auth`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

/** Server message for an axios error, falling back to a friendly default. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiResponse> | undefined;
    if (data?.message) return data.message;
    if (error.response?.status === 429) return "Too many attempts. Please try again later.";
    if (!error.response) return "We couldn’t reach the sign-in service. Please try again.";
  }
  return fallback;
}

export interface LocalLoginResult {
  email: string;
  display_name: string | null;
}

export async function localLogin(email: string, password: string): Promise<LocalLoginResult> {
  const res = await localAuth.post<ApiResponse<LocalLoginResult>>("/login", {
    email,
    password,
  });
  return res.data.data;
}

export async function localLogout(): Promise<void> {
  await localAuth.post("/logout");
}

export interface InvitationInfo {
  email: string;
  kind: "invite" | "password_reset";
}

export async function validateInvitation(token: string): Promise<InvitationInfo> {
  const res = await localAuth.get<ApiResponse<InvitationInfo>>("/invitations/validate", {
    params: { token },
  });
  return res.data.data;
}

export async function redeemInvitation(params: {
  token: string;
  password: string;
  display_name?: string;
}): Promise<{ email?: string }> {
  const res = await localAuth.post<ApiResponse<{ email?: string }>>(
    "/invitations/redeem",
    params
  );
  return res.data.data ?? {};
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<string> {
  const res = await localAuth.post<ApiResponse>("/password/change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return res.data.message;
}

export interface LocalSession {
  id: string;
  user_email: string;
  auth_source: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  current: boolean;
}

export async function listSessions(): Promise<LocalSession[]> {
  const res = await localAuth.get<ApiResponse<{ sessions: LocalSession[] }>>("/sessions");
  const sessions = res.data?.data?.sessions;
  return Array.isArray(sessions) ? sessions : [];
}

export async function revokeSession(sessionId: string): Promise<void> {
  await localAuth.delete(`/sessions/${sessionId}`);
}

export interface Invitation {
  id: string;
  kind: "invite" | "password_reset";
  email: string;
  invited_by: string;
  role_names: string[];
  status: "pending" | "redeemed" | "revoked" | "expired";
  expires_at: string | null;
  redeemed_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
}

export interface CreatedInvitation {
  invitation: Invitation;
  /** Raw token — returned exactly once, never retrievable again. */
  token: string;
  link: string;
}

export async function createInvitation(params: {
  email: string;
  kind?: "invite" | "password_reset";
  role_names?: string[];
  ttl_hours?: number;
}): Promise<CreatedInvitation> {
  const res = await localAuth.post<ApiResponse<CreatedInvitation>>("/invitations", params);
  return res.data.data;
}

export async function listInvitations(params: {
  limit?: number;
  offset?: number;
  kind?: string;
  email?: string;
}): Promise<{ invitations: Invitation[]; total: number }> {
  const res = await localAuth.get<
    ApiResponse<{ invitations: Invitation[]; total: number }>
  >("/invitations", { params });
  return res.data.data;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await localAuth.delete(`/invitations/${invitationId}`);
}

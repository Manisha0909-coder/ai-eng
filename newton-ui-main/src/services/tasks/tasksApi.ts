import { API_CONFIG } from "@/config/api";

/**
 * API client for scheduled tasks/reminders (backend: /tasks/*).
 *
 * Reminders are created by the assistant (via its create_reminder tool) during
 * a normal chat turn; this client only lists and cancels them for the UI.
 */

export interface ScheduledTask {
  task_id: string;
  session_id: string;
  kind: string;
  message: string;
  original_request: string | null;
  due_at: string; // UTC ISO 8601
  status: "pending" | "delivering" | "delivered" | "failed" | "cancelled";
  fired_at: string | null;
  created_source: string | null;
  created_at: string | null;
}

interface ListTasksResult {
  tasks: ScheduledTask[];
  count: number;
}

export async function fetchTasks(options?: {
  sessionId?: string;
  activeOnly?: boolean;
  offset?: number;
  limit?: number;
}): Promise<ListTasksResult> {
  const params = new URLSearchParams();
  if (options?.sessionId) params.set("session_id", options.sessionId);
  if (options?.activeOnly) params.set("active_only", "true");
  params.set("offset", String(options?.offset ?? 0));
  params.set("limit", String(options?.limit ?? 50));

  const response = await fetch(
    `${API_CONFIG.LOCAL_API_BASE_URL}/tasks/list?${params.toString()}`,
    { credentials: "include" },
  );
  if (!response.ok) throw new Error(`Failed to fetch tasks (${response.status})`);
  const body = await response.json();
  return {
    tasks: body?.data?.tasks ?? [],
    count: body?.data?.count ?? 0,
  };
}

export async function cancelTask(taskId: string): Promise<boolean> {
  const response = await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/tasks/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId }),
  });
  return response.ok;
}

import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { apiFetch } from "@/services/api/sessionExpiry";

interface SnapshotMessage {
  role: "user" | "assistant";
  content?: string;
  message_id: string;
  date: string;
  reasoning?: string;
  json_data?: {
    cards?: any[];
    chart_data?: any;
    forms?: any[];
    html_data?: string;
    calendar_data?: any[];
    session_id?: string;
    package?: any;
    packages?: any[];
  };
  file_paths?: string[];
  message_timeline?: any[]; // Support for interleaved timeline entries
}

interface FeedbackSnapshot {
  id: number;
  feedback_id: number;
  session_id: string;
  created_at: string;
  chat_history_snapshot: SnapshotMessage[];
}

interface SnapshotsApiResponse {
  snapshots: FeedbackSnapshot[];
  total: number;
}

/**
 * Fetch feedback snapshots (chat history) for a specific feedback entry
 * @param feedbackId - The ID of the feedback entry
 * @param token - Authentication token
 * @returns Promise with snapshot data
 */
export async function fetchFeedbackSnapshots(
  feedbackId: number,
): Promise<SnapshotsApiResponse> {
  const baseUrl = API_CONFIG.LOCAL_API_BASE_URL || "";
  const url = `${baseUrl.replace(/\/$/, "")}/feedback/${feedbackId}/snapshots`;

  const response = await apiFetch(url, {
    method: "GET",
    headers: {
      ...API_CONFIG.API_HEADERS,
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch snapshots: ${response.status} ${response.statusText}`);
  }

  return unwrapEnvelope<SnapshotsApiResponse>(await response.json());
}

// Export types for use in other components
export type { SnapshotMessage, FeedbackSnapshot, SnapshotsApiResponse };


import { API_CONFIG } from "@/config/api";

/**
 * Client for the backend's per-user event feed (GET /events/subscribe, SSE).
 *
 * The backend pushes an event whenever this user's data changes anywhere —
 * a Telegram turn, another device, a rename, a stream starting — so the
 * frontend can react instead of polling list_chat_sessions / list_message /
 * stream status. Consumers subscribe via `subscribeUserEvents`; the module
 * keeps a single shared EventSource for the whole app and reconnects with a
 * flat backoff if the connection dies. Pollers should treat themselves as a
 * fallback and stand down while `isUserEventsFeedLive()` is true.
 */

export type UserEventType =
  | "session_updated"
  | "session_deleted"
  | "message_added"
  | "stream_started"
  | "stream_ended"
  | "task_created"
  | "task_cancelled"
  | "reminder_fired";

export interface UserEvent {
  type: UserEventType;
  data: any;
}

type Listener = (event: UserEvent) => void;

const EVENT_TYPES: UserEventType[] = [
  "session_updated",
  "session_deleted",
  "message_added",
  "stream_started",
  "stream_ended",
  "task_created",
  "task_cancelled",
  "reminder_fired",
];

const RECONNECT_DELAY_MS = 15_000;

let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit(event: UserEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // One bad listener must not break the others.
    }
  });
}

function openSource() {
  if (source || typeof EventSource === "undefined") return;
  try {
    source = new EventSource(`${API_CONFIG.LOCAL_API_BASE_URL}/events/subscribe`, {
      withCredentials: true,
    });
  } catch {
    scheduleReconnect();
    return;
  }

  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (e) => {
      let data: any = null;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        // Malformed payload — deliver the event anyway so fallbacks can refresh.
      }
      emit({ type, data });
    });
  }

  source.onerror = () => {
    // EventSource retries transient drops itself (per the server's `retry:`).
    // Only a CLOSED source — auth failure, proxy reset — needs manual help.
    if (source && source.readyState === EventSource.CLOSED) {
      source.close();
      source = null;
      scheduleReconnect();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (listeners.size > 0) openSource();
  }, RECONNECT_DELAY_MS);
}

/** Subscribe to the user's event feed; opens the shared connection on first use. */
export function subscribeUserEvents(listener: Listener): () => void {
  listeners.add(listener);
  openSource();
  return () => {
    // Keep the connection alive for the app's lifetime — it's one idle socket
    // and other consumers may subscribe later.
    listeners.delete(listener);
  };
}

/** True while the feed is connected — pollers should stand down. */
export function isUserEventsFeedLive(): boolean {
  return source !== null && source.readyState === EventSource.OPEN;
}

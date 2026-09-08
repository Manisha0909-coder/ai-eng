/**
 * Persist the first user message in sessionStorage while the backend session exists
 * but list_message is still empty (first turn streaming, not persisted yet).
 */

const KEY_PENDING = "newton.firstMessage.pending";

const keyForSession = (sessionId: string) =>
  `newton.firstMessage.${sessionId}`;

export type PendingFirstMessage = {
  content: string;
  mode?: string;
  personaId?: number;
  savedAt: string;
};

export function savePendingFirstMessageBeforeSession(
  payload: PendingFirstMessage
): void {
  try {
    sessionStorage.setItem(KEY_PENDING, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Persist the in-flight user message for an existing session (a follow-up turn,
 * not the first message). Lets us re-render the user's query when re-attaching
 * to a still-active stream, since `list_message` only returns persisted turns.
 */
export function savePendingMessageForSession(
  sessionId: string,
  payload: PendingFirstMessage
): void {
  if (!sessionId?.trim()) return;
  try {
    sessionStorage.setItem(keyForSession(sessionId.trim()), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Call when session_id is known (e.g. after streaming sets it). */
export function migratePendingFirstMessageToSession(sessionId: string): void {
  if (!sessionId?.trim()) return;
  try {
    const raw = sessionStorage.getItem(KEY_PENDING);
    if (!raw) return;
    sessionStorage.setItem(keyForSession(sessionId.trim()), raw);
    sessionStorage.removeItem(KEY_PENDING);
  } catch {
    /* ignore */
  }
}

export function getPendingFirstMessage(
  sessionId: string
): PendingFirstMessage | null {
  if (!sessionId?.trim()) return null;
  try {
    const raw = sessionStorage.getItem(keyForSession(sessionId.trim()));
    if (!raw) return null;
    return JSON.parse(raw) as PendingFirstMessage;
  } catch {
    return null;
  }
}

export function clearPendingFirstMessage(sessionId: string | null): void {
  try {
    if (sessionId?.trim()) {
      sessionStorage.removeItem(keyForSession(sessionId.trim()));
    }
    sessionStorage.removeItem(KEY_PENDING);
  } catch {
    /* ignore */
  }
}

export function clearPendingFirstMessagePendingOnly(): void {
  try {
    sessionStorage.removeItem(KEY_PENDING);
  } catch {
    /* ignore */
  }
}

/**
 * Persists the in-flight stream across App route unmounts (e.g. admin console).
 * React refs are lost when App unmounts, but the fetch keeps running; this bridge
 * keeps the AbortController and owner chat id so the stop button works on return.
 */

type StreamingSession = {
  ownerChatId: string;
  abortController: AbortController;
};

let activeSession: StreamingSession | null = null;

export function registerStreamingSession(
  ownerChatId: string,
  abortController: AbortController
): void {
  activeSession = { ownerChatId, abortController };
}

export function clearStreamingSession(): void {
  activeSession = null;
}

export function getActiveStreamingSession(): StreamingSession | null {
  return activeSession;
}

export function hasActiveStreamingSession(): boolean {
  return activeSession !== null;
}

export function abortActiveStreamingSession(): boolean {
  if (!activeSession) return false;
  try {
    activeSession.abortController.abort();
  } catch {
    // ignore
  }
  activeSession = null;
  return true;
}

export function adoptStreamingSessionRefs(refs: {
  streamingOwnerChatIdRef: { current: string | null };
  streamingIsActiveRef: { current: boolean };
  abortControllerRef: { current: AbortController | null };
}): boolean {
  if (!activeSession) return false;
  refs.streamingOwnerChatIdRef.current = activeSession.ownerChatId;
  refs.streamingIsActiveRef.current = true;
  refs.abortControllerRef.current = activeSession.abortController;
  return true;
}

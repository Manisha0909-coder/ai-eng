import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef } from "react";
import { useChatStore } from "../store/chatStore";
import { useStore } from "../store/useStore";
import { useLanguageStore } from "../store/languageStore";
import {
  UnifiedChatState,
  initialUnifiedChatState,
  processUnifiedStreamingMessage,
} from "../services/chat/streamingChat";
import { checkChatStreamStatus, fetchUserMessages } from "../services/chat/api";
import {
  hasActiveStreamingSession,
  registerStreamingSession,
} from "../services/chat/streamingSessionBridge";
import { mergeServerMessages } from "../services/chat/messageMerge";
import {
  isUserEventsFeedLive,
  subscribeUserEvents,
  type UserEvent,
} from "../services/chat/userEventsFeed";
import { Message } from "../types/message";
import { AppState } from "../types/app";

/** How often we ping GET /chat/sessions/{id}/status for the open session. */
const STATUS_POLL_MS = 5_000;
/** Full message-list reconciles are heavier; run at most this often. */
const RECONCILE_MIN_INTERVAL_MS = 20_000;

interface UseLiveSessionSyncParams {
  streamingOwnerChatIdRef: MutableRefObject<string | null>;
  streamingIsActiveRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  applyStreamingUiUpdate: (s: UnifiedChatState, ownerChatId: string | null) => void;
  endStreamingSession: () => void;
  setAppState: Dispatch<SetStateAction<AppState>>;
}

/**
 * Keeps the open conversation live when turns originate outside this tab
 * (e.g. the user messages the bot from Telegram).
 *
 * Poll-then-attach: every few seconds we ask the backend whether the open
 * session has an active Redis stream. If it does — and this tab doesn't own a
 * stream — we attach read-only to GET /chat/sessions/{id}/stream and render the
 * in-flight reply exactly like a locally-initiated one. Between streams, an
 * occasional message-list reconcile picks up short turns that completed
 * entirely inside a polling gap.
 */
export function useLiveSessionSync({
  streamingOwnerChatIdRef,
  streamingIsActiveRef,
  abortControllerRef,
  applyStreamingUiUpdate,
  endStreamingSession,
  setAppState,
}: UseLiveSessionSyncParams) {
  const inFlightRef = useRef(false);
  const lastReconcileAtRef = useRef(0);

  const pollRef = useRef<() => Promise<void>>();
  pollRef.current = async () => {
    if (inFlightRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const { sessionId, isViewingArchivedSession } = useStore.getState();
    if (!sessionId || isViewingArchivedSession) return;
    // Never interfere with a stream this tab owns or is already attached to.
    if (streamingIsActiveRef.current || hasActiveStreamingSession()) return;

    const isStale = () => useStore.getState().sessionId !== sessionId;

    inFlightRef.current = true;
    try {
      const streaming = await checkChatStreamStatus(sessionId);
      if (isStale()) return;

      if (streaming === true) {
        await attachToExternalStream(sessionId, isStale);
      } else if (
        Date.now() - lastReconcileAtRef.current >= RECONCILE_MIN_INTERVAL_MS
      ) {
        await reconcilePersistedMessages(sessionId, isStale);
      }
    } catch {
      // Background sync must never surface errors.
    } finally {
      inFlightRef.current = false;
    }
  };

  /** Refetch persisted messages and fold new ones into the rendered thread. */
  const reconcilePersistedMessages = async (
    sessionId: string,
    isStale: () => boolean
  ) => {
    lastReconcileAtRef.current = Date.now();
    const chatId = useChatStore.getState().currentChatId;
    if (!chatId) return;

    const server = await fetchUserMessages(sessionId);
    if (isStale() || server.length === 0) return;
    // A stream may have started (here or externally) while we were fetching.
    if (streamingIsActiveRef.current || hasActiveStreamingSession()) return;

    const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
    if (!chat) return;
    const merged = mergeServerMessages(chat.messages, server);
    if (merged) {
      // The chats→streamingChatState sync effect in App.tsx propagates this to
      // the visible thread; new messages fade in via ChatContainer's mount
      // animation.
      useChatStore.getState().updateChat(chatId, merged);
    }
  };

  /** Attach read-only to an externally-initiated in-flight generation. */
  const attachToExternalStream = async (
    sessionId: string,
    isStale: () => boolean,
    pendingUserText?: string
  ) => {
    const chatId = useChatStore.getState().currentChatId;
    if (!chatId) return;

    // Pick up the external user message first, if it's already persisted, so
    // it renders above the reply we're about to stream.
    try {
      await reconcilePersistedMessages(sessionId, isStale);
    } catch {}
    if (isStale()) return;
    if (streamingIsActiveRef.current || hasActiveStreamingSession()) return;

    // The in-flight user message isn't persisted until the turn completes; if
    // the stream_started event carried its text, render it now. The later
    // reconcile matches it by content, so it won't duplicate.
    if (pendingUserText && pendingUserText.trim()) {
      const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
      const messages = chat?.messages ?? [];
      const lastUser = [...messages].reverse().find((m) => m.type === "user");
      if ((lastUser?.content ?? "").trim() !== pendingUserText.trim()) {
        const pendingUser: Message = {
          id: `live-user-${sessionId}-${messages.length}`,
          type: "user",
          content: pendingUserText,
          timestamp: new Date(),
        } as Message;
        useChatStore.getState().updateChat(chatId, [...messages, pendingUser]);
      }
    }

    const baseMessages =
      useChatStore.getState().chats.find((c) => c.id === chatId)?.messages ?? [];

    abortControllerRef.current = new AbortController();
    registerStreamingSession(chatId, abortControllerRef.current);
    streamingOwnerChatIdRef.current = chatId;
    streamingIsActiveRef.current = true;
    setAppState((prev) => ({ ...prev, isGenerating: true }));

    try {
      await processUnifiedStreamingMessage(
        useLanguageStore.getState().languageType,
        { ...initialUnifiedChatState, messages: baseMessages },
        "",
        (s) => applyStreamingUiUpdate(s, chatId),
        undefined,
        undefined,
        undefined,
        undefined,
        {
          skipAddingUserMessage: true,
          streamResume: { sessionId },
        },
        abortControllerRef.current.signal
      );
    } catch {
      // Stream may have completed between the status check and the GET — the
      // db-fallback inside the streaming client handles hydration.
    } finally {
      endStreamingSession();
      setAppState((prev) => ({ ...prev, isGenerating: false }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("updateStreamingChatState", {
            detail: { reason: "messageCompleted" },
          })
        );
      }
    }

    // Canonize the finished turn (and pick up the external user message if it
    // wasn't persisted when we attached).
    if (!isStale()) {
      lastReconcileAtRef.current = 0;
      try {
        await reconcilePersistedMessages(sessionId, isStale);
      } catch {}
    }
  };

  const handleEventRef = useRef<(event: UserEvent) => void>();
  handleEventRef.current = async (event: UserEvent) => {
    const { sessionId, isViewingArchivedSession } = useStore.getState();
    if (!sessionId || isViewingArchivedSession) return;
    if (event.data?.session_id !== sessionId) return;
    if (inFlightRef.current) return;
    if (streamingIsActiveRef.current || hasActiveStreamingSession()) return;

    const isStale = () => useStore.getState().sessionId !== sessionId;
    inFlightRef.current = true;
    try {
      if (event.type === "stream_started") {
        // Verify the stream really is live before attaching — a stale event
        // degrades to a no-op status check.
        const streaming = await checkChatStreamStatus(sessionId);
        if (isStale() || streaming !== true) return;
        await attachToExternalStream(
          sessionId,
          isStale,
          typeof event.data?.query === "string" ? event.data.query : undefined
        );
      } else if (event.type === "message_added") {
        // The turn is already persisted — reconcile from the DB, and never
        // attach here: the completed turn's stream key can briefly outlive it,
        // and a fresh attach would replay the whole turn as a duplicate.
        await reconcilePersistedMessages(sessionId, isStale);
      }
    } catch {
      // Background sync must never surface errors.
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    // Primary signal: backend-pushed events for the open session.
    const unsubscribe = subscribeUserEvents((event) => {
      handleEventRef.current?.(event);
    });

    // Interval polling is a fallback for when the event feed is down; the
    // refocus check always runs to catch anything missed while hidden.
    const fallbackTick = () => {
      if (!isUserEventsFeedLive()) pollRef.current?.();
    };
    const focusTick = () => {
      pollRef.current?.();
    };
    const intervalId = setInterval(fallbackTick, STATUS_POLL_MS);
    window.addEventListener("focus", focusTick);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener("focus", focusTick);
    };
  }, []);
}

import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  clearPendingFirstMessage,
  getPendingFirstMessage,
  migratePendingFirstMessageToSession,
  savePendingMessageForSession,
  type PendingFirstMessage,
} from "../utils/pendingFirstMessage";
import { generateChatId } from "../utils/helper";
import { AppState } from "../types/app";
import notify from "../utils/notify";
import {
  abortActiveStreamingSession,
  getActiveStreamingSession,
  registerStreamingSession,
} from "../services/chat/streamingSessionBridge";

/**
 * Reconstruct the in-flight user message from a locally-saved pending payload.
 * `list_message` omits the current turn until generation finishes, so this is
 * what keeps the user's query visible while we re-attach to the live stream.
 */
function buildPendingUserMessage(pending: PendingFirstMessage) {
  return {
    id: `pending-user-${pending.savedAt}`,
    type: "user" as const,
    content: pending.content,
    timestamp: new Date(pending.savedAt),
    ...(pending.mode !== undefined && { mode: pending.mode }),
    ...(pending.personaId !== undefined && { personaId: pending.personaId }),
  };
}

interface UseSessionManagerParams {
  streamingMessageCount: number;
  streamingChatStateIsTyping: boolean;
  appStateIsProcessingQuery: boolean;
  streamingOwnerChatIdRef: MutableRefObject<string | null>;
  streamingIsActiveRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  newlyCreatedSessionRef: MutableRefObject<string | null>;
  currentChatIdRef: MutableRefObject<string | null>;
  applyStreamingUiUpdate: (s: UnifiedChatState, ownerChatId: string | null) => void;
  endStreamingSession: () => void;
  setStreamingChatState: Dispatch<SetStateAction<UnifiedChatState>>;
  setAppState: Dispatch<SetStateAction<AppState>>;
}

/**
 * Manages sessionId ↔ URL route synchronisation, loads historical messages
 * when a session is selected, and handles the stream-resume flow for in-flight
 * sessions. Extracted from App.tsx to isolate session lifecycle concerns.
 *
 * Returns `skipRouteSyncRef` so that sibling hooks (useQueryParamChat) can
 * suppress spurious route pushes during programmatic navigation.
 */
export function useSessionManager({
  streamingMessageCount,
  streamingChatStateIsTyping,
  appStateIsProcessingQuery,
  streamingOwnerChatIdRef,
  streamingIsActiveRef,
  abortControllerRef,
  newlyCreatedSessionRef,
  currentChatIdRef,
  applyStreamingUiUpdate,
  endStreamingSession,
  setStreamingChatState,
  setAppState,
}: UseSessionManagerParams) {
  const navigate = useNavigate();
  const params = useParams<{ sessionId?: string }>();

  const { sessionId, setSessionId } = useStore();
  const { addChat, updateChat, setCurrentChat, clearAllChats } = useChatStore();
  const { languageType } = useLanguageStore();

  // ── Internal refs ──────────────────────────────────────────────────────────
  const syncingRouteRef = useRef(false);
  const previousRouteSessionRef = useRef<string | undefined>(undefined);
  const lastLoadedSessionRef = useRef<string | null>(null);
  const manualSessionLoadingRef = useRef<string | null>(null);
  const skipRouteSyncRef = useRef(false);
  const newChatSessionStartedRef = useRef(false);
  const previousSessionIdRef = useRef<string | null>(null);
  const skipLoadMessagesForNewSessionRef = useRef(false);
  const hasResetRootSessionRef = useRef(false);
  const loadMessagesSeqRef = useRef(0);

  // ── Migrate pending first message when session is assigned ─────────────────
  useEffect(() => {
    if (sessionId) {
      migratePendingFirstMessageToSession(sessionId);
    }
  }, [sessionId]);

  // ── Window event listeners for session lifecycle ───────────────────────────
  useEffect(() => {
    const handleSessionLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail;
      manualSessionLoadingRef.current = detail?.sessionId ?? null;
      skipRouteSyncRef.current = false;
    };

    const handleSessionLoadingFailed = () => {
      manualSessionLoadingRef.current = null;
      lastLoadedSessionRef.current = null;
    };

    const handleSessionLoadingComplete = () => {
      manualSessionLoadingRef.current = null;
    };

    const handleNewChatSessionStarted = () => {
      skipRouteSyncRef.current = true;
      newChatSessionStartedRef.current = true;
      skipLoadMessagesForNewSessionRef.current = true;
    };

    const handleSessionCreatedByStreaming = (event: Event) => {
      const detail = (event as CustomEvent<{ session_id: string }>).detail;
      if (detail?.session_id) {
        newlyCreatedSessionRef.current = detail.session_id;
        setTimeout(() => {
          if (newlyCreatedSessionRef.current === detail.session_id) {
            newlyCreatedSessionRef.current = null;
          }
        }, 2000);
      }
    };

    const handleResumeRouteSync = () => {
      skipRouteSyncRef.current = false;
      try {
        window.sessionStorage.setItem("newton.skipRouteSync", "false");
      } catch (error) {
        console.warn("Failed to clear skipRouteSync flag", error);
      }
    };

    window.addEventListener("sessionLoading", handleSessionLoading as EventListener);
    window.addEventListener("sessionLoadingFailed", handleSessionLoadingFailed);
    window.addEventListener("sessionLoadingComplete", handleSessionLoadingComplete);
    window.addEventListener("newChatSessionStarted", handleNewChatSessionStarted);
    window.addEventListener("sessionCreatedByStreaming", handleSessionCreatedByStreaming as EventListener);
    window.addEventListener("resumeRouteSync", handleResumeRouteSync);

    return () => {
      window.removeEventListener("sessionLoading", handleSessionLoading as EventListener);
      window.removeEventListener("sessionLoadingFailed", handleSessionLoadingFailed);
      window.removeEventListener("sessionLoadingComplete", handleSessionLoadingComplete);
      window.removeEventListener("newChatSessionStarted", handleNewChatSessionStarted);
      window.removeEventListener("sessionCreatedByStreaming", handleSessionCreatedByStreaming as EventListener);
      window.removeEventListener("resumeRouteSync", handleResumeRouteSync);
    };
  }, [newlyCreatedSessionRef]);

  // ── Restore skipRouteSync flag from sessionStorage on mount ────────────────
  useEffect(() => {
    try {
      const skipValue = window.sessionStorage.getItem("newton.skipRouteSync");
      if (skipValue === "true") skipRouteSyncRef.current = true;
      else if (skipValue === "false") skipRouteSyncRef.current = false;
    } catch (error) {
      console.warn("Failed to read skipRouteSync flag", error);
    }
  }, []);

  // ── Reset stale session when navigating back to root "/" ───────────────────
  useEffect(() => {
    if (hasResetRootSessionRef.current) return;
    if (typeof window === "undefined") return;

    if (window.location.pathname !== "/") {
      hasResetRootSessionRef.current = true;
      return;
    }

    const hasActiveSessionState =
      streamingMessageCount > 0 ||
      streamingChatStateIsTyping ||
      appStateIsProcessingQuery;

    if (!hasActiveSessionState && sessionId && !newChatSessionStartedRef.current) {
      skipRouteSyncRef.current = true;
      skipLoadMessagesForNewSessionRef.current = true;
      lastLoadedSessionRef.current = null;
      manualSessionLoadingRef.current = null;
      setSessionId(null);
    }

    hasResetRootSessionRef.current = true;
  }, [
    sessionId,
    streamingMessageCount,
    streamingChatStateIsTyping,
    appStateIsProcessingQuery,
    setSessionId,
  ]);

  // ── loadMessages ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (pendingOverride?: PendingFirstMessage | null) => {
    if (!sessionId) return;
    const requestSessionId = sessionId;
    if (manualSessionLoadingRef.current === requestSessionId) return;
    const requestId = ++loadMessagesSeqRef.current;

    // Aborting the orphaned background stream resolves its owner's success path,
    // which clears the saved in-flight message. The caller (resume listener)
    // snapshots it beforehand and passes it here so it survives that race.
    const readPending = (): PendingFirstMessage | null => {
      const p = pendingOverride ?? getPendingFirstMessage(requestSessionId);
      // Re-persist so subsequent re-attaches (switch away/back again) still find
      // it; it's cleared for good when the resumed stream finishes.
      if (p) savePendingMessageForSession(requestSessionId, p);
      return p;
    };

    const isStale = () =>
      requestId !== loadMessagesSeqRef.current ||
      useStore.getState().sessionId !== requestSessionId;

    // Stream survived a route change (e.g. admin console) — keep live UI state.
    const bridgedAtStart = getActiveStreamingSession();
    const chatIdAtStart = useChatStore.getState().currentChatId;
    if (bridgedAtStart && chatIdAtStart && bridgedAtStart.ownerChatId === chatIdAtStart) {
      streamingOwnerChatIdRef.current = chatIdAtStart;
      streamingIsActiveRef.current = true;
      abortControllerRef.current = bridgedAtStart.abortController;
      setAppState((prev) => ({ ...prev, isGenerating: true }));
      const liveChat = useChatStore
        .getState()
        .chats.find((c) => c.id === chatIdAtStart);
      if (liveChat) {
        setStreamingChatState((prev) => ({
          ...prev,
          messages: liveChat.messages,
          isTyping: true,
        }));
      }
      return;
    }

    // Attach the UI to the backend's still-active stream. `baseState` is the
    // conversation as we know it so far (prior turns); the resumed stream
    // appends the in-flight assistant reply on top of it.
    const resumeStream = async (chatIdNow: string, baseState: UnifiedChatState) => {
      const bridged = getActiveStreamingSession();
      if (bridged?.ownerChatId === chatIdNow) {
        streamingOwnerChatIdRef.current = chatIdNow;
        streamingIsActiveRef.current = true;
        abortControllerRef.current = bridged.abortController;
        setAppState((prev) => ({ ...prev, isGenerating: true }));
        const liveChat = useChatStore
          .getState()
          .chats.find((c) => c.id === chatIdNow);
        applyStreamingUiUpdate(
          {
            ...baseState,
            messages: liveChat?.messages ?? baseState.messages,
            isTyping: true,
          },
          chatIdNow
        );
        return;
      }

      abortActiveStreamingSession();
      abortControllerRef.current = new AbortController();
      registerStreamingSession(chatIdNow, abortControllerRef.current);
      streamingOwnerChatIdRef.current = chatIdNow;
      setAppState((prev) => ({ ...prev, isGenerating: true }));

      try {
        await processUnifiedStreamingMessage(
          languageType,
          baseState,
          "",
          (s) => applyStreamingUiUpdate(s, chatIdNow),
          undefined,
          undefined,
          undefined,
          undefined,
          {
            skipAddingUserMessage: true,
            streamResume: { sessionId: requestSessionId },
          },
          abortControllerRef.current.signal
        );
        clearPendingFirstMessage(requestSessionId);
      } catch {
        // Stream may have completed between status check and GET (404) — harmless.
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
    };

    try {
      const messages = await fetchUserMessages(requestSessionId);

      if (isStale()) return;

      if (messages.length > 0) {
        let chatIdNow = useChatStore.getState().currentChatId;
        if (!chatIdNow) {
          const newChatId = generateChatId();
          addChat({
            id: newChatId,
            title: "Previous Conversation",
            timestamp: new Date(),
            messages,
          });
          setCurrentChat(newChatId);
          currentChatIdRef.current = newChatId;
          chatIdNow = newChatId;
        } else {
          updateChat(chatIdNow, messages);
        }

        setStreamingChatState((prev) => ({ ...prev, messages }));

        if (useStore.getState().isSessionPersonaDeleted) {
          notify.error("This persona has been deleted");
        }

        // list_message only returns persisted turns; the latest assistant reply
        // isn't saved until generation finishes. If the backend stream is still
        // active, reconnect so the in-flight reply continues instead of being
        // dropped until the next reload.
        const stillStreaming = await checkChatStreamStatus(requestSessionId);
        if (isStale()) return;
        if (stillStreaming !== true) {
          // Turn is finished/persisted — drop any stale in-flight message.
          clearPendingFirstMessage(requestSessionId);
          return;
        }

        // The in-flight user query isn't persisted yet, so list_message doesn't
        // include it. Restore it from the locally-saved pending payload so the
        // user's message renders above the resuming assistant reply.
        const pending = readPending();
        let baseMessages = messages;
        const lastUser = [...messages]
          .reverse()
          .find((m) => m.type === "user");
        if (pending && lastUser?.content !== pending.content) {
          baseMessages = [...messages, buildPendingUserMessage(pending)];
          updateChat(chatIdNow, baseMessages);
          setStreamingChatState((prev) => ({ ...prev, messages: baseMessages }));
        }

        await resumeStream(chatIdNow, {
          ...initialUnifiedChatState,
          messages: baseMessages,
        });
      } else {
        const pending = readPending();
        const stillStreaming = await checkChatStreamStatus(requestSessionId);

        if (isStale()) return;
        if (!pending && stillStreaming !== true) return;

        let chatIdNow = useChatStore.getState().currentChatId;
        if (!chatIdNow) {
          const newChatId = generateChatId();
          addChat({
            id: newChatId,
            title: pending
              ? pending.content.slice(0, 30) + (pending.content.length > 30 ? "..." : "")
              : "Live session",
            timestamp: new Date(),
            messages: [],
          });
          setCurrentChat(newChatId);
          currentChatIdRef.current = newChatId;
          chatIdNow = newChatId;
        }

        const baseState: UnifiedChatState = pending
          ? {
              ...initialUnifiedChatState,
              messages: [buildPendingUserMessage(pending)],
            }
          : initialUnifiedChatState;

        if (pending) {
          updateChat(chatIdNow, baseState.messages);
          applyStreamingUiUpdate(baseState, chatIdNow);
        }

        if (stillStreaming !== true) return;

        await resumeStream(chatIdNow, baseState);
      }
    } catch {}
  }, [
    sessionId,
    addChat,
    updateChat,
    setCurrentChat,
    languageType,
    applyStreamingUiUpdate,
    endStreamingSession,
    abortControllerRef,
    streamingOwnerChatIdRef,
    currentChatIdRef,
    setStreamingChatState,
    setAppState,
  ]);

  // ── Resume an in-flight stream when re-selecting a streaming session ───────
  // The sidebar fires this after `list_message` returns empty for a session
  // whose backend stream is still active. We can't rely on the normal
  // sessionId-change effect because `lastLoadedSessionRef` is already set to
  // this session, so we drive `loadMessages` (which re-checks status and
  // resumes the stream) explicitly here.
  useEffect(() => {
    const handleResumeStreamingSession = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail;
      const sid = detail?.sessionId;
      if (!sid) return;
      if (useStore.getState().sessionId !== sid) return;

      // Snapshot the in-flight user message BEFORE aborting: aborting the
      // orphaned stream runs its owner's success path, which clears this.
      const pendingSnapshot = getPendingFirstMessage(sid);

      // Abort any stream carried across route navigation before re-attaching.
      abortActiveStreamingSession();
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {}
        abortControllerRef.current = null;
      }

      manualSessionLoadingRef.current = null;
      lastLoadedSessionRef.current = sid;
      loadMessages(pendingSnapshot).catch(() => {
        lastLoadedSessionRef.current = null;
      });
    };

    window.addEventListener(
      "resumeStreamingSession",
      handleResumeStreamingSession as EventListener
    );
    return () => {
      window.removeEventListener(
        "resumeStreamingSession",
        handleResumeStreamingSession as EventListener
      );
    };
  }, [loadMessages, abortControllerRef]);

  // ── Trigger loadMessages when sessionId changes ────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      lastLoadedSessionRef.current = null;
      manualSessionLoadingRef.current = null;
      return;
    }

    if (lastLoadedSessionRef.current === sessionId) return;

    if (streamingMessageCount > 0 && lastLoadedSessionRef.current === sessionId) return;

    if (skipLoadMessagesForNewSessionRef.current && !previousSessionIdRef.current) {
      lastLoadedSessionRef.current = sessionId;
      setTimeout(() => {
        skipLoadMessagesForNewSessionRef.current = false;
      }, 1000);
      return;
    }

    if (sessionId && newlyCreatedSessionRef.current === sessionId) {
      if (streamingMessageCount > 0) {
        lastLoadedSessionRef.current = sessionId;
        return;
      }
    }

    lastLoadedSessionRef.current = sessionId;
    loadMessages().catch(() => {
      lastLoadedSessionRef.current = null;
    });
  }, [sessionId, loadMessages, streamingMessageCount, newlyCreatedSessionRef]);

  // ── Route sync: URL param → sessionId ─────────────────────────────────────
  useEffect(() => {
    const routeSessionId = params.sessionId;
    if (routeSessionId) {
      if (previousRouteSessionRef.current !== routeSessionId) {
        previousRouteSessionRef.current = routeSessionId;
        if (sessionId !== routeSessionId) {
          syncingRouteRef.current = true;
          setSessionId(routeSessionId);
        }
      }
    } else if (sessionId) {
      previousRouteSessionRef.current = undefined;
      navigate(`/chat/${sessionId}`, { replace: true });
    }
  }, [params.sessionId, sessionId, setSessionId, navigate]);

  // ── Route sync: sessionId → URL ────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    if (syncingRouteRef.current) {
      syncingRouteRef.current = false;
      return;
    }
    if (params.sessionId !== sessionId) {
      if (skipRouteSyncRef.current || window.location.pathname === "/") return;
      navigate(`/chat/${sessionId}`, { replace: true });
    }
  }, [sessionId, params.sessionId, navigate]);

  // ── Clear state when navigating back to root "/" with no active session ────
  useEffect(() => {
    if (params.sessionId) return;
    if (window.location.pathname !== "/") return;

    const shouldPreserveSession =
      streamingMessageCount > 0 ||
      streamingChatStateIsTyping ||
      appStateIsProcessingQuery;

    if (shouldPreserveSession) return;

    skipRouteSyncRef.current = true;
    previousRouteSessionRef.current = undefined;
    manualSessionLoadingRef.current = null;
    lastLoadedSessionRef.current = null;

    if (sessionId) setSessionId(null);

    clearAllChats();
    setStreamingChatState(initialUnifiedChatState);
    window.dispatchEvent(new CustomEvent("clearStreamingChatState"));

    try {
      window.sessionStorage.setItem("newton.skipRouteSync", "true");
    } catch (error) {
      console.warn("Failed to persist skipRouteSync flag", error);
    }

    if (window.location.href.includes("redirect")) {
      window.history.replaceState(
        null,
        "",
        window.location.origin + window.location.pathname
      );
    }

    newChatSessionStartedRef.current = false;
  }, [
    params.sessionId,
    sessionId,
    setSessionId,
    clearAllChats,
    setStreamingChatState,
    streamingMessageCount,
    streamingChatStateIsTyping,
    appStateIsProcessingQuery,
  ]);

  // ── Track when newChatSession state clears after sessionId arrives ─────────
  useEffect(() => {
    if (newChatSessionStartedRef.current && !previousSessionIdRef.current && sessionId) {
      newChatSessionStartedRef.current = false;
    }
    previousSessionIdRef.current = sessionId;
  }, [sessionId]);

  return { skipRouteSyncRef };
}

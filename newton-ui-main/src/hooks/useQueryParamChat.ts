import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useChatStore } from "../store/chatStore";
import { useStore, getSelectedPersonaId } from "../store/useStore";
import { useLanguageStore } from "../store/languageStore";
import {
  UnifiedChatState,
  initialUnifiedChatState,
  processUnifiedStreamingMessage,
} from "../services/chat/streamingChat";
import {
  clearPendingFirstMessage,
  savePendingFirstMessageBeforeSession,
} from "../utils/pendingFirstMessage";
import { generateChatId } from "../utils/helper";
import { Message } from "../types/message";
import { AppState } from "../types/app";
import { registerStreamingSession } from "../services/chat/streamingSessionBridge";

interface UseQueryParamChatParams {
  streamingOwnerChatIdRef: MutableRefObject<string | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  currentChatIdRef: MutableRefObject<string | null>;
  skipRouteSyncRef: MutableRefObject<boolean>;
  newlyCreatedSessionRef: MutableRefObject<string | null>;
  applyStreamingUiUpdate: (s: UnifiedChatState, ownerChatId: string | null) => void;
  mergeStreamingPatch: (
    updater: (prev: UnifiedChatState) => UnifiedChatState,
    ownerChatId: string | null
  ) => void;
  endStreamingSession: () => void;
  setAppState: Dispatch<SetStateAction<AppState>>;
  setStreamingChatState: Dispatch<SetStateAction<UnifiedChatState>>;
}

/**
 * Listens for the `?q=` search parameter and auto-submits the decoded query
 * as a new chat message, handling all state setup and stream teardown.
 * Extracted from App.tsx to isolate the query-param auto-send concern.
 */
export function useQueryParamChat({
  streamingOwnerChatIdRef,
  abortControllerRef,
  currentChatIdRef,
  skipRouteSyncRef,
  newlyCreatedSessionRef,
  applyStreamingUiUpdate,
  mergeStreamingPatch,
  endStreamingSession,
  setAppState,
  setStreamingChatState,
}: UseQueryParamChatParams) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { sessionId, setSessionId, isAuthenticated } = useStore();
  const { addChat, setCurrentChat, clearAllChats } = useChatStore();
  const { languageType } = useLanguageStore();

  const hasProcessedQueryRef = useRef(false);

  useEffect(() => {
    const queryParam = searchParams.get("q");

    if (!queryParam) {
      hasProcessedQueryRef.current = false;
      setAppState((prev) => ({ ...prev, isProcessingQuery: false }));
      return;
    }

    const decodedQuery = decodeURIComponent(queryParam).trim();

    if (!decodedQuery) {
      hasProcessedQueryRef.current = false;
      setAppState((prev) => ({ ...prev, isProcessingQuery: false }));
      return;
    }

    if (decodedQuery && !hasProcessedQueryRef.current && isAuthenticated) {
      hasProcessedQueryRef.current = true;
      setAppState((prev) => ({ ...prev, isProcessingQuery: true }));

      const clearAndCreateNewChat = async () => {
        try {
          setSessionId(null);
          skipRouteSyncRef.current = true;
          window.dispatchEvent(new Event("newChatSessionStarted"));
          try {
            window.sessionStorage.setItem("newton.skipRouteSync", "true");
          } catch (error) {
            console.warn("Failed to persist skipRouteSync flag", error);
          }

          clearAllChats();

          const newChatId = generateChatId();
          addChat({
            id: newChatId,
            title: decodedQuery.slice(0, 30) + (decodedQuery.length > 30 ? "..." : ""),
            timestamp: new Date(),
            messages: [],
          });
          setCurrentChat(newChatId);
          currentChatIdRef.current = newChatId;

          const userMessage: Message = {
            id: Date.now().toString(),
            content: decodedQuery,
            type: "user",
            timestamp: new Date(),
          };

          const newStateWithMessage: UnifiedChatState = {
            ...initialUnifiedChatState,
            messages: [userMessage],
            isTyping: true,
          };

          streamingOwnerChatIdRef.current = newChatId;
          applyStreamingUiUpdate(newStateWithMessage, newChatId);
          setAppState((prev) => ({ ...prev, isGenerating: true }));

          // Remove ?q= from URL to prevent re-triggering on refresh
          navigate(window.location.pathname, { replace: true });

          await new Promise((resolve) => setTimeout(resolve, 100));

          try {
            abortControllerRef.current = new AbortController();
            registerStreamingSession(newChatId, abortControllerRef.current);

            const currentSessionId = useStore.getState().sessionId;
            if (!currentSessionId) {
              savePendingFirstMessageBeforeSession({
                content: decodedQuery,
                savedAt: new Date().toISOString(),
              });
            }

            const result = await processUnifiedStreamingMessage(
              languageType,
              newStateWithMessage,
              decodedQuery,
              (s) => applyStreamingUiUpdate(s, newChatId),
              () => setAppState((prev) => ({ ...prev, isGenerating: false })),
              undefined,
              undefined,
              undefined,
              { skipAddingUserMessage: true },
              abortControllerRef.current?.signal
            );

            const newState = result.state;
            applyStreamingUiUpdate(newState, newChatId);
            endStreamingSession();
            clearPendingFirstMessage(useStore.getState().sessionId);

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("updateStreamingChatState", {
                  detail: { reason: "messageCompleted" },
                })
              );
            }

            if (result.newSession) {
              const newSessionId = result.newSession.session_id;
              newlyCreatedSessionRef.current = newSessionId;
              setTimeout(() => {
                if (newlyCreatedSessionRef.current === newSessionId) {
                  newlyCreatedSessionRef.current = null;
                }
              }, 2000);

              const currentUserId = useStore.getState().userId || "";
              const currentPersonaId = getSelectedPersonaId();
              window.dispatchEvent(
                new CustomEvent("addNewChatSession", {
                  detail: {
                    session_id: newSessionId,
                    chat_title: result.newSession.chat_title,
                    user_id: currentUserId,
                    ...(currentPersonaId !== null && currentPersonaId !== undefined
                      ? { persona_id: currentPersonaId }
                      : {}),
                  },
                })
              );
            } else if (result.updatedTitle) {
              const currentUserId = useStore.getState().userId || "";
              const currentPersonaId = getSelectedPersonaId();
              window.dispatchEvent(
                new CustomEvent("addNewChatSession", {
                  detail: {
                    session_id: result.updatedTitle.session_id,
                    chat_title: result.updatedTitle.chat_title,
                    user_id: currentUserId,
                    ...(currentPersonaId !== null && currentPersonaId !== undefined
                      ? { persona_id: currentPersonaId }
                      : {}),
                  },
                })
              );
            }
          } catch (error) {
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              content: "Failed to process your query. Please try again.",
              type: "assistant",
              timestamp: new Date(),
              isError: true,
            } as any;
            mergeStreamingPatch(
              (prev) => ({
                ...prev,
                messages: [...prev.messages, errorMessage],
                isTyping: false,
              }),
              newChatId
            );
            endStreamingSession();
            hasProcessedQueryRef.current = false;
          } finally {
            setAppState((prev) => ({
              ...prev,
              isProcessingQuery: false,
              isGenerating: false,
            }));
          }
        } catch (error) {
          setAppState((prev) => ({ ...prev, isProcessingQuery: false }));
          hasProcessedQueryRef.current = false;
        }
      };

      clearAndCreateNewChat();
    } else if (queryParam && !isAuthenticated) {
      const redirectPath = window.location.pathname + window.location.search;
      navigate(`/auth?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [
    searchParams,
    isAuthenticated,
    clearAllChats,
    addChat,
    setCurrentChat,
    navigate,
    applyStreamingUiUpdate,
    mergeStreamingPatch,
    endStreamingSession,
    setSessionId,
    languageType,
    skipRouteSyncRef,
    newlyCreatedSessionRef,
    abortControllerRef,
    currentChatIdRef,
    streamingOwnerChatIdRef,
    setAppState,
  ]);
}

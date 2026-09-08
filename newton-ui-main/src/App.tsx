import { motion } from "framer-motion";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChatContainer } from "./features/chat/components/ChatContainer/ChatContainer";
import { ChatInput } from "./features/chat/components/ChatInput/ChatInput";
import { Header } from "./layouts/Header";
import { WelcomeScreen } from "./features/chat/components/WelcomeScreen/WelcomeScreen";
import { SearchResultsView } from "./features/search/components/SearchResultsView/SearchResultsView";
import useTTS from "./hooks/useTTS";
import { useSwipeGesture } from "./hooks/useSwipeGesture";
import { trackError, trackEvent } from "./services/infrastructure/analytics";
import { ChatState, initialState } from "./services/chat/chat";
import {
  UnifiedChatState,
  initialUnifiedChatState,
} from "./services/chat/streamingChat";
import {
  adoptStreamingSessionRefs,
  clearStreamingSession,
  getActiveStreamingSession,
  hasActiveStreamingSession,
  registerStreamingSession,
} from "./services/chat/streamingSessionBridge";
import { useChatStore } from "./store/chatStore";
import { useStore } from "./store/useStore";
import { AppState, initialAppState } from "./types/app";
import notify from "./utils/notify";

// Extracted hooks
import { useAudioSetup } from "./hooks/useAudioSetup";
import { useSessionManager } from "./hooks/useSessionManager";
import { useStreamingSubmit } from "./hooks/useStreamingSubmit";
import { useMessageEdit } from "./hooks/useMessageEdit";
import { useQueryParamChat } from "./hooks/useQueryParamChat";
import { useLiveSessionSync } from "./hooks/useLiveSessionSync";

export function App({
  setSidebarTracker,
}: {
  setSidebarTracker: Dispatch<SetStateAction<boolean | null>>;
}) {
  const {
    searchQuery,
    searchResults,
    isSearching,
    isSearchModeActive,
    newChatType,
    selectedPersonaId,
    personas,
    isViewingArchivedSession,
    isSessionPersonaDeleted,
    setIsDashboardFullscreen,
  } = useStore();
  const hideChatInput =
    isViewingArchivedSession || isSessionPersonaDeleted;
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  const {
    chats,
    currentChatId,
    updateChat,
  } = useChatStore();

  // ── Shared refs ────────────────────────────────────────────────────────────
  /** Keeps async streaming callbacks aligned with the tab the user is viewing. */
  const currentChatIdRef = useRef<string | null>(null);
  /** Chat id that owns the in-flight stream (submit / edit / query). */
  const streamingOwnerChatIdRef = useRef<string | null>(null);
  const streamingIsActiveRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const newlyCreatedSessionRef = useRef<string | null>(null);

  // ── Component state ────────────────────────────────────────────────────────
  const [appState, setAppState] = useState<AppState>(initialAppState);
  // Legacy mirror of the store's messages; only the setter is still used.
  const [, setChatState] = useState<ChatState>(initialState);
  const [streamingChatState, setStreamingChatState] =
    useState<UnifiedChatState>(initialUnifiedChatState);
  const streamingMessageCount = streamingChatState.messages.length;
  const [sidebarState, setSidebarState] = useState({ isMobile: false });

  const isLoadingSession =
    (appState.isLoadingMessages || appState.isLoadingChat) &&
    streamingChatState.messages.length === 0;

  const shouldShowChatContainer =
    streamingChatState.messages.length > 0 ||
    appState.isProcessingQuery ||
    isLoadingSession;

  const showDefaultDashboardLandscape =
    !shouldShowChatContainer &&
    newChatType === "dashboard" &&
    selectedPersona?.type === "dashboard";

  useEffect(() => {
    if (showDefaultDashboardLandscape) {
      setIsDashboardFullscreen(true);
    }
  }, [setIsDashboardFullscreen, showDefaultDashboardLandscape]);

  // Keep currentChatIdRef in sync with the rendered chat
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // ── Core streaming state helpers ───────────────────────────────────────────
  const endStreamingSession = useCallback(() => {
    streamingOwnerChatIdRef.current = null;
    streamingIsActiveRef.current = false;
    clearStreamingSession();
  }, []);

  // Re-attach to an in-flight stream after route remount (e.g. admin console).
  useEffect(() => {
    const reattached = adoptStreamingSessionRefs({
      streamingOwnerChatIdRef,
      streamingIsActiveRef,
      abortControllerRef,
    });
    if (reattached) {
      const ownerId = streamingOwnerChatIdRef.current;
      const liveChat = ownerId
        ? useChatStore.getState().chats.find((c) => c.id === ownerId)
        : undefined;
      const liveMessages = liveChat?.messages ?? [];
      const hasStreamingMessage = liveMessages.some(
        (m) => m.type === "assistant" && m.isStreaming === true
      );

      if (!hasStreamingMessage) {
        // Stream finished while on another route; stale bridge must not revive isTyping.
        endStreamingSession();
        streamingIsActiveRef.current = false;
        setStreamingChatState((prev) => ({
          ...prev,
          messages: liveMessages.length > 0 ? liveMessages : prev.messages,
          isTyping: false,
        }));
        setAppState((prev) => ({ ...prev, isGenerating: false }));
      } else {
        setAppState((prev) => ({ ...prev, isGenerating: true }));
        setStreamingChatState((prev) => ({
          ...prev,
          messages: liveMessages,
          isTyping: true,
        }));
      }
    }

    return () => {
      if (
        streamingIsActiveRef.current &&
        streamingOwnerChatIdRef.current &&
        abortControllerRef.current
      ) {
        registerStreamingSession(
          streamingOwnerChatIdRef.current,
          abortControllerRef.current
        );
      }
    };
  }, []);

  /** Persist stream to the owning chat; only update visible UI when that chat is selected. */
  const applyStreamingUiUpdate = useCallback(
    (s: UnifiedChatState, ownerChatId: string | null) => {
      streamingIsActiveRef.current = s.isTyping;
      if (ownerChatId) {
        updateChat(ownerChatId, s.messages);
      }
      if (ownerChatId && currentChatIdRef.current === ownerChatId) {
        setStreamingChatState(s);
      }
    },
    [updateChat]
  );

  const mergeStreamingPatch = useCallback(
    (
      updater: (prev: UnifiedChatState) => UnifiedChatState,
      ownerChatId: string | null
    ) => {
      setStreamingChatState((prev) => {
        const next = updater(prev);
        streamingIsActiveRef.current = next.isTyping;
        if (ownerChatId) {
          updateChat(ownerChatId, next.messages);
        }
        if (ownerChatId && currentChatIdRef.current !== ownerChatId) {
          return prev;
        }
        return next;
      });
    },
    [updateChat]
  );

  // ── TTS ────────────────────────────────────────────────────────────────────
  const {
    speakText,
    speakAssistantResponse,
    stopSpeaking,
    cleanupAudio,
    isTTSLoading,
    isTTSSpeaking,
  } = useTTS();

  // ── Extracted hooks ────────────────────────────────────────────────────────
  useAudioSetup({ cleanupAudio });

  const { skipRouteSyncRef } = useSessionManager({
    streamingMessageCount,
    streamingChatStateIsTyping: streamingChatState.isTyping,
    appStateIsProcessingQuery: appState.isProcessingQuery,
    streamingOwnerChatIdRef,
    streamingIsActiveRef,
    abortControllerRef,
    newlyCreatedSessionRef,
    currentChatIdRef,
    applyStreamingUiUpdate,
    endStreamingSession,
    setStreamingChatState,
    setAppState,
  });

  const {
    handleSubmit,
    handleRemoveLastMessages,
    handleStopGeneration,
    handleRetry,
    handleMessageSubmit,
  } = useStreamingSubmit({
    streamingOwnerChatIdRef,
    streamingIsActiveRef,
    currentChatIdRef,
    abortControllerRef,
    newlyCreatedSessionRef,
    applyStreamingUiUpdate,
    mergeStreamingPatch,
    endStreamingSession,
    streamingChatState,
    setStreamingChatState,
    setAppState,
    speakAssistantResponse,
  });

  const { handleEditMessage } = useMessageEdit({
    streamingOwnerChatIdRef,
    currentChatIdRef,
    abortControllerRef,
    applyStreamingUiUpdate,
    mergeStreamingPatch,
    endStreamingSession,
    streamingChatState,
    setAppState,
  });

  useQueryParamChat({
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
  });

  // Live-sync the open conversation with turns that originate outside this tab
  // (e.g. Telegram): poll the session's stream status and attach read-only to
  // in-flight replies so they stream in here too.
  useLiveSessionSync({
    streamingOwnerChatIdRef,
    streamingIsActiveRef,
    abortControllerRef,
    applyStreamingUiUpdate,
    endStreamingSession,
    setAppState,
  });

  // ── Issue 1.4: window.error listener in its own stable effect ─────────────
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error) trackError(event.error);
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  // ── Synchronise isGenerating with active streaming (not stale message flags) ─
  useEffect(() => {
    const hasStreamingMessage = streamingChatState.messages.some(
      (m) => m.type === "assistant" && m.isStreaming === true
    );
    const streamIsLive =
      streamingChatState.isTyping ||
      hasActiveStreamingSession() ||
      (hasStreamingMessage && streamingIsActiveRef.current);
    setAppState((prev) =>
      prev.isGenerating === streamIsLive
        ? prev
        : { ...prev, isGenerating: streamIsLive }
    );
  }, [streamingChatState.isTyping, streamingChatState.messages]);

  // ── Chat store → legacy chatState + page-view tracking ────────────────────
  useEffect(() => {
    if (currentChatId) {
      const currentChat = chats.find((chat) => chat.id === currentChatId);
      if (currentChat) {
        setChatState((prev) => ({ ...prev, messages: currentChat.messages }));
      }
    }
    trackEvent("page_view");
  }, [currentChatId, chats]);

  // ── Clear streaming state on explicit clearStreamingChatState event ────────
  useEffect(() => {
    const handleClearStreamingChatState = () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {}
      }
      endStreamingSession();
      setStreamingChatState(initialUnifiedChatState);
      setAppState((prev) => ({ ...prev, isGenerating: false, isLoading: false }));
    };

    window.addEventListener(
      "clearStreamingChatState",
      handleClearStreamingChatState as EventListener
    );
    return () => {
      window.removeEventListener(
        "clearStreamingChatState",
        handleClearStreamingChatState as EventListener
      );
    };
  }, [endStreamingSession]);

  // ── Session-switch loading flag (drives the chat skeleton) ─────────────────
  // The sidebar dispatches `sessionLoading` when a switch starts and
  // `sessionLoadingEnded` (from its finally block) when it finishes on any
  // path. App.tsx owns `appState.isLoadingMessages`, so mirror those here.
  useEffect(() => {
    const handleLoadingStart = () =>
      setAppState((prev) => ({ ...prev, isLoadingMessages: true }));
    const handleLoadingEnd = () =>
      setAppState((prev) => ({ ...prev, isLoadingMessages: false }));

    window.addEventListener("sessionLoading", handleLoadingStart);
    window.addEventListener("sessionLoadingEnded", handleLoadingEnd);
    return () => {
      window.removeEventListener("sessionLoading", handleLoadingStart);
      window.removeEventListener("sessionLoadingEnded", handleLoadingEnd);
    };
  }, []);

  // ── Mobile detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile !== sidebarState.isMobile) {
        setSidebarState((prev) => ({ ...prev, isMobile }));
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [sidebarState.isMobile]);

  // ── Chat tab transition: sync store messages to streaming state ────────────
  useEffect(() => {
    if (currentChatId) {
      const currentChat = chats.find((chat) => chat.id === currentChatId);
      if (currentChat) {
        const hasStreamingMessage = currentChat.messages.some(
          (m) => m.type === "assistant" && m.isStreaming === true
        );
        const streamOwner = streamingOwnerChatIdRef.current;
        const bridged = hasActiveStreamingSession();

        // Require an actively flagged message — stale refs after route remount
        // must not keep isTyping / thinking dots alive once the stream ended.
        if (!hasStreamingMessage) {
          if (bridged && streamOwner === currentChatId) {
            clearStreamingSession();
          }
          if (streamOwner === currentChatId) {
            streamingIsActiveRef.current = false;
          }
        }

        const isThisChatStreaming =
          hasStreamingMessage &&
          streamOwner === currentChatId &&
          (streamingIsActiveRef.current || bridged);

        if (bridged && !streamOwner) {
          adoptStreamingSessionRefs({
            streamingOwnerChatIdRef,
            streamingIsActiveRef,
            abortControllerRef,
          });
        }

        const clearedMessages = currentChat.messages.map((m) =>
          m.type === "assistant" && m.isStreaming && !isThisChatStreaming
            ? { ...m, isStreaming: false }
            : m
        );
        if (
          !isThisChatStreaming &&
          clearedMessages.some(
            (m, i) => m.isStreaming !== currentChat.messages[i]?.isStreaming
          )
        ) {
          updateChat(currentChatId, clearedMessages);
        }

        setStreamingChatState((prev) => ({
          ...prev,
          messages: clearedMessages,
          isTyping: isThisChatStreaming,
        }));
      }
    }
  }, [currentChatId, chats]);

  const toggleUploadCard = useCallback(() => {
    setAppState((prev) => ({ ...prev, showUploadCard: !prev.showUploadCard }));
  }, []);

  // ── Swipe gestures ─────────────────────────────────────────────────────────
  const mainContentRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLDivElement>(null);

  const handleSwipeRight = useCallback(() => {
    window.dispatchEvent(new Event("openSidebar"));
  }, []);

  const handleSwipeLeft = useCallback(() => {
    window.dispatchEvent(new Event("closeSidebar"));
  }, []);

  useSwipeGesture(mainContentRef, {
    onSwipeRight: handleSwipeRight,
    onSwipeLeft: handleSwipeLeft,
    minSwipeDistance: 60,
    edgeThreshold: 80,
    enabled: true,
  });


  // ── Memoized components ────────────────────────────────────────────────────
  const memoizedHeader = useMemo(() => <Header />, []);

  // Stop button / input lock only for the chat that owns the in-flight stream.
  const streamOwnerChatId =
    streamingOwnerChatIdRef.current ??
    getActiveStreamingSession()?.ownerChatId ??
    null;
  const isGeneratingForCurrentChat =
    appState.isGenerating &&
    currentChatId != null &&
    streamOwnerChatId === currentChatId;

  const memoizedChatInput = useMemo(
    () => (
      <ChatInput
        stopSpeaking={stopSpeaking}
        isGenerating={isGeneratingForCurrentChat}
        setIsGenerating={(generating) =>
          setAppState((prev) => ({ ...prev, isGenerating: generating }))
        }
        onSubmit={(message, fileMetadata, mode, emailContext, personaId) =>
          handleSubmit(message, fileMetadata, mode, emailContext, personaId)
        }
        onStopGeneration={handleStopGeneration}
        onRemoveLastMessages={handleRemoveLastMessages}
        setScreen={(screen: "chat" | "communication") =>
          setAppState((prev) => ({ ...prev, screen }))
        }
        isLoading={appState.isLoading}
        onToggleUploadCard={toggleUploadCard}
      />
    ),
    [
      stopSpeaking,
      isGeneratingForCurrentChat,
      appState.isLoading,
      currentChatId,
      handleSubmit,
      handleStopGeneration,
      handleRemoveLastMessages,
      toggleUploadCard,
    ]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="app-container min-h-screen bg-background text-text-main transition-[background,color] duration-300 ease-in-out"
    >
      <div
        onClick={() => {
          const isMobile = window.innerWidth <= 768;
          if (isMobile || !isSearchModeActive) {
            setSidebarTracker((prev) => !prev);
          }
        }}
        className="h-full transition-colors duration-300"
      >
        <div className="flex h-full overflow-hidden z-10">
          <div
            ref={mainContentRef}
            className={`flex-1 flex flex-col h-full overflow-hidden text-white
                transition-all ease-in-out transform will-change-transform relative`}
            style={{
              height: "100%",
              background:
                "var(--color-background-gradient, var(--color-background))",
              color: "rgb(var(--color-text))",
              minHeight: "-webkit-fill-available",
              overflow: "hidden",
              paddingRight: "var(--viz-sidebar-width, 0px)",
              boxSizing: "border-box",
            }}
          >
            {/* Header — on mobile it needs a real surface so chat messages
                scrolling underneath don't show through the persona selector. */}
            <div
              className={`z-50 pt-0 fixed right-0 left-0 flex-shrink-0 ${
                sidebarState.isMobile
                  ? "bg-background/85 backdrop-blur-md border-b border-border-main/40"
                  : ""
              }`}
              style={{ width: "100%" }}
            >
              {memoizedHeader}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full flex flex-col px-0 md:px-4"
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                // Clear the fixed header: 3rem of header plus the device
                // status-bar inset (standalone PWA), which the old fixed 64px
                // ignored — that's what let content sit under the header.
                paddingTop: sidebarState.isMobile
                  ? "calc(3.5rem + env(safe-area-inset-top))"
                  : "60px",
              }}
            >
              {(() => {
                const shouldShowChatContainer =
                  streamingChatState.messages.length > 0 ||
                  appState.isProcessingQuery ||
                  isLoadingSession;
                const useDashboardLayout =
                  shouldShowChatContainer &&
                  newChatType !== "analytical" &&
                  selectedPersona?.type !== "chat";
                const showDefaultDashboardLandscape =
                  !shouldShowChatContainer &&
                  newChatType === "dashboard" &&
                  selectedPersona?.type === "dashboard";
                return (
                  <>
                    <main className="main-content flex-1 flex flex-col min-h-0 overflow-x-hidden scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mt-4">
                      {(() => {
                        if (isSearchModeActive) {
                          return (
                            <SearchResultsView
                              searchQuery={searchQuery}
                              searchResults={searchResults}
                              isSearching={isSearching}
                            />
                          );
                        }

                        return shouldShowChatContainer ? (
                          <ChatContainer
                            messages={streamingChatState.messages}
                            isTyping={streamingChatState.isTyping}
                            onMessageSubmit={handleMessageSubmit}
                            onEditMessage={handleEditMessage}
                            onRetry={handleRetry}
                            isLoadingMessages={
                              (appState.isLoadingMessages ||
                                appState.isLoadingChat) &&
                              streamingChatState.messages.length === 0
                            }
                            speakText={speakText}
                            stopSpeaking={stopSpeaking}
                            isSpeaking={isTTSSpeaking}
                            isLoadingTTS={isTTSLoading}
                            chatSidebarInput={
                              useDashboardLayout && !hideChatInput
                                ? memoizedChatInput
                                : undefined
                            }
                          />
                        ) : showDefaultDashboardLandscape ? (
                          <ChatContainer
                            messages={streamingChatState.messages}
                            isTyping={streamingChatState.isTyping}
                            onMessageSubmit={handleMessageSubmit}
                            onEditMessage={handleEditMessage}
                            onRetry={handleRetry}
                            isLoadingMessages={false}
                            speakText={speakText}
                            stopSpeaking={stopSpeaking}
                            isSpeaking={isTTSSpeaking}
                            isLoadingTTS={isTTSLoading}
                            chatSidebarInput={
                              !hideChatInput
                                ? memoizedChatInput
                                : undefined
                            }
                          />
                        ) : (
                          <WelcomeScreen />
                        );
                      })()}
                    </main>

                    {!isSearchModeActive &&
                      !useDashboardLayout &&
                      !showDefaultDashboardLandscape &&
                      !hideChatInput &&
                      (shouldShowChatContainer ||
                        (newChatType != null && selectedPersonaId != null)) && (
                        <div
                          ref={chatInputRef}
                          className="chat-input-anchor w-full left-0 bottom-0 z-50 pb-[calc(var(--safe-bottom,0px)+var(--bottom-gap,16px))] sm:pb-12 bg-transparent flex-shrink-0"
                          style={{ position: "relative" }}
                        >
                          {memoizedChatInput}
                        </div>
                      )}
                  </>
                );
              })()}

              {appState.showUploadCard && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className={`fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50`}
                ></motion.div>
              )}
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}

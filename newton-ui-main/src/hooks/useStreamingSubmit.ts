import { Dispatch, MutableRefObject, SetStateAction, useCallback, useRef } from "react";
import { useChatStore } from "../store/chatStore";
import { useStore } from "../store/useStore";
import { useLanguageStore } from "../store/languageStore";
import { useEmailStore } from "../store/emailStore";
import useTTSStore from "../store/ttsStore";
import {
  UnifiedChatState,
  initialUnifiedChatState,
  processUnifiedStreamingMessage,
} from "../services/chat/streamingChat";
import {
  clearPendingFirstMessage,
  clearPendingFirstMessagePendingOnly,
  savePendingFirstMessageBeforeSession,
  savePendingMessageForSession,
} from "../utils/pendingFirstMessage";
import { fileUrl, middlewareFilePath } from "../utils/fileStaticPath";
import { generateChatId } from "../utils/helper";
import { trackError, trackEvent, trackModelUsage } from "../services/infrastructure/analytics";
import { getSelectedPersonaId } from "../store/useStore";
import { Message, UploadedFileMetadata } from "../types/message";
import { AppState } from "../types/app";
import {
  abortActiveStreamingSession,
  registerStreamingSession,
} from "../services/chat/streamingSessionBridge";

interface EmailContext {
  emailId: string;
  conversationId: string;
}

interface UseStreamingSubmitParams {
  streamingOwnerChatIdRef: MutableRefObject<string | null>;
  streamingIsActiveRef: MutableRefObject<boolean>;
  currentChatIdRef: MutableRefObject<string | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  newlyCreatedSessionRef: MutableRefObject<string | null>;
  applyStreamingUiUpdate: (s: UnifiedChatState, ownerChatId: string | null) => void;
  mergeStreamingPatch: (
    updater: (prev: UnifiedChatState) => UnifiedChatState,
    ownerChatId: string | null
  ) => void;
  endStreamingSession: () => void;
  streamingChatState: UnifiedChatState;
  setStreamingChatState: Dispatch<SetStateAction<UnifiedChatState>>;
  setAppState: Dispatch<SetStateAction<AppState>>;
  speakAssistantResponse: (text: string) => void;
}

/**
 * Encapsulates handleSubmit, handleRemoveLastMessages, handleStopGeneration,
 * handleRetry, and handleMessageSubmit. Extracted from App.tsx to isolate the
 * streaming-submission concern.
 */
export function useStreamingSubmit({
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
}: UseStreamingSubmitParams) {
  const { sessionId, setSessionId } = useStore();
  const {
    currentChatId,
    chats,
    addChat,
    updateChat,
    setCurrentChat,
    updateChatTitle,
    addMessageById,
    clearAllChats,
  } = useChatStore();
  const { languageType } = useLanguageStore();
  const { isReplyClicked, isReplyAllClicked, isForwardClicked } = useEmailStore();
  const { isSTTActive } = useTTSStore();

  /** Tracks the sessionId that existed BEFORE the streaming API call so that
   *  cancellation before session creation can be handled correctly. */
  const sessionIdBeforeCallRef = useRef<string | null>(null);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    } else {
      abortActiveStreamingSession();
    }
    endStreamingSession();

    const ownerChatId = streamingOwnerChatIdRef.current ?? currentChatId;

    setStreamingChatState((prev) => {
      const messages = prev.messages.map((m) =>
        m.type === "assistant" && m.isStreaming
          ? { ...m, isStreaming: false }
          : m
      );
      if (ownerChatId) {
        updateChat(ownerChatId, messages);
      }
      return { ...prev, messages, isTyping: false };
    });
    setAppState((prev) => ({ ...prev, isGenerating: false }));
  }, [
    abortControllerRef,
    streamingOwnerChatIdRef,
    endStreamingSession,
    setStreamingChatState,
    currentChatId,
    updateChat,
    setAppState,
  ]);

  const handleRemoveLastMessages = useCallback(() => {
    setStreamingChatState((prev) => {
      const messages = [...prev.messages];
      if (messages.length === 0) return prev;

      const sessionIdBeforeCall = sessionIdBeforeCallRef.current;
      const isFirstMessage =
        messages.length <= 2 &&
        (messages.length === 1 ||
          (messages.length === 2 &&
            messages[0].type === "user" &&
            messages[1].type === "assistant"));

      const currentChat = chats.find((chat) => chat.id === currentChatId);
      const isNewChat =
        currentChatId && (!currentChat || currentChat.messages.length === 0);
      const onlyUserMessage =
        messages.length === 1 && messages[0].type === "user";

      if (
        (isFirstMessage && !sessionIdBeforeCall && !sessionId) ||
        (isFirstMessage && isNewChat && !sessionId) ||
        (onlyUserMessage && !sessionId && !sessionIdBeforeCall)
      ) {
        // Drop the cancelled exchange (user + assistant); text is restored to the input
        sessionIdBeforeCallRef.current = null;
        if (currentChatId) {
          updateChat(currentChatId, []);
        }
        return { ...prev, messages: [], isTyping: false };
      }

      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === "assistant") messages.pop();
      // Remove the user bubble; useStopRequest restores its text to the input
      if (messages.length > 0 && messages[messages.length - 1].type === "user") {
        messages.pop();
      }

      const finalMessages = messages.map((m) =>
        m.type === "assistant" && m.isStreaming
          ? { ...m, isStreaming: false }
          : m
      );
      const updatedState = { ...prev, messages: finalMessages, isTyping: false };

      if (isFirstMessage && finalMessages.length === 0) {
        setTimeout(() => {
          useChatStore.getState().clearAllChats();
        }, 0);
        return initialUnifiedChatState;
      }

      if (currentChatId) {
        updateChat(currentChatId, finalMessages);
      }

      return updatedState;
    });
  }, [currentChatId, updateChat, sessionId, chats]);

  const handleSubmit = useCallback(
    async (
      content: string,
      fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[],
      mode?: string,
      emailContext?: EmailContext,
      personaId?: number,
      language?: "EN" | "AR"
    ) => {
      setAppState((prev) => ({ ...prev, isLoading: true }));

      const hasAttachments =
        fileMetadata != null &&
        (!Array.isArray(fileMetadata) || fileMetadata.length > 0);

      // Fast path: reuse existing error bubble
      const msgsLen = streamingChatState.messages.length;
      if (msgsLen >= 2 && currentChatId && !hasAttachments) {
        const lastAny: any = streamingChatState.messages[msgsLen - 1];
        const prevAny: any = streamingChatState.messages[msgsLen - 2];
        if (
          lastAny?.type === "assistant" &&
          lastAny?.isError === true &&
          !lastAny?.isStreaming &&
          prevAny?.type === "user"
        ) {
          const ownerChatId = currentChatId;
          const shouldIncludeEmailContext = !!emailContext;

          const replacedUser: Message = {
            ...(prevAny as Message),
            content,
            timestamp: new Date(),
            mode: mode ?? prevAny.mode,
            ...(personaId !== undefined && { personaId }),
            emailContext: shouldIncludeEmailContext
              ? { emailId: emailContext?.emailId, conversationId: emailContext?.conversationId }
              : prevAny.emailContext,
          } as Message;

          const reusedAssistant: Message = {
            ...(lastAny as Message),
            content: "",
            isStreaming: true,
            isError: false,
            isRetrying: false,
            // Drop prior error body so only the generating animation shows until BE responds
            message_timeline: [],
            reasoningMessage: undefined,
            assistantMessage: undefined,
          } as any;

          const nextMessages = [
            ...streamingChatState.messages.slice(0, msgsLen - 2),
            replacedUser,
            reusedAssistant,
          ];

          const updatedState = {
            ...streamingChatState,
            messages: nextMessages,
            isTyping: true,
            message_timeline: [],
            error: undefined,
          };
          streamingOwnerChatIdRef.current = ownerChatId;
          applyStreamingUiUpdate(updatedState, ownerChatId);
          setAppState((prev) => ({ ...prev, isGenerating: true }));

          try {
            abortControllerRef.current = new AbortController();
            registerStreamingSession(ownerChatId, abortControllerRef.current);

            sessionIdBeforeCallRef.current = sessionId;
            if (!sessionId) {
              savePendingFirstMessageBeforeSession({
                content,
                mode,
                ...(personaId !== undefined && { personaId }),
                savedAt: new Date().toISOString(),
              });
            } else {
              savePendingMessageForSession(sessionId, {
                content,
                mode,
                ...(personaId !== undefined && { personaId }),
                savedAt: new Date().toISOString(),
              });
            }

            const result = await processUnifiedStreamingMessage(
              language || languageType,
              updatedState,
              content,
              (s) => applyStreamingUiUpdate(s, ownerChatId),
              () => setAppState((prev) => ({ ...prev, isGenerating: false })),
              undefined,
              mode,
              shouldIncludeEmailContext
                ? { emailId: emailContext?.emailId!, conversationId: emailContext?.conversationId! }
                : replacedUser.emailContext,
              {
                reuseAssistantId: (reusedAssistant as any).id,
                skipAddingUserMessage: true,
                ...(personaId !== undefined && { personaId }),
              },
              abortControllerRef.current?.signal
            );

            sessionIdBeforeCallRef.current = null;
            const newState = result.state;
            applyStreamingUiUpdate(newState, ownerChatId);
            endStreamingSession();
            setAppState((prev) => ({ ...prev, isGenerating: false }));
            clearPendingFirstMessage(useStore.getState().sessionId);

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("updateStreamingChatState", { detail: { reason: "messageCompleted" } })
              );
            }

            _dispatchSessionEvents(result, newlyCreatedSessionRef);

            return {
              content: newState.messages[newState.messages.length - 1]?.content || "",
              formFields: (newState.messages[newState.messages.length - 1] as any)?.formFields || [],
            } as any;
          } catch (error) {
            mergeStreamingPatch((prev) => ({ ...prev, isTyping: false }), ownerChatId);
            endStreamingSession();
            setAppState((prev) => ({ ...prev, isGenerating: false }));
          } finally {
            setAppState((prev) => ({ ...prev, isLoading: false }));
          }

          return;
        }
      }

      let chatId = currentChatId;

      try {
        abortControllerRef.current = new AbortController();

        if (!chatId) {
          chatId = generateChatId();
          addChat({
            id: chatId,
            title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
            timestamp: new Date(),
            messages: [],
          });
          setCurrentChat(chatId);
          currentChatIdRef.current = chatId;
        }
        registerStreamingSession(chatId, abortControllerRef.current);

        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const shouldIncludeEmailContext = !!emailContext;

        const isDuplicate =
          !hasAttachments &&
          streamingChatState.messages.some(
            (msg) =>
              msg.type === "user" &&
              msg.content === content &&
              Date.now() - new Date(msg.timestamp).getTime() < 2000
          );

        if (isDuplicate) {
          setAppState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        const createAttachments = (
          metadata: UploadedFileMetadata | UploadedFileMetadata[] | undefined
        ) => {
          if (!metadata) return undefined;
          const arr = Array.isArray(metadata) ? metadata : [metadata];
          return arr.map((file) => {
            const sp = middlewareFilePath(String(file.static_path ?? ""));
            return {
              type: file.mimetype,
              content: file.mimetype.startsWith("image/") ? fileUrl(file.static_path ?? "") : "",
              name: file.original_filename,
              preview: file.mimetype.startsWith("image/") ? fileUrl(file.static_path ?? "") : undefined,
              file_id: file.file_id,
              static_path: sp,
              original_filename: file.original_filename,
              mimetype: file.mimetype,
            };
          });
        };

        const getFileIds = (
          metadata: UploadedFileMetadata | UploadedFileMetadata[] | undefined
        ): string[] | undefined => {
          if (!metadata) return undefined;
          const arr = Array.isArray(metadata) ? metadata : [metadata];
          const ids = arr
            .map((f) => f.file_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0);
          return ids.length > 0 ? ids : undefined;
        };

        let userMessage: Message;

        if (!isReplyClicked && !isReplyAllClicked && !isForwardClicked) {
          userMessage = {
            id: uniqueId,
            content,
            type: "user",
            timestamp: new Date(),
            mode,
            ...(personaId !== undefined && { personaId }),
            attachments: createAttachments(fileMetadata),
            emailContext: shouldIncludeEmailContext
              ? { emailId: emailContext.emailId, conversationId: emailContext.conversationId }
              : undefined,
          };
        } else {
          userMessage = {
            id: uniqueId,
            content: "",
            type: "user",
            timestamp: new Date(),
            mode,
            ...(personaId !== undefined && { personaId }),
            attachments: createAttachments(fileMetadata),
            emailContext: shouldIncludeEmailContext
              ? { emailId: emailContext.emailId, conversationId: emailContext.conversationId }
              : undefined,
          };
        }

        if (chatId && streamingChatState.messages.length === 0) {
          updateChatTitle(chatId, content.slice(0, 30) + (content.length > 30 ? "..." : ""));
        }

        const lastMsg = streamingChatState.messages[streamingChatState.messages.length - 1];
        const canReplaceLastUser =
          !isReplyClicked &&
          !isReplyAllClicked &&
          !isForwardClicked &&
          !hasAttachments &&
          lastMsg &&
          lastMsg.type === "user";

        let nextMessages: Message[];
        if (canReplaceLastUser) {
          const replacedUser: Message = {
            ...(lastMsg as Message),
            content,
            attachments: createAttachments(fileMetadata),
            timestamp: new Date(),
            mode,
            ...(personaId !== undefined && { personaId }),
            emailContext: shouldIncludeEmailContext
              ? {
                  emailId: emailContext?.emailId || (lastMsg as any)?.emailContext?.emailId,
                  conversationId: emailContext?.conversationId || (lastMsg as any)?.emailContext?.conversationId,
                }
              : (lastMsg as any)?.emailContext,
          } as Message;
          userMessage = replacedUser;
          nextMessages = [...streamingChatState.messages.slice(0, -1), replacedUser];
        } else {
          nextMessages =
            isReplyClicked || isReplyAllClicked || isForwardClicked
              ? streamingChatState.messages
              : [...streamingChatState.messages, userMessage];
        }

        const updatedState: UnifiedChatState = {
          ...streamingChatState,
          messages: nextMessages,
          isTyping: true,
        };
        streamingOwnerChatIdRef.current = chatId;
        applyStreamingUiUpdate(updatedState, chatId);
        setAppState((prev) => ({ ...prev, isGenerating: true }));

        if (!isReplyClicked && !isReplyAllClicked && !isForwardClicked && chatId) {
          addMessageById(chatId, userMessage);
        }

        // Security report special case
        if (
          content.toLowerCase().includes("assessment report") ||
          content.toLowerCase().includes("security report")
        ) {
          const botMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const botMessage: Message = {
            id: botMessageId,
            content: "Here's the security assessment report:",
            type: "assistant",
            timestamp: new Date(),
            showSecurityReport: true,
          } as any;

          const messagesWithBot = [...updatedState.messages, botMessage];
          const unifiedForStream: UnifiedChatState = {
            ...updatedState,
            messages: messagesWithBot,
            isTyping: false,
            error: undefined,
          };

          applyStreamingUiUpdate(unifiedForStream, chatId);
          endStreamingSession();
          setAppState((prev) => ({ ...prev, isGenerating: false }));
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 0));

        sessionIdBeforeCallRef.current = sessionId;
        if (!sessionId) {
          savePendingFirstMessageBeforeSession({
            content,
            mode,
            ...(personaId !== undefined && { personaId }),
            savedAt: new Date().toISOString(),
          });
        } else {
          savePendingMessageForSession(sessionId, {
            content,
            mode,
            ...(personaId !== undefined && { personaId }),
            savedAt: new Date().toISOString(),
          });
        }

        const result = await processUnifiedStreamingMessage(
          language || languageType,
          updatedState,
          content,
          (s) => applyStreamingUiUpdate(s, chatId),
          () => setAppState((prev) => ({ ...prev, isGenerating: false })),
          getFileIds(fileMetadata),
          mode,
          shouldIncludeEmailContext
            ? { emailId: emailContext?.emailId, conversationId: emailContext?.conversationId }
            : undefined,
          {
            attachments: createAttachments(fileMetadata),
            skipAddingUserMessage: true,
            ...(personaId !== undefined && { personaId }),
          },
          abortControllerRef.current?.signal
        );

        const newState = result.state;

        if (newState.messages.length === 0 && !sessionIdBeforeCallRef.current) {
          clearAllChats();
          endStreamingSession();
          setStreamingChatState(initialUnifiedChatState);
          if (sessionId) setSessionId(null);
          sessionIdBeforeCallRef.current = null;
          clearPendingFirstMessagePendingOnly();
          setAppState((prev) => ({ ...prev, isGenerating: false }));
          return { content: "", formFields: [] };
        }

        sessionIdBeforeCallRef.current = null;
        applyStreamingUiUpdate(newState, chatId);
        endStreamingSession();
        setAppState((prev) => ({ ...prev, isGenerating: false }));
        clearPendingFirstMessage(useStore.getState().sessionId);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("updateStreamingChatState", { detail: { reason: "messageCompleted" } })
          );
        }

        const lastMessage = newState.messages[newState.messages.length - 1];
        if (lastMessage && lastMessage.type === "assistant" && isSTTActive) {
          speakAssistantResponse(lastMessage.content);
        }

        trackModelUsage("local/mcp", true);
        setAppState((prev) => ({ ...prev, isGenerating: false }));

        _dispatchSessionEvents(result, newlyCreatedSessionRef);

        return {
          content: newState.messages[newState.messages.length - 1]?.content || "",
          formFields:
            (newState.messages[newState.messages.length - 1] as Message)?.formFields || [],
        };
      } catch (error) {
        if (error instanceof Error) trackError(error);
        trackModelUsage(
          "local/mcp",
          false,
          error instanceof Error ? error.message : "Unknown error"
        );
        mergeStreamingPatch((prev) => ({ ...prev, isTyping: false }), chatId);
        endStreamingSession();
        setAppState((prev) => ({ ...prev, isGenerating: false }));
      } finally {
        setAppState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [
      currentChatId,
      addChat,
      setCurrentChat,
      streamingChatState,
      isReplyClicked,
      isReplyAllClicked,
      isForwardClicked,
      languageType,
      updateChatTitle,
      addMessageById,
      updateChat,
      isSTTActive,
      speakAssistantResponse,
      applyStreamingUiUpdate,
      mergeStreamingPatch,
      endStreamingSession,
      sessionId,
      setSessionId,
      clearAllChats,
      abortControllerRef,
      streamingOwnerChatIdRef,
      currentChatIdRef,
      newlyCreatedSessionRef,
      setStreamingChatState,
      setAppState,
      chats,
    ]
  );

  const handleRetry = useCallback(
    async (errorMessageId: string) => {
      const errorMessageIndex = streamingChatState.messages.findIndex(
        (msg) => msg.id === errorMessageId
      );
      if (errorMessageIndex === -1 || errorMessageIndex === 0) return;

      const userMessage = streamingChatState.messages[errorMessageIndex - 1];
      if (!userMessage || userMessage.type !== "user") return;

      setStreamingChatState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === errorMessageId ? { ...msg, isRetrying: true } : msg
        ),
      }));

      await handleSubmit(
        userMessage.content,
        undefined,
        userMessage.mode,
        userMessage.emailContext,
        userMessage.personaId,
        languageType
      );
    },
    [streamingChatState.messages, handleSubmit, languageType, setStreamingChatState]
  );

  const handleMessageSubmit = useCallback(
    async (
      content: string,
      fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[]
    ): Promise<void> => {
      await handleSubmit(content, fileMetadata);
    },
    [handleSubmit]
  );

  return {
    handleSubmit,
    handleRemoveLastMessages,
    handleStopGeneration,
    handleRetry,
    handleMessageSubmit,
    sessionIdBeforeCallRef,
  };
}

/** Dispatch addNewChatSession / updateStreamingChatState events after a successful stream. */
function _dispatchSessionEvents(
  result: { newSession?: { session_id: string; chat_title: string }; updatedTitle?: { session_id: string; chat_title: string } },
  newlyCreatedSessionRef: MutableRefObject<string | null>
) {
  const { getState } = useStore;
  const currentUserId = getState().userId || "";
  const currentPersonaId = getSelectedPersonaId();
  const personaPayload =
    currentPersonaId !== null && currentPersonaId !== undefined
      ? { persona_id: currentPersonaId }
      : {};

  if (result.newSession) {
    const newSessionId = result.newSession.session_id;
    newlyCreatedSessionRef.current = newSessionId;
    setTimeout(() => {
      if (newlyCreatedSessionRef.current === newSessionId) {
        newlyCreatedSessionRef.current = null;
      }
    }, 2000);

    window.dispatchEvent(
      new CustomEvent("addNewChatSession", {
        detail: {
          session_id: newSessionId,
          chat_title: result.newSession.chat_title,
          user_id: currentUserId,
          ...personaPayload,
        },
      })
    );
  } else if (result.updatedTitle) {
    window.dispatchEvent(
      new CustomEvent("addNewChatSession", {
        detail: {
          session_id: result.updatedTitle.session_id,
          chat_title: result.updatedTitle.chat_title,
          user_id: currentUserId,
          ...personaPayload,
        },
      })
    );
  }
}

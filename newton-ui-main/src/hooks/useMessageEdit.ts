import { Dispatch, MutableRefObject, SetStateAction, useCallback } from "react";
import { useStore, getSelectedPersonaId } from "../store/useStore";
import { useLanguageStore } from "../store/languageStore";
import {
  UnifiedChatState,
  processUnifiedStreamingMessage,
} from "../services/chat/streamingChat";
import { fileUrl, middlewareFilePath } from "../utils/fileStaticPath";
import {
  clearPendingFirstMessage,
  savePendingMessageForSession,
} from "../utils/pendingFirstMessage";
import { UploadedFileMetadata } from "../types/message";
import { AppState } from "../types/app";
import { registerStreamingSession } from "../services/chat/streamingSessionBridge";

interface UseMessageEditParams {
  streamingOwnerChatIdRef: MutableRefObject<string | null>;
  currentChatIdRef: MutableRefObject<string | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  applyStreamingUiUpdate: (s: UnifiedChatState, ownerChatId: string | null) => void;
  mergeStreamingPatch: (
    updater: (prev: UnifiedChatState) => UnifiedChatState,
    ownerChatId: string | null
  ) => void;
  endStreamingSession: () => void;
  streamingChatState: UnifiedChatState;
  setAppState: Dispatch<SetStateAction<AppState>>;
}

/**
 * Handles user-message editing.  Unlike the previous implementation which
 * re-implemented the full SSE read loop, this hook delegates to
 * `processUnifiedStreamingMessage` — keeping the streaming protocol in a
 * single place. The `editMessageId` option is threaded through to the request
 * body so the backend can locate and replace the original message.
 */
export function useMessageEdit({
  streamingOwnerChatIdRef,
  currentChatIdRef,
  abortControllerRef,
  applyStreamingUiUpdate,
  mergeStreamingPatch,
  endStreamingSession,
  streamingChatState,
  setAppState,
}: UseMessageEditParams) {
  const { sessionId } = useStore();
  const { languageType } = useLanguageStore();

  const handleEditMessage = useCallback(
    async (
      messageId: string,
      newContent: string,
      fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[]
    ) => {
      const messageToEdit = streamingChatState.messages.find(
        (msg) => msg.message_id === messageId || msg.id === messageId
      );

      if (!messageToEdit || messageToEdit.type !== "user") return;

      const currentChatId = currentChatIdRef.current;
      if (!currentChatId) return;

      const ownerChatId = currentChatId;
      streamingOwnerChatIdRef.current = ownerChatId;

      const messageIndex = streamingChatState.messages.findIndex(
        (msg) => msg.message_id === messageId || msg.id === messageId
      );
      const messagesToKeep = streamingChatState.messages.slice(0, messageIndex + 1);

      // Build attachment list from uploaded file metadata
      const finalAttachments = fileMetadata
        ? (Array.isArray(fileMetadata) ? fileMetadata : [fileMetadata]).map((file) => {
            const sp = file.static_path ? middlewareFilePath(file.static_path) : "";
            return {
              type: file.mimetype || "application/octet-stream",
              content: "",
              name: file.file_name,
              preview: file.static_path ? fileUrl(file.static_path) : undefined,
              file_id: file.file_id,
              static_path: sp,
              original_filename: file.original_filename,
              mimetype: file.mimetype,
            };
          })
        : [];

      // Update the edited user message in the slice
      const updatedMessages = messagesToKeep.map((msg) =>
        msg.message_id === messageId || msg.id === messageId
          ? { ...msg, content: newContent, attachments: finalAttachments, isEditing: false }
          : msg
      );

      const tempAssistantId = (Date.now() + 1).toString();

      // Set up starting state: edited messages + empty streaming assistant bubble
      const editState: UnifiedChatState = {
        ...streamingChatState,
        messages: [
          ...updatedMessages,
          {
            id: tempAssistantId,
            content: "",
            type: "assistant" as const,
            timestamp: new Date(),
            isStreaming: true,
          },
        ],
        isTyping: true,
      };

      applyStreamingUiUpdate(editState, ownerChatId);
      setAppState((prev) => ({ ...prev, isGenerating: true }));

      // Resolve persona: prefer the message's own persona, then the currently selected one
      const messagePersonaId = messageToEdit.personaId;
      const storedPersonaId = getSelectedPersonaId();
      const personaIdToUse =
        messagePersonaId !== undefined && messagePersonaId !== null
          ? messagePersonaId
          : storedPersonaId !== undefined && storedPersonaId !== null
          ? storedPersonaId
          : undefined;

      // Persist the edited query so it can be re-rendered if the user switches
      // away and back while this regeneration is still streaming (list_message
      // won't include the in-flight turn until it finishes).
      if (sessionId) {
        savePendingMessageForSession(sessionId, {
          content: newContent,
          ...(messageToEdit.mode !== undefined && { mode: messageToEdit.mode }),
          ...(personaIdToUse !== undefined && { personaId: personaIdToUse }),
          savedAt: new Date().toISOString(),
        });
      }

      // Register an AbortController so the resume-on-switch flow can cleanly
      // stop this stream instead of leaving an orphaned second consumer.
      abortControllerRef.current = new AbortController();
      registerStreamingSession(ownerChatId, abortControllerRef.current);

      const fileIds =
        finalAttachments.length > 0
          ? finalAttachments
              .map((f) => f.file_id)
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          : undefined;

      try {
        await processUnifiedStreamingMessage(
          languageType,
          editState,
          newContent,
          (s) => applyStreamingUiUpdate(s, ownerChatId),
          undefined,
          fileIds,
          messageToEdit.mode,
          messageToEdit.emailContext
            ? {
                emailId: messageToEdit.emailContext.emailId,
                conversationId: messageToEdit.emailContext.conversationId,
              }
            : undefined,
          {
            skipAddingUserMessage: true,
            reuseAssistantId: tempAssistantId,
            editMessageId: messageToEdit.message_id ?? messageToEdit.id,
            ...(personaIdToUse !== undefined && { personaId: personaIdToUse }),
          },
          abortControllerRef.current.signal
        );
        // Completed normally — the turn is persisted, so drop the saved query.
        clearPendingFirstMessage(useStore.getState().sessionId);
      } catch (error) {
        mergeStreamingPatch(
          (prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === tempAssistantId
                ? {
                    ...msg,
                    content: `Failed to edit message: ${
                      error instanceof Error ? error.message : "Unknown error"
                    }`,
                    isStreaming: false,
                    isError: true,
                  }
                : msg
            ),
            isTyping: false,
          }),
          ownerChatId
        );
      } finally {
        endStreamingSession();
        setAppState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    [
      streamingChatState,
      streamingOwnerChatIdRef,
      currentChatIdRef,
      abortControllerRef,
      applyStreamingUiUpdate,
      mergeStreamingPatch,
      endStreamingSession,
      languageType,
      sessionId,
      setAppState,
    ]
  );

  return { handleEditMessage };
}

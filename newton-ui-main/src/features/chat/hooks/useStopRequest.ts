import { useRef, useCallback } from "react";
import { API_CONFIG } from "@/config/api";
import type { UploadedFileMetadata } from "@/types/message";

interface UseStopRequestOptions {
  sessionId: string;
  onStopGeneration: () => void;
  onRemoveLastMessages?: () => void;
}

interface StoredMessageData {
  content: string;
  fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[];
  mode?: string;
  selectedFiles: File[];
  uploadedFiles: UploadedFileMetadata[];
  filePreviewUrls: Record<string, string>;
}

export const useStopRequest = ({
  sessionId,
  onStopGeneration,
  onRemoveLastMessages,
}: UseStopRequestOptions) => {
  const lastSentMessageRef = useRef<StoredMessageData | null>(null);
  const isCancellingRef = useRef(false);

  /**
   * Store message data before sending for potential restoration on cancel
   */
  const storeMessageForCancel = useCallback((data: StoredMessageData) => {
    lastSentMessageRef.current = data;
  }, []);

  /**
   * Handle stop/cancel request - abort fetch, call cancel API, restore input
   */
  const handleStopRequest = useCallback(
    async (restoreCallbacks: {
      setInput: (v: string) => void;
      restoreFiles: (
        files: File[],
        uploaded: UploadedFileMetadata[],
        previews: Record<string, string>
      ) => void;
      restoreInput: (content: string) => void;
    }) => {
      isCancellingRef.current = true;
      const storedData = lastSentMessageRef.current;

      // Immediately abort the fetch request
      onStopGeneration();

      // Restore the original message
      if (storedData) {
        setTimeout(() => {
          restoreCallbacks.restoreInput(storedData.content);
          restoreCallbacks.restoreFiles(
            storedData.selectedFiles,
            storedData.uploadedFiles,
            storedData.filePreviewUrls
          );
        }, 0);
      }

      // Call cancel API
      try {
        if (sessionId ) {
          await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/chat/cancel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ session_id: sessionId }),
            credentials: "include",
          });
        }
      } catch (err) {
        console.error("Cancel request failed", err);
      }

      // Remove last messages from chat
      if (onRemoveLastMessages) {
        onRemoveLastMessages();
      }

      // Clear ref after restoration
      setTimeout(() => {
        lastSentMessageRef.current = null;
        isCancellingRef.current = false;
      }, 100);
    },
    [sessionId, onStopGeneration, onRemoveLastMessages]
  );

  /**
   * Clear stored message when generation completes successfully
   */
  const clearStoredMessage = useCallback(() => {
    if (!isCancellingRef.current) {
      lastSentMessageRef.current = null;
    }
  }, []);

  return {
    storeMessageForCancel,
    handleStopRequest,
    clearStoredMessage,
    isCancelling: isCancellingRef.current,
  };
};

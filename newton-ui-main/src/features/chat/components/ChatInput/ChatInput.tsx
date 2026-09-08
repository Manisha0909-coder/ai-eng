import React, { useEffect, useState } from "react";
import notify from "@/utils/notify";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useEmailStore } from "@/store/emailStore";
import { useLanguageStore } from "@/store/languageStore";
import { useStore } from "@/store/useStore";
import type { UploadedFileMetadata } from "@/types/message";
import { fetchUserProfile } from "@/services/user/userApi";
import { useFileUpload, useChatInputState, useStopRequest } from "../../hooks";
import { DefaultLayout } from "./layouts/DefaultLayout";

/** Last path segment for matching when API returns directories or different separators. */
function fileBasename(name: string): string {
  const n = name.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
}

/** Pair each selected file with server metadata (names may differ after sanitization). */
function resolveUploadedMetadataForSelectedFiles(
  selectedFiles: File[],
  uploadedFiles: UploadedFileMetadata[]
): UploadedFileMetadata[] {
  const valid = uploadedFiles.filter(
    (u) => typeof u.file_id === "string" && u.file_id.length > 0
  );

  const matchesLocalName = (u: UploadedFileMetadata, file: File): boolean => {
    const local = file.name;
    return (
      u.original_filename === local ||
      u.file_name === local ||
      fileBasename(u.original_filename).toLowerCase() ===
        fileBasename(local).toLowerCase() ||
      fileBasename(u.file_name).toLowerCase() ===
        fileBasename(local).toLowerCase()
    );
  };

  const used = new Set<string>();
  const ordered: UploadedFileMetadata[] = [];

  for (const file of selectedFiles) {
    const meta = valid.find((u) => !used.has(u.file_id) && matchesLocalName(u, file));
    if (meta) {
      used.add(meta.file_id);
      ordered.push(meta);
    }
  }

  if (ordered.length === selectedFiles.length) {
    return ordered;
  }

  // Same batch size but names did not match (parallel uploads / uncommon shapes).
  if (
    selectedFiles.length === valid.length &&
    selectedFiles.length > 0 &&
    ordered.length === 0
  ) {
    return valid;
  }

  return ordered;
}

export interface ChatInputProps {
  onSubmit: (
    message: string,
    fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[],
    mode?: string,
    emailContext?: {
      emailId: string;
      conversationId: string;
    },
    personaId?: number
  ) => Promise<{ content: string; formFields: any } | undefined>;
  stopSpeaking: () => void;
  setScreen: (screen: "chat" | "communication") => void;
  onStopGeneration: () => void;
  onRemoveLastMessages?: () => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  isLoading: boolean;
  onToggleUploadCard: () => void;
  width?: number;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  isLoading,
  onSubmit,
  isGenerating,
  setIsGenerating,
  onStopGeneration,
  onRemoveLastMessages,
}) => {
  // Store hooks
  const {
    activeCard,
    isReplyClicked,
    setReplyClicked,
    isReplyAllClicked,
    setReplyAllClicked,
    isForwardClicked,
    setForwardClicked,
  } = useEmailStore();
  const {
    userId,
    sessionId,
    personas,
    selectedPersonaId: storedPersonaId,
    setSelectedPersonaId: setStoreSelectedPersonaId,
    newChatType,
  } = useStore();
  const { languageType, setLanguageType } = useLanguageStore();

  // UI state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const [hasSeenTooltip, setHasSeenTooltip] = useState(false);
  const [hasUsedPersona, setHasUsedPersona] = useState(false);
  const [supportsImages, setSupportsImages] = useState(false);

  const isSmallScreen =
    typeof window !== "undefined" &&
    window.matchMedia?.("(max-width: 640px)").matches;

  // When starting a brand new chat (no session yet), lock the chat input until
  // the user has chosen a mode (Chat vs Dashboard) AND selected a persona.
  // `newChatType` is not persisted; after refresh we only have `selectedPersonaId`.
  // Infer workspace from the selected persona so the input is not stuck disabled.
  const selectedPersonaForLock = personas.find(
    (p) => p.id === storedPersonaId,
  );
  const inferredNewChatType: "analytical" | "dashboard" | null =
    selectedPersonaForLock == null
      ? null
      : selectedPersonaForLock.type === "dashboard"
        ? "dashboard"
        : "analytical";
  const effectiveNewChatType = newChatType ?? inferredNewChatType;

  const isModeNotSelected =
    !sessionId &&
    (effectiveNewChatType === null ||
      effectiveNewChatType === undefined ||
      storedPersonaId === null ||
      storedPersonaId === undefined);

  const platform = /iPhone|iPad|iPod/.test(navigator.userAgent)
    ? "iOS"
    : /Android/.test(navigator.userAgent)
    ? "Android"
    : "other";

  // Custom hooks
  const fileUpload = useFileUpload({
    userId,
    sessionId: sessionId || "",
    supportsImages,
  });
  const inputState = useChatInputState({
    languageType,
    isMobile,
  });
  const stopRequest = useStopRequest({
    sessionId: sessionId || "",
    onStopGeneration,
    onRemoveLastMessages,
  });

  const microphone = useMicrophone(languageType, false);

  // Fetch user profile to get supports_images from selected persona
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await fetchUserProfile();
        
        // Check if top-level supports_images exists
        if (profile.supports_images === true) {
          setSupportsImages(true);
          return;
        }
        
        // Check selected persona's supports_images
        if (storedPersonaId !== null && storedPersonaId !== undefined) {
          const selectedPersona = profile.personas.find(
            (p) => p.id === storedPersonaId
          );
          if (selectedPersona?.supports_images === true) {
            setSupportsImages(true);
            return;
          }
        }
        
        // Check default persona if no persona is selected
        const defaultPersona = profile.personas.find((p) => p.is_default);
        if (defaultPersona?.supports_images === true) {
          setSupportsImages(true);
          return;
        }
        
        setSupportsImages(false);
      } catch (error: any) {
        console.error("Failed to load user profile for supports_images:", error);
        
        // Log CORS errors specifically for debugging
        if (error?.isCorsError) {
          console.warn("CORS Error: Backend needs to configure CORS properly for cookie-based authentication");
        }
        
        // Default to false on error
        setSupportsImages(false);
      }
    };

    loadUserProfile();
  }, [storedPersonaId]); 

  // Shared interaction configs
  const isInteractionLocked = isGenerating || isLoading || isModeNotSelected;
  const isSubmitDisabled =
    (!inputState.input.trim() && fileUpload.selectedFiles.length === 0) ||
    isLoading ||
    isModeNotSelected;

  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const hoverMotion = {
    whileHover: { scale: isInteractionLocked ? 1 : 1.05 },
    whileTap: { scale: isInteractionLocked ? 1 : 0.97 },
    transition: { type: "spring", stiffness: 260, damping: 18, mass: 0.7 },
  };
  const fadeInQuick = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  };

  // Handle email reply/forward triggers
  useEffect(() => {
    if (isReplyClicked || isReplyAllClicked || isForwardClicked) {
      setIsGenerating(true);
      const emailContext = activeCard
        ? { emailId: activeCard.id, conversationId: activeCard.conversation_id }
        : undefined;

      const message = isReplyClicked
        ? "I want to reply to this selected email, Analyze and draft a reply email accordingly."
        : isReplyAllClicked
        ? "I want to reply all to this selected email, Analyze and draft an email accordingly."
        : "I want to forward this selected email, Analyze and draft a forward email accordingly.";

      onSubmit(message, undefined, undefined, emailContext);
      setReplyClicked(false);
      setReplyAllClicked(false);
      setForwardClicked(false);
    }
  }, [
    isReplyClicked,
    isReplyAllClicked,
    isForwardClicked,
    activeCard,
    onSubmit,
    setReplyClicked,
    setReplyAllClicked,
    setForwardClicked,
    setIsGenerating,
  ]);

  // Handle mobile resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset persona state on session change
  useEffect(() => {
    setHasUsedPersona(false);
  }, [sessionId]);

  // Update input from transcription
  useEffect(() => {
    if (microphone.transcription) {
      const currentInput = inputState.input;
      const newInput =
        currentInput + (currentInput ? " " : "") + microphone.transcription;
      inputState.setInput(newInput);
      microphone.clearTranscription();
    }
  }, [
    microphone.transcription,
    microphone.clearTranscription,
    inputState.input,
    inputState.setInput,
  ]);

  // Allow other screens (e.g., welcome suggestions) to prefill chat input.
  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      const prompt = detail?.prompt?.trim();
      if (!prompt) {
        return;
      }
      inputState.restoreInput(prompt);
      inputState.focusTextarea(platform);
    };

    window.addEventListener("chatInputPrefill", handlePrefill as EventListener);
    return () => {
      window.removeEventListener(
        "chatInputPrefill",
        handlePrefill as EventListener
      );
    };
  }, [inputState.restoreInput, inputState.focusTextarea, platform]);

  // Clear stored message when generation completes
  useEffect(() => {
    if (!isGenerating) {
      const timer = setTimeout(() => stopRequest.clearStoredMessage(), 500);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, stopRequest]);

  // Tooltip visibility timer
  useEffect(() => {
    if (!hasSeenTooltip && !isSmallScreen) {
      const timer = setTimeout(() => setHasSeenTooltip(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTooltip, isSmallScreen]);

  // Show error toast if dictation fails
  useEffect(() => {
    if (microphone.error) {
      notify.error(microphone.error);
    }
  }, [microphone.error]);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    inputState.setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Arabic key mapping
    if (inputState.handleArabicKeyDown(e)) return;

    // History navigation
    if (inputState.handleHistoryNavigation(e)) return;

    // Enter key handling
    if (inputState.handleEnterKey(e)) {
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (fileUpload.selectedFiles.length > 0) {
      const allUploaded = fileUpload.selectedFiles.every(
        (file) => fileUpload.fileUploadStates[file.name] === "uploaded"
      );
      if (!allUploaded) {
        notify.error("Please wait for all files to finish uploading.");
        return;
      }
    }

    if (!inputState.input.trim() && fileUpload.selectedFiles.length === 0)
      return;

    const originalMessage = inputState.input.trim();

    const resolvedMetas = resolveUploadedMetadataForSelectedFiles(
      fileUpload.selectedFiles,
      fileUpload.uploadedFiles
    );
    let fileMetadataToSend:
      | UploadedFileMetadata
      | UploadedFileMetadata[]
      | undefined;
    if (resolvedMetas.length === 0) {
      fileMetadataToSend = undefined;
    } else if (resolvedMetas.length === 1) {
      fileMetadataToSend = resolvedMetas[0];
    } else {
      fileMetadataToSend = resolvedMetas;
    }

    if (
      fileUpload.selectedFiles.length > 0 &&
      (fileMetadataToSend === undefined ||
        (Array.isArray(fileMetadataToSend) &&
          fileMetadataToSend.length === 0) ||
        (!Array.isArray(fileMetadataToSend) &&
          typeof fileMetadataToSend.file_id === "string" &&
          fileMetadataToSend.file_id.length === 0) ||
        (Array.isArray(fileMetadataToSend) &&
          fileMetadataToSend.some(
            (m) => typeof m.file_id !== "string" || m.file_id.length === 0
          )))
    ) {
      notify.error(
        "Could not attach your files to this message. Remove them and try uploading again."
      );
      return;
    }

    const rawPersonaId =
      !hasUsedPersona &&
      storedPersonaId !== null &&
      storedPersonaId !== undefined
        ? storedPersonaId
        : undefined;
    const personaIdForRequest =
      typeof rawPersonaId === "number" && !Number.isNaN(rawPersonaId)
        ? rawPersonaId
        : undefined;

    // Store for potential cancel restoration
    stopRequest.storeMessageForCancel({
      content: originalMessage,
      fileMetadata: fileMetadataToSend,
      mode: undefined,
      selectedFiles: [...fileUpload.selectedFiles],
      uploadedFiles: [...fileUpload.uploadedFiles],
      filePreviewUrls: { ...fileUpload.filePreviewUrls },
    });

    // Clear input
    inputState.resetInput();
    inputState.addToHistory(originalMessage);

    // Build email context
    const emailContext = activeCard
      ? { emailId: activeCard.id, conversationId: activeCard.conversation_id }
      : undefined;

    setHasUsedPersona(true);

    onSubmit(
      originalMessage,
      fileMetadataToSend,
      undefined,
      emailContext,
      personaIdForRequest
    );

    if (personaIdForRequest !== undefined) {
      setTimeout(() => setStoreSelectedPersonaId(null), 0);
    }

    fileUpload.clearFiles();
    inputState.focusTextarea(platform);
  };

  const handleStopRequest = () => {
    stopRequest.handleStopRequest({
      setInput: inputState.setInput,
      restoreFiles: fileUpload.restoreFiles,
      restoreInput: inputState.restoreInput,
    });
  };

  const handleLanguageToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (languageType === "EN") {
      setLanguageType("AR");
      notify.success("Switched to Arabic Mode");
    } else {
      setLanguageType("EN");
      notify.success("Switched to English Mode");
    }
  };

  // Shared layout props
  const layoutProps = {
    input: inputState.input,
    setInput: inputState.setInput,
    textareaRef: inputState.textareaRef,
    languageType,
    isMobile,
    isSmallScreen,
    selectedFiles: fileUpload.selectedFiles,
    filePreviewUrls: fileUpload.filePreviewUrls,
    fileUploadStates: fileUpload.fileUploadStates,
    fileInputRef: fileUpload.fileInputRef,
    isDragOver: fileUpload.isDragOver,
    onFileSelect: fileUpload.handleFileSelect,
    onFileRemove: fileUpload.handleFileRemove,
    onFileUpload: fileUpload.handleFileUpload,
    onDragOver: fileUpload.handleDragOver,
    onDragLeave: fileUpload.handleDragLeave,
    onDrop: fileUpload.handleDrop,
    onInputChange: handleInputChange,
    onKeyDown: handleKeyDown,
    onSubmit: handleSubmit,
    // Propagate mode lock into layout-level disabled states
    isGenerating: isGenerating || isModeNotSelected,
    isLoading: isLoading || isModeNotSelected,
    isSubmitDisabled: isSubmitDisabled || isModeNotSelected,
    sessionId: sessionId || "",
    onStopRequest: handleStopRequest,
    isRecording: microphone.recordingState === "recording",
    isProcessing: microphone.recordingState === "processing",
    isConfirming: microphone.recordingState === "confirming",
    audioLevel: microphone.audioLevel,
    onStartRecording: microphone.startRecording,
    onStopRecording: microphone.stopRecording,
    onConfirmRecording: microphone.confirmAndProcess,
    onCancelRecording: microphone.cancelTranscription,
    onLanguageToggle: handleLanguageToggle,
    showFileUploadWarning: fileUpload.showFileUploadWarning,
    fileWarningMessage: fileUpload.fileWarningMessage,
    hoverMotion,
    fadeInQuick,
    focusRingClass,
    hasSeenTooltip,
    supportsImages,
  };

  return (
    <div>
      <DefaultLayout {...layoutProps} />
    </div>
  );
};

export default ChatInput;

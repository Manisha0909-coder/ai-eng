import React from "react";
import { Message, UploadedFileMetadata } from "@/types/message";

export interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export type FileUploadState = "uploading" | "uploaded" | "pending" | "processing";

export interface Attachment {
  static_path?: string;
  preview?: string;
  mimetype?: string;
  type?: string;
  original_filename?: string;
  name?: string;
}

export interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className: string;
  staticPath?: string;
  fallbackSrc?: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  style?: React.CSSProperties;
}

export interface ChatMessageProps {
  message: Message;
  formFields: any;
  onEditMessage?: (
    messageId: string,
    newContent: string,
    fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[],
  ) => void;
  isLoading?: boolean;
  speakText?: (text: string) => Promise<void>;
  stopSpeaking?: () => void;
  isSpeaking?: boolean;
  isLoadingTTS?: boolean;
  isReadOnly?: boolean;
  /** When true, user message edit is disabled until the assistant finishes (typing or streaming). */
  disableEditUntilResponseComplete?: boolean;
  onRetry?: (messageId: string) => void;
  /** Called once when all forms in this message are submitted; used to send a follow-up prompt to /create API */
  onAllFormsSubmitted?: () => void;
}

export interface LoadingMessageProps {
  message: Message;
  markdownProps: any;
}

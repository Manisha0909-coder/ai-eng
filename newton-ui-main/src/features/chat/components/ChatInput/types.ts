export type FileUploadState =
  | "uploading"
  | "uploaded"
  | "pending"
  | "processing";

export interface ChatInputLayoutProps {
  // Input state
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  languageType: "EN" | "AR";
  isMobile: boolean;
  isSmallScreen: boolean;

  // File upload
  selectedFiles: File[];
  filePreviewUrls: Record<string, string>;
  fileUploadStates: Record<string, FileUploadState>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isDragOver: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileRemove: (fileName: string) => void;
  onFileUpload: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;

  // Input handlers
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;

  // Generation state
  isGenerating: boolean;
  isLoading: boolean;
  isSubmitDisabled: boolean;
  sessionId: string;
  onStopRequest: () => void;

  // Microphone/dictation
  isRecording: boolean;
  isProcessing: boolean;
  isConfirming: boolean;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onConfirmRecording: () => void;
  onCancelRecording: () => void;

  // Language/theme
  onLanguageToggle: (e: React.MouseEvent) => void;

  // File warning
  showFileUploadWarning: boolean;
  fileWarningMessage: string;

  // Motion configs
  hoverMotion: object;
  fadeInQuick: object;
  focusRingClass: string;

  // Tooltip
  hasSeenTooltip: boolean;

  // Image upload support
  supportsImages?: boolean;
}

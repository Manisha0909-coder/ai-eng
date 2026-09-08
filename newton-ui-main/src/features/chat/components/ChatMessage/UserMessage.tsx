import axios from "axios";
import {
  CheckCircle,
  FileText,
  Globe,
  Image,
  Loader2,
  Mic,
  PencilIcon,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { motion } from "framer-motion";
import notify from "@/utils/notify";
import { API_CONFIG } from "@/config/api";
import { useMicrophone } from "@/hooks/useMicrophone";
import { fetchUserProfile } from "@/services/user/userApi";
import { useLanguageStore } from "@/store/languageStore";
import { useStore } from "@/store/useStore";
import { CopyButton } from "@/components/ui/copy-button";
import { ARABIC_KEY_MAP } from "@/utils/arabicKeyMap";
import { Message, UploadedFileMetadata } from "@/types/message";
import {
  isImageFile,
  MAX_CHAT_IMAGES,
} from "@/utils/chatImageUpload";
import { fileUrl } from "@/utils/fileStaticPath";
import { parseUploadResponsePayload } from "@/features/chat/hooks/useFileUpload";
import { decodeUnicodeEscapes } from "./utils";
import { MSG_ACTION_BTN } from "./actionButton";
import MessageAttachments from "./MessageAttachments";
import type { Attachment, FileUploadState } from "./types";

interface UserMessageProps {
  message: Message;
  onEditMessage?: (
    messageId: string,
    newContent: string,
    fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[],
  ) => void;
  isReadOnly?: boolean;
  disableEditUntilResponseComplete?: boolean;
  isChatShare: boolean;
}

const UserMessage: React.FC<UserMessageProps> = ({
  message,
  onEditMessage,
  isReadOnly = false,
  disableEditUntilResponseComplete = false,
  isChatShare,
}) => {
  const { languageType, setLanguageType } = useLanguageStore();
  const isViewingArchivedSession = useStore((s) => s.isViewingArchivedSession);
  const selectedPersonaId = useStore((s) => s.selectedPersonaId);
  const [supportsImages, setSupportsImages] = useState(false);

  const {
    recordingState,
    transcription,
    audioLevel,
    startRecording,
    confirmAndProcess,
    cancelTranscription,
  } = useMicrophone(languageType);
  const [isComposing, setIsComposing] = useState(false);

  const isRecording = recordingState === "recording";
  const isProcessing = recordingState === "processing";

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [editImages, setEditImages] = useState(message.attachments);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const [, setEditingMessageId] = useState<string | null>(null);

  // Stable content tracking (mirror original behavior)
  const [stableContent, setStableContent] = useState(message.content || "");

  // File picker / upload state
  const [selectededitfiles, setSelectededitfiles] = useState<File[]>([]);
  const [deletedFileRefs, setDeletedFileRefs] = useState<string[]>([]);
  const fileInputeditRef = useRef<HTMLInputElement>(null);
  /** Synced with selectededitfiles so back-to-back file picks can't exceed the image cap */
  const editSelectedImageCountRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [, setFileWarningMessage] = useState("");
  const [, setShowFileUploadWarning] = useState(false);
  const [fileUploadStates, setFileUploadStates] = useState<{
    [fileName: string]: FileUploadState;
  }>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileMetadata[]>(
    [],
  );
  const [filePreviewUrls, setFilePreviewUrls] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    editSelectedImageCountRef.current = selectededitfiles.filter(
      isImageFile,
    ).length;
  }, [selectededitfiles]);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await fetchUserProfile();

        if (profile.supports_images === true) {
          setSupportsImages(true);
          return;
        }

        if (selectedPersonaId !== null && selectedPersonaId !== undefined) {
          const selectedPersona = profile.personas.find(
            (p) => p.id === selectedPersonaId,
          );
          if (selectedPersona?.supports_images === true) {
            setSupportsImages(true);
            return;
          }
        }

        const defaultPersona = profile.personas.find((p) => p.is_default);
        if (defaultPersona?.supports_images === true) {
          setSupportsImages(true);
          return;
        }

        setSupportsImages(false);
      } catch {
        setSupportsImages(false);
      }
    };

    loadUserProfile();
  }, [selectedPersonaId]);

  const handleLanguageSwitch = useCallback(() => {
    const newLanguage = languageType === "EN" ? "AR" : "EN";
    setLanguageType(newLanguage);

    // Update textarea direction and alignment immediately
    if (editInputRef.current) {
      editInputRef.current.style.textAlign =
        newLanguage === "AR" ? "right" : "left";
      editInputRef.current.style.direction =
        newLanguage === "AR" ? "rtl" : "ltr";
    }
    // Focus back on textarea
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 100);
  }, [languageType, setLanguageType]);

  useEffect(() => {
    if (transcription && transcription.trim() !== "") {
      // Append new transcription to existing editContent
      setEditContent((prevContent) => {
        // Avoid duplicating the same transcription
        if (prevContent.endsWith(transcription)) {
          return prevContent;
        }
        // Add space if there's existing content
        return (
          prevContent + (prevContent ? " " + transcription : transcription)
        );
      });
    }
  }, [transcription]);

  // Better useEffect for updating editImages
  useEffect(() => {
    if (message.content !== stableContent) {
      setStableContent(message.content || "");
    }

    // Better comparison for attachments
    if (message.attachments) {
      const currentAttachments = message.attachments || [];
      const currentEditImages = editImages || [];

      // Compare based on unique identifiers (original_filename or name)
      const currentIds = currentAttachments
        .map((a) => a.original_filename || a.name)
        .sort();
      const editIds = currentEditImages
        .map((a) => a.original_filename || a.name)
        .sort();

      if (JSON.stringify(currentIds) !== JSON.stringify(editIds)) {
        setEditImages([...currentAttachments]);
      }
    }
  }, [message.content, message.attachments, stableContent, editImages]);

  // Stable content updates - second effect (preserved for behavioral parity)
  useEffect(() => {
    if (message.content !== stableContent) {
      setStableContent(message.content || "");
    }

    if (
      message.attachments &&
      JSON.stringify(message.attachments) !== JSON.stringify(editImages)
    ) {
      setEditImages(message.attachments);
    }
  }, [message.content, message.attachments, stableContent, editImages]);

  // Check if there are any changes in edit mode
  const hasChanges = useMemo(() => {
    if (!isEditing) return false;

    const contentChanged =
      editContent.trim() !== (message.content || "").trim();

    const retainedAttachments = (message.attachments || []).filter(
      (att) => !deletedFileRefs.includes(att.original_filename ?? att.name),
    );
    const allAttachments = [...retainedAttachments, ...uploadedFiles];
    const attachmentsChanged =
      JSON.stringify(
        allAttachments
          .map((a) => a.original_filename ?? (a as any).name)
          .sort(),
      ) !==
      JSON.stringify(
        (message.attachments || [])
          .map((a) => a.original_filename ?? (a as any).name)
          .sort(),
      );

    return contentChanged || attachmentsChanged;
  }, [
    isEditing,
    editContent,
    message.content,
    message.attachments,
    deletedFileRefs,
    uploadedFiles,
  ]);

  const handleFileUpload = () => {
    fileInputeditRef.current?.click();
  };

  const handleFileRemove = useCallback((fileName: string) => {
    setDeletedFileRefs((prev) => [...prev, fileName]);
    setSelectededitfiles((prev) =>
      prev.filter((file) => file.name !== fileName),
    );
    setUploadedFiles((prev) =>
      prev.filter((file) => file.original_filename !== fileName),
    );
    setEditImages((prev) =>
      (prev ?? []).filter(
        (att) => att.original_filename !== fileName && att.name !== fileName,
      ),
    );

    setFilePreviewUrls((prev) => {
      const newUrls = { ...prev };
      delete newUrls[fileName];
      return newUrls;
    });
    setFileUploadStates((prev) => {
      const newStates = { ...prev };
      delete newStates[fileName];
      return newStates;
    });
  }, []);

  // Drag and drop functionality
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const checkFileCompatibility = (file: File) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".tiff",
      ".tif",
    ];
    const hasAllowedExtension = allowedExtensions.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasAllowedExtension) {
      return {
        compatible: false,
        message: `File type "${fileName}" is not supported. Please upload only JPG, JPEG, PNG, GIF, BMP, TIFF, or TIF images.`,
      };
    }

    // Check file size limits (ChatGPT-like limits)
    const maxSize = 20 * 1024 * 1024; // 20MB for most files
    const maxImageSize = 20 * 1024 * 1024; // 20MB for images

    if (fileType.startsWith("image/") && file.size > maxImageSize) {
      return {
        compatible: false,
        message: "Image file is too large. Please use an image under 20MB.",
      };
    }

    if (file.size > maxSize) {
      return {
        compatible: false,
        message: "File is too large. Please use a file under 50MB.",
      };
    }

    return { compatible: true, message: "" };
  };

  const handleUploadToBe = async (file: File) => {
    const sessionId = useStore.getState().sessionId || "";
    setFileUploadStates((prev) => ({ ...prev, [file.name]: "uploading" }));

    const fileData = new FormData();
    fileData.append("file", file);
    fileData.append("session_id", sessionId);
    fileData.append("user_id", useStore.getState().userId || "");
    fileData.append("file_name", file.name);
    fileData.append("file_type", file.type);
    fileData.append("file_size", file.size.toString());

    const uploadUrl = `${API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "")}/files/images/upload`;

    try {
      const response = await axios.post(uploadUrl, fileData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      const parsed = parseUploadResponsePayload(response.data, file);
      if (!parsed) {
        notify.error("Upload succeeded but server did not return a file URL.");
        setSelectededitfiles((prev) => prev.filter((f) => f !== file));
        setFileUploadStates((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
        return;
      }

      const { metadata: uploadedFileMetadata, rawStaticPath } = parsed;

      setUploadedFiles((prev) => [...prev, uploadedFileMetadata]);
      if (isImageFile(file)) {
        const previewUrl = fileUrl(rawStaticPath);
        setFilePreviewUrls((prev) => ({
          ...prev,
          [file.name]: previewUrl,
        }));
      }
      setFileUploadStates((prev) => ({ ...prev, [file.name]: "uploaded" }));
    } catch (error) {
      notify.error("Error uploading file");
      setSelectededitfiles((prev) => prev.filter((f) => f !== file));

      setFileUploadStates((prev) => {
        const newStates = { ...prev };
        delete newStates[file.name];
        return newStates;
      });
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    const newFilePreviewUrls: { [key: string]: string } = {};
    let imageCount = editSelectedImageCountRef.current;
    let skippedDueToImageLimit = false;

    newFiles.forEach((file) => {
      if (isImageFile(file) && imageCount >= MAX_CHAT_IMAGES) {
        skippedDueToImageLimit = true;
        return;
      }

      const compatibilityCheck = checkFileCompatibility(file);

      if (!compatibilityCheck.compatible) {
        setFileWarningMessage(compatibilityCheck.message);
        setShowFileUploadWarning(true);
        setTimeout(() => setShowFileUploadWarning(false), 5000);
        return;
      }

      if (isImageFile(file)) {
        imageCount += 1;
      }

      validFiles.push(file);

      setFileUploadStates((prev) => ({ ...prev, [file.name]: "pending" }));

      handleUploadToBe(file);

      if (isImageFile(file)) {
        const reader = new FileReader();

        reader.onload = (event) => {
          const img = document.createElement("img");

          img.onload = () => {
            if (img.width > 8000 || img.height > 8000) {
              setFileWarningMessage(
                `Image dimensions are too large (${img.width}x${img.height}). Please use an image under 8000x8000 pixels.`,
              );
              setShowFileUploadWarning(true);
              setTimeout(() => setShowFileUploadWarning(false), 4000);
              return;
            }

            newFilePreviewUrls[file.name] = event.target?.result as string;
            setFilePreviewUrls((prev) => ({
              ...prev,
              ...newFilePreviewUrls,
            }));
          };

          img.onerror = () => {
            setFileWarningMessage(
              "Could not load image. The file may be corrupted.",
            );
            setShowFileUploadWarning(true);
            setTimeout(() => setShowFileUploadWarning(false), 4000);
          };

          img.src = event.target?.result as string;
        };

        reader.readAsDataURL(file);
      } else if (file.type === "application/pdf") {
        newFilePreviewUrls[file.name] = "/pdf-icon.png";
        setFilePreviewUrls((prev) => ({ ...prev, ...newFilePreviewUrls }));
      } else {
        newFilePreviewUrls[file.name] = "/file-icon.png";
        setFilePreviewUrls((prev) => ({ ...prev, ...newFilePreviewUrls }));
      }
    });

    if (skippedDueToImageLimit) {
      notify.error(`You can attach up to ${MAX_CHAT_IMAGES} images.`);
    }

    if (validFiles.length > 0) {
      editSelectedImageCountRef.current = imageCount;
      setSelectededitfiles((prev) => [...prev, ...validFiles]);
    }

    if (fileInputeditRef.current) fileInputeditRef.current.value = "";
  };

  // Handle edit start
  const handleEditStart = useCallback(() => {
    setEditingMessageId(message.message_id as string);
    setIsEditing(true);
    setEditContent(message.content);
    setEditImages(message.attachments);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.setSelectionRange(
        message.content?.length || 0,
        message.content?.length || 0,
      );
    }, 0);
  }, [message.content, message.attachments, editContent, message.message_id]);

  // Handle edit cancel
  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
    setEditImages(message.attachments || []);
    editSelectedImageCountRef.current = 0;
    setSelectededitfiles([]);
    setFileUploadStates({});
    setFilePreviewUrls({});
    setDeletedFileRefs([]);
    setLanguageType("EN");
  }, [message.content, message.attachments, message]);

  useEffect(() => {
    if (disableEditUntilResponseComplete && isEditing) {
      handleEditCancel();
    }
  }, [disableEditUntilResponseComplete, isEditing, handleEditCancel]);

  const handleEditSave = useCallback(() => {
    const retainedAttachments = (message.attachments || []).filter(
      (att) => !deletedFileRefs.includes(att.original_filename ?? att.name),
    );
    const allAttachments = [...retainedAttachments, ...uploadedFiles];
    const fileMetadataToSend =
      allAttachments.length > 0 ? allAttachments : undefined;
    // Only call onEditMessage if content or attachments changed
    if (
      (editContent.trim() &&
        editContent !== message.content &&
        onEditMessage) ||
      JSON.stringify(
        allAttachments.map((a) => a.original_filename ?? (a as any).name),
      ) !==
        JSON.stringify(
          (message.attachments || []).map(
            (a) => a.original_filename ?? (a as any).name,
          ),
        )
    ) {
      // Use message_id if available, otherwise fallback to frontend id for first message in new chat
      const messageIdToUse = message.message_id || message.id;
      onEditMessage?.(
        messageIdToUse as string,
        editContent.trim(),
        fileMetadataToSend as UploadedFileMetadata[] | undefined,
      );
    }
    setUploadedFiles([]);
    setIsEditing(false);
    editSelectedImageCountRef.current = 0;
    setSelectededitfiles([]);
    setFileUploadStates({});
    setFilePreviewUrls({});
    setDeletedFileRefs([]);
  }, [
    uploadedFiles,
    editContent,
    message.content,
    message.message_id,
    message.attachments,
    onEditMessage,
    deletedFileRefs,
    message,
  ]);

  // Enhanced handleKeyDown for edit mode
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Arabic key mapping when in Arabic mode - EXACTLY LIKE YOUR CHAT INPUT
      if (languageType === "AR" && !isComposing) {
        const isCharacterKey =
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey;

        if (isCharacterKey && ARABIC_KEY_MAP[e.key]) {
          e.preventDefault();

          const textarea = e.target as HTMLTextAreaElement;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const arabicChar = ARABIC_KEY_MAP[e.key];

          const newValue =
            editContent.substring(0, start) +
            arabicChar +
            editContent.substring(end);
          setEditContent(newValue);

          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              start + arabicChar.length;
          }, 0);

          return;
        }
      }

      switch (e.key) {
        case "Enter":
          if (!e.shiftKey) {
            e.preventDefault();
            if (hasChanges) {
              handleEditSave();
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          handleEditCancel();
          break;
        case "Tab":
          e.preventDefault();
          const textarea = e.target as HTMLTextAreaElement;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          setEditContent(
            editContent.substring(0, start) +
              "\t" +
              editContent.substring(end),
          );
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          }, 0);
          break;
      }
    },
    [
      languageType,
      isComposing,
      editContent,
      handleEditSave,
      handleEditCancel,
      hasChanges,
    ],
  );

  // Hydrate selectededitfiles from existing attachments when entering edit mode
  useEffect(() => {
    if (
      isEditing &&
      Array.isArray(message.attachments) &&
      message.attachments.length > 0
    ) {
      const fetchFiles = async () => {
        const filePromises = message.attachments?.map(async (att) => {
          try {
            if (!att.static_path) {
              return null;
            }
            const url = fileUrl(att.static_path);

            const response = await axios.get(url, {
              withCredentials: true,
              responseType: "blob",
            });

            const file = new File(
              [response.data],
              att.original_filename || att.name,
              {
                type:
                  response.headers["content-type"] ||
                  att.mimetype ||
                  att.type ||
                  "application/octet-stream",
              },
            );

            const previewUrl = URL.createObjectURL(file);

            setFilePreviewUrls((prev) => ({
              ...prev,
              [file.name]: previewUrl,
            }));

            setFileUploadStates((prev) => ({
              ...prev,
              [file.name]: "uploaded",
            }));
            return file;
          } catch (err) {
            return null;
          }
        });
        const files = filePromises
          ? (await Promise.all(filePromises)).filter(
              (file): file is File => file !== null,
            )
          : [];
        setSelectededitfiles(files);
      };
      fetchFiles();
    }
  }, [
    isEditing,
    message.attachments,
    setFilePreviewUrls,
    setSelectededitfiles,
  ]);

  const expandedImage: Attachment | null = null;

  const userMessageContent = useMemo(() => {
    return (
      <div className={`flex justify-end mb-4 group`} dir="ltr">
        <div
          className={`flex items-start gap-2 sm:gap-2 my-1 mb-4 ${
            isEditing ? "w-full max-w-2xl" : "max-w-[70%]"
          }`}
        >
          <div className="flex flex-col items-end flex-1 min-w-0">
            {!isEditing &&
              !expandedImage &&
              message.attachments &&
              message.attachments.length > 0 && (
                <div className="mb-1 w-full flex flex-col items-end">
                  <MessageAttachments
                    attachments={message.attachments as Attachment[]}
                  />
                </div>
              )}
            <div
              className={`flex flex-col items-end w-full ${
                isEditing ? "" : "max-w-lg"
              }`}
            >
              <div
                dir={isEditing ? undefined : "auto"}
                className={
                  isEditing
                    ? "w-full rounded-[10px] p-3"
                    : `w-full user-message rounded-2xl rounded-tr-sm border px-4 py-3${
                        message.isHighlighted
                          ? " bg-status-error/10 border-status-error/20"
                          : " bg-primary/10 border-primary/20"
                      }`
                }
              >
                {isEditing ? (
                  <form className="w-full">
                    <input
                      type="file"
                      ref={fileInputeditRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif"
                      multiple
                    />

                    {selectededitfiles.length > 0 && (
                      <div className="mb-2 p-2 rounded-lg bg-surface/50 border border-border-main">
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {selectededitfiles.map((file, index) => (
                            <div
                              key={`${file.name}-${file.lastModified}-${index}`}
                              className="flex items-center bg-surface-2 rounded-lg p-1 sm:p-2 max-w-full"
                            >
                              {filePreviewUrls[file.name]?.startsWith(
                                "data:image",
                              ) ? (
                                <img
                                  src={filePreviewUrls[file.name]}
                                  alt={file.name}
                                  className="h-6 w-6 sm:h-8 sm:w-8 object-cover rounded mr-1 sm:mr-2"
                                />
                              ) : file.type === "application/pdf" ? (
                                <FileText
                                  size={14}
                                  className="text-status-error mr-1 sm:mr-2 sm:size-4"
                                />
                              ) : file.type.startsWith("image/") ? (
                                <FileText
                                  size={14}
                                  className="text-primary mr-1 sm:mr-2 sm:size-4"
                                />
                              ) : (
                                <FileText
                                  size={14}
                                  className="text-text-muted mr-1 sm:mr-2 sm:size-4"
                                />
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-center">
                                <span className="text-xs text-text-main truncate max-w-[80px] sm:max-w-[120px]">
                                  {file.name}
                                </span>
                                <span className="text-xs text-text-muted sm:ml-1">
                                  ({(file.size / 1024).toFixed(1)}KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleFileRemove(file.name)}
                                className="text-text-muted hover:text-text-main p-1 rounded-full hover:bg-surface ml-1 sm:ml-2"
                              >
                                <Trash2 size={16} className="sm:size-4" />
                              </button>
                              <div className="flex items-center ml-1 sm:ml-2">
                                {fileUploadStates[file.name] ===
                                  "uploading" && (
                                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-primary" />
                                )}
                                {fileUploadStates[file.name] === "uploaded" && (
                                  <CheckCircle
                                    size={16}
                                    className="text-status-success sm:size-4"
                                  />
                                )}
                                {(!fileUploadStates[file.name] ||
                                  fileUploadStates[file.name] === "pending") && (
                                  <div className="w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-status-warning rounded-full animate-pulse" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className={`w-full rounded-2xl rounded-tr-sm border border-primary/40 bg-input-bg transition-colors focus-within:ring-1 focus-within:ring-primary/50 ${
                        isDragOver ? "ring-1 ring-primary/50 bg-primary/5" : ""
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      <textarea
                        ref={editInputRef}
                        name="editchat"
                        id="editchat"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={(e) => {
                          setIsComposing(false);
                          setEditContent(e.currentTarget.value);
                        }}
                        placeholder={
                          languageType === "AR"
                            ? "قم بتحرير رسالتك..."
                            : "Edit your message..."
                        }
                        rows={3}
                        className="w-full bg-transparent border-none px-4 pt-3 pb-2 text-base text-text-main resize-none overflow-y-auto themed-placeholder focus:outline-none"
                        style={{
                          textAlign: languageType === "AR" ? "right" : "left",
                          direction: languageType === "AR" ? "rtl" : "ltr",
                          minHeight: "44px",
                          maxHeight: "160px",
                        }}
                      />

                    <div className="flex items-center justify-between px-2 pb-2 gap-2">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={handleLanguageSwitch}
                          className="flex items-center justify-center h-7 px-2 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
                          data-tooltip-id="edit-lang-tooltip"
                        >
                          <Globe size={14} />
                          <span className="text-xs font-medium ml-1">
                            {languageType === "EN" ? "EN" : "AR"}
                          </span>
                        </button>

                        {supportsImages && (
                          <button
                            type="button"
                            onClick={handleFileUpload}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
                            aria-label="Upload image"
                          >
                            <Image size={14} />
                          </button>
                        )}

                        <div className="relative">
                          {isRecording || isProcessing ? (
                            <motion.div
                              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-surface-2"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2 }}
                              style={{ contain: "layout" }}
                            >
                              <motion.div
                                className="flex items-center gap-0.5"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                                style={{
                                  contain: "layout",
                                  height: "20px",
                                  alignItems: "center",
                                }}
                              >
                                {[
                                  {
                                    baseHeight: 3,
                                    variance: 8,
                                    delay: 0,
                                  },
                                      {
                                        baseHeight: 6,
                                        variance: 12,
                                        delay: 0.1,
                                      },
                                      {
                                        baseHeight: 9,
                                        variance: 16,
                                        delay: 0.2,
                                      },
                                      {
                                        baseHeight: 6,
                                        variance: 12,
                                        delay: 0.1,
                                      },
                                      {
                                        baseHeight: 3,
                                        variance: 8,
                                        delay: 0,
                                      },
                                ].map((bar, i) => (
                                  <motion.div
                                    key={i}
                                    className="w-1 rounded-full bg-primary"
                                    style={{
                                      contain: "layout",
                                      maxHeight: "20px",
                                      alignSelf: "center",
                                    }}
                                    animate={
                                      isProcessing
                                        ? {
                                            height: [
                                              bar.baseHeight + 4,
                                              bar.baseHeight + 8,
                                              bar.baseHeight + 4,
                                            ],
                                          }
                                        : {
                                            height: [
                                              bar.baseHeight +
                                                audioLevel * bar.variance * 0.4,
                                              bar.baseHeight +
                                                bar.variance +
                                                audioLevel * bar.variance * 0.6,
                                              bar.baseHeight +
                                                audioLevel * bar.variance * 0.4,
                                            ],
                                          }
                                    }
                                    transition={{
                                      duration: 0.8,
                                      repeat: Infinity,
                                      delay: bar.delay,
                                      ease: [0.4, 0, 0.6, 1],
                                    }}
                                  />
                                ))}
                              </motion.div>

                              <div className="flex items-center gap-1">
                                {!isProcessing && (
                                  <motion.button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      cancelTranscription();
                                    }}
                                    className="h-6 w-6 flex items-center justify-center rounded-full bg-text-muted/30 hover:bg-text-muted/50 transition-all"
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <X size={12} className="w-3 h-3 text-text-main" />
                                  </motion.button>
                                )}
                                <motion.button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isProcessing) return;
                                    confirmAndProcess();
                                  }}
                                  className="h-6 w-6 flex items-center justify-center rounded-full bg-primary/80 hover:bg-primary transition-all disabled:opacity-50"
                                  whileTap={{ scale: 0.95 }}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2
                                      size={12}
                                      className="w-3 h-3 text-background animate-spin"
                                    />
                                  ) : (
                                    <CheckCircle
                                      size={12}
                                      className="w-3 h-3 text-background"
                                    />
                                  )}
                                </motion.button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.button
                              type="button"
                              onClick={startRecording}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
                              disabled={isProcessing}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Mic size={14} />
                            </motion.button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleEditCancel}
                          className="h-7 px-3 rounded-lg text-xs border border-border-main text-text-muted hover:bg-surface-2 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleEditSave}
                          disabled={!hasChanges}
                          className="h-7 px-3 rounded-lg text-xs bg-primary text-white dark:text-background hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    </div>
                  </form>
                ) : (
                  <>
                    {message.content && (
                      <div className="text-base leading-relaxed break-words whitespace-pre-wrap text-text-main">
                        {decodeUnicodeEscapes(message.content)}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Buttons positioned below the message box */}
              {!isEditing && (
                <div className="flex items-center gap-1 mt-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity w-full">
                  {message.content && (
                    <CopyButton
                      text={decodeUnicodeEscapes(message.content)}
                      iconSize={14}
                      iconClassName=""
                      className={MSG_ACTION_BTN}
                    />
                  )}

                  {!isChatShare &&
                    !isReadOnly &&
                    !isViewingArchivedSession && (
                    <button
                      type="button"
                      disabled={
                        message.isStreaming ||
                        disableEditUntilResponseComplete
                      }
                      title={
                        disableEditUntilResponseComplete
                          ? "Wait for the assistant to finish responding"
                          : "Edit"
                      }
                      aria-label="Edit message"
                      className={`${MSG_ACTION_BTN} disabled:opacity-40 disabled:pointer-events-none`}
                      onClick={handleEditStart}
                    >
                      <PencilIcon size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {!isChatShare && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm flex-shrink-0"
              style={{
                border: "0px solid var(--color-primary)",
                borderRadius: "9999px",
              }}
            >
              <User className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      </div>
    );
  }, [
    message.type,
    message.content,
    message.attachments,
    filePreviewUrls,
    fileUploadStates,
    uploadedFiles,
    handleFileSelect,
    isDragOver,
    isProcessing,
    isRecording,
    languageType,
    selectededitfiles,
    setLanguageType,
    startRecording,
    message.isStreaming,
    isEditing,
    editContent,
    handleEditStart,
    handleEditSave,
    handleEditCancel,
    hasChanges,
    disableEditUntilResponseComplete,
    isViewingArchivedSession,
    isChatShare,
    isReadOnly,
    supportsImages,
  ]);

  return <>{userMessageContent}</>;
};

export default UserMessage;

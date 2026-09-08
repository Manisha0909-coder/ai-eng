import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import notify from "@/utils/notify";
import { API_CONFIG } from "@/config/api";
import type { UploadedFileMetadata } from "@/types/message";
import type { FileUploadState } from "../components/ChatInput/types";
import {
  MAX_CHAT_IMAGES,
  isImageFile,
} from "@/utils/chatImageUpload";
import { fileUrl, middlewareFilePath } from "@/utils/fileStaticPath";

const localApiBase = API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "");

// Supported file types for ChatGPT-like functionality
const SUPPORTED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  // Office documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  // Code files
  "text/javascript",
  "text/typescript",
  "text/css",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  // Other
  "application/zip",
  "application/x-zip-compressed",
];

const CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".css",
  ".html",
  ".xml",
  ".json",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".php",
  ".rb",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".scala",
  ".r",
  ".m",
  ".sql",
  ".sh",
  ".bash",
  ".ps1",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".config",
  ".env",
  ".md",
  ".txt",
  ".csv",
  ".log",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for most files
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB for images
const MAX_IMAGE_DIMENSION = 8000;

interface UseFileUploadOptions {
  userId: string;
  sessionId: string;
  supportsImages?: boolean;
}

interface FileCompatibilityResult {
  compatible: boolean;
  message: string;
}

/** API may return snake_case or camelCase; optional nested `data` wrapper (same as ChatMessage upload). */
function unwrapUploadResponseBody(raw: unknown): unknown {
  if (
    raw &&
    typeof raw === "object" &&
    "data" in (raw as object) &&
    (raw as Record<string, unknown>).data !== undefined &&
    typeof (raw as Record<string, unknown>).data === "object"
  ) {
    return (raw as Record<string, unknown>).data;
  }
  return raw;
}

/** Backend may wrap file rows as `{ files: [ { file_id, ... } ] }` after one `data` unwrap. */
function extractSingleFilePayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (Array.isArray(o.files) && o.files.length > 0) {
    const first = o.files[0];
    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }
    return null;
  }

  if (o.file && typeof o.file === "object") {
    return o.file as Record<string, unknown>;
  }

  if (
    o.file_id != null ||
    o.fileId != null ||
    o.static_path != null ||
    o.staticPath != null
  ) {
    return o;
  }

  return null;
}

export function parseUploadResponsePayload(
  raw: unknown,
  file: File
): { metadata: UploadedFileMetadata; rawStaticPath: string } | null {
  const inner = unwrapUploadResponseBody(raw);
  const payload =
    extractSingleFilePayload(inner) ?? extractSingleFilePayload(raw);
  if (!payload) {
    return null;
  }

  const rawStaticPath =
    (typeof payload.static_path === "string" && payload.static_path) ||
    (typeof payload.staticPath === "string" && payload.staticPath) ||
    "";

  const file_id = String(
    payload.file_id ?? payload.fileId ?? payload.id ?? ""
  ).trim();

  const original_filename = String(
    payload.original_filename ??
      payload.originalFilename ??
      file.name
  );

  const file_name = String(
    payload.file_name ?? payload.fileName ?? original_filename
  );

  const mimetype = String(
    payload.mimetype ??
      payload.mime_type ??
      payload.mimeType ??
      file.type
  );

  const static_path = rawStaticPath
    ? middlewareFilePath(String(rawStaticPath))
    : "";

  if (!file_id) {
    return null;
  }

  if (isImageFile(file) && !rawStaticPath) {
    return null;
  }

  return {
    metadata: {
      file_id,
      file_name,
      mimetype,
      original_filename,
      static_path,
    },
    rawStaticPath,
  };
}

export const useFileUpload = ({
  userId,
  supportsImages = false,
}: UseFileUploadOptions) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileMetadata[]>(
    []
  );
  const [filePreviewUrls, setFilePreviewUrls] = useState<
    Record<string, string>
  >({});
  const [fileUploadStates, setFileUploadStates] = useState<
    Record<string, FileUploadState>
  >({});
  const [showFileUploadWarning, setShowFileUploadWarning] = useState(false);
  const [fileWarningMessage, setFileWarningMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Sync with selectedFiles so rapid successive picks see the true count (state updates async). */
  const selectedImageCountRef = useRef(0);

  useEffect(() => {
    selectedImageCountRef.current = selectedFiles.filter(isImageFile).length;
  }, [selectedFiles]);

  const checkFileCompatibility = useCallback(
    (file: File): FileCompatibilityResult => {
      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      const hasCodeExtension = CODE_EXTENSIONS.some((ext) =>
        fileName.endsWith(ext)
      );

      if (!SUPPORTED_MIME_TYPES.includes(fileType) && !hasCodeExtension) {
        return {
          compatible: false,
          message: `File type "${fileType}" is not supported. Please use images, documents, or code files.`,
        };
      }

      if (fileType.startsWith("image/") && file.size > MAX_IMAGE_SIZE) {
        return {
          compatible: false,
          message: "Image file is too large. Please use an image under 20MB.",
        };
      }

      if (file.size > MAX_FILE_SIZE) {
        return {
          compatible: false,
          message: "File is too large. Please use a file under 50MB.",
        };
      }

      return { compatible: true, message: "" };
    },
    []
  );

  const showWarning = useCallback((message: string) => {
    setFileWarningMessage(message);
    setShowFileUploadWarning(true);
    setTimeout(() => setShowFileUploadWarning(false), 5000);
  }, []);

  const pollFileStatus = useCallback(
    async (fileId: string): Promise<any> => {
      const maxAttempts = 30;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `${localApiBase}/files/status/${fileId}`,
          { withCredentials: true }
        );

        if (statusResponse.data.status === "SUCCESS") {
          return statusResponse.data;
        } else if (statusResponse.data.status === "PENDING") {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        } else {
          throw new Error("Processing failed");
        }
      }
      throw new Error("Processing timeout");
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setFileUploadStates((prev) => ({ ...prev, [file.name]: "uploading" }));

      const fileData = new FormData();
      fileData.append("file", file);
      fileData.append("user_id", userId);
      fileData.append("file_name", file.name);
      fileData.append("file_type", file.type);
      fileData.append("file_size", file.size.toString());

      try {
        const response = await axios.post(
          `${localApiBase}/files/images/upload`,
          fileData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            withCredentials: true,
          }
        );

        const parsed = parseUploadResponsePayload(response.data, file);
        if (!parsed) {
          notify.error(
            "Upload succeeded but the server did not return usable file details. Please try again."
          );
          setSelectedFiles((prev) => prev.filter((f) => f !== file));
          setFileUploadStates((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
          return;
        }

        let uploadedFileMetadata = parsed.metadata;

        // For non-image files, poll status until complete
        if (!isImageFile(file)) {
          setFileUploadStates((prev) => ({
            ...prev,
            [file.name]: "processing",
          }));
          const processingResult = await pollFileStatus(
            uploadedFileMetadata.file_id
          );
          uploadedFileMetadata = {
            ...uploadedFileMetadata,
            processing_result: processingResult,
          };
        }

        setUploadedFiles((prev) => [...prev, uploadedFileMetadata]);

        // Update preview URL for images
        if (isImageFile(file) && parsed.rawStaticPath) {
          const previewUrl = fileUrl(parsed.rawStaticPath);
          setFilePreviewUrls((prev) => ({
            ...prev,
            [file.name]: previewUrl,
          }));
        }

        setFileUploadStates((prev) => ({ ...prev, [file.name]: "uploaded" }));
      } catch (error) {
        console.error("Error uploading file:", error);
        notify.error("Error uploading file");
        setSelectedFiles((prev) => prev.filter((f) => f !== file));
        setFileUploadStates((prev) => {
          const newStates = { ...prev };
          delete newStates[file.name];
          return newStates;
        });
      }
    },
    [userId, pollFileStatus]
  );

  const createImagePreview = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.onload = () => {
          if (
            img.width > MAX_IMAGE_DIMENSION ||
            img.height > MAX_IMAGE_DIMENSION
          ) {
            showWarning(
              `Image dimensions are too large (${img.width}x${img.height}). Please use an image under 8000x8000 pixels.`
            );
            return;
          }
          setFilePreviewUrls((prev) => ({
            ...prev,
            [file.name]: event.target?.result as string,
          }));
        };
        img.onerror = () => {
          showWarning("Could not load image. The file may be corrupted.");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [showWarning]
  );

  const processFiles = useCallback(
    (files: File[]) => {
      const validFiles: File[] = [];
      let imageCount = selectedImageCountRef.current;
      let skippedDueToImageLimit = false;

      files.forEach((file) => {
        if (isImageFile(file) && !supportsImages) {
          showWarning("Image uploads are not enabled for your account.");
          return;
        }

        if (isImageFile(file) && imageCount >= MAX_CHAT_IMAGES) {
          skippedDueToImageLimit = true;
          return;
        }

        const compatibilityCheck = checkFileCompatibility(file);
        if (!compatibilityCheck.compatible) {
          showWarning(compatibilityCheck.message);
          return;
        }

        if (isImageFile(file)) {
          imageCount += 1;
        }

        validFiles.push(file);
        setFileUploadStates((prev) => ({ ...prev, [file.name]: "pending" }));
        uploadFile(file);

        if (isImageFile(file)) {
          createImagePreview(file);
        } else if (file.type === "application/pdf") {
          setFilePreviewUrls((prev) => ({
            ...prev,
            [file.name]: "/pdf-icon.png",
          }));
        } else {
          setFilePreviewUrls((prev) => ({
            ...prev,
            [file.name]: "/file-icon.png",
          }));
        }
      });

      if (skippedDueToImageLimit) {
        notify.error(
          `Only up to ${MAX_CHAT_IMAGES} images can be uploaded.`,
        );
      }

      if (validFiles.length > 0) {
        selectedImageCountRef.current = imageCount;
        setSelectedFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [
      checkFileCompatibility,
      showWarning,
      uploadFile,
      createImagePreview,
      supportsImages,
    ]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFiles(Array.from(files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processFiles]
  );

  const handleFileRemove = useCallback((fileName: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.name !== fileName));
    setUploadedFiles((prev) =>
      prev.filter((uploaded) => uploaded.original_filename !== fileName)
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

  const handleFileUpload = useCallback(() => {
    if (!supportsImages) return;
    fileInputRef.current?.click();
  }, [supportsImages]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!supportsImages) return;
      e.preventDefault();
      setIsDragOver(true);
    },
    [supportsImages]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!supportsImages) return;
      e.preventDefault();
      setIsDragOver(false);
    },
    [supportsImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!supportsImages) return;
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles, supportsImages]
  );

  const clearFiles = useCallback(() => {
    selectedImageCountRef.current = 0;
    setSelectedFiles([]);
    setUploadedFiles([]);
    setFilePreviewUrls({});
    setFileUploadStates({});
  }, []);

  const restoreFiles = useCallback(
    (
      files: File[],
      uploaded: UploadedFileMetadata[],
      previews: Record<string, string>
    ) => {
      selectedImageCountRef.current = files.filter(isImageFile).length;
      setSelectedFiles([...files]);
      setUploadedFiles([...uploaded]);
      setFilePreviewUrls({ ...previews });
      const restoredStates: Record<string, FileUploadState> = {};
      files.forEach((file) => {
        const wasUploaded = uploaded.some(
          (uf) => uf.original_filename === file.name
        );
        restoredStates[file.name] = wasUploaded ? "uploaded" : "pending";
      });
      setFileUploadStates(restoredStates);
    },
    []
  );

  return {
    // State
    selectedFiles,
    uploadedFiles,
    filePreviewUrls,
    fileUploadStates,
    showFileUploadWarning,
    fileWarningMessage,
    isDragOver,
    fileInputRef,
    // Actions
    handleFileSelect,
    handleFileRemove,
    handleFileUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearFiles,
    restoreFiles,
  };
};

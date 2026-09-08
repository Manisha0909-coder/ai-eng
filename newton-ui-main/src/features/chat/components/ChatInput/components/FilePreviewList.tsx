import React from "react";
import { FileText, Trash2, Loader2, CheckCircle } from "lucide-react";
import type { FileUploadState } from "../types";

interface FilePreviewListProps {
  files: File[];
  previewUrls: Record<string, string>;
  uploadStates: Record<string, FileUploadState>;
  onRemove: (fileName: string) => void;
}

export const FilePreviewList: React.FC<FilePreviewListProps> = ({
  files,
  previewUrls,
  uploadStates,
  onRemove,
}) => {
  if (files.length === 0) return null;

  return (
    <div className="mb-2 p-2 rounded-lg bg-surface border border-border-main">
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <div
            key={file.name}
            className="flex items-center bg-background rounded-lg p-2 border border-border-main"
          >
            {/* File preview icon/image */}
            {previewUrls[file.name]?.startsWith("data:image") ? (
              <img
                src={previewUrls[file.name]}
                alt={file.name}
                className="h-8 w-8 object-cover rounded mr-2"
              />
            ) : file.type === "application/pdf" ? (
              <FileText size={16} className="text-red-400 mr-2" />
            ) : file.type.startsWith("image/") ? (
              <FileText size={16} className="text-blue-400 mr-2" />
            ) : (
              <FileText size={16} className="text-gray-400 mr-2" />
            )}

            {/* File name */}
            <span className="text-xs text-text-main truncate max-w-[150px]">
              {file.name}
            </span>

            {/* File size */}
            <span className="text-xs text-text-main ml-1">
              ({(file.size / 1024).toFixed(1)}KB)
            </span>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(file.name)}
              className="text-red-600 p-1 rounded-full ml-2"
            >
              <Trash2 size={12} />
            </button>

            {/* Upload status indicator */}
            <div className="flex items-center ml-2">
              {uploadStates[file.name] === "uploading" && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              )}
              {uploadStates[file.name] === "processing" && (
                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
              )}
              {uploadStates[file.name] === "uploaded" && (
                <CheckCircle size={12} className="text-green-400" />
              )}
              {(!uploadStates[file.name] ||
                uploadStates[file.name] === "pending") && (
                <div className="w-4 h-4 flex items-center justify-center">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

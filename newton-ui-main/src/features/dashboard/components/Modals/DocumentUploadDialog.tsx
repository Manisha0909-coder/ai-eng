import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Upload,
  FileText,
  X,
  Search,
  ChevronDown,
  Check,
  CheckCircle,
  Lock,
  Globe,
  Loader2,
} from "lucide-react";
import notify from "@/utils/notify";
import { rbacApi } from "@/services/rbac/rbacApi";
import { DashboardLoader } from "@/components/ContentLoader";
import { AdminFormDialog, FormDialogFooter } from "../Forms/AdminFormDialog";
import { FormField } from "../Forms/FormField";

interface TagObject {
  id: number;
  name: string;
  description?: string;
}

interface UploadFormState {
  descriptions: string[];
  document_tags: TagObject[][];
  isPrivate: boolean;
}

interface DocumentUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  isAdminDashboard: boolean;
  isAdmin: boolean;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 5;

function createEmptyUploadForm(isAdminDashboard: boolean): UploadFormState {
  return {
    descriptions: Array(MAX_FILES).fill(""),
    document_tags: Array.from({ length: MAX_FILES }, () => []),
    isPrivate: !isAdminDashboard,
  };
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

export function DocumentUploadDialog({
  isOpen,
  onClose,
  onUploadSuccess,
  isAdminDashboard,
  isAdmin,
}: DocumentUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(() =>
    createEmptyUploadForm(isAdminDashboard),
  );
  const [isUploading, setIsUploading] = useState(false);

  const [availableDocumentTags, setAvailableDocumentTags] = useState<TagObject[]>([]);
  const [isDocumentTagsOpen, setIsDocumentTagsOpen] = useState(false);
  const [areDocumentTagsOpen, setAreDocumentTagsOpen] = useState(
    Array(MAX_FILES).fill(false),
  );
  const [documentTagSearch, setDocumentTagSearch] = useState("");
  const [showCommonTagConfirmation, setShowCommonTagConfirmation] = useState(
    Array(MAX_FILES).fill(false),
  );
  const [pendingCommonTag, setPendingCommonTag] = useState<TagObject | null>(null);
  const [isLoadingDocumentTags, setIsLoadingDocumentTags] = useState(false);
  const [hasLoadedDocumentTags, setHasLoadedDocumentTags] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentTagsRef = useRef<HTMLDivElement>(null);

  const resetForm = () => {
    setSelectedFiles([]);
    setUploadForm(createEmptyUploadForm(isAdminDashboard));
    setAreDocumentTagsOpen(Array(MAX_FILES).fill(false));
    setShowCommonTagConfirmation(Array(MAX_FILES).fill(false));
    setPendingCommonTag(null);
    setDocumentTagSearch("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    const fetchDocumentTags = async () => {
      if (!isDocumentTagsOpen || hasLoadedDocumentTags || isLoadingDocumentTags) return;

      setIsLoadingDocumentTags(true);
      try {
        const response = await rbacApi.documentTags.list({ limit: 50 });
        const tags: TagObject[] = response.data.map((tag) => ({
          id: tag.id,
          name: tag.name,
          description: tag.description,
        }));
        setAvailableDocumentTags(tags);
        setHasLoadedDocumentTags(true);
      } catch (error) {
        console.error("Failed to fetch document tags:", error);
        setAvailableDocumentTags([]);
        notify.error("Failed to load document tags");
      } finally {
        setIsLoadingDocumentTags(false);
      }
    };

    fetchDocumentTags();
  }, [isDocumentTagsOpen, hasLoadedDocumentTags, isLoadingDocumentTags]);

  const validateAndSetFiles = (fileArray: File[]) => {
    const empty = fileArray.filter((f) => f.size === 0);
    if (empty.length > 0) {
      notify.error(`Empty files cannot be uploaded: ${empty.map((f) => f.name).join(", ")}`);
    }
    const oversized = fileArray.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      notify.error(`File size must not exceed 50MB: ${oversized.map((f) => f.name).join(", ")}`);
    }
    const validFiles = fileArray.filter(
      (f) => f.size > 0 && f.size <= MAX_FILE_SIZE_BYTES,
    );
    if (validFiles.length > MAX_FILES) {
      notify.error(`Maximum ${MAX_FILES} files allowed for upload`);
      setSelectedFiles(validFiles.slice(0, MAX_FILES));
    } else {
      setSelectedFiles(validFiles);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      validateAndSetFiles(Array.from(files));
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files) {
      validateAndSetFiles(Array.from(files));
    }
  };

  const handleDocumentTagSelect = (tag: TagObject, index: number) => {
    const alreadySelected = uploadForm.document_tags[index].some((t) => t.id === tag.id);
    if (tag.name.toLowerCase() === "common" && !alreadySelected) {
      setPendingCommonTag(tag);
      const updateShowCommonTagConfirmation = [...showCommonTagConfirmation];
      updateShowCommonTagConfirmation[index] = true;
      setShowCommonTagConfirmation(updateShowCommonTagConfirmation);
      return;
    }
    setUploadForm((prev) => ({
      ...prev,
      document_tags: prev.document_tags.map((tagsAtPos, i) => {
        if (i !== index) return tagsAtPos;
        return alreadySelected
          ? tagsAtPos.filter((t) => t.id !== tag.id)
          : [...tagsAtPos, tag];
      }),
    }));
  };

  const handleCommonTagConfirm = (index: number) => {
    if (pendingCommonTag) {
      const prevTags = [...uploadForm.document_tags];
      prevTags[index] = [...prevTags[index], pendingCommonTag];
      setUploadForm((prev) => ({
        ...prev,
        document_tags: prevTags,
      }));
    }
    const updateShowCommonTagConfirmation = [...showCommonTagConfirmation];
    updateShowCommonTagConfirmation[index] = false;
    setShowCommonTagConfirmation(updateShowCommonTagConfirmation);
    setPendingCommonTag(null);
  };

  const handleCommonTagCancel = (index: number) => {
    const updateShowCommonTagConfirmation = [...showCommonTagConfirmation];
    updateShowCommonTagConfirmation[index] = false;
    setShowCommonTagConfirmation(updateShowCommonTagConfirmation);
    setPendingCommonTag(null);
  };

  const handleRemoveDocumentTag = (tagToRemove: TagObject, index: number) => {
    const docTags = [...uploadForm.document_tags];
    docTags[index] = docTags[index].filter((tag) => tag.id !== tagToRemove.id);
    setUploadForm((prev) => ({
      ...prev,
      document_tags: docTags,
    }));
  };

  const pollDocumentStatus = async (documentId: number, maxAttempts = 30) => {
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const doc = await rbacApi.documents.getById(documentId);
        if (doc.status === 100 || doc.has_failed || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (doc.has_failed) {
            notify.error(`Document processing failed: ${doc.name || "Unknown"}`);
          }
          onUploadSuccess();
        }
      } catch (error) {
        console.error("Error polling document status:", error);
        clearInterval(pollInterval);
      }
    }, 2000);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const isPrivate = isAdminDashboard ? false : uploadForm.isPrivate;

      if (!isPrivate && !isAdmin) {
        notify.error("Only admins can upload public documents");
        setIsUploading(false);
        return;
      }

      const numFiles = selectedFiles.length;
      const metadata = uploadForm.descriptions.slice(0, numFiles).map((desc, index) => ({
        doc_desc: desc || "",
        tag_ids: uploadForm.document_tags[index]?.map((tag) => tag.id) || [],
      }));

      const responses = isPrivate
        ? await rbacApi.documents.batchUploadPrivate({ files: selectedFiles, metadata })
        : await rbacApi.documents.batchUploadPublic({ files: selectedFiles, metadata });

      if (Array.isArray(responses)) {
        responses.forEach((response) => {
          if (response.status !== undefined && response.status < 100) {
            const documentId = response.document_id || response.id;
            if (documentId) {
              pollDocumentStatus(documentId);
            }
          }
        });
      }

      resetForm();
      onUploadSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Error uploading document:", error);
      notify.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredTags = availableDocumentTags.filter((tag) =>
    tag.name.toLowerCase().includes(documentTagSearch.toLowerCase()),
  );

  return (
    <AdminFormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload documents"
      icon={<Upload size={15} />}
      size="lg"
      bodyClassName="max-h-[70vh]"
      footer={
        <FormDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
            className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.length === 0}
            className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                <span>
                  Uploading {selectedFiles.length} file
                  {selectedFiles.length > 1 ? "s" : ""}...
                </span>
              </>
            ) : (
              <>
                <Upload className="mr-2" size={18} />
                <span>
                  {selectedFiles.length > 0
                    ? `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`
                    : "Upload"}
                </span>
              </>
            )}
          </Button>
        </FormDialogFooter>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        {!isAdminDashboard && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Document Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadForm((prev) => ({ ...prev, isPrivate: true }))}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  uploadForm.isPrivate
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border-main hover:border-primary/50"
                }`}
              >
                <Lock size={18} />
                <span className="font-medium">Private</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isAdmin) {
                    notify.error("Only admins can upload public documents");
                    return;
                  }
                  setUploadForm((prev) => ({ ...prev, isPrivate: false }));
                }}
                disabled={!isAdmin}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  !uploadForm.isPrivate
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border-main hover:border-primary/50"
                } ${!isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Globe size={18} />
                <span className="font-medium">Public</span>
                {!isAdmin && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    Admin Only
                  </Badge>
                )}
              </button>
            </div>
            <p className="text-xs text-text-muted">
              {uploadForm.isPrivate
                ? "Private documents are only visible to you"
                : "Users with the corresponding document tag can view this document"}
            </p>
          </div>
        )}

        {isAdminDashboard && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <Globe size={18} className="text-primary" />
              <span className="text-sm font-medium text-primary">Uploading as Shared Document</span>
            </div>
            <p className="text-xs text-text-muted">
              Users with the corresponding document tag can view this document
            </p>
          </div>
        )}

        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors hover:border-muted-foreground/50"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto text-text-muted mb-2 sm:mb-4" size={18} />
          <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Upload Documents</h3>
          <p className="text-text-muted text-xs sm:text-sm">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-text-muted text-2xs sm:text-xs mt-2">
            Upload up to {MAX_FILES} files at once. Supported formats: PDF, DOCX, PPTX, XLSX, HTML,
            MD, ASCIIDOC, CSV, JPG, PNG (max 50MB each)
          </p>
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.docx,.pptx,.xlsx,.html,.md,.asciidoc,.adoc,.csv,.jpg,.jpeg,.png"
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm sm:text-base">
              Selected Files ({selectedFiles.length}/{MAX_FILES})
            </h4>
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="border rounded-lg p-2 m-2">
                <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <FileText className="text-text-muted flex-shrink-0" size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
                    }}
                    className="flex-shrink-0 p-1 hover:bg-accent rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 mt-2">
                  <FormField label="Description">
                    <Textarea
                      placeholder="Enter document description"
                      value={uploadForm.descriptions[index]}
                      onChange={(e) =>
                        setUploadForm((prev) => {
                          const updatedDescriptions = [...prev.descriptions];
                          updatedDescriptions[index] = e.target.value;
                          return { ...prev, descriptions: updatedDescriptions };
                        })
                      }
                      rows={4}
                      className="min-h-[4.5rem] resize-y bg-background text-text-main border-border-main placeholder:text-text-muted"
                    />
                  </FormField>

                  <FormField label="Document Tags">
                    {uploadForm.document_tags[index].length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-md bg-muted/30">
                        {uploadForm.document_tags[index].map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="flex items-center gap-1 bg-primary/10 text-primary border-primary/20"
                          >
                            {tag.name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDocumentTag(tag, index);
                              }}
                              className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="relative" ref={documentTagsRef}>
                      <Popover
                        open={areDocumentTagsOpen[index]}
                        onOpenChange={setIsDocumentTagsOpen}
                        modal
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const prevOpenTags = [...areDocumentTagsOpen];
                              prevOpenTags[index] = !prevOpenTags[index];
                              setAreDocumentTagsOpen(prevOpenTags);
                            }}
                            className="w-full flex items-center justify-between p-2 border border-input rounded-md bg-background text-text-main hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                          >
                            <span className="text-text-muted truncate text-left flex-1">
                              {uploadForm.document_tags[index].length === 0
                                ? "Select document tags"
                                : (() => {
                                    const selectedTagNames = uploadForm.document_tags[index]
                                      .map((t) => t.name)
                                      .filter(Boolean);
                                    const namesText = selectedTagNames.join(", ");
                                    return namesText.length > 40
                                      ? `${uploadForm.document_tags[index].length} tag${uploadForm.document_tags[index].length > 1 ? "s" : ""} selected`
                                      : namesText;
                                  })()}
                            </span>
                            <ChevronDown
                              className={`flex-shrink-0 transition-transform ${
                                areDocumentTagsOpen[index] ? "rotate-180" : ""
                              }`}
                              size={16}
                            />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
                          align="start"
                          onPointerDownOutside={(e) => {
                            const target = e.target as HTMLElement;
                            if (!documentTagsRef.current?.contains(target)) {
                              const prevOpen = [...areDocumentTagsOpen];
                              prevOpen[index] = !prevOpen[index];
                              setAreDocumentTagsOpen(prevOpen);
                              setDocumentTagSearch("");
                            } else {
                              e.preventDefault();
                            }
                          }}
                          onInteractOutside={(e) => {
                            const target = e.target as HTMLElement;
                            if (documentTagsRef.current?.contains(target)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <div className="flex flex-col">
                            <div className="p-2 border-b border-border-main">
                              <div className="relative">
                                <Search
                                  className="absolute left-2 top-2.5 text-text-muted"
                                  size={16}
                                />
                                <Input
                                  type="text"
                                  placeholder="Search tags..."
                                  value={documentTagSearch}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setDocumentTagSearch(e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className="w-full pl-8 pr-3 py-2 text-sm"
                                />
                              </div>
                            </div>

                            <div className="overflow-y-auto max-h-60">
                              {isLoadingDocumentTags ? (
                                <div className="flex items-center justify-center p-4">
                                  <DashboardLoader size="md" />
                                </div>
                              ) : filteredTags.length === 0 ? (
                                <div className="p-4 text-center text-sm text-text-muted">
                                  {documentTagSearch
                                    ? "No tags found matching your search"
                                    : "No tags available"}
                                </div>
                              ) : (
                                filteredTags.map((tag) => {
                                  const isSelected = uploadForm.document_tags[index].some(
                                    (t) => t.id === tag.id,
                                  );
                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDocumentTagSelect(tag, index);
                                      }}
                                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground w-full text-left border-b border-border-main last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <div
                                          className={`flex h-4 w-4 items-center justify-center rounded-sm border border-primary flex-shrink-0 ${
                                            isSelected
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50 [&_svg]:invisible"
                                          }`}
                                        >
                                          <Check className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{tag.name}</div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </FormField>
                </div>

                {showCommonTagConfirmation[index] && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface p-6 rounded-lg shadow-lg max-w-md w-full mx-4 border border-border-main">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-500/10 rounded-full">
                          <CheckCircle className="text-orange-600" size={18} />
                        </div>
                        <h3 className="text-lg font-semibold text-text-main">Set as Common Document</h3>
                      </div>

                      <p className="text-text-main mb-2">
                        Are you sure you want to tag this document as{" "}
                        <span className="font-semibold text-orange-600">&quot;common&quot;</span>?
                      </p>
                      <p className="text-sm text-text-muted mb-6">
                        Common documents will be accessible to all users in your organization. This
                        action can be reversed by removing the tag later.
                      </p>

                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleCommonTagCancel(index)}
                          className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:bg-surface-2 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCommonTagConfirm(index)}
                          className="px-4 py-2 text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 rounded-md transition-colors"
                        >
                          Yes, Set as Common
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminFormDialog>
  );
}

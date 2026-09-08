import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  FileText,
  X,
  Loader2,
  Trash2,
  Download,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import notify from "@/utils/notify";
import { formatDashboardDate } from "@/utils/helper";
import { rbacApi, type DocumentFile } from "@/services/rbac/rbacApi";
import { DocFileIcon } from "@/features/documents/fileTypeVisuals";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowPrimaryIconButtonClass,
} from "@/features/dashboard/utils/dashboardRowActionStyles";

const PAGE_SIZE = 20;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPTED = ".pdf,.docx,.pptx,.xlsx,.html,.md,.asciidoc,.adoc,.csv,.jpg,.jpeg,.png";
const FILE_TYPES_LABEL = "PDF, DOCX, PPTX, XLSX, HTML, MD, ASCIIDOC, CSV, JPG, PNG";

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

function getDocName(doc: DocumentFile) {
  return doc.name || "Untitled document";
}

function fileExt(name: string) {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}

function StatusBadge({
  doc,
  onRetry,
  retrying,
}: {
  doc: DocumentFile;
  onRetry: () => void;
  retrying: boolean;
}) {
  const hasFailed = doc.has_failed ?? false;
  const rawStatus = doc.status;
  const status =
    typeof rawStatus === "number"
      ? Math.max(0, Math.min(100, Math.round(rawStatus)))
      : 0;

  if (hasFailed) {
    return (
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        title="Retry upload"
        className="flex items-center gap-1 h-5 px-2 rounded-full text-xs bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/15 disabled:opacity-50"
      >
        {retrying ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <RefreshCw size={10} />
        )}
        {retrying ? "Retrying…" : "Failed"}
      </button>
    );
  }
  if (status === 100) {
    return (
      <span className="flex items-center gap-1 h-5 px-2 rounded-full text-xs bg-status-success/10 text-status-success border border-status-success/20">
        <CheckCircle size={10} /> Done
      </span>
    );
  }
  if (status > 0) {
    return (
      <span className="flex items-center gap-1 h-5 px-2 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
        <Loader2 size={10} className="animate-spin" /> {status}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 h-5 px-2 rounded-full text-xs bg-surface-2 text-text-muted border border-border-main">
      <Clock size={10} /> Queued
    </span>
  );
}

function DocRow({
  doc,
  onDownload,
  onDelete,
  onRetry,
  downloading,
  deleting,
  retrying,
}: {
  doc: DocumentFile;
  onDownload: () => void;
  onDelete: () => void;
  onRetry: () => void;
  downloading: boolean;
  deleting: boolean;
  retrying: boolean;
}) {
  const name = getDocName(doc);
  const ext = fileExt(name);
  const hasFailed = doc.has_failed ?? false;

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 bg-surface border border-border-main rounded-xl px-3.5 py-2.5 hover:border-primary/20 hover:shadow-sm transition-all",
        deleting && "opacity-60",
      )}
    >
      {/* Always show the file-type icon; progress/failed live in StatusBadge + actions */}
      <DocFileIcon name={name} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" title={name}>
          {name}
        </div>
        <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
          <span className="text-xs text-text-muted">
            {ext} · {formatBytes(doc.file_size)}
            {doc.created_at || doc.updated_at
              ? " · " + formatDashboardDate(doc.created_at || doc.updated_at || "")
              : ""}
          </span>
          <StatusBadge doc={doc} onRetry={onRetry} retrying={retrying} />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hasFailed && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRetry}
            disabled={retrying || deleting}
            className={dashboardRowPrimaryIconButtonClass}
            title="Retry upload"
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onDownload}
          disabled={downloading || deleting || retrying}
          className={dashboardRowPrimaryIconButtonClass}
          title="Download document"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onDelete}
          disabled={deleting || downloading || retrying}
          className={dashboardRowDeleteIconButtonClass}
          title="Delete document"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function UploadZone({
  selectedFiles,
  isUploading,
  uploadProgress,
  onSelectFiles,
  onRemoveFile,
  onUpload,
}: {
  selectedFiles: File[];
  isUploading: boolean;
  uploadProgress: number | null;
  onSelectFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onUpload: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    onSelectFiles(Array.from(e.dataTransfer.files));
  };

  const hasFiles = selectedFiles.length > 0;
  const canAddMore = selectedFiles.length < MAX_FILES && !isUploading;

  return (
    <div className="rounded-xl border border-border-main bg-surface overflow-hidden shrink-0">
      {/* Drop zone / idle state */}
      {!hasFiles && !isUploading && (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 px-4 py-5 cursor-pointer transition-colors",
            isDragOver
              ? "bg-primary/5 border-primary/40"
              : "hover:bg-surface-2/50",
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          aria-label="Upload documents"
        >
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
            isDragOver ? "bg-primary/15" : "bg-surface-2",
          )}>
            <Upload size={16} className={isDragOver ? "text-primary" : "text-text-muted"} />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-text-main">
              Drop files here or{" "}
              <span className="text-primary underline-offset-2 hover:underline">browse</span>
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Up to {MAX_FILES} files · 50 MB each
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
            {FILE_TYPES_LABEL.split(", ").map((t) => (
              <span
                key={t}
                className="px-1.5 py-px rounded text-[10px] font-mono bg-surface-2 text-text-muted border border-border-main"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Uploading progress state */}
      {isUploading && (
        <div className="flex flex-col gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <Loader2 size={13} className="animate-spin text-primary shrink-0" />
            <span className="text-xs text-text-muted flex-1">
              Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}…
            </span>
            {uploadProgress !== null && (
              <span className="text-xs font-mono text-primary tabular-nums">{uploadProgress}%</span>
            )}
          </div>
          {uploadProgress !== null && (
            <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Files selected — fixed-height scrollable list */}
      {hasFiles && !isUploading && (
        <div
          className={cn(
            "flex flex-col",
            isDragOver && "ring-2 ring-inset ring-primary/40 bg-primary/5",
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
            <span className="text-xs font-medium text-text-main">
              {selectedFiles.length} of {MAX_FILES} files selected
            </span>
            <div className="flex items-center gap-1.5">
              {canAddMore && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 h-6 px-2 rounded-lg text-xs border border-border-main text-text-muted hover:bg-surface-2 transition-colors"
                >
                  <Plus size={10} />
                  Add more
                </button>
              )}
              <button
                onClick={onUpload}
                disabled={isUploading}
                className="flex items-center gap-1.5 h-6 px-2.5 rounded-lg text-xs bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Upload size={10} />
                Upload
              </button>
            </div>
          </div>

          {/* Scrollable file list — fixed height so panel doesn't grow */}
          <div className="overflow-y-auto max-h-[112px] px-3.5 pb-2.5 space-y-1 scrollbar-thin scrollbar-thumb-border-main scrollbar-track-transparent">
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1 px-2 rounded-lg bg-surface-2/60 group/row"
              >
                <FileText size={11} className="text-text-muted shrink-0" />
                <span className="flex-1 min-w-0 text-xs truncate text-text-main" title={f.name}>
                  {f.name}
                </span>
                <span className="text-xs text-text-muted shrink-0 tabular-nums">
                  {formatBytes(f.size)}
                </span>
                <button
                  onClick={() => onRemoveFile(i)}
                  className="text-text-muted hover:text-status-error transition-colors shrink-0 opacity-60 group-hover/row:opacity-100"
                  aria-label={`Remove ${f.name}`}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onSelectFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function DocumentsTab({ isActive }: { isActive: boolean }) {
  const [filter, setFilter] = useState("");
  const [docs, setDocs] = useState<DocumentFile[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentFile | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [retryingDocId, setRetryingDocId] = useState<number | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => { setPage(0); }, [filter]);

  const fetchDocs = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const res = await rbacApi.documents.listPrivate({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: filter.trim() || undefined,
      });
      setDocs(res.documents || []);
      setTotalDocs(res.total ?? 0);
    } catch {
      notify.error("Failed to load documents");
    } finally {
      setIsLoadingDocs(false);
    }
  }, [filter, page]);

  const handleRefresh = () => {
    void fetchDocs();
  };

  useEffect(() => {
    if (isActive) fetchDocs();
  }, [isActive, fetchDocs]);

  const validateAndSetFiles = (incoming: File[]) => {
    const merged = [...selectedFiles, ...incoming];
    const empty = incoming.filter((f) => f.size === 0);
    if (empty.length) notify.error(`Empty files cannot be uploaded: ${empty.map((f) => f.name).join(", ")}`);
    const oversized = incoming.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length) notify.error(`Max 50 MB per file: ${oversized.map((f) => f.name).join(", ")}`);
    const valid = merged.filter((f) => f.size > 0 && f.size <= MAX_FILE_BYTES);
    if (valid.length > MAX_FILES) {
      notify.error(`Maximum ${MAX_FILES} files allowed`);
    }
    setSelectedFiles(valid.slice(0, MAX_FILES));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || isUploading) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const metadata = selectedFiles.map(() => ({ doc_desc: "", tag_ids: [] }));
      await rbacApi.documents.batchUploadPrivate({ files: selectedFiles, metadata });
      setSelectedFiles([]);
      setUploadProgress(null);
      notify.success(`${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} uploaded`);
      setPage(0);
      fetchDocs();
    } catch (err: any) {
      notify.error(err, "Upload failed");
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    const docId = documentToDelete.id || documentToDelete.document_id;
    if (!docId) return;

    setDeletingDocId(docId);
    try {
      await rbacApi.documents.delete(docId);
      setDocs((prev) => prev.filter((d) => (d.id || d.document_id) !== docId));
      setTotalDocs((prev) => Math.max(0, prev - 1));
      setDocumentToDelete(null);
    } catch (err: any) {
      notify.error(err, "Failed to delete document");
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleDownload = async (doc: DocumentFile) => {
    const docId = doc.id || doc.document_id;
    if (!docId) return;
    setDownloadingDocId(docId);
    try {
      const blob = await rbacApi.documents.download(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getDocName(doc);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      notify.error(err, "Failed to download");
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleRetry = async (doc: DocumentFile) => {
    const docId = doc.id || doc.document_id;
    if (!docId) return;
    setRetryingDocId(docId);
    try {
      await rbacApi.documents.retryUpload(docId);
      setTimeout(fetchDocs, 1000);
    } catch (err: any) {
      notify.error(err, "Retry failed");
    } finally {
      setRetryingDocId(null);
    }
  };

  const totalPages = Math.ceil(totalDocs / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-5 pt-4 space-y-3">
        {/* Upload zone */}
        <UploadZone
          selectedFiles={selectedFiles}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onSelectFiles={validateAndSetFiles}
          onRemoveFile={(i) => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))}
          onUpload={handleUpload}
        />

        {/* Search + refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search documents…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-7 pl-7 pr-3 rounded-lg border border-border-main bg-surface text-xs placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingDocs}
            title="Refresh documents"
            aria-label="Refresh documents"
            className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors shrink-0"
          >
            <RefreshCw size={13} className={isLoadingDocs ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Doc list */}
      <div
        className={cn(
          "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-main scrollbar-track-transparent px-5 min-h-0 mt-4",
          (totalPages <= 1 || isLoadingDocs) && "pb-4",
        )}
      >
      {isLoadingDocs ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 bg-surface border border-border-main rounded-xl px-3.5 py-2.5 animate-pulse"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-2 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-44 rounded bg-surface-2" />
                <div className="h-2.5 w-28 rounded bg-surface-2" />
              </div>
              <div className="h-6 w-20 rounded-lg bg-surface-2 shrink-0" />
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2.5 py-8">
          <div className="w-11 h-11 rounded-xl bg-surface-2 flex items-center justify-center">
            <FileText size={20} className="text-text-muted" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium mb-0.5">
              {filter ? "No matching documents" : "No documents yet"}
            </p>
            <p className="text-xs text-text-muted">
              {filter ? "Try a different search term." : "Upload your first document above to get started."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const docId = doc.id || doc.document_id || 0;
            return (
              <DocRow
                key={docId}
                doc={doc}
                downloading={downloadingDocId === docId}
                deleting={deletingDocId === docId}
                retrying={retryingDocId === docId}
                onDownload={() => handleDownload(doc)}
                onDelete={() => setDocumentToDelete(doc)}
                onRetry={() => handleRetry(doc)}
              />
            );
          })}
        </div>
      )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isLoadingDocs && (
        <div className="flex items-center justify-between px-5 pb-4 pt-1 shrink-0">
          <span className="text-xs text-text-muted">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalDocs)} of {totalDocs}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-text-muted px-1">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-border-main text-text-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={documentToDelete !== null}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete document?"
        description="This action cannot be undone."
        itemName={documentToDelete ? getDocName(documentToDelete) : undefined}
        isLoading={
          documentToDelete !== null &&
          deletingDocId === (documentToDelete.id || documentToDelete.document_id)
        }
        layerClassName="z-[9100]"
      />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import { rbacApi, type DocumentFile } from "@/services/rbac/rbacApi";
import {
  Upload,
  Download,
  Trash2,
  X,
  Check,
  CheckCircle,
  Clock,
  RefreshCw,
  Lock,
  Globe,
  SquarePen,
} from "lucide-react";
import notify from "@/utils/notify";
import { ErrorRetry } from "../components/ErrorRetry";
import { useIsMobile } from "@/hooks/use-mobile";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { formatDashboardDate } from "@/utils/helper";
import { EditDocumentDialog } from "../components/Modals/EditDocumentDialog";
import { DocumentUploadDialog } from "../components/Modals/DocumentUploadDialog";
import {
  dashboardRowEditIconButtonClass,
  dashboardRowDeleteIconButtonClass,
  dashboardRowPrimaryIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { DocTagsCollapsible } from "../components/DocTagsCollapsible";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabSearchableSelect,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
} from "../components/DashboardTabFilterUi";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabCardHeaderClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";
import { DashboardLoader } from "@/components/ContentLoader";
import { DataTable, ColumnConfig, type TableQueryParams } from "@/components/DataTable";
import { cn } from "@/lib/utils";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";
import { DashboardPill } from "../components/DashboardPill";
import { StatusBadge } from "../components/StatusBadge";
import { DocFileIcon } from "@/features/documents/fileTypeVisuals";

// Extended DocumentFile type with legacy fields
interface ExtendedDocumentFile extends DocumentFile {
  // Legacy fields (for backward compatibility)
  file_id?: string;
  file_name?: string;
  static_path?: string | null;
  static_url?: string | null;
  doc_desc?: string | null,
  upload_status?: number;
  is_completed?: boolean;
  category?: string;
  tags?: string[];
  document_tags?: string[] | string;
  // Backend doc_tags field (array of tag objects or strings)
  doc_tags?: Array<{
    id?: number;
    name: string;
    description?: string;
  }> | string[];
  // Additional tag fields
  personal_tag?: {
    id: number;
    name: string;
    description?: string;
  } | null;
  // personal_doc_tags is inherited from DocumentFile (PersonalDocTag[])
}

type DocumentType = "private" | "public";

const DOC_FILTER_FORMAT_ALL = "__all__";
const DOC_FILTER_STATUS_ALL = "__all__";

const DOCUMENT_FILE_FORMAT_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All formats", value: DOC_FILTER_FORMAT_ALL },
  { label: "PDF", value: "pdf" },
  { label: "DOCX", value: "docx" },
  { label: "PPTX", value: "pptx" },
  { label: "XLSX", value: "xlsx" },
  { label: "HTML", value: "html" },
  { label: "TXT", value: "txt" },
  { label: "MD", value: "md" },
  { label: "CSV", value: "csv" },
  { label: "ASCIIDOC", value: "asciidoc" },
  { label: "ADOC", value: "adoc" },
  { label: "JPG", value: "jpg" },
  { label: "JPEG", value: "jpeg" },
  { label: "PNG", value: "png" },
];

const getDocumentId = (doc: ExtendedDocumentFile) =>
  doc.file_id || doc.id?.toString() || doc.document_id?.toString() || "";

const getDocumentName = (doc: ExtendedDocumentFile) =>
  doc.title || doc.file_name || doc.name || "Untitled document";

/** Normalized tag names for display and table search (doc_tags, document_tags, personal tags, etc.) */
function collectDocumentTagNames(document: ExtendedDocumentFile): string[] {
  const allTags: string[] = [];

  if (document.document_tags) {
    let parsedTags: string[] = [];
    if (typeof document.document_tags === "string") {
      try {
        parsedTags = JSON.parse(document.document_tags);
      } catch {
        parsedTags = [document.document_tags];
      }
    } else if (Array.isArray(document.document_tags)) {
      if (
        document.document_tags.length === 1 &&
        typeof document.document_tags[0] === "string" &&
        document.document_tags[0].startsWith("[")
      ) {
        try {
          parsedTags = JSON.parse(document.document_tags[0]);
        } catch {
          parsedTags = document.document_tags;
        }
      } else {
        parsedTags = document.document_tags;
      }
    }
    allTags.push(...parsedTags);
  }

  if (document.tags && Array.isArray(document.tags)) {
    allTags.push(...document.tags);
  }

  if (document.personal_doc_tag?.name) {
    allTags.push(document.personal_doc_tag.name);
  }

  if (document.personal_doc_tags && Array.isArray(document.personal_doc_tags)) {
    const tagNames = document.personal_doc_tags
      .map((tag) => tag?.name)
      .filter((name): name is string => Boolean(name));
    allTags.push(...tagNames);
  }

  if (document.personal_tag?.name) {
    allTags.push(document.personal_tag.name);
  }

  if (document.doc_tags && Array.isArray(document.doc_tags)) {
    const docTagNames = document.doc_tags
      .map((tag) => {
        if (typeof tag === "string") {
          return tag;
        } else if (tag && typeof tag === "object" && tag.name) {
          return tag.name;
        }
        return null;
      })
      .filter((name): name is string => Boolean(name));
    allTags.push(...docTagNames);
  }

  return Array.from(
    new Set(
      allTags.filter(
        (tag: string) =>
          tag && tag !== "nan" && tag !== "null" && tag !== "undefined" && typeof tag === "string"
      )
    )
  );
}

function DocumentTagsDisplay({
  document,
  className,
  isMobile,
  emptyContent = null,
}: {
  readonly document: ExtendedDocumentFile;
  className?: string;
  isMobile: boolean;
  emptyContent?: ReactNode;
}) {
  const validTags = collectDocumentTagNames(document);
  const idBase = getDocumentId(document) || "doc";
  const items = validTags.map((name, i) => ({
    id: `${idBase}-tag-${i}`,
    name,
  }));

  return (
    <DocTagsCollapsible
      items={items}
      idPrefix={idBase}
      isMobile={isMobile}
      className={cn("max-w-[280px]", className)}
      emptyContent={emptyContent}
    />
  );
}


export const DocumentsSection = () => {
  // Subscribe to isAdmin separately to ensure re-renders when it changes
  const isAdmin = useStore((state) => state.isAdmin);
  const location = useLocation();
  const isAdminDashboard = location.pathname === "/admin-dashboard";
  const [documents, setDocuments] = useState<ExtendedDocumentFile[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
  // Default to public documents when on admin dashboard, otherwise private
  const [documentType, setDocumentType] = useState<DocumentType>(
    isAdminDashboard ? "public" : "private"
  );

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchTermRef = useRef(searchTerm);
  const [tableKey, setTableKey] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [docListFilters, setDocListFilters] = useState<{
    fileFormat: string;
    status: typeof DOC_FILTER_STATUS_ALL | "pending" | "failed" | "completed";
  }>({
    fileFormat: DOC_FILTER_FORMAT_ALL,
    status: DOC_FILTER_STATUS_ALL,
  });
  const docListFilterCount = useMemo(() => {
    let n = 0;
    if (docListFilters.fileFormat !== DOC_FILTER_FORMAT_ALL) n += 1;
    if (docListFilters.status !== DOC_FILTER_STATUS_ALL) n += 1;
    return n;
  }, [docListFilters]);

  const hasDocListActiveFilters = useMemo(() => {
    const hasSearch = searchTerm.trim().length > 0;
    if (documentType === "public" && isAdmin) {
      return hasSearch || docListFilterCount > 0;
    }
    return hasSearch;
  }, [searchTerm, documentType, isAdmin, docListFilterCount]);

  const clearAllDocumentsListFilters = () => {
    setSearchTerm("");
    setDocListFilters({
      fileFormat: DOC_FILTER_FORMAT_ALL,
      status: DOC_FILTER_STATUS_ALL,
    });
  };
  const docListFilterKey = `${docListFilters.fileFormat}|${docListFilters.status}`;
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [retryingDocuments, setRetryingDocuments] = useState<Set<string>>(new Set());
  const [pendingBulkIds, setPendingBulkIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const clearSelectionRef = useRef<(() => void) | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<ExtendedDocumentFile | null>(null);
  const [isSingleDeleting, setIsSingleDeleting] = useState(false);
  const [editingDocument, setEditingDocument] = useState<ExtendedDocumentFile | null>(null);
  /** Keeps latest rows for fetch logic without widening fetchDocuments deps. */
  const documentsRef = useRef<ExtendedDocumentFile[]>([]);
  /** After upload/refresh, avoid replacing the table with the full-page DashboardLoader. */
  const skipFullTableLoaderRef = useRef(false);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const reloadDocuments = useCallback(() => {
    skipFullTableLoaderRef.current = true;
    setTableKey((k) => k + 1);
  }, []);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(
      () => setDebouncedSearchTerm(searchTerm),
      DASHBOARD_SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setTableKey((k) => k + 1);
  }, [documentType, debouncedSearchTerm, docListFilterKey]);

  const handleConfirmDelete = async () => {
    if (pendingBulkIds.length === 0) return;

    setIsBulkDeleting(true);
    try {
      await rbacApi.documents.bulkDelete(pendingBulkIds);

      setPendingBulkIds([]);
      setIsDeleteDialogOpen(false);
      clearSelectionRef.current?.();

      reloadDocuments();
    } catch (error: any) {
      console.error("Error bulk deleting documents:", error);
      notify.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!documentToDelete) return;
    const docId = getDocumentId(documentToDelete);
    if (!docId) {
      notify.error("Document ID not found");
      return;
    }

    setIsSingleDeleting(true);
    try {
      await rbacApi.documents.delete(docId);
      setDocumentToDelete(null);
      reloadDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      notify.error(error);
    } finally {
      setIsSingleDeleting(false);
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchDocuments = useCallback(
    async (query: TableQueryParams) => {
      const skipFullLoader = skipFullTableLoaderRef.current;
      if (skipFullLoader) {
        skipFullTableLoaderRef.current = false;
      }
      /** Show table loader on fetch unless this is a silent refresh while rows are already visible. */
      const showTableLoader =
        !skipFullLoader || documentsRef.current.length === 0;

      try {
        setIsLoading(showTableLoader);
        setIsLoadingMore(false);
        setError(null);

        const limit = query.limit ?? 25;
        const offset = query.offset ?? 0;
        const sort_by = (query.sort_by as any) || "created_at";
        const sort_order = query.sort_order || "desc";

        let file_format: string | undefined;
        let has_failed: boolean | undefined;
        let status: number | undefined;
        let status_lt: number | undefined;

        if (documentType === "public" && isAdmin) {
          file_format =
            docListFilters.fileFormat !== DOC_FILTER_FORMAT_ALL
              ? docListFilters.fileFormat
              : undefined;
          if (docListFilters.status === "failed") {
            has_failed = true;
            status = undefined;
            status_lt = undefined;
          } else if (docListFilters.status === "completed") {
            has_failed = false;
            status = 100;
            status_lt = undefined;
          } else if (docListFilters.status === "pending") {
            has_failed = false;
            status = undefined;
            status_lt = 100;
          } else {
            has_failed = undefined;
            status = undefined;
            status_lt = undefined;
          }
        }

        let documentsData: ExtendedDocumentFile[] = [];
        let total = 0;

        if (documentType === "private") {
          const response = await rbacApi.documents.listPrivate({
            limit,
            offset,
            search: debouncedSearchTerm.trim() || undefined,
            sort_by,
            sort_order,
          });
          documentsData = response.documents || [];
          total = response.total ?? response.count ?? documentsData.length ?? 0;
        } else if (documentType === "public" && isAdmin) {
          const response = await rbacApi.documents.listPublic({
            limit,
            offset,
            search: debouncedSearchTerm.trim() || undefined,
            file_format,
            has_failed,
            status: status !== undefined && !Number.isNaN(status) ? status : undefined,
            status_lt:
              status_lt !== undefined && !Number.isNaN(status_lt) ? status_lt : undefined,
            sort_by,
            sort_order,
          });
          documentsData = response.documents || [];
          total = response.total ?? response.count ?? documentsData.length ?? 0;
        } else {
          // Fallback to old API for non-admin users viewing public
          const response = await fetch(
            `${API_CONFIG.LOCAL_API_BASE_URL}/files/document/list/common_files?offset=${offset}&limit=${limit}&search=${encodeURIComponent(
              debouncedSearchTerm.trim(),
            )}`,
            { credentials: "include" },
          );
          const parsedData = unwrapEnvelope<{ documents?: ExtendedDocumentFile[]; total?: number; count?: number }>(
            await response.json()
          );
          documentsData = parsedData.documents || [];
          total = parsedData.total ?? parsedData.count ?? documentsData.length ?? 0;
        }

        let normalizedDocuments = documentsData.map((doc: ExtendedDocumentFile) => ({
          ...doc,
          file_id: doc.file_id || doc.id?.toString() || doc.document_id?.toString() || "",
          file_name: doc.file_name || doc.name || "",
          created_at: doc.created_at || doc.updated_at,
        }));

        // If the document server ignores status_lt, keep only non-completed rows for “Pending”.
        if (
          documentType === "public" &&
          isAdmin &&
          docListFilters.status === "pending"
        ) {
          normalizedDocuments = normalizedDocuments.filter((doc) => {
            const statusValue = doc.status ?? doc.upload_status ?? 0;
            const raw =
              typeof statusValue === "number" ? statusValue : Number(statusValue);
            const numericStatus = Number.isNaN(raw)
              ? 0
              : Math.max(0, Math.min(100, Math.round(raw)));
            return numericStatus < 100;
          });
        }

        setDocuments(normalizedDocuments);
        setTotalDocuments(total);
        setError(null);
      } catch (error: any) {
        console.error("Error fetching documents:", error);
        const errorMessage = error.message || "Failed to load documents.";
        setError(errorMessage);
        notify.error(error);
        setDocuments([]);
        setTotalDocuments(0);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [documentType, isAdmin, debouncedSearchTerm, docListFilters],
  );

  // Poll document status for async processing
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
          reloadDocuments();
        }
      } catch (error) {
        console.error("Error polling document status:", error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleDownload = async (doc: ExtendedDocumentFile) => {


    const docId = getDocumentId(doc);
    const fileName = getDocumentName(doc);

    if (!docId) {
      notify.error("Document ID not found");
      return;
    }

    setDownloadingFiles((prev) => new Set(prev).add(docId));

    try {
      const blob = await rbacApi.documents.download(docId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      notify.error(error);
    } finally {
      setDownloadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const handleRetryUpload = async (doc: ExtendedDocumentFile) => {
    const docId = getDocumentId(doc);

    if (!docId) {
      notify.error("Document ID not found");
      return;
    }

    setRetryingDocuments((prev) => new Set(prev).add(docId));

    try {
      const response = await rbacApi.documents.retryUpload(docId);

      // Poll for document status if processing is in progress
      if (response.status !== undefined && response.status < 100) {
        const documentId = response.document_id || response.id;
        if (documentId) {
          pollDocumentStatus(documentId);
        }
      } else {
        // Refresh documents list after a short delay
        setTimeout(() => {
          reloadDocuments();
        }, 1000);
      }
    } catch (error: any) {
      console.error("Error retrying upload:", error);
      notify.error(error);
    } finally {
      setRetryingDocuments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };


  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
      Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
    );
  };


  const getDocumentStatusBadge = (document: ExtendedDocumentFile) => {
    // Support both old and new API structures
    const hasFailed = document.has_failed ?? false;
    const statusValue = document.status ?? document.upload_status ?? 0;
    const status = typeof statusValue === 'number' ? statusValue : typeof statusValue === 'string' ? Number(statusValue) : 0;
    const numericStatus = Number.isNaN(status) ? 0 : Math.max(0, Math.min(100, Math.round(status)));

    const badgeBaseClasses = `${isMobile ? 'text-2xs py-0.5' : 'text-xs py-0.5'} inline-flex items-center justify-center min-w-[6rem]`;
    const docId = getDocumentId(document);
    const isRetrying = docId ? retryingDocuments.has(docId) : false;

    if (hasFailed) {
      return (
        <DashboardPill
          as="button"
          intent="status"
          status="error"
          className={`${badgeBaseClasses} cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
          icon={
            isRetrying ? (
              <DashboardLoader size="xs" variant="inline" className="shrink-0" />
            ) : (
              <RefreshCw className="shrink-0" size={14} />
            )
          }
          label={isRetrying ? "Retrying..." : "Failed"}
          buttonProps={{
            onClick: (e) => {
              e.stopPropagation();
              handleRetryUpload(document);
            },
            disabled: isRetrying,
            title: "Retry upload",
          }}
        />
      );
    }

    if (numericStatus === 100) {
      return (
        <StatusBadge status="success" label="Completed" icon={<CheckCircle size={14} />} className={badgeBaseClasses} />
      );
    }

    if (numericStatus > 0 && numericStatus < 100) {
      return (
        <StatusBadge status="pending" label={`${numericStatus}%`} icon={<DashboardLoader size="xs" variant="inline" className="shrink-0" />} className={badgeBaseClasses} />
      );
    }

    return (
      <StatusBadge status="neutral" label="Queued" icon={<Clock size={14} />} className={badgeBaseClasses} />
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    reloadDocuments();
    setIsRefreshing(false);
  };

  // Define columns for DataTable
  const columns: ColumnConfig<ExtendedDocumentFile>[] = useMemo(() => {
    const baseColumns: ColumnConfig<ExtendedDocumentFile>[] = [
      {
        key: "name",
        header: "Document",
        type: "text",
        width: 340,
        searchable: true,
        sortable: true,
        render: (_, document) => {
          const docName = getDocumentName(document);
          const formatLabel = (document.file_format || "unknown").toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <DocFileIcon
                format={document.file_format}
                name={getDocumentName(document)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text-main truncate text-sm">
                    {docName}
                  </p>
                  {(document.is_private !== undefined) && (
                    <StatusBadge
                      status={document.is_private ? "info" : "success"}
                      label={document.is_private ? "Private" : "Public"}
                      icon={document.is_private ? <Lock size={12} /> : <Globe size={12} />}
                      className="text-xs"
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-text-muted">
                  {formatLabel}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: "description",
        header: "Description",
        type: "text",
        width: 350,
        searchable: true,
        render: (_, document) => {

            return (
              <span className="text-sm text-text-muted">
                {document.doc_desc || "—"}
              </span>
            );
        },
      },
      {
        key: "doc_tags",
        header: "Doc Tags",
        type: "custom",
        width: 240,
        searchable: true,
        accessor: (row) => collectDocumentTagNames(row).join(" "),
        render: (_, document) => (
          <DocumentTagsDisplay
            document={document}
            className="mt-0"
            isMobile={isMobile}
            emptyContent={<span className="text-sm text-text-muted">—</span>}
          />
        ),
      },
      {
        key: "file_size",
        header: "Size",
        type: "number",
        width: 100,
        sortable: true,
        render: (_, document) => (
          <span className="text-sm text-text-muted">
            {formatFileSize(document.file_size ?? null)}
          </span>
        ),
      },
      {
        key: "user_id",
        header: "Uploaded by",
        type: "text",
        width: 150,
        searchable: true,
        // Remove custom render to let DataTable handle text display with show more/less
      },
      {
        key: "status",
        header: "Status",
        type: "custom",
        width: 120,
        sortable: true,
        render: (_, document) => getDocumentStatusBadge(document),
      },
      {
        key: "created_at",
        header: "Date",
        type: "date",
        width: 150,
        sortable: true,
        render: (_, document) => (
          <span className="text-sm text-text-muted">
            {formatDashboardDate(document.created_at || document.updated_at || "")}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Action",
        type: "custom",
        width: 168,
        render: (_, document) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setEditingDocument(document);
              }}
              className={dashboardRowEditIconButtonClass}
              title="Edit document"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(document);
              }}
              disabled={downloadingFiles.has(getDocumentId(document))}
              className={dashboardRowPrimaryIconButtonClass}
              title="Download document"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDocumentToDelete(document);
              }}
              className={dashboardRowDeleteIconButtonClass}
              title="Delete document"
              disabled={isSingleDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];

    return baseColumns;
  }, [
    retryingDocuments,
    downloadingFiles,
    isSingleDeleting,
  ]);

  return (
    <TabsContent
      value="documents"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <div className="relative z-10">
        <DashboardTabHeader
          title="Document Management"
          description="Upload and manage system documents and files"
          descriptionClassName="text-text-main text-sm sm:text-base sm:mb-0 mb-0"
          headerClassName={cn(
            dashboardTabCardHeaderClassName,
            "relative z-10",
            !isAdminDashboard && "border-b-0 pb-0"
          )}
          actions={
                    <DashboardTabToolbar
                      primary={
                        <>
                    <DashboardTabSearchInput
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {documentType === "public" && isAdmin && (
                      <DashboardTabFiltersPopover
                        filterCount={docListFilterCount}
                        align="end"
                        onClear={() =>
                          setDocListFilters({
                            fileFormat: DOC_FILTER_FORMAT_ALL,
                            status: DOC_FILTER_STATUS_ALL,
                          })
                        }
                      >
                        <DashboardTabSearchableSelect
                          label="File format"
                          options={DOCUMENT_FILE_FORMAT_FILTER_OPTIONS}
                          value={docListFilters.fileFormat}
                          onValueChange={(value) =>
                            setDocListFilters((prev) => ({ ...prev, fileFormat: value }))
                          }
                          placeholder="Search formats..."
                        />
                        <DashboardTabSearchableSelect
                          label="Status"
                          options={[
                            { label: "Any status", value: DOC_FILTER_STATUS_ALL },
                            { label: "Pending", value: "pending" },
                            { label: "Failed", value: "failed" },
                            { label: "Completed", value: "completed" },
                          ]}
                          value={docListFilters.status}
                          onValueChange={(value) =>
                            setDocListFilters((prev) => ({
                              ...prev,
                              status: value as typeof prev.status,
                            }))
                          }
                          placeholder="Search..."
                        />
                      </DashboardTabFiltersPopover>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 max-lg:px-2 flex items-center gap-2"
                      onClick={() => setIsUploadDialogOpen(true)}
                      title="Upload documents"
                    >
                      <Upload size={18} />
                    </Button>
                        </>
                      }
                      refresh={
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 max-lg:px-2"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refresh documents"
                          >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                      }
                    />
          }
        />
                  {!isAdminDashboard && (
                    <div className="w-full border-b border-border-main px-4 pb-4 sm:px-6">
                      <Tabs value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="private" className="flex items-center gap-2">
                            <Lock size={16} />
                            <span>Private Documents</span>
                          </TabsTrigger>
                          <TabsTrigger
                            value="public"
                            className="flex items-center gap-2"
                            disabled={!isAdmin}
                          >
                            <Globe size={16} />
                            <span>Public Documents</span>
                            {!isAdmin && (
                              <Badge variant="secondary" className="ml-1 text-xs">Admin Only</Badge>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  )}
        </div>

        {hasDocListActiveFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllDocumentsListFilters}>
            {documentType === "public" &&
              isAdmin &&
              docListFilters.fileFormat !== DOC_FILTER_FORMAT_ALL && (
                <DashboardTabFilterChip
                  onRemove={() =>
                    setDocListFilters((prev) => ({
                      ...prev,
                      fileFormat: DOC_FILTER_FORMAT_ALL,
                    }))
                  }
                  ariaLabel="Clear file format filter"
                >
                  <span className="truncate">
                    Format:{" "}
                    {DOCUMENT_FILE_FORMAT_FILTER_OPTIONS.find(
                      (o) => o.value === docListFilters.fileFormat
                    )?.label ?? docListFilters.fileFormat}
                  </span>
                </DashboardTabFilterChip>
              )}
            {documentType === "public" &&
              isAdmin &&
              docListFilters.status !== DOC_FILTER_STATUS_ALL && (
                <DashboardTabFilterChip
                  onRemove={() =>
                    setDocListFilters((prev) => ({
                      ...prev,
                      status: DOC_FILTER_STATUS_ALL,
                    }))
                  }
                  ariaLabel="Clear status filter"
                >
                  <span className="truncate">
                    Status:{" "}
                    {docListFilters.status === "pending"
                      ? "Pending"
                      : docListFilters.status === "failed"
                        ? "Failed"
                        : docListFilters.status === "completed"
                          ? "Completed"
                          : docListFilters.status}
                  </span>
                </DashboardTabFilterChip>
              )}
            <DashboardTabSearchFilterChip
              query={searchTerm}
              onClear={() => setSearchTerm("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

      <CardContent className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          ref={scrollContainerRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
                    <DeleteConfirmationModal
              isOpen={isDeleteDialogOpen}
              onClose={() => setIsDeleteDialogOpen(false)}
              onConfirm={handleConfirmDelete}
              title={`Delete ${pendingBulkIds.length} Document${pendingBulkIds.length !== 1 ? "s" : ""}?`}
              description="This action cannot be undone."
              itemName={
                pendingBulkIds.length > 0
                  ? `${pendingBulkIds.length} document${
                      pendingBulkIds.length !== 1 ? "s" : ""
                    }`
                  : undefined
              }
              isLoading={isBulkDeleting}
                    />

                    <DeleteConfirmationModal
                      isOpen={documentToDelete !== null}
                      onClose={() => setDocumentToDelete(null)}
                      onConfirm={handleConfirmSingleDelete}
                      title="Delete Document?"
                      description="This action cannot be undone."
                      itemName={
                        documentToDelete ? getDocumentName(documentToDelete) : undefined
                      }
                      isLoading={isSingleDeleting}
                    />

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-4">
                        {error && !isLoading && !isLoadingMore ? (
                        <div className="flex min-h-0 flex-1 justify-center overflow-auto p-8">
                                <ErrorRetry
                                  error={error}
                            onRetry={() => reloadDocuments()}
                                  isLoading={isLoading}
                                />
                              </div>
                      ) : (
                        <DataTable
                          key={tableKey}
                          columns={columns}
                          data={documents}
                          isLoading={isLoading}
                {...dashboardTableLoadingProps}
                          emptyMessage={
                            searchTerm
                              ? "No documents found matching your filters."
                              : "No documents uploaded yet."
                          }
                          loadingMessage="Loading documents..."
                          pageSizeOptions={PAGE_SIZE_OPTIONS}
                          getRowId={(document) => getDocumentId(document) || document.name || ""}
                          className={dashboardAdminTableClassName}
                          serverSide
                          totalItems={totalDocuments}
                          onQueryChange={(query) => fetchDocuments(query)}
                          enableGlobalSearch={false}
                          enableFilters={false}
                          enableRowSelection
                          renderBulkActions={(selectedIds, clearSelection) => {
                            clearSelectionRef.current = clearSelection;
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-status-error hover:text-status-error border-status-error/30 hover:border-status-error/60"
                                onClick={() => {
                                  setPendingBulkIds([...selectedIds] as string[]);
                                  setIsDeleteDialogOpen(true);
                                }}
                                disabled={isBulkDeleting}
                                title="Delete selected documents"
                              >
                                {isBulkDeleting ? (
                                  <DashboardLoader variant="inline" />
                                ) : (
                                  <Trash2 className="h-3 w-3 mr-1" />
                                )}
                                Delete
                              </Button>
                            );
                          }}
                        />
                      )}
                    </div>
        </motion.div>
      </CardContent>
    </Card>

    {/* Edit Document Dialog */}
    <EditDocumentDialog
      isOpen={editingDocument !== null}
      onClose={() => setEditingDocument(null)}
      document={editingDocument}
      isPrivate={documentType === "private"}
      onUpdateSuccess={() => {
        reloadDocuments();
        setEditingDocument(null);
      }}
    />

    <DocumentUploadDialog
      isOpen={isUploadDialogOpen}
      onClose={() => setIsUploadDialogOpen(false)}
      onUploadSuccess={reloadDocuments}
      isAdminDashboard={isAdminDashboard}
      isAdmin={isAdmin}
    />
  </TabsContent>
);
};



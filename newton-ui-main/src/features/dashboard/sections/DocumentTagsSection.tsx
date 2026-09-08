import { Dispatch, SetStateAction, useMemo } from "react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DashboardTabSearchInput,
  DashboardTabActiveFiltersBar,
  DashboardTabSearchFilterChip,
} from "../components/DashboardTabFilterUi";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { DashboardPill } from "../components/DashboardPill";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { ErrorRetry } from "../components/ErrorRetry";
import { DocumentTag } from "@/services/rbac/rbacApi";
import { SquarePen, Trash2, ChevronDown, ChevronUp, RefreshCw, Plus } from "lucide-react";
import { formatDashboardDate } from "@/utils/helper";
import { formatLastUpdated } from "../utils/dashboardHelper";
import { useIsTextTruncated } from "@/hooks/useIsTextTruncated";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { cn } from "@/lib/utils";

interface TagDescriptionProps {
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const TagDescription = ({ description, isExpanded, onToggle }: TagDescriptionProps) => {
  const { ref, isTruncated } = useIsTextTruncated(description, true, false, isExpanded, 2);

  return (
    <>
      <p
        ref={ref}
        className={`text-sm text-text-muted whitespace-pre-wrap leading-normal ${
          isExpanded ? "" : "line-clamp-2"
        }`}
      >
        {description}
      </p>
      {description && description !== "No description provided" && isTruncated && (
        <button
          className="mt-1.5 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
          onClick={onToggle}
        >
          {isExpanded ? (
            <>
              <span>Show less</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Show more</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </>
  );
};

export interface DocumentTagsSectionProps {
  isAdmin: boolean;
  docTagSearch: string;
  setDocTagSearch: (value: string) => void;
  documentTags: DocumentTag[];
  docTagsLoading: boolean;
  docTagsError: string | null;
  retryDocTags: () => void;
  setEditingDocTag: (tag?: DocumentTag) => void;
  setIsDocTagFormOpen: (open: boolean) => void;
  handleDeleteDocumentTag: (tagId: number, tagName: string) => void;
  expandedDocTagDescriptions: Set<number>;
  setExpandedDocTagDescriptions: Dispatch<SetStateAction<Set<number>>>;
  docTagPage: number;
  setDocTagPage: (page: number) => void;
  docTagPageSize: number;
  setDocTagPageSize: (size: number) => void;
  docTagTotal: number;
  isMobile: boolean;
}

export const DocumentTagsSection = ({
  isAdmin,
  docTagSearch,
  setDocTagSearch,
  documentTags,
  docTagsLoading,
  docTagsError,
  retryDocTags,
  setEditingDocTag,
  setIsDocTagFormOpen,
  handleDeleteDocumentTag,
  expandedDocTagDescriptions,
  setExpandedDocTagDescriptions,
  docTagPage,
  setDocTagPage,
  docTagPageSize,
  setDocTagPageSize,
  docTagTotal,
  isMobile,
}: Readonly<DocumentTagsSectionProps>) => {
  const hasActiveFilters = docTagSearch.trim().length > 0;

  const clearAllDocTagListFilters = () => {
    setDocTagSearch("");
  };
  const toggleDescription = (tagId: number) => {
    setExpandedDocTagDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const columns: ColumnConfig<DocumentTag>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        type: "text",
        width: 180,
        render: (_, tag) => (
          <DashboardPill intent="entity" entity="doc-tag" label={tag.name} truncate className="max-w-full" />
        ),
      },
      {
        key: "description",
        header: "Description",
        type: "custom",
        width: 380,
        render: (_, tag) => (
          <div className="max-w-md min-w-0">
            <TagDescription
              description={tag.description || "No description provided"}
              isExpanded={expandedDocTagDescriptions.has(tag.id)}
              onToggle={() => toggleDescription(tag.id)}
            />
          </div>
        ),
      },
      {
        key: "created_at",
        header: "Created At",
        type: "date",
        width: 160,
        render: (_, tag) => (
          <span className="text-sm text-text-muted">
            {formatDashboardDate(tag.created_at)}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: "Last Updated",
        type: "date",
        width: 160,
        render: (_, tag) => (
          <span className="text-sm text-text-muted tabular-nums whitespace-nowrap">
            {formatLastUpdated(tag.updated_at)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        width: 120,
        render: (_, tag) => (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={() => {
                setEditingDocTag(tag);
                setIsDocTagFormOpen(true);
              }}
              title={!isAdmin ? "Admin privileges required" : "Edit document tag"}
              className={dashboardRowEditIconButtonClass}
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={() =>
                handleDeleteDocumentTag(tag.id, tag.name || `Document Tag #${tag.id}`)
              }
              title={!isAdmin ? "Admin privileges required" : "Delete document tag"}
              className={dashboardRowDeleteIconButtonClass}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, expandedDocTagDescriptions, setEditingDocTag, setIsDocTagFormOpen, handleDeleteDocumentTag]
  );

  return (
    <TabsContent value="doc-tags" className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Document Tag Management"
          description="Organize documents with tags"
          titleRowEnd={
            <Button
              className="flex md:hidden lg:hidden p-1"
              variant="outline"
              size="sm"
              disabled={!isAdmin}
              onClick={() => {
                setEditingDocTag(undefined);
                setIsDocTagFormOpen(true);
              }}
              title={!isAdmin ? "Admin privileges required" : ""}
            >
              <Plus className="h-4 w-4" />
              Add Doc Tag
              {!isAdmin && (
                <span className="ml-1 text-xs text-text-main">
                  (Admin Only)
                </span>
              )}
            </Button>
          }
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                <DashboardTabSearchInput
                  placeholder="Search tags..."
                  value={docTagSearch}
                  onChange={(e) => setDocTagSearch(e.target.value)}
                />
              <Button
                variant="outline"
                size="sm"
                className="hidden h-10 max-lg:px-2 sm:flex"
                disabled={!isAdmin}
                onClick={() => {
                  setEditingDocTag(undefined);
                  setIsDocTagFormOpen(true);
                }}
                title={!isAdmin ? "Admin privileges required" : "Add document tag"}
              >
                <Plus className="h-4 w-4" />
                <span className={dashboardTabToolbarButtonLabelClassName}>
                  Add Doc Tag
                  {!isAdmin && (
                    <span className="ml-1 text-xs text-text-main">
                      (Admin Only)
                    </span>
                  )}
                </span>
              </Button>
                  </>
                }
                refresh={
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={retryDocTags}
                disabled={docTagsLoading}
                title="Refresh document tags"
              >
                <RefreshCw className={`h-4 w-4 ${docTagsLoading ? 'animate-spin' : ''}`} />
              </Button>
                }
              />
          }
        />

        {hasActiveFilters && (
          <div className="relative z-10">
            <DashboardTabActiveFiltersBar onClearAll={clearAllDocTagListFilters}>
              <DashboardTabSearchFilterChip
                query={docTagSearch}
                onClear={() => setDocTagSearch("")}
              />
            </DashboardTabActiveFiltersBar>
          </div>
        )}

        <CardContent className="text-text-main flex-1 min-h-0 overflow-y-auto relative z-10">
          {docTagsError && !docTagsLoading ? (
            <div className="p-4">
              <ErrorRetry error={docTagsError} onRetry={retryDocTags} isLoading={docTagsLoading} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={documentTags}
              isLoading={docTagsLoading}
                {...dashboardTableLoadingProps}
              disablePagination
              enableFilters={false}
              enableGlobalSearch={false}
              enableRowSelection
              emptyMessage={
                docTagSearch.trim()
                  ? "No document tags found matching your search."
                  : "No document tags found. Create your first tag to get started."
              }
              loadingMessage="Loading document tags..."
              getRowId={(tag) => `doc-tag-${tag.id}`}
              className={dashboardAdminTableClassName}
            />
          )}
        </CardContent>
        <EnhancedPagination
          currentPage={docTagPage}
          setCurrentPage={setDocTagPage}
          pageSize={docTagPageSize}
          setPageSize={setDocTagPageSize}
          totalItems={docTagTotal}
          displayedItemsCount={documentTags.length}
          isMobile={isMobile}
        />
      </Card>
    </TabsContent>
  );
};



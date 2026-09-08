import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
import {
  ChevronDown,
  SquarePen,
  Trash2,
  X,
  RefreshCw,
  Plus,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DashboardPill } from "../components/DashboardPill";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
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
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { ErrorRetry } from "../components/ErrorRetry";
import { rbacApi, Tag, Tool } from "@/services/rbac/rbacApi";
import { formatDashboardDate } from "@/utils/helper";
import { formatLastUpdated } from "../utils/dashboardHelper";
import { useIsTextTruncated } from "@/hooks/useIsTextTruncated";
import { DataTable, ColumnConfig } from "@/components/DataTable";
import { cn } from "@/lib/utils";

interface TagDescriptionProps {
  description: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fixed two-line height so every row matches; full text is revealed in a popover
// instead of expanding the row inline.
const TagDescription = ({ description, isOpen, onOpenChange }: TagDescriptionProps) => {
  const { ref, isTruncated } = useIsTextTruncated(description, true, false, false, 2);
  const isPlaceholder = !description || description === "No description available";

  const clampedText = (
    <p
      ref={ref}
      className="text-sm text-text-muted whitespace-pre-wrap leading-normal line-clamp-2 min-h-[2.625rem]"
    >
      {description}
    </p>
  );

  if (isPlaceholder || !isTruncated) {
    return clampedText;
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left cursor-pointer"
          title="Show full description"
        >
          {clampedText}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-h-60 overflow-y-auto scrollbar-themed bg-background text-text-main"
      >
        <p className="text-sm whitespace-pre-wrap leading-normal text-text-muted">
          {description}
        </p>
      </PopoverContent>
    </Popover>
  );
};

export interface TagsSectionProps {
  isAdmin: boolean;
  isUserAdmin?: boolean;
  isMobile: boolean;
  tagSearch: string;
  setTagSearch: (value: string) => void;
  selectedTagTools: string[];
  setSelectedTagTools: (tools: string[]) => void;
  tags: Tag[];
  tagsLoading: boolean;
  tagsError: string | null;
  retryTags: () => void;
  tagPage: number;
  setTagPage: (page: number) => void;
  tagPageSize: number;
  setTagPageSize: (size: number) => void;
  tagTotal: number;
  expandedTags: Set<number>;
  setExpandedTags: Dispatch<SetStateAction<Set<number>>>;
  expandedTagDescriptions: Set<number>;
  setExpandedTagDescriptions: Dispatch<SetStateAction<Set<number>>>;
  setIsTagFormOpen: (open: boolean) => void;
  setEditingTag: (tag?: Tag) => void;
  handleDeleteTag: (tagId: number, tagName: string) => void;
}

export const TagsSection = ({
  isAdmin,
  isUserAdmin = false,
  isMobile,
  tagSearch,
  setTagSearch,
  selectedTagTools,
  setSelectedTagTools,
  tags,
  tagsLoading,
  tagsError,
  retryTags,
  tagPage,
  setTagPage,
  tagPageSize,
  setTagPageSize,
  tagTotal,
  expandedTags,
  setExpandedTags,
  expandedTagDescriptions,
  setExpandedTagDescriptions,
  setIsTagFormOpen,
  setEditingTag,
  handleDeleteTag,
}: Readonly<TagsSectionProps>) => {
  const fetchToolNames = useCallback(async (): Promise<string[]> => {
    try {
      // Skip API call for user admins
      if (isUserAdmin) {
        return [];
      }
      const response = await rbacApi.tools.list({ limit: 1000, offset: 0, isUserAdmin });
      if (response.success) {
        return response.data.map((tool: Tool) => tool.name);
      }
      return [];
    } catch (error) {
      console.error("Error fetching tools:", error);
      return [];
    }
  }, [isUserAdmin]);

  const handleClearFilters = () => {
    setSelectedTagTools([]);
  };

  const filterPopoverCount = selectedTagTools.length;

  const hasActiveFilters =
    tagSearch.trim().length > 0 || selectedTagTools.length > 0;

  const clearAllTagListFilters = () => {
    setTagSearch("");
    handleClearFilters();
  };

  const toggleTagExpansion = (tagId: number) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const toggleDescriptionExpansion = (tagId: number) => {
    setExpandedTagDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const columns: ColumnConfig<Tag>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        type: "text",
        width: 180,
        render: (_, tag) => (
          <div className="min-w-0 max-w-full">
            <DashboardPill intent="entity" entity="tool-tag" label={tag.name} truncate className="max-w-full" />
          </div>
        ),
      },
      {
        key: "description",
        header: "Description",
        type: "custom",
        width: 340,
        render: (_, tag) => (
          <div className="max-w-md min-w-0">
            <TagDescription
              description={tag.description || "No description available"}
              isOpen={expandedTagDescriptions.has(tag.id)}
              onOpenChange={() => toggleDescriptionExpansion(tag.id)}
            />
          </div>
        ),
      },
      {
        key: "tool_names",
        header: "Tools",
        type: "custom",
        width: 320,
        render: (_, tag) => {
          const toolNames = tag.tool_names || [];
          const visibleTools = toolNames.slice(0, 1);
          const hiddenTools = toolNames.slice(1);
          const chip = (toolName: string, key: string, className?: string) => (
            <DashboardPill
              key={key}
              intent="neutral"
              label={toolName}
              truncate
              className={cn("max-w-[160px]", className)}
              title={toolName}
            />
          );

          if (toolNames.length === 0) {
            return <span className="text-xs text-text-muted italic">No tools assigned</span>;
          }

          return (
            <div className="flex items-center gap-2 min-w-0">
              {/* Visible chips: each truncates cleanly; the trigger is never pushed out */}
              <div className="flex flex-nowrap items-center gap-2 min-w-0">
                {visibleTools.map((toolName) =>
                  chip(toolName, `${tag.id}-${toolName}`),
                )}
              </div>
              {hiddenTools.length > 0 && (
                <Popover
                  open={expandedTags.has(tag.id)}
                  onOpenChange={() => toggleTagExpansion(tag.id)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-3 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 transition-all duration-200 rounded-full border border-primary/20 hover:border-primary/40"
                    >
                      +{hiddenTools.length} more
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-72 max-h-60 overflow-y-auto scrollbar-themed bg-background text-text-main"
                  >
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      All tools ({toolNames.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {toolNames.map((toolName) =>
                        chip(toolName, `${tag.id}-all-${toolName}`),
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        },
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
                setEditingTag(tag);
                setIsTagFormOpen(true);
              }}
              title={!isAdmin ? "Admin privileges required" : "Edit tag"}
              className={dashboardRowEditIconButtonClass}
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!isAdmin}
              onClick={() => handleDeleteTag(tag.id, tag.name || `Tag #${tag.id}`)}
              title={!isAdmin ? "Admin privileges required" : "Delete tag"}
              className={dashboardRowDeleteIconButtonClass}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, expandedTags, expandedTagDescriptions, setEditingTag, setIsTagFormOpen, handleDeleteTag]
  );

  return (
    <TabsContent value="tags" className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Tool Tag Management"
          description="Organize tools with tags"
          titleRowEnd={
            <Button
              className="flex sm:hidden p-1"
              variant="outline"
              size="sm"
              disabled={!isAdmin}
              onClick={() => {
                setEditingTag(undefined);
                setIsTagFormOpen(true);
              }}
              title={!isAdmin ? "Admin privileges required" : ""}
            >
              <Plus className="h-4 w-4" />
              Add Tool Tag 
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
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                />
                <DashboardTabFiltersPopover
                  filterCount={filterPopoverCount}
                  onClear={handleClearFilters}
                >
                  <div className="space-y-2">
                    <Label className="text-text-main">Tool names</Label>
                    <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto sm:max-h-none">
                      {selectedTagTools.map((toolName) => (
                        <Badge
                          key={toolName}
                          variant="secondary"
                          className="flex items-center gap-1 border-border-main bg-background text-text-main"
                        >
                          {toolName}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedTagTools(selectedTagTools.filter((t) => t !== toolName))
                            }
                            className="ml-1 rounded-full p-0.5 hover:bg-surface"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    <Combobox
                      placeholder="Search and select tool names to add..."
                      onOpen={fetchToolNames}
                      onSelect={(toolName: string | string[]) => {
                        if (Array.isArray(toolName)) {
                          setSelectedTagTools(toolName);
                        } else if (!selectedTagTools.includes(toolName)) {
                          setSelectedTagTools([...selectedTagTools, toolName]);
                        }
                      }}
                      defaultValue={selectedTagTools}
                      className="text-text-main border-border-main"
                    />
                  </div>
                </DashboardTabFiltersPopover>
              <Button
                variant="outline"
                size="sm"
                className="hidden h-10 max-lg:px-2 sm:flex"
                disabled={!isAdmin}
                onClick={() => {
                  setEditingTag(undefined);
                  setIsTagFormOpen(true);
                }}
                title={!isAdmin ? "Admin privileges required" : "Add tool tag"}
              >
                <Plus className="h-4 w-4" />
                <span className={dashboardTabToolbarButtonLabelClassName}>
                  Add Tool Tag
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
                onClick={retryTags}
                disabled={tagsLoading}
                title="Refresh tags"
              >
                <RefreshCw className={`h-4 w-4 ${tagsLoading ? 'animate-spin' : ''}`} />
              </Button>
                }
              />
          }
        />

        {hasActiveFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllTagListFilters}>
            {selectedTagTools.map((toolName) => (
              <DashboardTabFilterChip
                key={toolName}
                onRemove={() =>
                  setSelectedTagTools(selectedTagTools.filter((t) => t !== toolName))
                }
                ariaLabel={`Remove ${toolName}`}
              >
                <span className="truncate">Tool: {toolName}</span>
              </DashboardTabFilterChip>
            ))}
            <DashboardTabSearchFilterChip
              query={tagSearch}
              onClear={() => setTagSearch("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <CardContent className="text-text-main flex-1 min-h-0 overflow-y-auto relative z-10">
          {tagsError && !tagsLoading ? (
            <div className="p-4">
              <ErrorRetry error={tagsError} onRetry={retryTags} isLoading={tagsLoading} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={tags}
              isLoading={tagsLoading}
                {...dashboardTableLoadingProps}
              disablePagination
              enableFilters={false}
              enableGlobalSearch={false}
              enableRowSelection
              emptyMessage={
                hasActiveFilters
                  ? "No tags found matching your filters."
                  : "No tags found. Create your first tag to get started."
              }
              loadingMessage="Loading tags..."
              getRowId={(tag) => `tool-tag-${tag.id}`}
              className={dashboardAdminTableClassName}
            />
          )}
        </CardContent>
        <EnhancedPagination
          currentPage={tagPage}
          setCurrentPage={setTagPage}
          pageSize={tagPageSize}
          setPageSize={setTagPageSize}
          totalItems={tagTotal}
          displayedItemsCount={tags.length}
          isMobile={isMobile}
        />
      </Card>
    </TabsContent>
  );
};



import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText, RefreshCw } from "lucide-react";
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
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Tool } from "@/services/rbac/rbacApi";
import { ErrorRetry } from "../components/ErrorRetry";
import { Combobox } from "@/components/ui/combobox";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import { DashboardPill } from "../components/DashboardPill";
import { formatLastUpdated } from "../utils/dashboardHelper";
import { getIconByName } from "@/utils/iconRegistry";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { useIsTextTruncated } from "@/hooks/useIsTextTruncated";

export interface ToolsSectionProps {
  tools: Tool[];
  toolSearch: string;
  setToolSearch: (value: string) => void;
  selectedToolTypes: string[];
  setSelectedToolTypes: (types: string[]) => void;
  selectedServerNames: string[];
  setSelectedServerNames: (names: string[]) => void;
  availableToolTypes: string[];
  availableServerNames: string[];
  toolsError: string | null;
  toolsLoading: boolean;
  retryTools: () => void;
  toolPage: number;
  setToolPage: (page: number) => void;
  toolPageSize: number;
  setToolPageSize: (size: number) => void;
  toolTotal: number;
  isMobile: boolean;
}

function cleanToolDescription(text: string): string {
  if (!text) return "No description";
  const lines = text.split("\n");
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.map((line) => line.trim()).join("\n").trim() || "No description";
}

function getToolRowId(tool: Tool): string {
  return tool.server_name
    ? `${tool.name}-${tool.server_name}-${tool.created_at}`
    : `${tool.name}-${tool.created_at}-${tool.updated_at}`;
}

function ToolDescription({
  description,
  isExpanded,
  onToggle,
}: {
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { ref, isTruncated } = useIsTextTruncated(description, true, false, isExpanded, 3);

  return (
    <>
      <p
        ref={ref}
        className={`text-sm text-text-muted whitespace-pre-wrap leading-normal ${
          isExpanded ? "" : "line-clamp-3"
        }`}
      >
        {description}
      </p>
      {description && description !== "No description" && isTruncated && (
        <button
          type="button"
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
}

export const ToolsSection = ({
  tools,
  toolSearch,
  setToolSearch,
  selectedToolTypes,
  setSelectedToolTypes,
  selectedServerNames,
  setSelectedServerNames,
  availableServerNames,
  toolsError,
  toolsLoading,
  retryTools,
  toolPage,
  setToolPage,
  toolPageSize,
  setToolPageSize,
  toolTotal,
  isMobile,
}: Readonly<ToolsSectionProps>) => {
  const [expandedToolDescriptions, setExpandedToolDescriptions] = useState<Set<string>>(
    new Set()
  );

  const toggleToolDescription = (rowId: string) => {
    setExpandedToolDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleClearToolFilters = () => {
    setSelectedToolTypes([]);
    setSelectedServerNames([]);
  };

  const filterPopoverCount = useMemo(() => {
    let n = 0;
    if (selectedToolTypes.length > 0) n += 1;
    if (selectedServerNames.length > 0) n += 1;
    return n;
  }, [selectedToolTypes.length, selectedServerNames.length]);

  const hasActiveFilters =
    toolSearch.trim().length > 0 || filterPopoverCount > 0;

  const clearAllToolListFilters = () => {
    setToolSearch("");
    handleClearToolFilters();
  };

  const columns: ColumnConfig<Tool>[] = useMemo(
    () => [
      {
        key: "tool",
        header: "TOOL",
        type: "custom",
        width: 320,
        align: "left",
        render: (_value, row) => {
          const ToolIcon = row.tool_icon ? getIconByName(row.tool_icon) : FileText;

          return (
            <div className="flex min-w-0 items-center gap-3 py-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ToolIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-main break-words">
                    {row.display_name || row.name}
                  </span>
                </div>
                {row.display_name && (
                  <code className="mt-0.5 block break-all font-mono text-xs text-text-muted">
                    {row.name}
                  </code>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "description",
        header: "DESCRIPTION",
        type: "custom",
        width: 380,
        align: "left",
        render: (_value, row) => {
          const rowId = getToolRowId(row);
          const description = cleanToolDescription(row.description || "");

          return (
            <div className="max-w-md min-w-0">
              <ToolDescription
                description={description}
                isExpanded={expandedToolDescriptions.has(rowId)}
                onToggle={() => toggleToolDescription(rowId)}
              />
            </div>
          );
        },
      },
      {
        key: "type",
        header: "TYPE",
        type: "custom",
        width: 120,
        align: "left",
        render: (_value, row) => (
          <DashboardPill intent="neutral" label={row.type} />
        ),
      },
      {
        key: "server_name",
        header: "SERVER",
        type: "custom",
        width: 180,
        align: "left",
        render: (_value, row) =>
          row.server_name ? (
            <DashboardPill
              intent="entity"
              entity="server"
              label={row.server_name}
              mono
              truncate
              className="max-w-full"
            />
          ) : (
            <span className="text-xs text-text-muted">—</span>
          ),
      },
      {
        key: "updated_at",
        header: "UPDATED",
        type: "custom",
        width: 100,
        align: "left",
        render: (_value, row) => (
          <span className="block whitespace-nowrap text-left text-sm text-text-muted">
            {formatLastUpdated(row.updated_at)}
          </span>
        ),
      },
    ],
    [expandedToolDescriptions]
  );

  return (
    <TabsContent value="tools" className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Available Tools"
          description="View available tools and their configurations"
          titleColumnClassName="m-5 sm:m-0"
          descriptionClassName="mb-0"
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                <DashboardTabSearchInput
                  placeholder="Search tools..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                />
                <DashboardTabFiltersPopover
                  filterCount={filterPopoverCount}
                  onClear={handleClearToolFilters}
                  align="end"
                >
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-text-main text-xs sm:text-sm">Tool Servers</Label>
                    <Combobox
                      multiple={false}
                      placeholder="Search & select tool server..."
                      onOpen={() => Promise.resolve(availableServerNames)}
                      onSelect={(value: string | string[]) => {
                        const next =
                          Array.isArray(value) ? value[0] : value;
                        setSelectedServerNames(next ? [next] : []);
                      }}
                      defaultValue={selectedServerNames}
                      options={availableServerNames}
                      className="text-xs sm:text-sm text-text-main border-border-main h-10"
                    />
                  </div>

                </DashboardTabFiltersPopover>
                  </>
                }
                refresh={
              <Button
                variant="outline"
                size="sm"
                className="h-10 max-lg:px-2"
                onClick={retryTools}
                disabled={toolsLoading}
                title="Refresh tools"
              >
                <RefreshCw
                  className={`h-4 w-4 ${toolsLoading ? "animate-spin" : ""}`}
                />
              </Button>
                }
              />
          }
        />

        {hasActiveFilters && (
          <DashboardTabActiveFiltersBar onClearAll={clearAllToolListFilters}>
            {selectedToolTypes.map((type) => (
              <DashboardTabFilterChip
                key={type}
                onRemove={() =>
                  setSelectedToolTypes(selectedToolTypes.filter((t) => t !== type))
                }
                ariaLabel={`Remove type ${type}`}
              >
                <span className="truncate">Type: {type}</span>
              </DashboardTabFilterChip>
            ))}
            {selectedServerNames.map((name) => (
              <DashboardTabFilterChip
                key={name}
                onRemove={() =>
                  setSelectedServerNames(selectedServerNames.filter((n) => n !== name))
                }
                ariaLabel={`Remove server ${name}`}
              >
                <span className="truncate">Server: {name}</span>
              </DashboardTabFilterChip>
            ))}
            <DashboardTabSearchFilterChip
              query={toolSearch}
              onClear={() => setToolSearch("")}
            />
          </DashboardTabActiveFiltersBar>
        )}

        <CardContent className="text-text-main flex-1 min-h-0 overflow-y-auto relative z-10 p-4 sm:p-6">
          {toolsError && !toolsLoading ? (
            <div className="p-4">
              <ErrorRetry
                error={toolsError}
                onRetry={retryTools}
                isLoading={toolsLoading}
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={tools}
              isLoading={toolsLoading}
              {...dashboardTableLoadingProps}
              disablePagination
              enableFilters={false}
              enableGlobalSearch={false}
              emptyMessage={
                toolSearch.trim() || filterPopoverCount > 0
                  ? "No tools found matching your filters."
                  : "No tools found."
              }
              loadingMessage="Loading tools..."
              getRowId={getToolRowId}
              className={cn("tools-table", dashboardAdminTableClassName)}
            />
          )}
        </CardContent>
        <EnhancedPagination
          currentPage={toolPage}
          setCurrentPage={setToolPage}
          pageSize={toolPageSize}
          setPageSize={setToolPageSize}
          totalItems={toolTotal}
          displayedItemsCount={tools.length}
          isMobile={isMobile}
        />
      </Card>
    </TabsContent>
  );
};

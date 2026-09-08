import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SquarePen,
  Trash2,
  RefreshCw,
  Plus,
  UserRound,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardPill } from "../components/DashboardPill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
  DashboardTabSearchableSelect,
} from "../components/DashboardTabFilterUi";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
  dashboardAdminTableClickableRowClassName,
} from "../components/DashboardTabLayout";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { ErrorRetry } from "../components/ErrorRetry";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { MemoryBlockSidebar } from "../components/MemoryBlockSidebar";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import {
  PersonaMemoryBlock,
  rbacApi,
} from "@/services/rbac/rbacApi";
import { useIsTextTruncated } from "@/hooks/useIsTextTruncated";
import { cn } from "@/lib/utils";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { formatLastUpdated } from "../utils/dashboardHelper";
import notify from "@/utils/notify";

interface BlockDescriptionCellProps {
  description: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const BlockDescriptionCell = ({ description, isOpen, onOpenChange }: BlockDescriptionCellProps) => {
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
        <button type="button" className="w-full text-left cursor-pointer" title="Show full description">
          {clampedText}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-h-60 overflow-y-auto scrollbar-themed bg-background text-text-main"
      >
        <p className="text-sm whitespace-pre-wrap leading-normal text-text-muted">{description}</p>
      </PopoverContent>
    </Popover>
  );
};

interface BlockCurrentValueCellProps {
  currentValue: string;
  onOpen: () => void;
}

// Fixed two-line preview in the row; full value opens in the detail sidebar.
const BlockCurrentValueCell = ({ currentValue, onOpen }: BlockCurrentValueCellProps) => {
  const { ref } = useIsTextTruncated(currentValue, true, false, false, 2);

  return (
    <button
      type="button"
      className="w-full text-left cursor-pointer rounded-sm transition-colors hover:text-text-main"
      title="View full value"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p
        ref={ref}
        className="text-xs text-text-muted whitespace-pre-wrap break-words leading-normal line-clamp-2 min-h-[2.625rem] overflow-hidden font-mono"
      >
        {currentValue}
      </p>
    </button>
  );
};

export interface PersonaMemoryBlocksSectionProps {
  isAdmin: boolean;
  isMobile: boolean;
  blockSearch: string;
  setBlockSearch: (value: string) => void;
  selectedPersonaId: number | null;
  setSelectedPersonaId: (personaId: number | null) => void;
  blocks: PersonaMemoryBlock[];
  blocksLoading: boolean;
  blocksError: string | null;
  retryBlocks: () => void;
  blockPage: number;
  setBlockPage: (page: number) => void;
  blockPageSize: number;
  setBlockPageSize: (size: number) => void;
  blockTotal: number;
  expandedBlocks: Set<string>;
  setExpandedBlocks: Dispatch<SetStateAction<Set<string>>>;
  setIsBlockFormOpen: (open: boolean) => void;
  setEditingBlock: (block?: PersonaMemoryBlock) => void;
  handleDeleteBlock: (personaId: number, blockId: string, label: string) => void;
}

export const PersonaMemoryBlocksSection = ({
  isAdmin,
  isMobile,
  blockSearch,
  setBlockSearch,
  selectedPersonaId,
  setSelectedPersonaId,
  blocks,
  blocksLoading,
  blocksError,
  retryBlocks,
  blockPage,
  setBlockPage,
  setBlockPageSize,
  blockPageSize,
  blockTotal,
  expandedBlocks,
  setExpandedBlocks,
  setIsBlockFormOpen,
  setEditingBlock,
  handleDeleteBlock,
}: Readonly<PersonaMemoryBlocksSectionProps>) => {
  const [personas, setPersonas] = useState<Array<{ id: number; name: string }>>([]);
  const [detailBlock, setDetailBlock] = useState<PersonaMemoryBlock | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string | number>>(new Set());
  const clearSelectionRef = useRef<(() => void) | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const getBlockPersonaId = useCallback((block: PersonaMemoryBlock | any): number | null => {
    const raw =
      block?.persona_id ??
      block?.personaId ??
      block?.persona?.id ??
      block?.persona?.persona_id;

    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, []);

  const getBlockKey = useCallback(
    (block: PersonaMemoryBlock) => {
      const blockPersonaId = getBlockPersonaId(block);
      return `${blockPersonaId ?? "unknown"}-${block.block_id}`;
    },
    [getBlockPersonaId]
  );

  const fetchPersonas = useCallback(async () => {
    try {
      const response = await rbacApi.personas.list({ limit: 1000, offset: 0, roots_only: true });
      if (response.success) {
        const personaOptions = response.data.map((p: any) => ({
          id: p.id || p.persona_id,
          name: p.persona_name || p.name || `Persona ${p.id || p.persona_id}`,
        }));
        setPersonas(personaOptions);
      }
    } catch (error) {
      console.error("Error fetching personas:", error);
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const toggleBlockExpansion = (blockKey: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockKey)) {
        next.delete(blockKey);
      } else {
        next.add(blockKey);
      }
      return next;
    });
  };

  const personaNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of personas) map.set(p.id, p.name);
    return map;
  }, [personas]);

  const personaFilterOptions = useMemo(
    () => [
      { label: "All Personas", value: "" },
      ...personas.map((p) => ({ label: p.name, value: String(p.id) })),
    ],
    [personas]
  );

  const getPersonaName = useCallback(
    (block: PersonaMemoryBlock): string => {
      const nestedName = (block as any).persona?.persona_name;
      if (nestedName) return nestedName;

      const personaId = getBlockPersonaId(block);
      if (personaId !== null) {
        return personaNameById.get(personaId) ?? `Persona ${personaId}`;
      }
      return "Unknown persona";
    },
    [getBlockPersonaId, personaNameById]
  );

  const handleClearFilters = () => {
    setSelectedPersonaId(null);
  };

  const hasActiveFilters =
    selectedPersonaId !== null || blockSearch.trim().length > 0;

  const openBlockDetail = useCallback((block: PersonaMemoryBlock) => {
    setDetailBlock(block);
    setDetailSheetOpen(true);
  }, []);

  const handleConfirmBulkDelete = async () => {
    if (selectedBlockIds.size === 0) return;

    setIsBulkDeleting(true);
    try {
      const blocksToDelete = blocks.filter((block) =>
        selectedBlockIds.has(getBlockKey(block)),
      );
      await Promise.all(
        blocksToDelete.map((block) => {
          const personaId = getBlockPersonaId(block);
          if (personaId === null) return Promise.resolve();
          return rbacApi.personaMemoryBlocks.delete(personaId, block.block_id);
        }),
      );

      clearSelectionRef.current?.();
      setSelectedBlockIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      retryBlocks();
    } catch (error) {
      console.error("Error bulk deleting memory blocks:", error);
      notify.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const columns: ColumnConfig<PersonaMemoryBlock>[] = useMemo(() => {
    const baseColumns: ColumnConfig<PersonaMemoryBlock>[] = [
      {
        key: "label",
        header: "LABEL",
        type: "custom",
        width: 180,
        align: "left",
        render: (_value, block) => (
          <span className="font-semibold text-text-main truncate block max-w-[180px]" title={block.label}>
            {block.label}
          </span>
        ),
      },
      {
        key: "persona",
        header: "PERSONA",
        type: "custom",
        width: 160,
        align: "left",
        render: (_value, block) => (
          <DashboardPill
            intent="entity"
            entity="persona"
            label={getPersonaName(block)}
            truncate
            className="max-w-[150px]"
          />
        ),
      },
      {
        key: "description",
        header: "DESCRIPTION",
        type: "custom",
        width: 280,
        align: "left",
        render: (_value, block) => {
          const blockKey = getBlockKey(block);
          const descriptionKey = `${blockKey}-description`;
          return (
            <div className="max-w-md min-w-0">
              <BlockDescriptionCell
                description={block.description || "No description available"}
                isOpen={expandedBlocks.has(descriptionKey)}
                onOpenChange={() => toggleBlockExpansion(descriptionKey)}
              />
            </div>
          );
        },
      },
      {
        key: "current_value",
        header: "CURRENT VALUE",
        type: "custom",
        width: 360,
        align: "left",
        render: (_value, block) => {
          if (!block.current_value) {
            return <span className="text-xs text-text-muted italic">No current value set</span>;
          }

          return (
            <div className="min-w-0 max-w-full">
              <BlockCurrentValueCell
                currentValue={block.current_value}
                onOpen={() => openBlockDetail(block)}
              />
            </div>
          );
        },
      },
      {
        key: "updated_at",
        header: "UPDATED",
        type: "custom",
        width: 100,
        align: "left",
        render: (_value, block) => (
          <span className="block text-left text-sm text-text-muted whitespace-nowrap">
            {formatLastUpdated(block.updated_at)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "ACTIONS",
        type: "custom",
        width: 120,
        align: "left",
        render: (_value, block) => {
          const blockPersonaId = getBlockPersonaId(block);
          return (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="icon"
                disabled={!isAdmin || blockPersonaId === null}
                onClick={() => {
                  if (blockPersonaId === null) return;
                  setEditingBlock({ ...(block as any), persona_id: blockPersonaId });
                  setIsBlockFormOpen(true);
                }}
                title={
                  !isAdmin
                    ? "Admin privileges required"
                    : blockPersonaId === null
                      ? "Missing persona id from API response"
                      : "Edit block"
                }
                className={dashboardRowEditIconButtonClass}
              >
                <SquarePen className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!isAdmin || blockPersonaId === null}
                onClick={() => {
                  if (blockPersonaId === null) return;
                  handleDeleteBlock(blockPersonaId, block.block_id, block.label);
                }}
                title={
                  !isAdmin
                    ? "Admin privileges required"
                    : blockPersonaId === null
                      ? "Missing persona id from API response"
                      : "Delete block"
                }
                className={dashboardRowDeleteIconButtonClass}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ];

    return baseColumns;
  }, [
    isAdmin,
    expandedBlocks,
    getBlockKey,
    getBlockPersonaId,
    getPersonaName,
    setEditingBlock,
    setIsBlockFormOpen,
    handleDeleteBlock,
    openBlockDetail,
  ]);

  return (
    <TabsContent
      value="shared-memory"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Shared Memory"
          description="Manage memory blocks shared across personas"
          descriptionClassName="mt-1 mb-0"
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                    <DashboardTabSearchInput
                      placeholder="Search by label or description"
                      value={blockSearch}
                      onChange={(e) => setBlockSearch(e.target.value)}
                    />

                    <DashboardTabFiltersPopover
                      filterCount={selectedPersonaId !== null ? 1 : 0}
                      onClear={handleClearFilters}
                    >
                      <DashboardTabSearchableSelect
                        label="Persona"
                        options={personaFilterOptions}
                        value={selectedPersonaId !== null ? String(selectedPersonaId) : ""}
                        onValueChange={(v) => {
                          if (!v) {
                            setSelectedPersonaId(null);
                            return;
                          }
                          const n = Number(v);
                          setSelectedPersonaId(Number.isFinite(n) ? n : null);
                        }}
                        placeholder="Search personas..."
                      />
                    </DashboardTabFiltersPopover>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 max-lg:px-2"
                      disabled={!isAdmin}
                      onClick={() => {
                        setEditingBlock(undefined);
                        setIsBlockFormOpen(true);
                      }}
                      title={!isAdmin ? "Admin privileges required" : "Add shared memory block"}
                    >
                      <Plus className="h-4 w-4" />
                      <span className={dashboardTabToolbarButtonLabelClassName}>
                        Add Shared Memory Block
                      </span>
                    </Button>
                  </>
                }
                refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={retryBlocks}
                    disabled={blocksLoading}
                    title="Refresh blocks"
                  >
                    <RefreshCw className={cn("h-4 w-4", blocksLoading && "animate-spin")} />
                  </Button>
                }
              />
          }
        />

        {hasActiveFilters && (
          <DashboardTabActiveFiltersBar
            onClearAll={() => {
              setSelectedPersonaId(null);
              setBlockSearch("");
            }}
          >
            {selectedPersonaId !== null && (
              <DashboardTabFilterChip
                onRemove={() => setSelectedPersonaId(null)}
                ariaLabel="Remove persona filter"
                className="max-w-[min(100%,280px)]"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  Persona: {personaNameById.get(selectedPersonaId) ?? `Persona ${selectedPersonaId}`}
                </span>
              </DashboardTabFilterChip>
            )}
            <DashboardTabSearchFilterChip query={blockSearch} onClear={() => setBlockSearch("")} />
          </DashboardTabActiveFiltersBar>
        )}

        <CardContent className="relative z-10 text-text-main flex-1 min-h-0 overflow-y-auto">
          {blocksError && !blocksLoading ? (
            <div className="p-4">
              <ErrorRetry error={blocksError} onRetry={retryBlocks} isLoading={blocksLoading} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={blocks}
              isLoading={blocksLoading}
              {...dashboardTableLoadingProps}
              disablePagination
              enableFilters={false}
              enableGlobalSearch={false}
              enableRowSelection={isAdmin}
              isRowSelectable={(block) => getBlockPersonaId(block) !== null}
              onSelectionChange={setSelectedBlockIds}
              renderBulkActions={
                isAdmin
                  ? (_ids, clear) => {
                      clearSelectionRef.current = clear;
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-status-error hover:text-status-error border-status-error/30 hover:border-status-error/60"
                          onClick={() => setIsBulkDeleteDialogOpen(true)}
                          title="Delete selected memory blocks"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      );
                    }
                  : undefined
              }
              onRowClick={(block) => {
                if (selectedBlockIds.size > 0) return;
                openBlockDetail(block);
              }}
              emptyMessage={
                hasActiveFilters
                  ? "No memory blocks match your current filters. Try adjusting search or persona."
                  : "No memory blocks found. Create your first block to get started."
              }
              loadingMessage="Loading memory blocks..."
              getRowId={(block) => getBlockKey(block)}
              className={cn(
                "shared-memory-table",
                dashboardAdminTableClassName,
                dashboardAdminTableClickableRowClassName,
              )}
            />
          )}
        </CardContent>
        <EnhancedPagination
          currentPage={blockPage}
          setCurrentPage={setBlockPage}
          pageSize={blockPageSize}
          setPageSize={setBlockPageSize}
          totalItems={blockTotal}
          displayedItemsCount={blocks.length}
          isMobile={isMobile}
        />
      </Card>

      <DeleteConfirmationModal
        isOpen={isBulkDeleteDialogOpen}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${selectedBlockIds.size} Memory Block${selectedBlockIds.size !== 1 ? "s" : ""}?`}
        description="This action cannot be undone."
        itemName={`${selectedBlockIds.size} memory block${selectedBlockIds.size !== 1 ? "s" : ""}`}
        isLoading={isBulkDeleting}
      />

      <MemoryBlockSidebar
        block={detailBlock}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setDetailBlock(null);
        }}
        blocks={blocks}
        getBlockKey={getBlockKey}
        getPersonaName={getPersonaName}
        getBlockPersonaId={getBlockPersonaId}
        isAdmin={isAdmin}
        onEdit={(block) => {
          const blockPersonaId = getBlockPersonaId(block);
          if (blockPersonaId === null) return;
          setDetailSheetOpen(false);
          setDetailBlock(null);
          setEditingBlock({ ...(block as any), persona_id: blockPersonaId });
          setIsBlockFormOpen(true);
        }}
        onDelete={(block) => {
          const blockPersonaId = getBlockPersonaId(block);
          if (blockPersonaId === null) return;
          setDetailSheetOpen(false);
          setDetailBlock(null);
          handleDeleteBlock(blockPersonaId, block.block_id, block.label);
        }}
        onNavigate={openBlockDetail}
      />
    </TabsContent>
  );
};

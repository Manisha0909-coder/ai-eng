import { useState, useEffect, useMemo, useRef } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { Plus, RefreshCw, Database, FileText, KeyRound, SquarePen, Trash2 } from "lucide-react";
import { EnhancedPagination } from "../components/EnhancedPagination";
import { ErrorRetry } from "../components/ErrorRetry";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { PersonaSidebar } from "../components/PersonaSidebar";
import { PersonaWizardModal } from "../components/PersonaWizard/PersonaWizardModal";
import type { PersonaWizardMode } from "../components/PersonaWizard/personaWizardTypes";
import { PersonaTypeAvatar } from "../components/PersonaTypeAvatar";
import { DashboardPill } from "../components/DashboardPill";
import { DataTable, type ColumnConfig } from "@/components/DataTable";
import { personasApi, type Persona } from "@/services/rbac/rbacApi";
import notify from "@/utils/notify";
import {
  countPersonaDatasources,
  countPersonaDocumentTags,
  countPersonaToolTags,
  formatRelativeTime,
} from "../utils/dashboardHelper";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";

export interface PersonasSectionProps {
  personaSearch: string;
  setPersonaSearch: (value: string) => void;
  personaTypeFilter: string | null;
  setPersonaTypeFilter: (value: string | null) => void;
  personaCurrentPage: number;
  setPersonaCurrentPage: (value: number) => void;
  personaPageSize: number;
  setPersonaPageSize: (value: number) => void;
  personaTotalItems: number;
  personas: Persona[];
  personasLoading: boolean;
  personasError: string | null;
  onOpenCreateModal: () => void;
  isMobile: boolean;
  retryPersonas: () => void;
}

export const PersonasSection = ({
  personaSearch,
  setPersonaSearch,
  personaTypeFilter,
  setPersonaTypeFilter,
  personaCurrentPage,
  setPersonaCurrentPage,
  personaPageSize,
  setPersonaPageSize,
  personaTotalItems,
  personas,
  personasLoading,
  personasError,
  onOpenCreateModal,
  isMobile,
  retryPersonas,
}: Readonly<PersonasSectionProps>) => {
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string | number>>(new Set());
  const clearSelectionRef = useRef<(() => void) | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<PersonaWizardMode>("version");
  const [wizardBasePersona, setWizardBasePersona] = useState<Persona | null>(null);

  const [detailPersona, setDetailPersona] = useState<Persona | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const detailSheetCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
  const [deleteMode, setDeleteMode] = useState<"persona" | "version">("persona");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filterPopoverCount = personaTypeFilter?.trim() ? 1 : 0;

  const hasActiveFilters =
    personaSearch.trim().length > 0 || filterPopoverCount > 0;

  useEffect(() => () => {
    if (detailSheetCloseTimerRef.current) {
      clearTimeout(detailSheetCloseTimerRef.current);
    }
  }, []);

  const clearDetailSheetCloseTimer = () => {
    if (detailSheetCloseTimerRef.current) {
      clearTimeout(detailSheetCloseTimerRef.current);
      detailSheetCloseTimerRef.current = null;
    }
  };

  const scheduleDetailPersonaClear = () => {
    clearDetailSheetCloseTimer();
    detailSheetCloseTimerRef.current = setTimeout(() => {
      setDetailPersona(null);
      detailSheetCloseTimerRef.current = null;
    }, 320);
  };

  const handleClearPersonaFilters = () => {
    setPersonaTypeFilter(null);
  };

  const handleClearAllPersonaListFilters = () => {
    setPersonaSearch("");
    handleClearPersonaFilters();
  };

  const openWizard = (mode: PersonaWizardMode, persona?: Persona | null) => {
    setWizardMode(mode);
    setWizardBasePersona(persona ?? null);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardBasePersona(null);
  };

  const handleDeleteDialogOpen = (
    persona: Persona,
    mode: "persona" | "version" = "persona",
  ) => {
    setPersonaToDelete(persona);
    setDeleteMode(mode);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setPersonaToDelete(null);
      setDeleteMode("persona");
      setDeleteLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!personaToDelete) return;

    try {
      setDeleteLoading(true);

      if (deleteMode === "persona") {
        const rootId = personaToDelete.parent_persona_id ?? personaToDelete.id;
        await personasApi.deletePersona(rootId);

        if (detailPersona) {
          const detailRootId = detailPersona.parent_persona_id ?? detailPersona.id;
          if (detailRootId === rootId) {
            setDetailPersona(null);
            setDetailSheetOpen(false);
          }
        }
      } else {
        const { id, parent_persona_id, current_version_id } = personaToDelete;
        const rootId = parent_persona_id ?? id;
        const versionId =
          parent_persona_id != null ? id : (current_version_id ?? id);
        await personasApi.deleteVersion(rootId, versionId);

        if (detailPersona?.id === personaToDelete.id) {
          setDetailPersona(null);
        }
      }

      if (personas.length === 1 && personaCurrentPage > 1) {
        setPersonaCurrentPage(personaCurrentPage - 1);
      } else {
        retryPersonas();
      }

      handleDeleteDialogChange(false);
    } catch (error) {
      console.error("Error deleting persona:", error);
      const message =
        error instanceof Error
          ? error.message
          : deleteMode === "persona"
            ? "Failed to delete persona"
            : "Failed to delete version";
      notify.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedPersonaIds.size === 0) return;

    setIsBulkDeleting(true);
    try {
      await personasApi.bulkDelete([...selectedPersonaIds] as number[]);
      clearSelectionRef.current?.();
      setSelectedPersonaIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      retryPersonas();
    } catch (error) {
      console.error("Error bulk deleting personas:", error);
      notify.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const columns: ColumnConfig<Persona>[] = useMemo(() => [
      {
        key: "persona",
        header: "Persona",
        type: "custom",
        width: 280,
        align: "left",
        render: (_value, row) => {
          const description =
            (row.persona_prompt ?? row.persona ?? "").trim().slice(0, 80) ||
            row.greeting_message?.trim().slice(0, 80) ||
            "No description";
          return (
            <div className="flex min-w-0 items-center gap-3 py-1">
              <PersonaTypeAvatar name={row.persona_name} type={row.type} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-main truncate">
                    {row.persona_name}
                  </span>
                  {row.is_default && (
                    <DashboardPill intent="status" status="info" label="Default" />
                  )}
                </div>
                <p className="text-xs text-text-muted truncate mt-0.5">
                  {description}
                  {(row.persona_prompt ?? row.persona ?? "").length > 80 ? "…" : ""}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        key: "model_id",
        header: "Model",
        type: "custom",
        width: 220,
        align: "left",
        render: (_value, row) =>
          row.model_id ? (
            <code className="inline-block max-w-full truncate rounded-md border border-border-main bg-background/60 px-2 py-1 font-mono text-xs text-text-muted">
              {row.model_id}
            </code>
          ) : (
            <span className="text-xs text-text-muted">—</span>
          ),
      },
      {
        key: "version",
        header: "Version",
        type: "custom",
        width: 90,
        align: "left",
        render: (_value, row) => (
          <span className="block text-left text-sm text-text-muted tabular-nums">
            {row.version != null ? `v${row.version}` : "—"}
          </span>
        ),
      },
      {
        key: "resources",
        header: "Resources",
        type: "custom",
        width: 140,
        align: "left",
        render: (_value, row) => {
          const tools = countPersonaToolTags(row.tool_tags);
          const datasources = countPersonaDatasources(row);
          const docs = countPersonaDocumentTags(row.document_tags);
          const autoTools = row.type === "dashboard" ? 1 : 0;
          const autoDocs = row.supports_documents ? 1 : 0;
          return (
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="inline-flex items-center gap-2" title="Tool tags">
                <KeyRound size={18} className="opacity-70" />
                {tools + autoTools}
              </span>
              <span className="inline-flex items-center gap-2" title="Data sources">
                <Database size={18} className="opacity-70" />
                {datasources}
              </span>
              <span className="inline-flex items-center gap-2" title="Document tags">
                <FileText size={18} className="opacity-70" />
                {docs + autoDocs}
              </span>
            </div>
          );
        },
      },
      {
        key: "updated_at",
        header: "Updated",
        type: "custom",
        width: 100,
        align: "left",
        render: (_value, row) => (
          <span className="block text-left text-sm text-text-muted whitespace-nowrap">
            {formatRelativeTime(row.updated_at)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        width: 120,
        align: "left",
        render: (_value, row) => (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                openWizard("edit", row);
              }}
              className={dashboardRowEditIconButtonClass}
              title="Edit persona"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteDialogOpen(row, "persona");
              }}
              disabled={row.is_default}
              className={dashboardRowDeleteIconButtonClass}
              title={
                row.is_default
                  ? "Default persona cannot be deleted"
                  : "Delete persona"
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
  ], []);

  return (
    <TabsContent value="personas" className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0">
      <Card className={cn("relative", dashboardTabCardClassName)}>
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Personas"
          description="Create and manage chat and dashboard personas"
          descriptionClassName="mb-0"
          titleRowEnd={
            <Button
              className="flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-primary p-1 text-background hover:bg-primary/90 sm:hidden"
              size="icon"
              onClick={onOpenCreateModal}
              title="New persona"
            >
              <Plus size={18} />
            </Button>
          }
          actions={
            <DashboardTabToolbar
              primary={
                <>
                  <DashboardTabSearchInput
                    placeholder="Search by persona_name or prompt content..."
                    value={personaSearch}
                    onChange={(e) => setPersonaSearch(e.target.value)}
                    className="max-w-[min(100%,360px)]"
                  />
                  <DashboardTabFiltersPopover
                    filterCount={filterPopoverCount}
                    onClear={handleClearPersonaFilters}
                  >
                    <DashboardTabSearchableSelect
                      label="Type"
                      options={[
                        { label: "All types", value: "" },
                        { label: "chat", value: "chat" },
                        { label: "api", value: "api" },
                        { label: "dashboard", value: "dashboard" },
                      ]}
                      value={personaTypeFilter ?? ""}
                      onValueChange={(v) => setPersonaTypeFilter(v || null)}
                      placeholder="Search types..."
                    />
                  </DashboardTabFiltersPopover>
                  <Button
                    size="sm"
                    className="hidden h-10 max-lg:px-2 sm:flex bg-surface hover:bg-primary/90 text-text-main border border-border-main"
                    onClick={onOpenCreateModal}
                    title="New persona"
                  >
                    <Plus size={18} />
                    <span className={dashboardTabToolbarButtonLabelClassName}>
                      New persona
                    </span>
                  </Button>
                </>
              }
              refresh={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={retryPersonas}
                  disabled={personasLoading}
                  title="Refresh personas"
                >
                  <RefreshCw
                    size={18}
                    className={personasLoading ? "animate-spin" : undefined}
                  />
                </Button>
              }
            />
          }
        />

        {hasActiveFilters && (
          <div className="relative z-10">
            <DashboardTabActiveFiltersBar onClearAll={handleClearAllPersonaListFilters}>
              {personaTypeFilter?.trim() && (
                <DashboardTabFilterChip
                  onRemove={() => setPersonaTypeFilter(null)}
                  ariaLabel="Remove type filter"
                  className="max-w-[min(100%,280px)]"
                >
                  <span className="truncate">Type: {personaTypeFilter}</span>
                </DashboardTabFilterChip>
              )}
              <DashboardTabSearchFilterChip
                query={personaSearch}
                onClear={() => setPersonaSearch("")}
              />
            </DashboardTabActiveFiltersBar>
          </div>
        )}

        <CardContent className="relative z-10 text-text-main flex-1 min-h-0 overflow-y-auto">
          {personasError && !personasLoading ? (
            <div className="p-4">
              <ErrorRetry
                error={personasError}
                onRetry={retryPersonas}
                isLoading={personasLoading}
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={personas}
              isLoading={personasLoading}
              {...dashboardTableLoadingProps}
              disablePagination
              enableFilters={false}
              enableGlobalSearch={false}
              enableRowSelection
              isRowSelectable={(persona) => !persona.is_default}
              onSelectionChange={setSelectedPersonaIds}
              renderBulkActions={(_ids, clear) => {
                clearSelectionRef.current = clear;
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-status-error hover:text-status-error border-status-error/30 hover:border-status-error/60"
                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                    title="Delete selected personas"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                );
              }}
              emptyMessage={
                personaSearch.trim()
                  ? "No personas found matching your search."
                  : "No personas created yet. Create your first persona to get started."
              }
              loadingMessage="Loading personas..."
              getRowId={(row) => row.id}
              onRowClick={(row) => {
                if (selectedPersonaIds.size > 0) return;
                clearDetailSheetCloseTimer();
                setDetailPersona(row);
                setDetailSheetOpen(true);
              }}
              className={cn(
                dashboardAdminTableClassName,
                dashboardAdminTableClickableRowClassName,
              )}
            />
          )}
        </CardContent>

        <EnhancedPagination
          currentPage={personaCurrentPage}
          setCurrentPage={setPersonaCurrentPage}
          pageSize={personaPageSize}
          setPageSize={setPersonaPageSize}
          totalItems={personaTotalItems}
          displayedItemsCount={personas.length}
          isMobile={isMobile}
        />
      </Card>

      <DeleteConfirmationModal
        isOpen={isBulkDeleteDialogOpen}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${selectedPersonaIds.size} Persona${selectedPersonaIds.size !== 1 ? "s" : ""}?`}
        description="This action cannot be undone."
        itemName={`${selectedPersonaIds.size} persona${selectedPersonaIds.size !== 1 ? "s" : ""}`}
        isLoading={isBulkDeleting}
      />

      <PersonaSidebar
        persona={detailPersona}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) {
            scheduleDetailPersonaClear();
          } else {
            clearDetailSheetCloseTimer();
          }
        }}
        onEdit={(p) => {
          setDetailSheetOpen(false);
          scheduleDetailPersonaClear();
          openWizard("edit", p);
        }}
        onDelete={(p) => {
          setDetailSheetOpen(false);
          scheduleDetailPersonaClear();
          window.setTimeout(() => handleDeleteDialogOpen(p, "version"), 350);
        }}
        onCreateVersion={(p) => {
          setDetailSheetOpen(false);
          scheduleDetailPersonaClear();
          openWizard("version", p);
        }}
        onRefresh={retryPersonas}
        onPersonaUpdated={(updated) => setDetailPersona(updated)}
        personas={personas}
        onNavigate={(p) => {
          clearDetailSheetCloseTimer();
          setDetailPersona(p);
        }}
      />

      <PersonaWizardModal
        isOpen={wizardOpen}
        mode={wizardMode}
        basePersona={wizardBasePersona}
        onClose={closeWizard}
        onSave={retryPersonas}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => handleDeleteDialogChange(false)}
        onConfirm={handleDelete}
        title={deleteMode === "persona" ? "Delete Persona?" : "Delete Version?"}
        description="This action cannot be undone."
        itemName={personaToDelete?.persona_name}
        usageNote={
          deleteMode === "persona"
            ? "All versions of this persona will be permanently removed."
            : undefined
        }
        isLoading={deleteLoading}
      />
    </TabsContent>
  );
};

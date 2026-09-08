import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import notify from "@/utils/notify";
import { Plus, RefreshCw, Trash2, SquarePen, Upload, Database } from "lucide-react";
import { AdminFormDialog, FormDialogFooter } from "../components/Forms/AdminFormDialog";
import { FormField } from "../components/Forms/FormField";

import { type ColumnConfig, DataTable } from "@/components/DataTable";
import { type TableQueryParams } from "@/components/DataTable/types";
import {
  dashboardRowDeleteIconButtonClass,
  dashboardRowEditIconButtonClass,
} from "../utils/dashboardRowActionStyles";
import { ErrorRetry } from "../components/ErrorRetry";
import { DashboardLoader } from "@/components/ContentLoader";
import {
  DashboardTabSearchInput,
  DashboardTabFiltersPopover,
  DashboardTabSearchableSelect,
  DashboardTabActiveFiltersBar,
  DashboardTabFilterChip,
  DashboardTabSearchFilterChip,
} from "../components/DashboardTabFilterUi";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { formatDashboardDate } from "@/utils/helper";
import { formatLastUpdated } from "../utils/dashboardHelper";
import {
  createDataSource,
  deleteDataSource,
  listDataSourcesWithMeta,
  updateDataSource,
  type CreateDataSourceRequest,
  type DataSourceDefinition,
  type DataSourceKind,
} from "@/services/datasources/dataSourcesApi";
import { DashboardPill } from "../components/DashboardPill";
import { cn } from "@/lib/utils";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "../utils/dashboardSearchDebounceMs";
import {
  DashboardTabCardChrome,
  DashboardTabHeader,
  DashboardTabToolbar,
  dashboardTabCardClassName,
  dashboardTabToolbarButtonLabelClassName,
  dashboardTableLoadingProps,
  dashboardAdminTableClassName,
} from "../components/DashboardTabLayout";

export interface DataSourcesSectionProps {
  isAdmin: boolean;
  isMobile: boolean;
  activeTab?: string;
}

type AdminDataSource = DataSourceDefinition & { source_id: string };

type DataSourceFormState = {
  datasource_name: string;
  kind: DataSourceKind;
  description: string;

  // csv
  file: File | null;
  current_path: string;

  // postgresql
  db_user: string;
  db_password: string;
  db_host: string;
  db_port: string;
  db_name: string;

  // api
  url: string;
};

const emptyForm = (): DataSourceFormState => ({
  datasource_name: "",
  kind: "csv",
  description: "",
  file: null,
  current_path: "",
  db_user: "",
  db_password: "",
  db_host: "",
  db_port: "",
  db_name: "",
  url: "",
});

const DATA_SOURCE_API_SORT_KEYS = new Set([
  "datasource_name",
  "kind",
  "created_at",
]);

function kindRequiredFields(kind: DataSourceKind) {
  switch (kind) {
    case "csv":
      return ["file"] as const;
    case "postgresql":
      return ["db_user", "db_password", "db_host", "db_port", "db_name"] as const;
    case "api":
      return ["url"] as const;
  }
}

function buildCreatePayload(form: DataSourceFormState): CreateDataSourceRequest {
  const payload: CreateDataSourceRequest = {
    datasource_name: form.datasource_name.trim(),
    kind: form.kind,
    description: form.description.trim() || undefined,
  };

  switch (form.kind) {
    case "csv":
      if (form.file) payload.file = form.file;
      break;
    case "postgresql":
      payload.db_user = form.db_user.trim();
      payload.db_password = form.db_password.trim();
      payload.db_host = form.db_host.trim();
      payload.db_port = form.db_port.trim();
      payload.db_name = form.db_name.trim();
      break;
    case "api":
      payload.url = form.url.trim();
      break;
  }

  return payload;
}

function DataSourceFormFields({
  form,
  setForm,
  mode,
}: {
  form: DataSourceFormState;
  setForm: Dispatch<SetStateAction<DataSourceFormState>>;
  mode: "create" | "edit";
}) {
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const update = <K extends keyof DataSourceFormState>(key: K, value: DataSourceFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <FormField label="Datasource Name" required>
        <Input
          value={form.datasource_name}
          onChange={(e) => update("datasource_name", e.target.value)}
          placeholder="e.g., Sales Data"
          className="bg-background border-border-main text-text-main"
        />
      </FormField>

      <FormField label="Kind" required>
        <Select
          value={form.kind}
          onValueChange={(value: DataSourceKind) => update("kind", value)}
          disabled={mode === "edit"}
        >
          <SelectTrigger className="bg-background border-border-main text-text-main">
            <SelectValue placeholder="Select kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">csv</SelectItem>
            <SelectItem value="postgresql">postgresql</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Description">
        <Input
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Optional"
          className="bg-background border-border-main text-text-main"
        />
      </FormField>

      {form.kind === "csv" && (
        <FormField
          label="CSV File"
          required={mode === "create"}
          hint={mode === "edit" ? "optional: upload to replace current file" : undefined}
        >
          {mode === "edit" && form.current_path && (
            <div className="rounded-md border border-border-main bg-background px-3 py-2 text-sm text-text-main/80">
              Current file: <span className="font-mono text-xs">{form.current_path}</span>
            </div>
          )}
          <Input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => update("file", e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => csvFileInputRef.current?.click()}
              className="border-border-main text-text-main hover:bg-background rounded-md"
            >
              <Upload className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Choose file
            </Button>
            {form.file && (
              <span className="min-w-0 truncate text-sm text-text-muted" title={form.file.name}>
                {form.file.name}
              </span>
            )}
          </div>
        </FormField>
      )}

      {form.kind === "postgresql" && (
        <>
          <FormField label="DB User" required>
            <Input
              value={form.db_user}
              onChange={(e) => update("db_user", e.target.value)}
              placeholder="admin"
              className="bg-background border-border-main text-text-main"
            />
          </FormField>
          <FormField
            label="DB Password"
            required={mode === "create"}
            hint={mode === "edit" ? "leave blank to keep current" : undefined}
          >
            <Input
              type="password"
              value={form.db_password}
              onChange={(e) => update("db_password", e.target.value)}
              placeholder={mode === "edit" ? "••••••••" : "secure_password"}
              className="bg-background border-border-main text-text-main"
            />
          </FormField>
          <FormField label="DB Host" required>
            <Input
              value={form.db_host}
              onChange={(e) => update("db_host", e.target.value)}
              placeholder="127.0.0.1"
              className="bg-background border-border-main text-text-main"
            />
          </FormField>
          <FormField label="DB Port" required>
            <Input
              value={form.db_port}
              onChange={(e) => update("db_port", e.target.value)}
              placeholder="5432"
              className="bg-background border-border-main text-text-main"
            />
          </FormField>
          <FormField label="DB Name" required>
            <Input
              value={form.db_name}
              onChange={(e) => update("db_name", e.target.value)}
              placeholder="production_db"
              className="bg-background border-border-main text-text-main"
            />
          </FormField>
        </>
      )}

      {form.kind === "api" && (
        <FormField label="URL" required>
          <Input
            type="url"
            value={form.url}
            onChange={(e) => update("url", e.target.value)}
            placeholder="https://example.com/endpoint"
            className="bg-background border-border-main text-text-main"
          />
        </FormField>
      )}
    </div>
  );
}

export const DataSourcesSection = ({
  isAdmin,
  isMobile,
  activeTab,
}: Readonly<DataSourcesSectionProps>) => {
  const [sources, setSources] = useState<AdminDataSource[]>([]);
  const [sourcesTotal, setSourcesTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  /** Empty = all kinds */
  const [kindFilter, setKindFilter] = useState<"" | "csv" | "postgresql">("");
  const [tableQuery, setTableQuery] = useState<TableQueryParams>({
    page: 1,
    limit: 10,
    offset: 0,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<DataSourceFormState>(() => emptyForm());

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSource, setEditSource] = useState<AdminDataSource | null>(null);
  const [editOriginalKind, setEditOriginalKind] = useState<DataSourceKind | null>(null);
  const [editForm, setEditForm] = useState<DataSourceFormState>(() => emptyForm());

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<AdminDataSource | null>(null);

  const pageSizeOptions = useMemo(
    () => (isMobile ? [10, 25, 50] : [10, 25, 50, 100]),
    [isMobile]
  );

  const hasListFilters =
    searchTerm.trim().length > 0 || kindFilter !== "";

  const clearAllListFilters = () => {
    setSearchTerm("");
    setKindFilter("");
  };

  const normalizeTableQuery = useCallback(
    (query: TableQueryParams): TableQueryParams => ({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      offset: query.offset ?? 0,
      sort_by: query.sort_by,
      sort_order: query.sort_order,
      search: query.search?.trim() || undefined,
      filters: query.filters,
    }),
    []
  );

  const isSameTableQuery = useCallback(
    (a: TableQueryParams, b: TableQueryParams) =>
      a.page === b.page &&
      a.limit === b.limit &&
      a.offset === b.offset &&
      a.sort_by === b.sort_by &&
      a.sort_order === b.sort_order &&
      (a.search ?? undefined) === (b.search ?? undefined),
    []
  );

  const handleTableQueryChange = useCallback(
    (nextQuery: TableQueryParams) => {
      setTableQuery((prev) =>
        {
          const normalizedPrev = normalizeTableQuery(prev);
          const normalizedNext = normalizeTableQuery(nextQuery);

          // Search is controlled by the header input in this section.
          // Ignore DataTable's internal search field so it cannot clear/override it.
          normalizedNext.search = normalizedPrev.search;

          return isSameTableQuery(normalizedPrev, normalizedNext)
            ? prev
            : normalizedNext;
        }
      );
    },
    [normalizeTableQuery, isSameTableQuery]
  );

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const normalizedSearch = tableQuery.search?.trim();
      const sortBy =
        tableQuery.sort_by &&
        DATA_SOURCE_API_SORT_KEYS.has(tableQuery.sort_by)
          ? tableQuery.sort_by
          : undefined;
      const sortOrder =
        sortBy &&
        (tableQuery.sort_order === "asc" || tableQuery.sort_order === "desc")
          ? tableQuery.sort_order
          : undefined;

      const response = await listDataSourcesWithMeta({
        includeSchema: false,
        limit: tableQuery.limit,
        offset: tableQuery.offset,
        search: normalizedSearch || undefined,
        kind: kindFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const list: AdminDataSource[] = Object.entries(response.sources).map(([key, def]) => ({
        ...(def ?? {}),
        source_id: def?.source_id ?? key,
      }));

      setSources(list);
      setSourcesTotal(response.total);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load data sources.";
      setError(msg);
      notify.error(msg);
      setSources([]);
      setSourcesTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    tableQuery.limit,
    tableQuery.offset,
    tableQuery.search,
    tableQuery.sort_by,
    tableQuery.sort_order,
    kindFilter,
  ]);

  useEffect(() => {
    if (activeTab !== "data-sources") return;
    fetchSources();
  }, [activeTab, fetchSources]);

  useEffect(() => {
    if (activeTab !== "data-sources") return;
    const timeoutId = window.setTimeout(() => {
      const normalizedSearch = searchTerm.trim() || undefined;
      setTableQuery((prev) => {
        const next: TableQueryParams = {
          ...prev,
          page: 1,
          offset: 0,
          search: normalizedSearch,
        };
        return isSameTableQuery(normalizeTableQuery(prev), normalizeTableQuery(next))
          ? prev
          : next;
      });
    }, DASHBOARD_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, searchTerm, normalizeTableQuery, isSameTableQuery]);

  useEffect(() => {
    if (activeTab !== "data-sources") return;
    setTableQuery((prev) =>
      prev.page === 1 && prev.offset === 0
        ? prev
        : { ...prev, page: 1, offset: 0 }
    );
  }, [activeTab, kindFilter]);

  useEffect(() => {
    // Keep form defaults stable when dialogs are closed.
    if (createOpen || editOpen) return;
    setCreateForm((prev) => ({ ...prev }));
    setEditForm((prev) => ({ ...prev }));
  }, [createOpen, editOpen]);

  const columns: ColumnConfig<AdminDataSource>[] = useMemo(() => {
    return [
      {
        key: "datasource_name",
        header: "Name",
        type: "text",
        sortable: true,
        searchable: true,
        width: 220,
        render: (_value, row) => (
          <span className="font-medium text-text-main">
            {row.datasource_name || "—"}
          </span>
        ),
      },
      {
        key: "kind",
        header: "Kind",
        type: "text",
        sortable: true,
        searchable: true,
        width: 120,
        render: (value) => (
          <DashboardPill
            intent="entity"
            entity="datasource"
            label={String(value ?? "—")}
          />
        ),
      },
      {
        key: "description",
        header: "Description",
        type: "text",
        sortable: false,
        searchable: true,
        width: 420,
        render: (value) => (
          <span className="text-text-main/80">{String(value ?? "—")}</span>
        ),
      },
      {
        key: "created_at",
        header: "Created At",
        type: "text",
        sortable: true,
        searchable: false,
        width: 220,
        render: (value) => <span>{formatDashboardDate(String(value ?? ""))}</span>,
      },
      {
        key: "updated_at",
        header: "Updated At",
        type: "text",
        sortable: false,
        searchable: false,
        width: 220,
        render: (value) => <span className="text-sm text-text-muted tabular-nums whitespace-nowrap">{formatLastUpdated(String(value ?? ""))}</span>,
      },
      {
        key: "actions",
        header: "Actions",
        type: "custom",
        width: 140,
        render: (_value, row) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (!isAdmin) return;
                setEditSource(row);
                setEditOriginalKind((row.kind as DataSourceKind) ?? null);
                setEditForm({
                  datasource_name: row.datasource_name ?? "",
                  kind: ((row.kind as DataSourceKind) ?? "csv") as DataSourceKind,
                  description: row.description ?? "",
                  file: null,
                  current_path: row.path ?? "",
                  db_user: row.db_user ?? "",
                  db_password: "", // never prefill secrets
                  db_host: row.db_host ?? "",
                  db_port: row.db_port ?? "",
                  db_name: row.db_name ?? "",
                  url: row.url ?? "",
                });
                setEditOpen(true);
              }}
              disabled={!isAdmin}
              className={dashboardRowEditIconButtonClass}
              title={isAdmin ? "Edit data source" : "Admin privileges required"}
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (!isAdmin) return;
                setSourceToDelete(row);
                setDeleteOpen(true);
              }}
              disabled={!isAdmin}
              className={dashboardRowDeleteIconButtonClass}
              title={isAdmin ? "Delete data source" : "Admin privileges required"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, [isAdmin]);

  const validateCreateForm = (form: DataSourceFormState): string | null => {
    if (!form.datasource_name.trim()) return "Datasource name is required.";
    if (!form.kind) return "Kind is required.";
    const required = kindRequiredFields(form.kind);

    for (const field of required) {
      const val = (form as any)[field];
      if (field === "file") {
        if (!(val instanceof File)) {
          return `Field "${field}" is required for kind "${form.kind}".`;
        }
        continue;
      }
      if (typeof val !== "string" || !val.trim()) {
        return `Field "${field}" is required for kind "${form.kind}".`;
      }
    }
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateCreateForm(createForm);
    if (validationError) {
      notify.error(validationError);
      return;
    }

    setCreateLoading(true);
    try {
      const payload = buildCreatePayload(createForm);
      await createDataSource(payload);
      setCreateOpen(false);
      setCreateForm((prev) => {
        const next = emptyForm();
        next.kind = prev.kind ?? "csv";
        return next;
      });
      await fetchSources();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editSource) return;

    const originalKind = editOriginalKind ?? ((editSource.kind as DataSourceKind) ?? "csv");
    const effectiveKind = originalKind;

    // Kind is immutable in edit mode; always preserve original kind.
    const payload: any = {
      description: editForm.description,
      kind: effectiveKind,
      ...(editForm.datasource_name.trim()
        ? { datasource_name: editForm.datasource_name.trim() }
        : {}),
    };

    // Only send kind-specific fields when they are filled (or when kind changed).
    const trimmed = (v: string) => v.trim();

    switch (effectiveKind) {
      case "csv":
        if (editForm.file instanceof File) payload.file = editForm.file;
        break;
      case "postgresql":
        if (trimmed(editForm.db_user)) payload.db_user = trimmed(editForm.db_user);
        if (trimmed(editForm.db_host)) payload.db_host = trimmed(editForm.db_host);
        if (trimmed(editForm.db_port)) payload.db_port = trimmed(editForm.db_port);
        if (trimmed(editForm.db_name)) payload.db_name = trimmed(editForm.db_name);
        if (trimmed(editForm.db_password)) payload.db_password = trimmed(editForm.db_password);
        break;
      case "api":
        if (trimmed(editForm.url)) payload.url = trimmed(editForm.url);
        break;
    }

    setEditLoading(true);
    try {
      await updateDataSource(editSource.source_id, payload);
      setEditOpen(false);
      setEditSource(null);
      setEditOriginalKind(null);
      await fetchSources();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!sourceToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteDataSource(sourceToDelete.source_id);
      setDeleteOpen(false);
      setSourceToDelete(null);
      await fetchSources();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };


  return (
    <TabsContent
      value="data-sources"
      className="mt-4 sm:mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden",
          dashboardTabCardClassName
        )}
      >
        <DashboardTabCardChrome />
        <DashboardTabHeader
          title="Data Sources Management"
          description="Create, update, and delete your data sources"
          titleColumnClassName="text-left pb-2 sm:pb-0"
          descriptionClassName="mb-0"
          actions={
              <DashboardTabToolbar
                primary={
                  <>
                    <DashboardTabSearchInput
                      placeholder="Search data sources..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <DashboardTabFiltersPopover
                      filterCount={kindFilter ? 1 : 0}
                      onClear={() => setKindFilter("")}
                      align="end"
                    >
                      <DashboardTabSearchableSelect
                        label="Kind"
                        options={[
                          { label: "All kinds", value: "" },
                          { label: "csv", value: "csv" },
                          { label: "postgresql", value: "postgresql" },
                        ]}
                        value={kindFilter}
                        onValueChange={(v) =>
                          setKindFilter(v as "" | "csv" | "postgresql")
                        }
                        placeholder="Search kinds..."
                      />
                    </DashboardTabFiltersPopover>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 max-lg:px-2"
                      onClick={() => {
                        if (!isAdmin) return;
                        setCreateForm((prev) => {
                          const next = emptyForm();
                          next.kind = prev.kind;
                          return next;
                        });
                        setCreateOpen(true);
                      }}
                      disabled={!isAdmin}
                      title={
                        isAdmin
                          ? "Create data source"
                          : "Admin privileges required"
                      }
                    >
                      <Plus className="h-4 w-4 lg:mr-2" />
                      <span className={dashboardTabToolbarButtonLabelClassName}>
                        Add Data Source
                      </span>
                    </Button>
                  </>
                }
                refresh={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={() => fetchSources()}
                    disabled={loading}
                    title="Refresh data sources"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                }
              />
          }
        />

        {hasListFilters && (
          <div className="relative z-10">
            <DashboardTabActiveFiltersBar onClearAll={clearAllListFilters}>
              {kindFilter !== "" && (
                <DashboardTabFilterChip
                  onRemove={() => setKindFilter("")}
                  ariaLabel="Remove kind filter"
                >
                  <span className="truncate">Kind: {kindFilter}</span>
                </DashboardTabFilterChip>
              )}
              <DashboardTabSearchFilterChip
                query={searchTerm}
                onClear={() => setSearchTerm("")}
              />
            </DashboardTabActiveFiltersBar>
          </div>
        )}

        <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
          {error && !loading ? (
            <div className="p-4">
              <ErrorRetry error={error} onRetry={fetchSources} isLoading={loading} />
            </div>
          ) : (
            <DataTable
              key={kindFilter || "all"}
              columns={columns}
              data={sources}
              isLoading={loading}
                {...dashboardTableLoadingProps}
              enableFilters={false}
              enableGlobalSearch={false}
              enableRowSelection
              serverSide={true}
              totalItems={sourcesTotal}
              onQueryChange={handleTableQueryChange}
              emptyMessage={
                searchTerm.trim()
                  ? "No data sources found matching your search."
                  : "No data sources found."
              }
              loadingMessage="Loading data sources..."
              pageSizeOptions={pageSizeOptions}
              defaultPageSize={10}
              getRowId={(row) => row.source_id}
              className={dashboardAdminTableClassName}
              disablePagination={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <AdminFormDialog
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateLoading(false);
          setCreateForm((prev) => {
            const next = emptyForm();
            next.kind = prev.kind;
            return next;
          });
        }}
        title="Create Data Source"
        icon={<Database size={15} />}
        size="md"
        footer={
          <FormDialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createLoading}
              className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLoading}
              className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
            >
              {createLoading ? (
                <span className="flex items-center gap-2">
                  <DashboardLoader variant="inline" />
                  Creating...
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </FormDialogFooter>
        }
      >
        <DataSourceFormFields form={createForm} setForm={setCreateForm} mode="create" />
      </AdminFormDialog>

      {/* Edit Dialog */}
      <AdminFormDialog
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditLoading(false);
          setEditSource(null);
          setEditOriginalKind(null);
        }}
        title="Edit Data Source"
        icon={<SquarePen size={15} />}
        size="md"
        footer={
          <FormDialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
              className="h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={editLoading || !editSource}
              className="h-9 rounded-[0.6rem] bg-primary text-white hover:bg-primary/90"
            >
              {editLoading ? (
                <span className="flex items-center gap-2">
                  <DashboardLoader variant="inline" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </FormDialogFooter>
        }
      >
        <DataSourceFormFields form={editForm} setForm={setEditForm} mode="edit" />
      </AdminFormDialog>

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSourceToDelete(null);
          setDeleteLoading(false);
        }}
        onConfirm={handleDelete}
        title="Delete Data Source?"
        description="This action cannot be undone."
        itemName={sourceToDelete?.datasource_name || sourceToDelete?.source_id}
        isLoading={deleteLoading}
      />
    </TabsContent>
  );
};


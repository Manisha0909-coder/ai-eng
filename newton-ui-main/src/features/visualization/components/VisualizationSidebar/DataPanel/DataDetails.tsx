import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DataTable, type ColumnConfig } from "@/components/DataTable";
import { DashboardLoader } from "@/components/ContentLoader";
import { getDataSourcePreview, type DataSourceColumn, type DataSourcePreviewResponse } from "@/services/datasources/dataSourcesApi";

function SchemaTable({ sourceId, schema }: { sourceId: string; schema: DataSourceColumn[] }) {
  const rows = useMemo(
    () =>
      schema.map((col, index) => {
        const c = col as { name?: string; type?: string; column_name?: string; data_type?: string };
        return {
          id: index,
          name: c.name ?? c.column_name ?? "",
          type: c.type ?? c.data_type ?? "",
        };
      }),
    [schema]
  );

  return (
    <div key={sourceId} style={{ minWidth: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 12 }}>
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                textAlign: "left",
                padding: "8px 10px",
                borderBottom: "1px solid rgb(var(--color-border))",
                background: "rgb(var(--color-background))",
                color: "rgb(var(--color-text))",
                fontWeight: 600,
                width: "65%",
              }}
            >
              Column
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                textAlign: "left",
                padding: "8px 10px",
                borderBottom: "1px solid rgb(var(--color-border))",
                background: "rgb(var(--color-background))",
                color: "rgb(var(--color-text))",
                fontWeight: 600,
                width: "35%",
              }}
            >
              Type
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`schema-${sourceId}-${row.id}-${row.name}`}>
              <td
                style={{
                  padding: "7px 10px",
                  borderBottom: "1px solid rgb(var(--color-border))",
                  color: "rgb(var(--color-text))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={row.name}
              >
                {row.name || "—"}
              </td>
              <td
                style={{
                  padding: "7px 10px",
                  borderBottom: "1px solid rgb(var(--color-border))",
                  color: "rgb(var(--color-text))",
                }}
              >
                {row.type || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: "10px", fontSize: 12, color: "rgb(var(--color-text-muted))" }}>
          No columns
        </div>
      )}
    </div>
  );
}

function PreviewDataTable({
  sourceId,
  schema,
  tableName,
  onPreviewSchemaLoaded,
}: {
  sourceId: string;
  schema: DataSourceColumn[];
  tableName?: string;
  onPreviewSchemaLoaded?: (columns: DataSourceColumn[]) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [preview, setPreview] = useState<DataSourcePreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inferredTableName = useMemo(() => {
    if (tableName) return tableName;
    const raw = schema.find((col) => {
      const c = col as { name?: string; column_name?: string };
      const name = c.name ?? c.column_name ?? "";
      return name.includes(".");
    });
    if (!raw) return undefined;
    const c = raw as { name?: string; column_name?: string };
    const name = c.name ?? c.column_name ?? "";
    const [detectedTableName] = name.split(".");
    return detectedTableName?.trim() || undefined;
  }, [schema, tableName]);

  useEffect(() => {
    setPage(1);
  }, [sourceId, inferredTableName]);

  useEffect(() => {
    let cancelled = false;
    const offset = (page - 1) * pageSize;
    setIsLoading(true);
    setError(null);
    getDataSourcePreview(sourceId, { tableName: inferredTableName, limit: pageSize, offset })
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load preview.");
          setPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, page, pageSize, inferredTableName]);

  useEffect(() => {
    if (!onPreviewSchemaLoaded || !preview) return;
    const sch = (preview as any).schema;
    if (sch && typeof sch === "object" && !Array.isArray(sch)) {
      const cols = Object.entries(sch as Record<string, string>).map(([name, type]) => ({ name, type }));
      if (cols.length > 0) {
        onPreviewSchemaLoaded(cols);
        return;
      }
    }
    if (Array.isArray((preview as any).columns) && (preview as any).columns.length > 0) {
      onPreviewSchemaLoaded((preview as any).columns.map((name: string) => ({ name, type: "" })));
    }
  }, [preview, onPreviewSchemaLoaded]);

  const previewData = (preview as any)?.data ?? [];
  const totalRows = (preview as any)?.total_rows ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows);

  const columnKeys = useMemo(() => {
    const cols = (preview as any)?.columns;
    if (Array.isArray(cols) && cols.length > 0) return cols;
    if (previewData[0]) return Object.keys(previewData[0]);
    return schema
      .map((c) => (c as any).name ?? (c as any).column_name ?? "")
      .filter(Boolean);
  }, [preview, previewData, schema]);

  const previewColumns = useMemo<
    ColumnConfig<Record<string, unknown> & { __rowIndex?: number }>[]
  >(() => {
    const colWidth = columnKeys.length > 8 ? 90 : 110;
    return columnKeys.map((key: string) => ({
      key,
      header: key,
      type: "text" as const,
      sortable: true,
      searchable: true,
      width: colWidth,
      render: (value: unknown) => {
        if (value == null) return "—";
        if (typeof value === "object") {
          try {
            const str = JSON.stringify(value);
            return str.length > 220 ? `${str.slice(0, 220)}...` : str;
          } catch {
            return String(value);
          }
        }
        const str = String(value);
        return str.length > 220 ? `${str.slice(0, 220)}...` : str;
      },
    }));
  }, [columnKeys]);

  const previewDataWithIds = useMemo(
    () => previewData.map((row: any, idx: number) => ({ ...row, __rowIndex: startIndex + idx })),
    [previewData, startIndex]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0, minWidth: 0 }}>
      {error && (
        <div style={{ fontSize: 12, color: "rgb(var(--color-error))", marginBottom: 6 }}>
          {error}
        </div>
      )}

      <div style={{ flex: "1 1 0%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <DataTable<Record<string, unknown> & { __rowIndex?: number }>
          key={`preview-${sourceId}-${page}`}
          columns={previewColumns}
          data={previewDataWithIds}
          disablePagination={true}
          enableGlobalSearch={false}
          enableFilters={false}
          isLoading={isLoading}
          loadingVariant="skeleton"
          skeletonRows={pageSize}
          loadingMessage="Loading preview..."
          emptyMessage="No rows"
          getRowId={(row) => `preview-${sourceId}-${row.__rowIndex ?? 0}`}
          className="!h-full !min-h-0 !min-w-0 !overflow-hidden !border-0 !shadow-none !rounded-md !bg-transparent flex-1"
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderTop: "1px solid rgb(var(--color-border))",
            fontSize: 12,
            color: "rgb(var(--color-text-muted))",
            flexShrink: 0,
            background: "rgb(var(--color-surface))",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            Showing {startIndex}–{endIndex} of {totalRows}
          </span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                border: "1px solid rgb(var(--color-border))",
                borderRadius: 6,
                background: "rgb(var(--color-background))",
                color: "rgb(var(--color-text))",
                padding: "4px 8px",
                fontSize: 12,
                cursor: "pointer",
              }}
              aria-label="Rows per page"
            >
              {[5, 10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                aria-label="Previous page"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  border: "1px solid rgb(var(--color-border))",
                  borderRadius: 6,
                  background: "rgb(var(--color-surface))",
                  color: "rgb(var(--color-text))",
                  cursor: page <= 1 || isLoading ? "not-allowed" : "pointer",
                  opacity: page <= 1 || isLoading ? 0.4 : 1,
                }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <span style={{ minWidth: 48, textAlign: "center", fontWeight: 500, color: "rgb(var(--color-text))" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                aria-label="Next page"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  border: "1px solid rgb(var(--color-border))",
                  borderRadius: 6,
                  background: "rgb(var(--color-surface))",
                  color: "rgb(var(--color-text))",
                  cursor: page >= totalPages || isLoading ? "not-allowed" : "pointer",
                  opacity: page >= totalPages || isLoading ? 0.4 : 1,
                }}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DataDetails({
  selectedSourceId,
  schemaForSelectedTable,
  activeDetailsTab,
  setActiveDetailsTab,
  onPreviewSchemaLoaded,
  isCsvSource,
  exploreLoading,
  exploreError,
  tableName,
}: {
  selectedSourceId: string;
  schemaForSelectedTable: DataSourceColumn[];
  activeDetailsTab: "schema" | "preview";
  setActiveDetailsTab: (tab: "schema" | "preview") => void;
  onPreviewSchemaLoaded: (columns: DataSourceColumn[]) => void;
  isCsvSource: boolean;
  exploreLoading: boolean;
  exploreError: string | null;
  tableName?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0, minWidth: 0, gap: 12 }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 8, flexShrink: 0 }}>
        <div
          role="tablist"
          aria-label="Data details view"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 2,
            borderRadius: 10,
            border: "1px solid rgb(var(--color-border))",
            background: "rgb(var(--color-background))",
            gap: 2,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeDetailsTab === "schema"}
            onClick={() => setActiveDetailsTab("schema")}
            disabled={schemaForSelectedTable.length === 0}
            style={{
              minWidth: 88,
              padding: "6px 10px",
              borderRadius: 8,
              border: "none",
              background: activeDetailsTab === "schema" ? "rgb(var(--color-primary))" : "transparent",
              color: activeDetailsTab === "schema" ? "white" : "rgb(var(--color-text))",
              opacity: schemaForSelectedTable.length === 0 ? 0.5 : 1,
              cursor: schemaForSelectedTable.length === 0 ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
          >
            Schema
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeDetailsTab === "preview"}
            onClick={() => setActiveDetailsTab("preview")}
            style={{
              minWidth: 88,
              padding: "6px 10px",
              borderRadius: 8,
              border: "none",
              background: activeDetailsTab === "preview" ? "rgb(var(--color-primary))" : "transparent",
              color: activeDetailsTab === "preview" ? "white" : "rgb(var(--color-text))",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
          >
            Preview
          </button>
        </div>
      </div>

      <div
        className="scrollbar-themed"
        style={{
          position: "relative",
          background: "rgb(var(--color-background))",
          borderRadius: 10,
          border: "1px solid rgb(var(--color-border))",
          overflow: "hidden",
          flex: "1 1 0%",
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <div
          className="scrollbar-themed"
          style={{
            position: "absolute",
            inset: 0,
            minHeight: 0,
            minWidth: 0,
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {activeDetailsTab === "schema" ? (
            isCsvSource && exploreLoading ? (
              <div
                style={{
                  height: "100%",
                  minHeight: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "rgb(var(--color-text-muted))",
                  fontSize: 12,
                }}
              >
                <DashboardLoader size="xs" variant="inline" />
                Loading schema…
              </div>
            ) : schemaForSelectedTable.length > 0 ? (
              <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", overflow: "auto" }}>
                <SchemaTable sourceId={selectedSourceId} schema={schemaForSelectedTable} />
              </div>
            ) : (
              <div
                style={{
                  height: "100%",
                  minHeight: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgb(var(--color-text-muted))",
                  fontSize: 12,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                No schema available for the selected table.
              </div>
            )
          ) : (
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {isCsvSource && exploreLoading ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    color: "rgb(var(--color-text-muted))",
                    fontSize: 12,
                  }}
                >
                  <DashboardLoader size="xs" variant="inline" />
                  Loading preview…
                </div>
              ) : isCsvSource && exploreError ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgb(var(--color-error))",
                    fontSize: 12,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  {exploreError}
                </div>
              ) : (
                <PreviewDataTable
                  key={`${selectedSourceId}-${tableName ?? "csv"}`}
                  sourceId={selectedSourceId}
                  schema={schemaForSelectedTable}
                  tableName={tableName}
                  onPreviewSchemaLoaded={onPreviewSchemaLoaded}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


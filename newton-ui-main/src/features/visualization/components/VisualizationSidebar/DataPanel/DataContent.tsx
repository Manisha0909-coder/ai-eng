import React, { useCallback, useRef } from "react";
import { Table2, ChevronLeft, ChevronRight } from "lucide-react";

import { SourceList } from "./SourceList";
import { TablesList } from "./TablesList";
import { DataDetails } from "./DataDetails";
import { DashboardLoader } from "@/components/ContentLoader";
import type { DataSourceColumn } from "@/services/datasources/dataSourcesApi";
import type { DataSourceListItem } from "@/hooks/useDataSources";

export function DataContent({
  // container
  onKeyDown,
  // source list
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  searchQuery,
  setSearchQuery,
  dataSourcesLoading,
  dataSourcesError,
  dataSourcesList,
  visibleDataSourcesList,
  selectedSourceId,
  selectSource,
  handleSourceFocus,
  sourceListItemRefs,
  visibleSourcesCount,
  setVisibleSourcesCount,
  // details
  selectedSource,
  dataPanelStep,
  setDataPanelStep,
  activeDetailsTab,
  setActiveDetailsTab,
  selectedTableName,
  setSelectedTableName,
  isPostgresqlSource,
  isCsvSource,
  exploreLoading,
  exploreError,
  exploreTables,
  visibleTableNames,
  tablesListPage,
  setTablesListPage,
  tablesListTotalPages,
  tablesListStart,
  tablesListEnd,
  schemaForSelectedTable,
  handlePreviewSchemaLoaded,
  handleBackToTables,
}: {
  onKeyDown: (e: React.KeyboardEvent) => void;
  leftPanelCollapsed: boolean;
  setLeftPanelCollapsed: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  dataSourcesLoading: boolean;
  dataSourcesError: string | null;
  dataSourcesList: DataSourceListItem[];
  visibleDataSourcesList: DataSourceListItem[];
  selectedSourceId: string | null;
  selectSource: (sourceId: string) => void;
  handleSourceFocus: (sourceId: string, index: number) => void;
  sourceListItemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  visibleSourcesCount: number;
  setVisibleSourcesCount: (updater: (prev: number) => number) => void;
  selectedSource: DataSourceListItem | null;
  dataPanelStep: "tables" | "detail";
  setDataPanelStep: (v: "tables" | "detail") => void;
  activeDetailsTab: "schema" | "preview";
  setActiveDetailsTab: (v: "schema" | "preview") => void;
  selectedTableName: string | null;
  setSelectedTableName: (v: string | null) => void;
  isPostgresqlSource: boolean;
  isCsvSource: boolean;
  exploreLoading: boolean;
  exploreError: string | null;
  exploreTables: string[];
  visibleTableNames: string[];
  tablesListPage: number;
  setTablesListPage: (updater: (prev: number) => number) => void;
  tablesListTotalPages: number;
  tablesListStart: number;
  tablesListEnd: number;
  schemaForSelectedTable: DataSourceColumn[];
  handlePreviewSchemaLoaded: (columns: DataSourceColumn[]) => void;
  handleBackToTables: () => void;
}) {
  const dataContentRef = useRef<HTMLDivElement>(null);

  const onSelectTable = useCallback(
    (name: string) => {
      setSelectedTableName(name);
      setDataPanelStep("detail");
    },
    [setDataPanelStep, setSelectedTableName]
  );

  return (
    <div
      ref={dataContentRef}
      role="region"
      aria-label="Data sources"
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0, gap: 0 }}>
        <SourceList
          leftPanelCollapsed={leftPanelCollapsed}
          setLeftPanelCollapsed={setLeftPanelCollapsed}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          dataSourcesLoading={dataSourcesLoading}
          dataSourcesError={dataSourcesError}
          dataSourcesList={dataSourcesList}
          visibleDataSourcesList={visibleDataSourcesList}
          selectedSourceId={selectedSourceId}
          selectSource={selectSource}
          handleSourceFocus={handleSourceFocus}
          sourceListItemRefs={sourceListItemRefs}
          visibleSourcesCount={visibleSourcesCount}
          setVisibleSourcesCount={setVisibleSourcesCount}
          pageSize={50}
        />

        <div
          className="scrollbar-themed"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            marginLeft: 12,
            borderRadius: 12,
            border: "1px solid rgb(var(--color-border))",
            background: "rgb(var(--color-surface))",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {selectedSource ? (
            <div
              key={selectedSource.source_id}
              className="data-panel-enter scrollbar-themed"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                padding: 20,
                minHeight: 0,
                minWidth: 0,
                flex: 1,
                overflow: "hidden",
              }}
            >
              {dataPanelStep === "tables" ? (
                <>
                  <div style={{ flexShrink: 0, marginBottom: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 16,
                        color: "rgb(var(--color-text))",
                        marginBottom: 4,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {selectedSource.datasource_name}
                    </div>
                    {selectedSource.description && (
                      <div style={{ fontSize: 13, color: "rgb(var(--color-text-muted))", lineHeight: 1.5 }}>
                        {selectedSource.description}
                      </div>
                    )}
                  </div>

                  {isPostgresqlSource && (
                    <TablesList
                      exploreTablesCount={exploreTables.length}
                      exploreLoading={exploreLoading}
                      exploreError={exploreError}
                      visibleTableNames={visibleTableNames}
                      selectedTableName={selectedTableName}
                      tablesListPage={tablesListPage}
                      tablesListTotalPages={tablesListTotalPages}
                      tablesListStart={tablesListStart}
                      tablesListEnd={tablesListEnd}
                      onSelectTable={onSelectTable}
                      onPrevPage={() => setTablesListPage((p) => Math.max(1, p - 1))}
                      onNextPage={() => setTablesListPage((p) => Math.min(tablesListTotalPages, p + 1))}
                    />
                  )}

                  {isCsvSource && (
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "1px solid rgb(var(--color-border))",
                        background: "rgb(var(--color-background))",
                      }}
                    >
                      <span style={{ fontSize: 12, color: "rgb(var(--color-text-muted))", fontWeight: 600 }}>
                        Dataset
                      </span>
                      {exploreLoading ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            fontSize: 12,
                            color: "rgb(var(--color-text-muted))",
                            minHeight: 120,
                            width: "100%",
                          }}
                        >
                          <DashboardLoader size="xs" variant="inline" />
                          <span>Loading…</span>
                        </div>
                      ) : exploreError ? (
                        <div style={{ fontSize: 12, color: "rgb(var(--color-error))" }}>{exploreError}</div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDataPanelStep("detail")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid rgb(var(--color-border))",
                            background: "rgb(var(--color-surface))",
                            color: "rgb(var(--color-text))",
                            cursor: "pointer",
                            fontSize: 13,
                            textAlign: "left",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {selectedSource.datasource_name}
                          </span>
                          <ChevronRight style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.7 }} />
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={handleBackToTables}
                      aria-label={isCsvSource ? "Back to list" : "Back to tables"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgb(var(--color-border))",
                        background: "rgb(var(--color-background))",
                        color: "rgb(var(--color-text))",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <ChevronLeft style={{ width: 16, height: 16 }} />
                      {isCsvSource ? "Back to list" : "Back to tables"}
                    </button>
                  </div>

                  <div style={{ flexShrink: 0, marginBottom: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 16,
                        color: "rgb(var(--color-text))",
                        marginBottom: 4,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {isCsvSource ? selectedSource.datasource_name : selectedTableName ?? ""}
                    </div>
                    {!isCsvSource && selectedSource.datasource_name && selectedTableName && (
                      <div style={{ fontSize: 12, color: "rgb(var(--color-text-muted))" }}>
                        {selectedSource.datasource_name}
                      </div>
                    )}
                    {isCsvSource && selectedSource.description && (
                      <div style={{ fontSize: 13, color: "rgb(var(--color-text-muted))", lineHeight: 1.5, marginTop: 4 }}>
                        {selectedSource.description}
                      </div>
                    )}
                  </div>

                  <DataDetails
                    selectedSourceId={selectedSource.source_id}
                    schemaForSelectedTable={schemaForSelectedTable}
                    activeDetailsTab={activeDetailsTab}
                    setActiveDetailsTab={setActiveDetailsTab}
                    onPreviewSchemaLoaded={handlePreviewSchemaLoaded}
                    isCsvSource={isCsvSource}
                    exploreLoading={exploreLoading}
                    exploreError={exploreError}
                    tableName={isPostgresqlSource ? selectedTableName ?? undefined : undefined}
                  />
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                height: "100%",
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 32,
                color: "rgb(var(--color-text-muted))",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              {dataSourcesLoading ? (
                <DashboardLoader size="md" message="Loading sources..." />
              ) : dataSourcesError ? null : dataSourcesList.length === 0 ? (
                <span>No data sources available</span>
              ) : (
                <>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "rgb(var(--color-surface))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Table2 style={{ width: 24, height: 24, opacity: 0.6 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 500, color: "rgb(var(--color-text))" }}>Select a data source</span>
                    <span style={{ fontSize: 13 }}>Choose from the list to view schema and preview</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


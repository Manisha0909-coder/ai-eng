import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type DataSourceColumn,
  type DataSourceDefinition,
  exploreDataSource,
  listDataSources,
} from "@/services/datasources/dataSourcesApi";

export type VisualizationActiveTab = "chart" | "data";
export type DataDetailsTab = "schema" | "preview";
export type DataPanelStep = "tables" | "detail";

const DATA_SOURCES_PAGE_SIZE = 50;
const TABLES_LIST_PAGE_SIZE = 30;

export type DataSourceListItem = {
  source_id: string;
  datasource_name: string;
  description?: string;
  kind: string;
  schema: DataSourceColumn[];
  columnCount: number;
};

function normalizeSchema(schema: DataSourceDefinition["schema"]): DataSourceColumn[] {
  if (!schema?.length) return [];
  return schema.map((col) => {
    const c = col as DataSourceColumn & {
      column_name?: string;
      data_type?: string;
    };
    return {
      name: c.name ?? c.column_name ?? "",
      type: c.type ?? c.data_type ?? "",
    };
  });
}

export function useDataSources(
  activeTab: VisualizationActiveTab,
  selectedPersonaId: number | null,
  searchQuery: string
) {
  const [dataSourcesMap, setDataSourcesMap] = useState<Record<string, DataSourceDefinition>>({});
  const [dataSourcesLoading, setDataSourcesLoading] = useState(false);
  const [dataSourcesError, setDataSourcesError] = useState<string | null>(null);

  const [visibleSourcesCount, setVisibleSourcesCount] = useState(DATA_SOURCES_PAGE_SIZE);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [focusedSourceIndex, setFocusedSourceIndex] = useState(0);
  const sourceListItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const dataSourcesList = useMemo<DataSourceListItem[]>(() => {
    const list = Object.entries(dataSourcesMap).map(([id, def]) => {
      const schema = normalizeSchema(def.schema);
      const sourceId = def.source_id ?? id;
      const datasourceName = def.datasource_name?.trim() || sourceId;
      return {
        source_id: sourceId,
        datasource_name: datasourceName,
        description: def.description,
        kind: (def.kind as string | undefined)?.toLowerCase() ?? "",
        schema,
        columnCount: schema.length,
      };
    });
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.datasource_name.toLowerCase().includes(q) ||
        s.source_id.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
    );
  }, [dataSourcesMap, searchQuery]);

  useEffect(() => {
    setVisibleSourcesCount(DATA_SOURCES_PAGE_SIZE);
  }, [searchQuery, dataSourcesMap]);

  const visibleDataSourcesList = useMemo(
    () => dataSourcesList.slice(0, visibleSourcesCount),
    [dataSourcesList, visibleSourcesCount]
  );

  const selectSource = useCallback(
    (sourceId: string) => {
      setSelectedSourceId(sourceId);
      const idx = visibleDataSourcesList.findIndex((s) => s.source_id === sourceId);
      if (idx >= 0) setFocusedSourceIndex(idx);
    },
    [visibleDataSourcesList]
  );

  const handleSourceFocus = useCallback((sourceId: string, index: number) => {
    setFocusedSourceIndex(index);
    setSelectedSourceId(sourceId);
  }, []);

  const jumpToBoundarySource = useCallback(
    (direction: "first" | "last") => {
      const list = visibleDataSourcesList;
      if (list.length === 0) return;
      const idx = direction === "first" ? 0 : list.length - 1;
      const source = list[idx];
      setFocusedSourceIndex(idx);
      setSelectedSourceId(source.source_id);
      setTimeout(() => sourceListItemRefs.current.get(source.source_id)?.focus(), 0);
    },
    [visibleDataSourcesList]
  );

  // Sync focused index when visible list changes (search, load more)
  useEffect(() => {
    if (visibleDataSourcesList.length === 0) return;
    const clamped = Math.min(focusedSourceIndex, visibleDataSourcesList.length - 1);
    if (clamped !== focusedSourceIndex) setFocusedSourceIndex(clamped);
  }, [visibleDataSourcesList.length, focusedSourceIndex]);

  // Fetch data sources when Data tab is active
  useEffect(() => {
    if (activeTab !== "data") return;
    // Zustand persist may take a moment to hydrate from localStorage.
    // Don't show an error on the initial null render; just wait.
    if (selectedPersonaId == null) {
      setDataSourcesLoading(false);
      setDataSourcesError(null);
      return;
    }
    if (selectedPersonaId === 0) {
      setDataSourcesMap({});
      setSelectedSourceId(null);
      setDataSourcesLoading(false);
      setDataSourcesError("Persona is required to load data sources.");
      return;
    }
    let cancelled = false;
    setDataSourcesLoading(true);
    setDataSourcesError(null);
    listDataSources({ includeSchema: false, personaId: selectedPersonaId })
      .then((data) => {
        if (!cancelled) setDataSourcesMap(data);
      })
      .catch((err) => {
        if (!cancelled) setDataSourcesError(err?.message ?? "Failed to load data sources.");
      })
      .finally(() => {
        if (!cancelled) setDataSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedPersonaId]);

  const selectedSource: DataSourceListItem | null = selectedSourceId
    ? visibleDataSourcesList.find((s) => s.source_id === selectedSourceId) ??
      dataSourcesList.find((s) => s.source_id === selectedSourceId) ??
      null
    : null;

  // Explore state (tables/schema) for the selected source
  const [activeDetailsTab, setActiveDetailsTab] = useState<DataDetailsTab>("preview");
  const [dataPanelStep, setDataPanelStep] = useState<DataPanelStep>("tables");
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [tablesListPage, setTablesListPage] = useState(1);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [exploreKind, setExploreKind] = useState<string | null>(null);
  const [exploreTables, setExploreTables] = useState<string[]>([]);
  const [exploreCsvSchema, setExploreCsvSchema] = useState<Record<string, string> | null>(null);
  const [previewSchemaFromPreview, setPreviewSchemaFromPreview] = useState<DataSourceColumn[]>([]);

  const effectiveKind = useMemo(() => {
    if (exploreKind) return exploreKind;
    return selectedSource?.kind ?? "";
  }, [exploreKind, selectedSource?.kind]);

  const isPostgresqlSource = effectiveKind === "postgresql";
  const isCsvSource = effectiveKind === "csv";

  useEffect(() => {
    setSelectedTableName(null);
    setDataPanelStep("tables");
    setTablesListPage(1);
    setPreviewSchemaFromPreview([]);
    setExploreKind(null);
    setExploreTables([]);
    setExploreCsvSchema(null);
    setExploreError(null);
    setExploreLoading(false);
  }, [selectedSourceId]);

  const handleBackToTables = useCallback(() => {
    setDataPanelStep("tables");
    setPreviewSchemaFromPreview([]);
  }, []);

  useEffect(() => {
    if (activeTab !== "data" || !selectedSourceId) return;
    if (selectedPersonaId == null || selectedPersonaId <= 0) return;
    let cancelled = false;
    setExploreLoading(true);
    setExploreError(null);
    exploreDataSource(selectedSourceId)
      .then((res) => {
        if (cancelled) return;
        setExploreKind(res.kind);
        if (res.kind === "postgresql") {
          setExploreTables(res.tables ?? []);
          setExploreCsvSchema(null);
        } else {
          setExploreTables([]);
          setExploreCsvSchema(res.schema ?? {});
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setExploreError(err?.message ?? "Failed to explore data source.");
          setExploreKind(null);
          setExploreTables([]);
          setExploreCsvSchema(null);
        }
      })
      .finally(() => {
        if (!cancelled) setExploreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedSourceId, selectedPersonaId]);

  useEffect(() => {
    setTablesListPage(1);
  }, [exploreTables]);

  const tablesListTotalPages = Math.max(
    1,
    Math.ceil(exploreTables.length / TABLES_LIST_PAGE_SIZE)
  );

  const visibleTableNames = useMemo(() => {
    const start = (tablesListPage - 1) * TABLES_LIST_PAGE_SIZE;
    return exploreTables.slice(start, start + TABLES_LIST_PAGE_SIZE);
  }, [exploreTables, tablesListPage]);

  const tablesListStart =
    exploreTables.length === 0
      ? 0
      : (tablesListPage - 1) * TABLES_LIST_PAGE_SIZE + 1;

  const tablesListEnd =
    exploreTables.length === 0
      ? 0
      : Math.min(tablesListPage * TABLES_LIST_PAGE_SIZE, exploreTables.length);

  const schemaForSelectedTable = useMemo(() => {
    if (!selectedSource) return [] as DataSourceColumn[];
    if (isCsvSource && exploreCsvSchema) {
      return Object.entries(exploreCsvSchema).map(([name, type]) => ({ name, type }));
    }
    if (isPostgresqlSource && selectedTableName && previewSchemaFromPreview.length > 0) {
      return previewSchemaFromPreview;
    }
    return selectedSource.schema;
  }, [
    selectedSource,
    isCsvSource,
    isPostgresqlSource,
    exploreCsvSchema,
    selectedTableName,
    previewSchemaFromPreview,
  ]);

  const handlePreviewSchemaLoaded = useCallback((columns: DataSourceColumn[]) => {
    setPreviewSchemaFromPreview(columns);
  }, []);

  useEffect(() => {
    setPreviewSchemaFromPreview([]);
  }, [selectedTableName]);

  useEffect(() => {
    if (!selectedSource || dataPanelStep !== "detail") {
      if (!selectedSource) setActiveDetailsTab("preview");
      return;
    }
    setActiveDetailsTab(schemaForSelectedTable.length > 0 ? "schema" : "preview");
  }, [selectedSource?.source_id, dataPanelStep, schemaForSelectedTable.length]);

  const setSelectedSourceIdAndFocus = useCallback((sourceId: string, index: number) => {
    setFocusedSourceIndex(index);
    setSelectedSourceId(sourceId);
    setTimeout(() => sourceListItemRefs.current.get(sourceId)?.focus(), 0);
  }, []);

  return {
    // list fetch state
    dataSourcesMap,
    dataSourcesLoading,
    dataSourcesError,
    // list + paging
    dataSourcesList,
    visibleDataSourcesList,
    visibleSourcesCount,
    setVisibleSourcesCount,
    // selection + left panel
    selectedSourceId,
    selectedSource,
    leftPanelCollapsed,
    setLeftPanelCollapsed,
    searchQuery,
    // focus helpers
    focusedSourceIndex,
    sourceListItemRefs,
    selectSource,
    handleSourceFocus,
    jumpToBoundarySource,
    setSelectedSourceId: setSelectedSourceIdAndFocus,
    // explore state
    activeDetailsTab,
    setActiveDetailsTab,
    dataPanelStep,
    setDataPanelStep,
    selectedTableName,
    setSelectedTableName,
    tablesListPage,
    setTablesListPage,
    exploreLoading,
    exploreError,
    exploreKind,
    exploreTables,
    exploreCsvSchema,
    previewSchemaFromPreview,
    schemaForSelectedTable,
    handlePreviewSchemaLoaded,
    // derived
    effectiveKind,
    isPostgresqlSource,
    isCsvSource,
    tablesListTotalPages,
    visibleTableNames,
    tablesListStart,
    tablesListEnd,
    handleBackToTables,
  };
}


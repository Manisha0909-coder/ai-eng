import React, { useCallback, useEffect, useMemo, useState } from "react";

import { BarChart2, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { useDefaultDashboard } from "@/hooks/useDefaultDashboard";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { useDataSources } from "@/hooks/useDataSources";

import { ChartContent, type LatestHtmlVisualization, type PlotlyDashboard } from "./ChartContent";
import { DataContent } from "./DataPanel/DataContent";
import type { Message } from "@/types/message";

/** Matches `window.innerWidth > 768` — responsive top/height without waiting for client hydration. */
const SIDEBAR_FIXED_LAYOUT_CLASS =
  "fixed top-16 h-[calc(100vh-4rem)] min-[769px]:top-[60px] min-[769px]:h-[calc(100vh-60px)]";

interface VisualizationSidebarProps {
  messages: Message[];
  /** When true, do not fetch or render the default dashboard (e.g. when persona is chat or mode is analytical). */
  suppressDefaultDashboard?: boolean;
  /** "sidebar" = fixed right sidebar (default). "inline" = flex child in center for dashboard layout. */
  variant?: "sidebar" | "inline";
}

/** json_data shapes from dashboard/visualization APIs not fully reflected on Message. */
type VisualizationJsonData = NonNullable<Message["json_data"]> & {
  dashboard_data?: {
    html_data?: unknown;
    dashboard_metadata?: { title?: string; name?: string; description?: string };
    plotly_json_config?: unknown[];
  };
  plotly_json_config?: unknown[];
  dashboard_metadata?: { title?: string; name?: string; description?: string };
};

function getVisualizationJson(msg: Message): VisualizationJsonData | undefined {
  return msg.json_data as VisualizationJsonData | undefined;
}

type HtmlVisualizationItem = {
  html: string;
  title?: string;
  description?: string;
};

const getLatestHtmlVisualization = (messages: Message[]): (LatestHtmlVisualization & { items?: HtmlVisualizationItem[] }) | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.type !== "assistant") continue;

    const jsonData = getVisualizationJson(msg);
    const dashboardData = jsonData?.dashboard_data;
    const dashboardHtml = dashboardData?.html_data;
    const dashboardTitle = dashboardData?.dashboard_metadata?.name;

    const raw = (msg as any).html_data ?? jsonData?.html_data ?? dashboardHtml;
    if (!raw) continue;

    const normalize = (val: unknown): HtmlVisualizationItem | null => {
      if (typeof val === "string") return { html: val };
      if (val && typeof val === "object") {
        const o = val as { string?: string; metadata?: { title?: string; description?: string } };
        if (typeof o.string === "string") {
          return { html: o.string, title: o.metadata?.title, description: o.metadata?.description };
        }
      }
      return null;
    };

    if (Array.isArray(raw)) {
      const normalized = raw
        .map((entry: unknown) => normalize(entry))
        .filter((e): e is HtmlVisualizationItem => Boolean(e?.html));
      if (normalized.length === 0) continue;
      const primary = normalized[normalized.length - 1];
      return {
        html: primary.html,
        title: primary.title ?? dashboardTitle ?? (msg as any).chat_title,
        description: primary.description,
        items: normalized,
      };
    }

    const single = normalize(raw);
    if (!single || !single.html) continue;
    return {
      html: single.html,
      title: single.title ?? dashboardTitle ?? (msg as any).chat_title,
      description: single.description,
      items: [single],
    };
  }
  return null;
};

type PlotlyChartCard = {
  id?: string | number;
  name?: string;
  error?: string;
  row?: number | null;
  col?: number | null;
  rowspan?: number | null;
  colspan?: number | null;
  plotly_data_config?: any;
  plotly_data?: any;
};

type PlotlyJsonConfigEntry = {
  metadata?: { title?: string; name?: string; description?: string };
  plotly_data?: unknown;
};

function plotlyChartHasRenderableData(chart: PlotlyChartCard): boolean {
  // Backend can send chart placeholders with only `error` (no plotly_data_config yet)
  if (typeof chart.error === "string" && chart.error.trim().length > 0) return true;
  const cfg = chart.plotly_data_config ?? chart.plotly_data;
  if (!cfg || typeof cfg !== "object") return false;
  const anyCfg = cfg as Record<string, unknown>;
  const data = anyCfg.data;
  if (Array.isArray(data) && data.length > 0) return true;
  // Pie / some traces don't always rely on `data: []` shape
  if (Array.isArray(anyCfg.labels) && Array.isArray(anyCfg.values) && (anyCfg.values as unknown[]).length > 0) {
    return true;
  }
  // Heatmap / matrix-style traces
  if (Array.isArray(anyCfg.z) && (anyCfg.z as unknown[]).length > 0) return true;
  return false;
}

function pickPlotlyConfigEntryWithCharts(plotlyConfigArray: unknown[]): PlotlyJsonConfigEntry | null {
  for (let j = plotlyConfigArray.length - 1; j >= 0; j--) {
    const entry = plotlyConfigArray[j] as PlotlyJsonConfigEntry;
    const pd = entry?.plotly_data as unknown;
    if (Array.isArray(pd) && pd.length > 0) return entry;
  }
  const first = plotlyConfigArray[0] as PlotlyJsonConfigEntry | undefined;
  return first ?? null;
}

const getLatestPlotlyDashboard = (messages: Message[]): PlotlyDashboard | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.type !== "assistant") continue;
    if (msg.isStreaming) continue;
    const jd = getVisualizationJson(msg);
    if (!jd) continue;
    const nested = jd.dashboard_data?.plotly_json_config;
    const topLevel = jd.plotly_json_config;
    const plotlyConfigArray =
      Array.isArray(nested) && nested.length > 0
        ? nested
        : Array.isArray(topLevel) && topLevel.length > 0
          ? topLevel
          : null;
    if (!plotlyConfigArray) continue;

    const dashboardData = jd.dashboard_data ?? {};
    // Backend often sends: [{ plotly_data: [...charts] }, { metadata: {...} }]
    // The last element may be metadata-only; never pick that for charts.
    const cfg = pickPlotlyConfigEntryWithCharts(plotlyConfigArray);
    if (!cfg) continue;

    const chartsRaw: PlotlyChartCard[] = Array.isArray(cfg.plotly_data)
      ? (cfg.plotly_data as PlotlyChartCard[])
      : [];
    const charts = chartsRaw.filter(plotlyChartHasRenderableData);
    if (!charts.length) continue;

    const tailMeta = [...plotlyConfigArray]
      .reverse()
      .find((e) => e && typeof e === "object" && (e as PlotlyJsonConfigEntry).metadata) as
      | PlotlyJsonConfigEntry
      | undefined;

    const metadata =
      tailMeta?.metadata ??
      cfg.metadata ??
      dashboardData.dashboard_metadata ??
      jd.dashboard_metadata ??
      {};
    const title =
      metadata.title ??
      metadata.name ??
      dashboardData.dashboard_metadata?.name ??
      jd.dashboard_metadata?.name ??
      (msg as any).chat_title;
    const description =
      metadata.description ??
      dashboardData.dashboard_metadata?.description ??
      jd.dashboard_metadata?.description;

    return { title, description, charts };
  }
  return null;
};

export const VisualizationSidebar: React.FC<VisualizationSidebarProps> = ({
  messages,
  suppressDefaultDashboard = false,
  variant = "sidebar",
}) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { effectiveSidebarWidth, isResizingSidebarRef } = useSidebarResize({ variant, isMobile });
  const activeTab = useStore((s) => s.visualizationActiveTab);
  const selectedPersonaId = useStore((s) => s.selectedPersonaId);
  const personas = useStore((s) => s.personas);
  const isDashboardFullscreen = useStore((s) => s.isDashboardFullscreen);
  const toggleDashboardFullscreen = useStore((s) => s.toggleDashboardFullscreen);

  const selectedPersona = useMemo(
    () => (selectedPersonaId != null ? personas.find((p) => p.id === selectedPersonaId) : undefined),
    [personas, selectedPersonaId]
  );
  const isDashboardPersona = selectedPersona?.type === "dashboard";

  const [, setChartThemeRevision] = useState(0);
  const readChartColors = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    setChartThemeRevision((n) => n + 1);
  }, []);
  useEffect(() => {
    const handler = () => readChartColors();
    window.addEventListener("color-scheme-changed", handler);
    return () => window.removeEventListener("color-scheme-changed", handler);
  }, [readChartColors]);

  const latestPlotlyDashboard = useMemo(() => getLatestPlotlyDashboard(messages), [messages]);
  const latestHtmlVisualization = useMemo(
    () => (isDashboardPersona ? null : getLatestHtmlVisualization(messages)),
    [isDashboardPersona, messages]
  );

  const { defaultDashboardHtml, isLoadingDefault, defaultDashboardError, DEFAULT_DASHBOARD_NOT_FOUND } =
    useDefaultDashboard({
      selectedPersonaId,
      suppressDefaultDashboard,
      hasVisualization: isDashboardPersona
        ? Boolean(latestPlotlyDashboard)
        : Boolean(latestHtmlVisualization || latestPlotlyDashboard),
    });

  const [searchQuery, setSearchQuery] = useState("");
  const data = useDataSources(activeTab, selectedPersonaId, searchQuery);

  const handleDataTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const list = data.visibleDataSourcesList;
      if (list.length === 0) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          {
            const nextIndex = Math.min(data.focusedSourceIndex + 1, list.length - 1);
            const source = list[nextIndex];
            data.setSelectedSourceId(source.source_id, nextIndex);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          {
            const nextIndex = Math.max(data.focusedSourceIndex - 1, 0);
            const source = list[nextIndex];
            data.setSelectedSourceId(source.source_id, nextIndex);
          }
          break;
        case "Home":
          e.preventDefault();
          data.jumpToBoundarySource("first");
          break;
        case "End":
          e.preventDefault();
          data.jumpToBoundarySource("last");
          break;
        default:
          break;
      }
    },
    [data]
  );

  const isInline = variant === "inline";
  if (!isInline && (isMobile || effectiveSidebarWidth <= 0)) return null;
  if (isInline && isMobile) return null;

  const wrapperStyle: React.CSSProperties = isInline
    ? {
        flex: 1,
        height: "100%",
        minWidth: 0,
        maxWidth: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-background-gradient, var(--color-background))",
        color: "var(--color-text)",
        overflow: "hidden",
        contain: "layout",
      }
    : {
        right: 0,
        width: `${effectiveSidebarWidth}px`,
        background: "var(--color-background-gradient, var(--color-background))",
        color: "var(--color-text)",
        borderLeft: "1px solid rgb(var(--color-border))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      };

  return (
    <>
      {variant === "sidebar" && !isInline ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize visualization sidebar"
          className={cn(SIDEBAR_FIXED_LAYOUT_CLASS, "z-[41] w-[6px] cursor-grab touch-none")}
          onMouseDown={() => {
            isResizingSidebarRef.current = true;
          }}
          style={{ right: effectiveSidebarWidth }}
        />
      ) : null}

      <div
        className={cn("sidebar-preview scrollbar", !isInline && SIDEBAR_FIXED_LAYOUT_CLASS, !isInline && "z-40")}
        aria-label={isInline ? "Dashboard" : "Visualization preview sidebar"}
        style={wrapperStyle}
      >
        <div className="sidebar-content bg-background scrollbar-themed flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden pt-2.5 px-4 pb-3.5">
          {activeTab === "chart" ? (
            <div className="scrollbar-themed" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, minHeight: "100%", display: "flex", flexDirection: "column" }}>
                  <ChartContent
                    latestPlotlyDashboard={latestPlotlyDashboard}
                    latestHtmlVisualization={latestHtmlVisualization}
                    suppressDefaultDashboard={suppressDefaultDashboard}
                    defaultDashboardHtml={defaultDashboardHtml}
                    isLoadingDefault={isLoadingDefault}
                    defaultDashboardError={defaultDashboardError}
                    defaultDashboardNotFoundCode={DEFAULT_DASHBOARD_NOT_FOUND}
                  />
                </div>
              </div>
            </div>
          ) : (
            <DataContent
              onKeyDown={handleDataTabKeyDown}
              leftPanelCollapsed={data.leftPanelCollapsed}
              setLeftPanelCollapsed={data.setLeftPanelCollapsed}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dataSourcesLoading={data.dataSourcesLoading}
              dataSourcesError={data.dataSourcesError}
              dataSourcesList={data.dataSourcesList}
              visibleDataSourcesList={data.visibleDataSourcesList}
              selectedSourceId={data.selectedSourceId}
              selectSource={data.selectSource}
              handleSourceFocus={data.handleSourceFocus}
              sourceListItemRefs={data.sourceListItemRefs}
              visibleSourcesCount={data.visibleSourcesCount}
              setVisibleSourcesCount={data.setVisibleSourcesCount}
              selectedSource={data.selectedSource}
              dataPanelStep={data.dataPanelStep}
              setDataPanelStep={data.setDataPanelStep}
              activeDetailsTab={data.activeDetailsTab}
              setActiveDetailsTab={data.setActiveDetailsTab}
              selectedTableName={data.selectedTableName}
              setSelectedTableName={data.setSelectedTableName}
              isPostgresqlSource={data.isPostgresqlSource}
              isCsvSource={data.isCsvSource}
              exploreLoading={data.exploreLoading}
              exploreError={data.exploreError}
              exploreTables={data.exploreTables}
              visibleTableNames={data.visibleTableNames}
              tablesListPage={data.tablesListPage}
              setTablesListPage={data.setTablesListPage}
              tablesListTotalPages={data.tablesListTotalPages}
              tablesListStart={data.tablesListStart}
              tablesListEnd={data.tablesListEnd}
              schemaForSelectedTable={data.schemaForSelectedTable}
              handlePreviewSchemaLoaded={data.handlePreviewSchemaLoaded}
              handleBackToTables={data.handleBackToTables}
            />
          )}
        </div>
      </div>

      {(activeTab === "chart" || activeTab === "data") && (
        <button
          type="button"
          onClick={toggleDashboardFullscreen}
          aria-label={isDashboardFullscreen ? "Show chat sidebar" : "Hide chat sidebar"}
          title={isDashboardFullscreen ? "Show chat" : "Hide chat"}
          className="fixed bottom-24 right-[calc(var(--chat-sidebar-width,0px)+var(--chat-divider-width,0px)+14px)] w-icon-lg h-icon-lg rounded-full border border-border-main bg-surface text-text-main inline-flex items-center justify-center shadow-[0_10px_26px_rgba(0,0,0,0.18)] z-[60]"
        >
          {isDashboardFullscreen ? (
            <MessageSquare style={{ width: 18, height: 18 }} />
          ) : (
            <BarChart2 style={{ width: 18, height: 18 }} />
          )}
        </button>
      )}
    </>
  );
};

export default VisualizationSidebar;


import DraggableDashboard, {
  type DraggableDashboardChartConfig,
  type DraggableDashboardChartConfig as ChartConfig,
} from "@/features/visualization/components/DraggableDashboard";
import { DefaultDashboardLandscape } from "@/features/visualization/components/DefaultDashboardLandscape/DefaultDashboardLandscape";
import IFrame from "@/components/IFrame";
import { DashboardLoader } from "@/components/ContentLoader";

type HtmlVisualizationItem = {
  html: string;
  title?: string;
  description?: string;
};

export type LatestHtmlVisualization = {
  html: string;
  title?: string;
  description?: string;
  items?: HtmlVisualizationItem[];
};

export type PlotlyDashboard = {
  title?: string;
  description?: string;
  charts: Array<{
    id?: string | number;
    name?: string;
    error?: string;
    row?: number | null;
    col?: number | null;
    rowspan?: number | null;
    colspan?: number | null;
    plotly_data_config?: {
      data?: Plotly.Data[];
      layout?: Partial<Plotly.Layout>;
      config?: Partial<Plotly.Config>;
    };
    plotly_data?: {
      data?: Plotly.Data[];
      layout?: Partial<Plotly.Layout>;
      config?: Partial<Plotly.Config>;
    };
  }>;
};

export function ChartContent({
  latestPlotlyDashboard,
  latestHtmlVisualization,
  suppressDefaultDashboard,
  defaultDashboardHtml,
  isLoadingDefault,
  defaultDashboardError,
  defaultDashboardNotFoundCode,
}: {
  latestPlotlyDashboard: PlotlyDashboard | null;
  latestHtmlVisualization: LatestHtmlVisualization | null;
  suppressDefaultDashboard: boolean;
  defaultDashboardHtml: string | null;
  isLoadingDefault: boolean;
  defaultDashboardError: string | null;
  defaultDashboardNotFoundCode: string;
}) {
  if (latestPlotlyDashboard) {
    const charts: DraggableDashboardChartConfig[] = latestPlotlyDashboard.charts.map(
      (chart, idx): ChartConfig => {
        const cfg = chart.plotly_data_config ?? chart.plotly_data;
        const normalized = cfg
          ? {
              data: (cfg.data ?? []) as Plotly.Data[],
              layout: cfg.layout ?? {},
              config: cfg.config,
            }
          : { data: [], layout: {}, config: undefined };
        return {
          id: chart.id ?? idx,
          name: chart.name ?? latestPlotlyDashboard?.title ?? "Chart",
          ...(chart.error ? { error: chart.error } : {}),
          row: chart.row ?? null,
          col: chart.col ?? null,
          rowspan: chart.rowspan ?? null,
          colspan: chart.colspan ?? null,
          plotly_data_config: normalized,
        };
      }
    );

    return (
      <DraggableDashboard charts={charts} storageKey="newton_viz_dashboard" showResetButton />
    );
  }

  if (latestHtmlVisualization) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: "100%",
        }}
      >
        {latestHtmlVisualization.items?.map((viz, index) => (
          <div
            key={index}
            style={{
              borderRadius: 10,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              flex: latestHtmlVisualization.items?.length === 1 ? 1 : undefined,
            }}
          >
            {(viz.title || viz.description) && (
              <div style={{ padding: "10px 12px 6px 12px" }}>
                {viz.title && (
                  <div
                    style={{
                      fontSize: "20px",
                      color: "var(--color-text)",
                      marginBottom: viz.description ? 2 : 0,
                    }}
                  >
                    {viz.title}
                  </div>
                )}
                {viz.description && (
                  <div style={{ fontSize: "11px", color: "rgb(var(--color-text-muted))", opacity: 0.8 }}>
                    {viz.description}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                padding: viz.title || viz.description ? 8 : 0,
                flex: latestHtmlVisualization.items?.length === 1 ? 1 : undefined,
                display: latestHtmlVisualization.items?.length === 1 ? "flex" : undefined,
              }}
            >
              <IFrame
                title={viz.title || latestHtmlVisualization.title || "Embedded visualization"}
                content={{ kind: "html", value: viz.html }}
                size={
                  latestHtmlVisualization.items?.length === 1
                    ? { mode: "viewport", vh: 100 }
                    : { mode: "auto", min: 320, max: 2400 }
                }
                sandboxLevel="scripts"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!suppressDefaultDashboard && defaultDashboardHtml) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        <IFrame
          title="Default Dashboard"
          content={{ kind: "html", value: defaultDashboardHtml }}
          size={{ mode: "viewport", vh: 100 }}
          sandboxLevel="scripts"
        />
      </div>
    );
  }

  if (!suppressDefaultDashboard && isLoadingDefault) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DashboardLoader size="md" message="Loading dashboard..." />
      </div>
    );
  }

  if (!suppressDefaultDashboard && defaultDashboardError) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          color: "rgb(var(--color-text-muted))",
          opacity: 0.7,
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div style={{ marginBottom: 6 }}>
            {defaultDashboardError === defaultDashboardNotFoundCode
              ? "No default dashboard is available."
              : "Loading default dashboard failed."}
          </div>
          <div style={{ fontSize: "16px", opacity: 0.85 }}>
            {defaultDashboardError === defaultDashboardNotFoundCode
              ? "Start a conversation to create your dashboard."
              : "Please try again in a moment, or start a new conversation to build a fresh dashboard."}
          </div>
        </div>
      </div>
    );
  }

  if (!suppressDefaultDashboard) {
    return <DefaultDashboardLandscape className="h-full min-h-0 overflow-auto" />;
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        color: "rgb(var(--color-text-muted))",
        opacity: 0.9,
        textAlign: "center",
        padding: "0 16px",
      }}
    >
      No visualization available yet for this conversation.
    </div>
  );
}


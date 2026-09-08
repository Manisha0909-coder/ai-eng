import React, { useEffect, useState } from "react";
import { fetchDefaultDashboard, type DefaultDashboardChart } from "@/services/visualization/defaultDashboardApi";
import { useStore } from "@/store/useStore";
import DraggableDashboard, {
  type DraggableDashboardChartConfig,
} from "../DraggableDashboard";

export const DefaultDashboardLandscape: React.FC<{ className?: string }> = ({ className = "" }) => {
  const selectedPersonaId = useStore((s) => s.selectedPersonaId);
  const [charts, setCharts] = useState<DefaultDashboardChart[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedPersonaId == null || selectedPersonaId <= 0) {
      // Avoid blanking an already-rendered dashboard if persona briefly becomes null
      // (e.g. hydration or transient store updates). If there's no dashboard yet,
      // fall back to empty state.
      setCharts((prev) => (prev.length > 0 ? prev : []));
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setLoading(true);
    fetchDefaultDashboard({ personaId: selectedPersonaId })
      .then((data) => {
        if (cancelled) return;
        const list =
          data?.plotly_config_json ??
          data?.graphs ??
          (Array.isArray(data?.plotly_json_config)
            ? (data?.plotly_json_config as DefaultDashboardChart[])
            : []);
        if (Array.isArray(list) && list.length > 0) {
          setCharts(list);
        } else {
          setCharts([]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load default dashboard");
          setCharts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPersonaId]);

  if (loading) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 260,
          color: "var(--color-text-muted)",
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ position: "relative", width: 32, height: 32 }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "999px",
                border: "2px solid rgb(var(--color-border) / 0.25)",
                borderTopColor: "transparent",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "999px",
                border: "2px solid rgb(var(--color-primary) / 0.9)",
                borderColor:
                  "transparent transparent rgb(var(--color-primary) / 0.9) rgb(var(--color-primary) / 0.9)",
                animation: "dd-default-spin 0.9s linear infinite",
              }}
            />
          </div>
          <div>Loading dashboard…</div>
          <style>
            {`@keyframes dd-default-spin { to { transform: rotate(360deg); } }`}
          </style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          color: "var(--color-text-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>
            Unable to load your default dashboard right now.
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Please refresh the page or try again in a moment.
          </div>
        </div>
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          color: "var(--color-text-muted)",
          fontSize: 13,
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        <div style={{ maxWidth: 560, width: "100%" }}>
          No default dashboard charts are available.
        </div>
      </div>
    );
  }

  const draggableCharts: DraggableDashboardChartConfig[] = charts.map((chart, idx) => {
    const cfg = chart.plotly_data_config;
    const normalized = cfg
      ? {
          data: (cfg.data ?? []) as Plotly.Data[],
          layout: cfg.layout ?? {},
          config: cfg.config,
        }
      : { data: [], layout: {}, config: undefined };

    return {
      id: chart.id ?? idx,
      name: chart.name ?? "Chart",
      row: chart.row ?? null,
      col: chart.col ?? null,
      rowspan: chart.rowspan ?? null,
      colspan: chart.colspan ?? null,
      plotly_data_config: normalized,
    };
  });

  return (
    <DraggableDashboard
      className={className}
      charts={draggableCharts}
      storageKey="newton_default_dashboard_layout"
      showResetButton
    />
  );
};

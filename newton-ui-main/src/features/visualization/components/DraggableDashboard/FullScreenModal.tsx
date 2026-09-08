import { useCallback, useEffect, useState } from "react";

import type { ChartColors } from "@/utils/chartColors";
import type { DraggableDashboardChartConfig } from "./types";
import { chartIsIndicatorOnly } from "@/utils/dashboardLayout";
import { PlotlyCell } from "./PlotlyCell";

function ChartErrorPanel({ message, tc }: { message: string; tc: ChartColors }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 100,
        margin: "4px 12px 8px",
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${tc.border}`,
        background: tc.surface,
        borderLeft: `3px solid ${tc.error}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: tc.error,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        Chart could not be rendered
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: tc.textMuted, wordBreak: "break-word" }}>
        {message}
      </div>
    </div>
  );
}

export function FullScreenModal({
  chart,
  tc,
  onClose,
}: {
  chart: DraggableDashboardChartConfig;
  tc: ChartColors;
  onClose: () => void;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const cfg = chart.plotly_data_config ?? chart.plotly_data ?? { data: [], layout: {} };
  const hasError = Boolean(chart.error);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleClose]);

  return (
    <div
      className={`dd-modal-overlay ${isClosing ? "dd-modal-overlay--leaving" : "dd-modal-overlay--entering"}`}
      onClick={handleClose}
    >
      <div
        className={`dd-modal-content ${isClosing ? "dd-modal-content--leaving" : "dd-modal-content--entering"}`}
        style={{ background: tc.background, borderColor: tc.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: `1px solid ${tc.border}`,
            background: tc.background,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: tc.text,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {chart.name || "Chart"}
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close fullscreen"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: tc.textMuted,
              borderRadius: 6,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${tc.textMuted}22`;
              e.currentTarget.style.color = tc.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tc.textMuted;
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, padding: "16px", display: "flex", flexDirection: "column" }}>
          {hasError ? (
            <ChartErrorPanel message={chart.error!} tc={tc} />
          ) : (
            <PlotlyCell
              config={{
                data: (cfg.data ?? []) as Plotly.Data[],
                layout: cfg.layout ?? {},
                config: cfg.config,
              }}
              tc={tc}
              variant={chartIsIndicatorOnly(chart) ? "kpi" : "default"}
            />
          )}
        </div>
      </div>
    </div>
  );
}


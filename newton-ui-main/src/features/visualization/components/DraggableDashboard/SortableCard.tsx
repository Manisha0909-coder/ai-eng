import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Resizable } from "re-resizable";

import type { ChartColors } from "@/utils/chartColors";
import type { DraggableDashboardChartConfig } from "./types";
import type { CardSize } from "@/utils/dashboardLayout";
import {
  chartIsIndicatorOnly,
  chartIsSingleIndicatorTile,
  defaultCardSize,
  DEFAULT_HEIGHT,
  INDICATOR_RESIZE_MIN_HEIGHT,
  INDICATOR_RESIZE_MIN_WIDTH,
} from "@/utils/dashboardLayout";
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

interface ResizeDelta {
  width: number;
  height: number;
}

export function SortableCard({
  chart,
  tc,
  size,
  onResize,
  onPopout,
  isEditing,
  animationDelay,
}: {
  chart: DraggableDashboardChartConfig;
  tc: ChartColors;
  size: CardSize;
  onResize: (id: string, delta: ResizeDelta) => void;
  onPopout: (id: string) => void;
  isEditing: boolean;
  animationDelay: number;
  containerWidth: number;
}) {
  const id = String(chart.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isEditing,
  });

  const cfg = chart.plotly_data_config ?? chart.plotly_data ?? { data: [], layout: {} };
  const hasError = Boolean(chart.error);
  const compactIndicatorTile = chartIsSingleIndicatorTile(chart);
  const kpiChrome = chartIsIndicatorOnly(chart);

  const ddCardStyle: React.CSSProperties = kpiChrome
    ? {
        width: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: `1px solid ${tc.border}`,
        background: tc.background,
        boxShadow: [
          `0 0 0 1px color-mix(in srgb, ${tc.border} 40%, transparent)`,
          `var(--shadow-sm)`,
          `var(--shadow-lg)`,
        ].join(", "),
      }
    : {
        width: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        border: `1px solid ${tc.border}`,
        background: tc.background,
        boxShadow: "var(--shadow-md)",
      };

  const cardInner = (
    <div className={`dd-card${kpiChrome ? " dd-card--kpi" : ""}`} style={ddCardStyle}>
      <div
        className={isEditing ? "dd-drag-handle" : undefined}
        {...(isEditing ? { ...attributes, ...listeners } : {})}
        style={{
          display: "flex",
          alignItems: "center",
          gap: kpiChrome ? 10 : 8,
          padding: kpiChrome ? "11px 14px 11px 10px" : "8px 12px",
          borderBottom: kpiChrome
            ? `1px solid color-mix(in srgb, ${tc.border} 88%, transparent)`
            : `1px solid ${tc.border}`,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {kpiChrome ? (
          <div
            aria-hidden
            style={{
              width: 3,
              borderRadius: 2,
              alignSelf: "stretch",
              minHeight: 22,
              background: `linear-gradient(180deg, color-mix(in srgb, ${tc.textMuted} 55%, ${tc.background}), ${tc.border})`,
              flexShrink: 0,
            }}
          />
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPopout(id);
          }}
          aria-label="View fullscreen"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
            transition: "opacity 0.2s",
            marginLeft: kpiChrome ? 0 : -4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tc.textMuted}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>

        {isEditing && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.55 }}>
            {[2, 6, 10].flatMap((x) =>
              [2, 6, 10].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.25" fill={tc.textMuted} />)
            )}
          </svg>
        )}

        <span
          style={{
            fontSize: kpiChrome ? 10 : 11,
            fontWeight: 700,
            color: tc.textMuted,
            letterSpacing: kpiChrome ? "0.11em" : "0.05em",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {chart.name || "Chart"}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: kpiChrome ? "visible" : undefined,
          padding: kpiChrome ? "0 4px 10px" : "4px 0 8px",
        }}
      >
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
            variant={kpiChrome ? "kpi" : "default"}
          />
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : undefined,
        width: "100%",
        minHeight: size.height,
        height: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className={animationDelay >= 0 ? "dd-card-enter" : undefined}
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          ...(animationDelay >= 0 && { animationDelay: `${animationDelay}ms` }),
        }}
      >
        {isEditing ? (
          <Resizable
            className="dd-resizable"
            size={{ width: "100%", height: size.height }}
            minWidth={compactIndicatorTile ? INDICATOR_RESIZE_MIN_WIDTH : 280}
            minHeight={compactIndicatorTile ? INDICATOR_RESIZE_MIN_HEIGHT : 240}
            enable={{ bottom: true }}
            onResizeStop={(_e, _dir, _ref, delta) => {
              onResize(id, { width: 0, height: delta.height });
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              minHeight: size.height,
              flex: 1,
              boxSizing: "border-box",
            }}
          >
            {cardInner}
          </Resizable>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: size.height,
              width: "100%",
            }}
          >
            {cardInner}
          </div>
        )}
      </div>
    </div>
  );
}

export function getEffectiveSize({
  id,
  charts,
  sizes,
  containerWidth,
  maxCardWidth,
}: {
  id: string;
  charts: DraggableDashboardChartConfig[];
  sizes: Record<string, CardSize>;
  containerWidth: number;
  maxCardWidth?: number;
}): CardSize {
  const chart = charts.find((c) => String(c.id) === id);
  const fallback =
    chart && containerWidth > 0
      ? defaultCardSize(chart, containerWidth)
      : { width: 480, height: DEFAULT_HEIGHT };
  const raw = sizes[id] ?? fallback;
  if (maxCardWidth == null || raw.width <= maxCardWidth) return raw;
  return { width: maxCardWidth, height: raw.height };
}


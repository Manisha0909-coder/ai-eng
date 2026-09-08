import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ChartColors } from "@/utils/chartColors";
import type { PlotlyDataConfig } from "./types";
import {
  ddLayoutScale,
  ddLegendBelowCartesian,
  ddPieLegendBelow,
  withIndicatorFontScaling,
  withTableColumnSizing,
} from "@/utils/plotlyLayoutUtils";

/** Narrow props for the default export — react-plotly.js ships without useful TS types. */
interface PlotlyReactComponentProps {
  data?: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  config?: Partial<Plotly.Config>;
  style?: React.CSSProperties;
  useResizeHandler?: boolean;
}

// Lazy: plotly.js is ~4 MB of script — loading it eagerly put it on the app's
// startup critical path and stretched the PWA splash screen. It now downloads
// only when a chart actually renders. Some builds resolve `react-plotly.js`
// as a module namespace object (`{ default: Component }`), hence the unwrap.
const PlotComponent = React.lazy(async () => {
  const mod: any = await import("react-plotly.js");
  const Component = (mod.default?.default ?? mod.default ?? mod) as
    React.ComponentType<PlotlyReactComponentProps>;
  return { default: Component };
});

// Debounce so we don't redraw Plotly on every resize tick (reduces lag when sidebar toggles)
const PLOTLY_RESIZE_DEBOUNCE_MS = 80;

function ddClamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export const PlotlyCell = React.memo(function PlotlyCell({
  config,
  tc,
  variant = "default",
}: {
  config: PlotlyDataConfig;
  tc: ChartColors;
  /** "kpi" = transparent plot paper so parent card surface shows through (indicator tiles). */
  variant?: "default" | "kpi";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        setSize({ w, h });
      }, PLOTLY_RESIZE_DEBOUNCE_MS);
    });
    ro.observe(el);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, []);

  // Once we have a real size, mount the chart then fade it in.
  // Two rAFs ensure the CSS transition always triggers.
  useEffect(() => {
    if (size.w > 0 && size.h > 0 && !mounted) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    }
  }, [size.w, size.h, mounted]);

  const dataForPlot = useMemo(
    () =>
      withTableColumnSizing(
        withIndicatorFontScaling(config.data as Plotly.Data[] | undefined, config.layout, tc, size.w)
      ),
    [config.data, config.layout, tc, size.w]
  );

  const layout: Partial<Plotly.Layout> = useMemo(() => {
    // Strip BE keys that clash with theming
    const rawLayout = { ...(config.layout ?? {}) } as any;
    delete rawLayout.title;
    delete rawLayout.template;

    const data = (dataForPlot ?? []) as Array<any>;
    const types = data.map((t) => t.type ?? "scatter");
    const hasPie = ["pie", "sunburst", "funnelarea", "treemap"].some((t) => types.includes(t));
    const hasOnlyIndicators = data.length > 0 && data.every((t: any) => t?.type === "indicator");

    const maxPoints = Math.max(0, ...data.map((t) => (t.x ?? []).length));
    const isDenseX = maxPoints > 30;

    const xLabels = data.flatMap((t: any) => t.x ?? []);
    const maxLabelLen = Math.max(0, ...xLabels.map((v: unknown) => String(v).length));
    const hasLongXLabels = maxLabelLen > 10;

    const needsTickAngle = isDenseX || hasLongXLabels;

    const maxYVal = Math.max(
      0,
      ...data.flatMap((t) => (t.y ?? []).filter((v: unknown): v is number => typeof v === "number"))
    );

    // Horizontal bar charts put category labels on the y-axis — left margin must be wide enough.
    const hasHorizontalBar = data.some((t) => t.type === "bar" && t.orientation === "h");
    const maxYLabelLen = hasHorizontalBar
      ? Math.max(0, ...data.flatMap((t) => (t.y ?? []).map((v: unknown) => String(v).length)))
      : 0;

    const plotW = size.w;
    const plotH = size.h;
    const scale = ddLayoutScale(plotW, plotH);
    const tickSize = Math.round(ddClamp(11 * scale, 7, 13));
    const legendFontSize = Math.round(ddClamp(11 * scale, 8, 12));

    const leftMargin = hasHorizontalBar
      ? Math.min(200, Math.max(72, maxYLabelLen * tickSize * 0.62 + 18))
      : Math.round(
          (maxYVal >= 10000 ? 72 : maxYVal >= 1000 ? 62 : 52) * ddClamp(scale, 0.85, 1.1)
        );

    // Crowded traces *or* narrow card: horizontal legend so it does not eat plot width
    const legendBelow = ddLegendBelowCartesian(plotW, data.length);
    const legendY = plotH > 0 && plotH < 260 ? -0.1 : plotH > 0 && plotH < 320 ? -0.16 : -0.26;

    const useTransparentPlot = variant === "kpi" && hasOnlyIndicators;

    // Invariants that BE must never override: sizing and theme colors
    const invariants = {
      width: size.w || undefined,
      height: size.h || undefined,
      autosize: false,
      paper_bgcolor: useTransparentPlot ? "transparent" : tc.background,
      plot_bgcolor: useTransparentPlot ? "transparent" : tc.background,
    };

    const base = {
      ...rawLayout,
      font: { ...(rawLayout.font ?? {}), color: tc.text },
      legend: {
        ...(rawLayout.legend ?? {}),
        font: { color: tc.textMuted, size: legendFontSize },
        bgcolor: "transparent",
        ...(legendBelow
          ? { orientation: "h" as const, y: legendY, x: 0.5, xanchor: "center" as const }
          : {}),
      },
      ...invariants,
    };

    if (hasPie) {
      const pieLegBelow = ddPieLegendBelow(plotW, data.length);
      const pieLegendY = plotH > 0 && plotH < 260 ? -0.06 : plotH > 0 && plotH < 300 ? -0.12 : -0.2;
      const pieMargins = pieLegBelow
        ? {
            t: Math.round(ddClamp(42 * scale, 32, 56)),
            b: Math.round(ddClamp(68 * scale, 52, 96)) + (legendFontSize > 10 ? 6 : 0),
            l: Math.max(8, Math.round(12 * scale)),
            r: Math.max(8, Math.round(12 * scale)),
          }
        : {
            t: Math.round(ddClamp(44 * scale, 34, 58)),
            b: Math.round(ddClamp(40 * scale, 28, 52)),
            l: Math.max(8, Math.round(12 * scale)),
            r: Math.min(200, Math.max(32, Math.round(36 * scale) + Math.min(100, data.length * 6))),
          };

      return {
        ...base,
        legend: {
          ...(base.legend ?? {}),
          font: { color: tc.textMuted, size: legendFontSize },
          ...(pieLegBelow
            ? {
                orientation: "h" as const,
                y: pieLegendY,
                x: 0.5,
                xanchor: "center" as const,
                yanchor: "top" as const,
              }
            : {}),
        },
        margin: { ...pieMargins, ...(rawLayout.margin ?? {}) },
      };
    }

    if (hasOnlyIndicators) {
      const kpiTight = variant === "kpi";
      const hasGauge = data.some((t: any) => t?.type === "indicator" && t?.gauge != null);
      const m = (rawLayout.margin ?? {}) as Partial<Record<string, unknown>>;
      const mNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
      const minL = hasGauge ? (kpiTight ? 30 : 22) : kpiTight ? 14 : 16;
      const minR = hasGauge ? (kpiTight ? 30 : 22) : kpiTight ? 14 : 16;
      const minT = hasGauge ? (kpiTight ? 16 : 12) : kpiTight ? 2 : 2;
      const minB = hasGauge ? (kpiTight ? 22 : 18) : kpiTight ? 6 : 6;

      const rawGrid = rawLayout.grid as
        | { rows?: number; columns?: number; xgap?: number; ygap?: number; pattern?: string }
        | undefined;
      const gridPatch =
        hasGauge &&
        data.length > 1 &&
        rawGrid &&
        typeof rawGrid === "object" &&
        rawGrid.rows != null &&
        rawGrid.columns != null
          ? {
              ...rawGrid,
              xgap: Math.max(mNum(rawGrid.xgap), 28),
              ygap: Math.max(mNum(rawGrid.ygap), 22),
            }
          : undefined;

      return {
        ...base,
        ...(gridPatch ? { grid: gridPatch } : {}),
        margin: {
          ...m,
          l: Math.max(minL, mNum(m.l)),
          r: Math.max(minR, mNum(m.r)),
          t: Math.max(minT, mNum(m.t)),
          b: Math.max(minB, mNum(m.b)),
        },
      };
    }

    const hasTable = types.includes("table");
    if (hasTable) {
      return {
        ...base,
        margin: {
          t: 8,
          r: 8,
          b: 8,
          l: 8,
          ...(rawLayout.margin ?? {}),
        },
      };
    }

    const narrow = plotW > 0 && plotW < 380;
    const veryNarrow = plotW > 0 && plotW < 320;
    const tickAngle = needsTickAngle
      ? veryNarrow && maxLabelLen > 14
        ? -65
        : narrow && maxLabelLen > 12
          ? -55
          : -45
      : rawLayout.xaxis?.tickangle ?? 0;

    const nticksCap = veryNarrow ? 6 : narrow ? 8 : plotW > 0 && plotW < 520 ? 10 : 12;

    const bottomMargin = (() => {
      if (needsTickAngle) {
        const perChar = tickSize * 0.42;
        const angular = ddClamp(48 + maxLabelLen * perChar, 56, 136);
        return Math.round(angular + (narrow ? 12 : 0) + (veryNarrow ? 8 : 0));
      }
      if (legendBelow) {
        return Math.round(ddClamp(76 * scale, 62, 102) + (plotH > 0 && plotH < 280 ? 8 : 0));
      }
      return Math.round(40 * ddClamp(scale, 0.88, 1.12));
    })();

    return {
      ...base,
      margin: {
        t: 8,
        r: Math.round(16 * ddClamp(scale, 0.9, 1.08)),
        b: bottomMargin,
        l: leftMargin,
        ...(rawLayout.margin ?? {}),
      },
      xaxis: {
        automargin: true,
        ...(rawLayout.xaxis ?? {}),
        tickangle: needsTickAngle ? tickAngle : rawLayout.xaxis?.tickangle ?? 0,
        ...(needsTickAngle ? { nticks: nticksCap } : {}),
        gridcolor: `${tc.border}66`,
        linecolor: `${tc.border}99`,
        tickfont: { color: tc.textMuted, size: tickSize },
        zerolinecolor: `${tc.border}66`,
      },
      yaxis: {
        automargin: true,
        ...(rawLayout.yaxis ?? {}),
        gridcolor: `${tc.border}66`,
        linecolor: `${tc.border}99`,
        tickfont: { color: tc.textMuted, size: tickSize },
        zerolinecolor: `${tc.border}66`,
      },
    };
  }, [size.w, size.h, tc, dataForPlot, config.layout, variant]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        position: "relative",
        overflow: variant === "kpi" ? "visible" : undefined,
      }}
    >
      {!mounted && <div className="dd-skeleton" />}
      {mounted && (
        <div className={`dd-chart-wrap${visible ? " dd-chart-wrap--visible" : ""}`}>
          <Suspense fallback={<div className="dd-skeleton" />}>
          <PlotComponent
            key={`${tc.background}-${size.w}-${size.h}`}
            data={dataForPlot}
            layout={layout}
            config={{
              responsive: false,
              displaylogo: false,
              displayModeBar: "hover",
              modeBarButtonsToRemove: ["lasso2d", "select2d", "toImage"],
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler={false}
          />
          </Suspense>
        </div>
      )}
    </div>
  );
});


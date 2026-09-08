import type { ChartColors } from "@/utils/chartColors";

function ddClamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Reference plot size for font + margin scaling inside dashboard cards */
const LAYOUT_SCALE_REF_W = 400;
const LAYOUT_SCALE_REF_H = 300;

/** ~0.55 (tiny card) … 1.35 (large): drives tick + legend font sizes */
export function ddLayoutScale(w: number, h: number): number {
  if (w <= 0 || h <= 0) return 1;
  const sx = ddClamp(w / LAYOUT_SCALE_REF_W, 0.55, 1.35);
  const sy = ddClamp(h / LAYOUT_SCALE_REF_H, 0.55, 1.35);
  return ddClamp(Math.sqrt(sx * sy), 0.55, 1.35);
}

export function ddLegendBelowCartesian(plotW: number, traceCount: number): boolean {
  if (traceCount > 8) return true;
  if (plotW <= 0) return false;
  if (plotW < 340 && traceCount >= 2) return true;
  if (plotW < 400 && traceCount >= 4) return true;
  if (plotW < 460 && traceCount >= 6) return true;
  return false;
}

export function ddPieLegendBelow(plotW: number, traceCount: number): boolean {
  if (plotW <= 0) return false;
  if (plotW < 400) return true;
  if (plotW < 500 && traceCount >= 5) return true;
  if (traceCount > 8) return true;
  return false;
}

/** KPI / gauge indicators: Plotly defaults a very large number font; cap for dashboard cards. */
export const INDICATOR_NUMBER_FONT_MAX = 30;
export const INDICATOR_NUMBER_FONT_DEFAULT = 26;
export const INDICATOR_TITLE_FONT_MAX = 13;
export const INDICATOR_TITLE_FONT_DEFAULT = 11;
export const INDICATOR_DELTA_FONT_MAX = 12;
export const INDICATOR_DELTA_FONT_DEFAULT = 10;
export const INDICATOR_GAUGE_TICK_FONT_MAX = 10;

export function inferIndicatorGridColumns(
  layout: Partial<Plotly.Layout> | undefined,
  indicatorCount: number
): number {
  const g = (layout as { grid?: { columns?: number } } | undefined)?.grid;
  if (g?.columns != null && g.columns >= 1) return g.columns;
  if (indicatorCount <= 1) return 1;
  if (indicatorCount === 2) return 2;
  if (indicatorCount === 3) return 3;
  if (indicatorCount === 4) return 2;
  return Math.min(3, indicatorCount);
}

/**
 * Scale indicator number/title fonts from subplot cell width so multiple KPIs in one row
 * do not overlap (Plotly uses a large default number size).
 */
export function withIndicatorFontScaling(
  data: Plotly.Data[] | undefined,
  layout: Partial<Plotly.Layout> | undefined,
  tc: ChartColors,
  plotW: number
): Plotly.Data[] {
  if (!data?.length) return (data ?? []) as Plotly.Data[];
  const indicatorCount = data.filter((t: any) => t?.type === "indicator").length;
  const allIndicator = indicatorCount > 0 && indicatorCount === data.length;
  const gridCols = allIndicator ? inferIndicatorGridColumns(layout, indicatorCount) : 1;
  const effW = plotW > 80 ? plotW : 480;
  const cellW = allIndicator && indicatorCount > 1 ? effW / Math.max(1, gridCols) : effW;
  const multiNumberMax =
    allIndicator && indicatorCount > 1
      ? Math.max(16, Math.min(INDICATOR_NUMBER_FONT_MAX, Math.floor(cellW / 9)))
      : INDICATOR_NUMBER_FONT_MAX;
  const multiTitleMax =
    allIndicator && indicatorCount > 1
      ? Math.max(9, Math.min(INDICATOR_TITLE_FONT_MAX, Math.floor(cellW / 20)))
      : INDICATOR_TITLE_FONT_MAX;
  const multiDeltaMax =
    allIndicator && indicatorCount > 1
      ? Math.max(8, Math.min(INDICATOR_DELTA_FONT_MAX, Math.floor(cellW / 24)))
      : INDICATOR_DELTA_FONT_MAX;

  return data.map((trace: any) => {
    if (trace?.type !== "indicator") return trace as Plotly.Data;

    const titleBlock =
      trace.title == null
        ? null
        : typeof trace.title === "string"
          ? { text: trace.title, font: {} as Record<string, unknown> }
          : trace.title;
    const nf = trace.number?.font ?? {};
    const tf = (titleBlock && typeof titleBlock === "object" ? titleBlock.font ?? {} : {}) as Record<
      string,
      unknown
    >;
    const df = trace.delta?.font ?? {};
    const numberSizeRaw = nf.size;
    const titleSizeRaw = tf.size;
    const deltaSizeRaw = df.size;

    const numberFontSize =
      numberSizeRaw != null && numberSizeRaw !== ""
        ? Math.min(Number(numberSizeRaw), multiNumberMax)
        : Math.min(INDICATOR_NUMBER_FONT_DEFAULT, multiNumberMax);
    const titleFontSize =
      titleSizeRaw != null && titleSizeRaw !== ""
        ? Math.min(Number(titleSizeRaw), multiTitleMax)
        : Math.min(INDICATOR_TITLE_FONT_DEFAULT, multiTitleMax);
    const deltaFontSize =
      deltaSizeRaw != null && deltaSizeRaw !== ""
        ? Math.min(Number(deltaSizeRaw), multiDeltaMax)
        : Math.min(INDICATOR_DELTA_FONT_DEFAULT, multiDeltaMax);

    const next: any = {
      ...trace,
      number: {
        ...trace.number,
        font: {
          ...nf,
          color: nf.color ?? tc.text,
          size: numberFontSize,
        },
      },
    };

    if (titleBlock != null && typeof titleBlock === "object") {
      next.title = {
        ...titleBlock,
        font: {
          ...tf,
          color: (tf.color as string | undefined) ?? tc.textMuted,
          size: titleFontSize,
        },
      };
    }

    if (trace.delta != null) {
      next.delta = {
        ...trace.delta,
        font: {
          ...df,
          color: df.color ?? tc.textMuted,
          size: deltaFontSize,
        },
      };
    }

    if (trace.gauge?.axis) {
      const tickf = trace.gauge.axis.tickfont ?? {};
      const tickSizeRaw = tickf.size;
      const gaugeTickCap =
        allIndicator && indicatorCount > 1
          ? Math.max(6, Math.min(INDICATOR_GAUGE_TICK_FONT_MAX, Math.floor(cellW / 36)))
          : INDICATOR_GAUGE_TICK_FONT_MAX;
      const tickSize =
        tickSizeRaw != null && tickSizeRaw !== ""
          ? Math.min(Number(tickSizeRaw), gaugeTickCap)
          : gaugeTickCap;
      next.gauge = {
        ...trace.gauge,
        axis: {
          ...trace.gauge.axis,
          tickfont: {
            ...tickf,
            size: tickSize,
          },
        },
      };
    }

    return next as Plotly.Data;
  });
}

/**
 * Plotly `table` traces default to equal column widths; long numeric strings
 * clip badly. Set relative `columnwidth` from content length when the backend
 * did not provide widths.
 */
export function withTableColumnSizing(data: Plotly.Data[] | undefined): Plotly.Data[] {
  if (!data?.length) return (data ?? []) as Plotly.Data[];

  return data.map((trace: any) => {
    if (trace?.type !== "table") return trace as Plotly.Data;
    const values = trace.cells?.values;
    if (!Array.isArray(values) || values.length === 0) return trace as Plotly.Data;

    const n = values.length;
    const existing = trace.columnwidth;
    if (Array.isArray(existing) && existing.length === n) {
      return trace as Plotly.Data;
    }

    const maxLens: number[] = values.map((col: unknown) => {
      if (!Array.isArray(col)) return 10;
      return Math.max(10, ...col.map((v) => String(v ?? "").length));
    });

    const headerVals = trace.header?.values;
    if (Array.isArray(headerVals)) {
      headerVals.forEach((h: unknown, i: number) => {
        if (i < maxLens.length) {
          maxLens[i] = Math.max(maxLens[i], String(h ?? "").length);
        }
      });
    }

    const sum = maxLens.reduce((a, b) => a + b, 0) || 1;
    const columnwidth = maxLens.map((len) => Math.max(0.15, len / sum));

    return { ...trace, columnwidth } as Plotly.Data;
  });
}


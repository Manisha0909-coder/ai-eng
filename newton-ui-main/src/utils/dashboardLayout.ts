import type { DraggableDashboardChartConfig } from "@/features/visualization/components/DraggableDashboard/types";

export interface CardSize {
  width: number;
  height: number;
}

export interface StoredState {
  order: string[];
  sizes: Record<string, CardSize>;
}

export const STORAGE_PREFIX = "dd_v3_";

export const DEFAULT_HEIGHT = 380;

// KPI / indicator constants
export const INDICATOR_ONLY_DEFAULT_HEIGHT = 172;
export const INDICATOR_ONLY_MAX_WIDTH = 320;
export const INDICATOR_GRID_ROW_HEIGHT = 96;
export const INDICATOR_GRID_VERTICAL_PAD = 44;
export const INDICATOR_GRID_MIN_HEIGHT = 188;
export const INDICATOR_GRID_MAX_HEIGHT = 280;
export const INDICATOR_GAUGE_GRID_ROW_HEIGHT = 152;
export const INDICATOR_GAUGE_GRID_VERTICAL_PAD = 92;
export const INDICATOR_GAUGE_GRID_MIN_HEIGHT = 360;
export const INDICATOR_GAUGE_GRID_MAX_HEIGHT = 620;
export const INDICATOR_RESIZE_MIN_WIDTH = 240;
export const INDICATOR_RESIZE_MIN_HEIGHT = 130;

/** Upper bound for persisted / restored card sizes (guards corrupt localStorage). */
export const CARD_SIZE_MAX = 10_000;

export const GAP = 12;

// Responsive breakpoints: column count by container width
export const BREAKPOINT_SM = 640; // < 640px: 1 column
export const BREAKPOINT_MD = 1024; // 640–1024: 2 columns, >= 1024: 3 columns

export function getColumnCount(containerWidth: number): number {
  if (containerWidth < BREAKPOINT_SM) return 1;
  if (containerWidth < BREAKPOINT_MD) return 2;
  return 3;
}

/** Card width so that exactly `cols` fit per row with GAP between them */
export function getCardWidthForColumns(containerWidth: number, cols: number): number {
  if (containerWidth <= 0 || cols < 1) return 480;
  const totalGaps = GAP * (cols - 1);
  return Math.floor((containerWidth - totalGaps) / cols);
}

export function chartIsIndicatorOnly(chart: DraggableDashboardChartConfig): boolean {
  if (chart.error) return false;
  const cfg = chart.plotly_data_config ?? chart.plotly_data;
  const rows = (cfg?.data ?? []) as Array<{ type?: string } | undefined>;
  if (rows.length === 0) return false;
  return rows.every((t) => t?.type === "indicator");
}

/** Compact KPI tile sizing applies only to a single indicator trace; multi-trace grids need full card space. */
export function chartIsSingleIndicatorTile(chart: DraggableDashboardChartConfig): boolean {
  if (!chartIsIndicatorOnly(chart)) return false;
  const cfg = chart.plotly_data_config ?? chart.plotly_data;
  const data = (cfg?.data ?? []) as Array<{ type?: string } | undefined>;
  if (data.length !== 1) return false;
  const layout = (cfg?.layout ?? {}) as { grid?: { rows?: number; columns?: number } };
  const g = layout.grid;
  if (!g) return true;
  const rows = g.rows ?? 1;
  const cols = g.columns ?? 1;
  return rows * cols <= 1;
}

export function chartHasIndicatorGauge(chart: DraggableDashboardChartConfig): boolean {
  if (chart.error) return false;
  const cfg = chart.plotly_data_config ?? chart.plotly_data;
  const data = (cfg?.data ?? []) as Array<any>;
  return data.some((t) => t?.type === "indicator" && t?.gauge != null);
}

export function inferIndicatorSubplotGrid(chart: DraggableDashboardChartConfig): { rows: number; cols: number } {
  const cfg = chart.plotly_data_config ?? chart.plotly_data;
  const layout = (cfg?.layout ?? {}) as { grid?: { rows?: number; columns?: number } };
  const g = layout.grid;
  const n = ((cfg?.data ?? []) as Array<{ type?: string }>).filter((t) => t?.type === "indicator").length;
  if (g != null && g.rows != null && g.columns != null && g.rows >= 1 && g.columns >= 1) {
    return { rows: g.rows, cols: g.columns };
  }
  if (n <= 1) return { rows: 1, cols: 1 };
  if (n === 2) return { rows: 1, cols: 2 };
  if (n === 3) return { rows: 1, cols: 3 };
  if (n === 4) return { rows: 2, cols: 2 };
  const cols = n <= 6 ? 3 : 4;
  return { rows: Math.ceil(n / cols), cols };
}

export function defaultCardSize(chart: DraggableDashboardChartConfig, containerWidth: number): CardSize {
  const cols = getColumnCount(containerWidth);
  const cardWidth = getCardWidthForColumns(containerWidth, cols);

  if (chartIsIndicatorOnly(chart) && chartIsSingleIndicatorTile(chart)) {
    const w = Math.min(cardWidth, INDICATOR_ONLY_MAX_WIDTH);
    return {
      width: Math.max(INDICATOR_RESIZE_MIN_WIDTH, w),
      height: INDICATOR_ONLY_DEFAULT_HEIGHT,
    };
  }

  if (chartIsIndicatorOnly(chart)) {
    const { rows, cols: gridCols } = inferIndicatorSubplotGrid(chart);
    const hasGauge = chartHasIndicatorGauge(chart);
    const rowH = hasGauge ? INDICATOR_GAUGE_GRID_ROW_HEIGHT : INDICATOR_GRID_ROW_HEIGHT;
    const padH = hasGauge ? INDICATOR_GAUGE_GRID_VERTICAL_PAD : INDICATOR_GRID_VERTICAL_PAD;
    const minH = hasGauge ? INDICATOR_GAUGE_GRID_MIN_HEIGHT : INDICATOR_GRID_MIN_HEIGHT;
    const maxH = hasGauge ? INDICATOR_GAUGE_GRID_MAX_HEIGHT : INDICATOR_GRID_MAX_HEIGHT;

    // Fit-to-chart sizing: indicators should take the full available column width.
    const w = Math.max(280, cardWidth);

    // Height derived from the actual indicator grid; still clamped for safety.
    const rawH = rowH * rows + padH;
    const h = Math.min(maxH, Math.max(minH, rawH));

    // Extra breathing room for multi-column gauge rows (ticks + titles collide easiest here).
    const bump = hasGauge && gridCols >= 2 ? 40 : 0;
    return { width: w, height: Math.min(maxH, h + bump) };
  }

  return { width: cardWidth, height: DEFAULT_HEIGHT };
}

export function loadState(key: string): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    return null;
  }
}

export function saveState(key: string, state: StoredState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function defaultSizes(
  charts: DraggableDashboardChartConfig[],
  containerWidth: number
): Record<string, CardSize> {
  return Object.fromEntries(charts.map((c) => [String(c.id), defaultCardSize(c, containerWidth)]));
}

export function sanitizeCardSize(raw: unknown, chart: DraggableDashboardChartConfig): CardSize | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { width?: unknown; height?: unknown };
  const w = Number(o.width);
  const h = Number(o.height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;

  const compactIndicator = chartIsSingleIndicatorTile(chart);
  const minW = compactIndicator ? INDICATOR_RESIZE_MIN_WIDTH : 280;
  const minH = compactIndicator ? INDICATOR_RESIZE_MIN_HEIGHT : 240;

  return {
    width: Math.min(CARD_SIZE_MAX, Math.max(minW, Math.floor(w))),
    height: Math.min(CARD_SIZE_MAX, Math.max(minH, Math.floor(h))),
  };
}

export function validateState(
  state: StoredState | null,
  charts: DraggableDashboardChartConfig[]
): StoredState | null {
  if (!state) return null;
  const ids = new Set(charts.map((c) => String(c.id)));
  if (state.order.length !== ids.size || state.order.some((id) => !ids.has(id)) || !state.sizes) {
    return null;
  }

  const chartById = new Map(charts.map((c) => [String(c.id), c]));
  const nextSizes: Record<string, CardSize> = {};
  for (const id of state.order) {
    const chart = chartById.get(id);
    if (!chart) return null;
    const raw = state.sizes[id];
    if (raw === undefined) return null;
    const clean = sanitizeCardSize(raw, chart);
    if (!clean) return null;
    nextSizes[id] = clean;
  }

  return { order: state.order, sizes: nextSizes };
}


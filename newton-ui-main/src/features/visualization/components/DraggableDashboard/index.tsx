import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { chartColors, type ChartColors } from "@/utils/chartColors";
import { COLOR_SCHEME_CHANGED } from "@/utils/theme";
import type { CardSize } from "@/utils/dashboardLayout";
import {
  chartIsSingleIndicatorTile,
  defaultSizes,
  GAP,
  getCardWidthForColumns,
  getColumnCount,
  INDICATOR_RESIZE_MIN_HEIGHT,
  INDICATOR_RESIZE_MIN_WIDTH,
  loadState,
  saveState,
  validateState,
} from "@/utils/dashboardLayout";

import type { DraggableDashboardChartConfig, DraggableDashboardProps } from "./types";
import { OverlayCard } from "./OverlayCard";
import { FullScreenModal } from "./FullScreenModal";
import { SortableCard, getEffectiveSize } from "./SortableCard";
import { Toolbar } from "./Toolbar";

// Debounce container width so sidebar open/close doesn't reflow all charts at once
const CONTAINER_RESIZE_DEBOUNCE_MS = 120;

// ─── CSS (injected once) ──────────────────────────────────────────────────────

const CSS_ID = "dd-v3-styles";
const GLOBAL_CSS = `
  .dd-card {
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    will-change: transform;
  }
  /* KPI cards — Plotly gauge ticks/labels can extend past the inner box; hidden would clip them. */
  .dd-card--kpi {
    overflow: visible;
    transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
  }
  .dd-card--kpi:hover {
    box-shadow: var(--shadow-lg) !important;
    transform: translateY(-1px);
  }
  .dd-drag-handle {
    cursor: grab;
    touch-action: none;
  }
  .dd-drag-handle:active { cursor: grabbing; }

  /* re-resizable corner handle */
  .dd-resizable > span[class*="se"] {
    width: 18px !important;
    height: 18px !important;
    right: 0 !important;
    bottom: 0 !important;
    cursor: se-resize;
    z-index: 10;
  }
  .dd-resizable > span[class*="se"]::after {
    content: "";
    position: absolute;
    right: 5px; bottom: 5px;
    width: 9px; height: 9px;
    border-right: 2px solid rgb(var(--color-border) / 0.35);
    border-bottom: 2px solid rgb(var(--color-border) / 0.35);
    border-radius: 1px;
    transition: border-color 0.15s;
  }
  .dd-card:hover .dd-resizable > span[class*="se"]::after {
    border-color: rgb(var(--color-border) / 0.8);
  }

  /* drag overlay */
  .dd-overlay {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 32px 80px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(var(--color-primary) / 0.3);
    opacity: 0.95;
    transform: scale(1.025) rotate(1deg);
    pointer-events: none;
  }

  /* Skeleton shimmer */
  .dd-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgb(var(--color-surface) / 0.7) 0%,
      rgb(var(--color-primary) / 0.15) 50%,
      rgb(var(--color-surface) / 0.7) 100%
    );
    background-size: 200% 100%;
    animation: dd-shimmer 1.8s ease-in-out infinite;
    will-change: background-position;
    border-radius: 4px;
  }
  @keyframes dd-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Chart fade + slide-up on load */
  .dd-chart-wrap {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateY(8px) scale(0.99);
    transition:
      opacity  0.65s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: opacity, transform;
  }
  .dd-chart-wrap--visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .dd-card--kpi .dd-chart-wrap { overflow: visible; }

  /* Staggered card entrance */
  .dd-card-enter {
    opacity: 0;
    animation: dd-card-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    will-change: opacity, transform;
  }
  @keyframes dd-card-in {
    from { opacity: 0; transform: translateY(24px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }

  /* Fullscreen modal */
  .dd-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgb(var(--color-background) / 0.8);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    transition: opacity 0.3s ease;
  }
  .dd-modal-overlay--entering { animation: dd-fade-in 0.3s ease-out both; }
  .dd-modal-overlay--leaving  { animation: dd-fade-out 0.25s ease-in both; }

  .dd-modal-content {
    width: 100%;
    height: 100%;
    background: rgb(var(--color-surface));
    border: 1px solid rgb(var(--color-border));
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    transform-origin: center center;
  }
  .dd-modal-content--entering { animation: dd-zoom-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  .dd-modal-content--leaving  { animation: dd-zoom-out 0.25s ease-in both; }

  @keyframes dd-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes dd-fade-out { from { opacity: 1; } to { opacity: 0; } }

  @keyframes dd-zoom-in {
    from { opacity: 0; transform: scale(0.92) translateY(10px); }
    to   { opacity: 1; transform: scale(1)   translateY(0); }
  }
  @keyframes dd-zoom-out {
    from { opacity: 1; transform: scale(1)   translateY(0); }
    to   { opacity: 0; transform: scale(0.95) translateY(10px); }
  }
`;

function injectCSS() {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}

export default function DraggableDashboard({
  charts,
  storageKey = "default",
  showResetButton = true,
  className,
}: DraggableDashboardProps) {
  const [tc, setTc] = useState<ChartColors>(() => chartColors());
  useEffect(() => {
    const handler = () => setTc(chartColors());
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) setContainerWidth(w);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect.width ?? 0;
      if (width <= 0) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        setContainerWidth(width);
      }, CONTAINER_RESIZE_DEBOUNCE_MS);
    });
    ro.observe(el);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, []);

  const chartIdKey = charts.map((c) => c.id).join(",");

  /** Detect chart payload changes when IDs are stable (avoids stale order/sizes after data refresh). */
  const chartsSignature = useMemo(
    () =>
      charts
        .map((c) => {
          const cfg = c.plotly_data_config ?? c.plotly_data;
          const data = (cfg?.data ?? []) as Array<{ type?: string; x?: unknown[] }>;
          const n = data.length;
          const firstType = n > 0 ? String(data[0]?.type ?? "") : "";
          const x0Len = n > 0 && Array.isArray(data[0]?.x) ? data[0]!.x!.length : 0;
          return `${c.id}:${n}:${firstType}:${x0Len}`;
        })
        .join("|"),
    [charts]
  );

  const [order, setOrder] = useState<string[]>(() => charts.map((c) => String(c.id)));
  const [sizes, setSizes] = useState<Record<string, CardSize>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  useEffect(() => {
    if (containerWidth === 0 || charts.length === 0) return;
    const saved = validateState(loadState(storageKey), charts);
    if (saved) {
      setOrder(saved.order);
      setSizes(saved.sizes);
    } else {
      const ids = charts.map((c) => String(c.id));
      const fresh = defaultSizes(charts, containerWidth);
      setOrder(ids);
      setSizes(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartIdKey, chartsSignature, storageKey, containerWidth]);

  const persist = useCallback(
    (o: string[], s: Record<string, CardSize>) => {
      saveState(storageKey, { order: o, sizes: s });
    },
    [storageKey]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setOrder((prev) => {
        const fromIndex = prev.indexOf(String(active.id));
        const toIndex = prev.indexOf(String(over.id));
        if (fromIndex < 0 || toIndex < 0) return prev;
        const next = arrayMove(prev, fromIndex, toIndex);
        persist(next, sizes);
        return next;
      });
    },
    [sizes, persist]
  );

  const handleResize = useCallback(
    (id: string, delta: { width: number; height: number }) => {
      setSizes((prev) => {
        const current = getEffectiveSize({
          id,
          charts,
          sizes: prev,
          containerWidth,
          maxCardWidth: undefined,
        });
        const chart = charts.find((c) => String(c.id) === id);
        const compactIndicator = chart ? chartIsSingleIndicatorTile(chart) : false;
        const minW = compactIndicator ? INDICATOR_RESIZE_MIN_WIDTH : 280;
        const minH = compactIndicator ? INDICATOR_RESIZE_MIN_HEIGHT : 240;
        const next = {
          ...prev,
          [id]: {
            width: Math.max(minW, current.width + delta.width),
            height: Math.max(minH, current.height + delta.height),
          },
        };
        persist(order, next);
        return next;
      });
    },
    [charts, containerWidth, order, persist]
  );

  const handleReset = useCallback(() => {
    const ids = charts.map((c) => String(c.id));
    const fresh = defaultSizes(charts, containerWidth);
    setOrder(ids);
    setSizes(fresh);
    persist(ids, fresh);
  }, [charts, containerWidth, persist]);

  useEffect(() => {
    injectCSS();
  }, []);

  const columnCount = getColumnCount(containerWidth);
  const maxCardWidth = containerWidth > 0 ? getCardWidthForColumns(containerWidth, columnCount) : undefined;

  if (charts.length === 0) return null;

  const chartById: Record<string, DraggableDashboardChartConfig> = Object.fromEntries(
    charts.map((c) => [String(c.id), c])
  );
  const activeChart = activeDragId ? chartById[activeDragId] : null;
  const activeSize = activeDragId ? sizes[activeDragId] : undefined;

  return (
    <div className={className} style={{ width: "100%", boxSizing: "border-box", paddingBottom: 16, position: "relative" }}>
      <Toolbar
        isEditing={isEditing}
        showResetButton={showResetButton}
        tc={tc}
        onReset={handleReset}
        onToggle={() => setIsEditing((v) => !v)}
      />

      <div ref={containerRef} style={{ width: "100%" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`,
                gap: GAP,
                alignItems: "stretch",
              }}
            >
              {order.map((id, index) => {
                const chart = chartById[id];
                if (!chart) return null;
                const size = getEffectiveSize({ id, charts, sizes, containerWidth, maxCardWidth });
                return (
                  <SortableCard
                    key={id}
                    chart={chart}
                    tc={tc}
                    size={size}
                    onResize={handleResize}
                    onPopout={setFullscreenId}
                    isEditing={isEditing}
                    animationDelay={isFirstRender.current ? Math.min(index * 80, 400) : -1}
                    containerWidth={containerWidth}
                  />
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
          >
            {activeChart && activeSize ? <OverlayCard chart={activeChart} tc={tc} size={activeSize} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {fullscreenId && chartById[fullscreenId] && (
        <FullScreenModal chart={chartById[fullscreenId]} tc={tc} onClose={() => setFullscreenId(null)} />
      )}
    </div>
  );
}

export type { DraggableDashboardChartConfig, DraggableDashboardProps, PlotlyDataConfig } from "./types";


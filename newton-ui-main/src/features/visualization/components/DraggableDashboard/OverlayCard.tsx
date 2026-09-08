import type { ChartColors } from "@/utils/chartColors";
import type { DraggableDashboardChartConfig } from "./types";
import type { CardSize } from "@/utils/dashboardLayout";

export function OverlayCard({
  chart,
  tc,
  size,
}: {
  chart: DraggableDashboardChartConfig;
  tc: ChartColors;
  size: CardSize;
}) {
  return (
    <div
      className="dd-overlay"
      style={{
        width: size.width,
        height: size.height,
        border: `1px solid ${tc.primary}55`,
        background: tc.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: `1px solid ${tc.border}`,
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          {[2, 6, 10].flatMap((x) =>
            [2, 6, 10].map((y) => (
              <circle key={`${x}${y}`} cx={x} cy={y} r="1.25" fill={tc.primary} opacity={0.7} />
            ))
          )}
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: tc.primary,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {chart.name || "Chart"}
        </span>
        {chart.error ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: tc.error, marginLeft: "auto" }}>
            Error
          </span>
        ) : null}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: chart.error ? 0.45 : 0.25,
        }}
      >
        {chart.error ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={tc.error} strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={tc.primary} strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        )}
      </div>
    </div>
  );
}


import React from "react";

import type { ChartColors } from "@/utils/chartColors";

export function Toolbar({
  isEditing,
  showResetButton,
  tc,
  onReset,
  onToggle,
}: {
  isEditing: boolean;
  showResetButton: boolean;
  tc: ChartColors;
  onReset: () => void;
  onToggle: () => void;
}) {
  const base: React.CSSProperties = {
    padding: "5px 12px",
    borderRadius: 7,
    border: `1px solid ${tc.border}`,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: "transparent",
    color: tc.textMuted,
    transition: "all 0.15s",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 4px",
        marginBottom: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: tc.textMuted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {isEditing ? "Drag to rearrange · Resize from corner" : "Dashboard"}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {showResetButton && (
          <button
            type="button"
            onClick={onReset}
            style={base}
            aria-label="Reset dashboard layout to default"
          >
            Reset layout
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isEditing ? "Done editing layout" : "Edit dashboard layout"}
          style={{
            ...base,
            background: isEditing ? `${tc.primary}22` : tc.surface,
            color: isEditing ? tc.primary : tc.textMuted,
            borderColor: isEditing ? tc.primary : tc.border,
          }}
        >
          {isEditing ? "✓ Done" : "Edit layout"}
        </button>
      </div>
    </div>
  );
}


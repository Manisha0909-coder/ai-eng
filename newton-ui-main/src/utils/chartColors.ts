export interface ChartColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

const SSR_DEFAULTS: ChartColors = {
  background: "rgb(10, 15, 26)",
  surface: "rgb(17, 24, 39)",
  text: "rgb(255, 255, 255)",
  textMuted: "rgb(156, 163, 175)",
  primary: "rgb(99, 102, 241)",
  secondary: "rgb(139, 92, 246)",
  accent: "rgb(167, 139, 250)",
  border: "rgb(55, 65, 81)",
  success: "rgb(16, 185, 129)",
  warning: "rgb(245, 158, 11)",
  error: "rgb(239, 68, 68)",
  info: "rgb(59, 130, 246)",
};

/** Convert space-separated RGB triplet or existing color string to `rgb(r, g, b)`. */
export function toRgb(value: string): string {
  const v = value.trim();
  if (!v) return v;
  if (v.startsWith("#") || v.startsWith("rgb")) return v;
  if (/^\d+\s+\d+\s+\d+$/.test(v)) {
    return `rgb(${v.replace(/\s+/g, ", ")})`;
  }
  return v;
}

/** Convert an `rgb(...)` string to `rgba(..., alpha)`. */
export function toRgba(rgb: string, alpha: number): string {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  return rgb;
}

function readCssRgb(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim();
  if (!raw) return fallback;
  return toRgb(raw);
}

export function chartColors(): ChartColors {
  if (typeof window === "undefined") return SSR_DEFAULTS;

  return {
    background: readCssRgb("--color-background", SSR_DEFAULTS.background),
    surface: readCssRgb("--color-surface", SSR_DEFAULTS.surface),
    text: readCssRgb("--color-text", SSR_DEFAULTS.text),
    textMuted: readCssRgb("--color-text-muted", SSR_DEFAULTS.textMuted),
    primary: readCssRgb("--color-primary", SSR_DEFAULTS.primary),
    secondary: readCssRgb("--color-secondary", SSR_DEFAULTS.secondary),
    accent: readCssRgb("--color-accent", SSR_DEFAULTS.accent),
    border: readCssRgb("--color-border", SSR_DEFAULTS.border),
    success: readCssRgb("--color-success", SSR_DEFAULTS.success),
    warning: readCssRgb("--color-warning", SSR_DEFAULTS.warning),
    error: readCssRgb("--color-error", SSR_DEFAULTS.error),
    info: readCssRgb("--color-info", SSR_DEFAULTS.info),
  };
}

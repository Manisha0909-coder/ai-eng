export type TokenKind =
  | "color"
  | "alpha"
  | "length"
  | "shadow"
  | "fontFamily"
  | "fontSize"
  | "duration"
  | "easing";

export type TokenMode = "light" | "dark" | "shared";

export interface TokenDef {
  cssVar: string;
  label: string;
  group: string;
  kind: TokenKind;
  /** "light" | "dark" only apply per-mode; "shared" lives in :root only */
  mode: TokenMode;
}

export const TOKEN_SCHEMA: TokenDef[] = [
  // --- Brand colors (per-mode) ---
  { cssVar: "--color-primary",            label: "Primary",              group: "Brand colors", kind: "color", mode: "light" },
  { cssVar: "--color-primary-foreground", label: "Primary foreground",   group: "Brand colors", kind: "color", mode: "light" },
  { cssVar: "--color-secondary",          label: "Secondary",            group: "Brand colors", kind: "color", mode: "light" },
  { cssVar: "--color-accent",             label: "Accent",               group: "Brand colors", kind: "color", mode: "light" },
  { cssVar: "--color-primary",            label: "Primary",              group: "Brand colors", kind: "color", mode: "dark" },
  { cssVar: "--color-primary-foreground", label: "Primary foreground",   group: "Brand colors", kind: "color", mode: "dark" },
  { cssVar: "--color-secondary",          label: "Secondary",            group: "Brand colors", kind: "color", mode: "dark" },
  { cssVar: "--color-accent",             label: "Accent",               group: "Brand colors", kind: "color", mode: "dark" },

  // --- Surfaces & text (per-mode) ---
  { cssVar: "--color-surface",     label: "Surface",          group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-surface-2",   label: "Surface 2",        group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-background",  label: "Background",       group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-text",        label: "Text",             group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-text-muted",  label: "Text muted",       group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-border",      label: "Border",           group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-input-bg",    label: "Input background", group: "Surfaces & text", kind: "color", mode: "light" },
  { cssVar: "--color-surface",     label: "Surface",          group: "Surfaces & text", kind: "color", mode: "dark" },
  { cssVar: "--color-surface-2",   label: "Surface 2",        group: "Surfaces & text", kind: "color", mode: "dark" },
  { cssVar: "--color-background",  label: "Background",       group: "Surfaces & text", kind: "color", mode: "dark" },
  { cssVar: "--color-text",        label: "Text",             group: "Surfaces & text", kind: "color", mode: "dark" },
  { cssVar: "--color-text-muted",  label: "Text muted",       group: "Surfaces & text", kind: "color", mode: "dark" },
  { cssVar: "--color-border",      label: "Border",           group: "Surfaces & text", kind: "color", mode: "dark" },
  { cssVar: "--color-input-bg",    label: "Input background", group: "Surfaces & text", kind: "color", mode: "dark" },

  // --- Status colors (shared — only :root) ---
  { cssVar: "--color-error",   label: "Error",   group: "Status", kind: "color", mode: "shared" },
  { cssVar: "--color-success", label: "Success", group: "Status", kind: "color", mode: "shared" },
  { cssVar: "--color-warning", label: "Warning", group: "Status", kind: "color", mode: "shared" },
  { cssVar: "--color-info",    label: "Info",    group: "Status", kind: "color", mode: "shared" },

  // --- Entity pill colors (per-mode) ---
  { cssVar: "--color-entity-role",        label: "Role",        group: "Entity pills", kind: "color", mode: "light" },
  { cssVar: "--color-entity-persona",     label: "Persona",     group: "Entity pills", kind: "color", mode: "light" },
  { cssVar: "--color-entity-doc-tag",     label: "Doc tag",     group: "Entity pills", kind: "color", mode: "light" },
  { cssVar: "--color-entity-tool-tag",    label: "Tool tag",    group: "Entity pills", kind: "color", mode: "light" },
  { cssVar: "--color-entity-server",      label: "Server",      group: "Entity pills", kind: "color", mode: "light" },
  { cssVar: "--color-entity-datasource",  label: "Datasource",  group: "Entity pills", kind: "color", mode: "light" },
  { cssVar: "--color-entity-role",        label: "Role",        group: "Entity pills", kind: "color", mode: "dark" },
  { cssVar: "--color-entity-persona",     label: "Persona",     group: "Entity pills", kind: "color", mode: "dark" },
  { cssVar: "--color-entity-doc-tag",     label: "Doc tag",     group: "Entity pills", kind: "color", mode: "dark" },
  { cssVar: "--color-entity-tool-tag",    label: "Tool tag",    group: "Entity pills", kind: "color", mode: "dark" },
  { cssVar: "--color-entity-server",      label: "Server",      group: "Entity pills", kind: "color", mode: "dark" },
  { cssVar: "--color-entity-datasource",  label: "Datasource",  group: "Entity pills", kind: "color", mode: "dark" },

  // --- Pill structure (shared) ---
  { cssVar: "--pill-radius",              label: "Radius",               group: "Pill structure", kind: "length", mode: "shared" },
  { cssVar: "--pill-px",                  label: "Padding X",            group: "Pill structure", kind: "length", mode: "shared" },
  { cssVar: "--pill-py",                  label: "Padding Y",            group: "Pill structure", kind: "length", mode: "shared" },
  { cssVar: "--pill-font-size",           label: "Font size",            group: "Pill structure", kind: "fontSize", mode: "shared" },
  { cssVar: "--pill-bg-alpha",            label: "Entity BG alpha",      group: "Pill structure", kind: "alpha", mode: "shared" },
  { cssVar: "--pill-border-alpha",        label: "Entity border alpha",  group: "Pill structure", kind: "alpha", mode: "shared" },
  { cssVar: "--pill-status-bg-alpha",     label: "Status BG alpha",      group: "Pill structure", kind: "alpha", mode: "shared" },
  { cssVar: "--pill-status-border-alpha", label: "Status border alpha",  group: "Pill structure", kind: "alpha", mode: "shared" },

  // --- Border radius (shared) ---
  { cssVar: "--border-radius-sm",   label: "Small",  group: "Radius", kind: "length", mode: "shared" },
  { cssVar: "--border-radius-md",   label: "Medium", group: "Radius", kind: "length", mode: "shared" },
  { cssVar: "--border-radius-lg",   label: "Large",  group: "Radius", kind: "length", mode: "shared" },
  { cssVar: "--border-radius-full", label: "Full",   group: "Radius", kind: "length", mode: "shared" },

  // --- Shadows (shared) ---
  { cssVar: "--shadow-sm",           label: "Small",         group: "Shadows", kind: "shadow", mode: "shared" },
  { cssVar: "--shadow-md",           label: "Medium",        group: "Shadows", kind: "shadow", mode: "shared" },
  { cssVar: "--shadow-lg",           label: "Large",         group: "Shadows", kind: "shadow", mode: "shared" },
  { cssVar: "--shadow-elevated",     label: "Elevated",      group: "Shadows", kind: "shadow", mode: "shared" },
  { cssVar: "--shadow-elevated-hover", label: "Elevated hover", group: "Shadows", kind: "shadow", mode: "shared" },

  // --- Typography (shared) ---
  { cssVar: "--font-family",         label: "Body font",    group: "Typography", kind: "fontFamily", mode: "shared" },
  { cssVar: "--font-family-heading", label: "Heading font", group: "Typography", kind: "fontFamily", mode: "shared" },
  { cssVar: "--font-size-sm",        label: "Size sm",      group: "Typography", kind: "fontSize",   mode: "shared" },
  { cssVar: "--font-size-base",      label: "Size base",    group: "Typography", kind: "fontSize",   mode: "shared" },
  { cssVar: "--font-size-lg",        label: "Size lg",      group: "Typography", kind: "fontSize",   mode: "shared" },
  { cssVar: "--font-size-xl",        label: "Size xl",      group: "Typography", kind: "fontSize",   mode: "shared" },
  { cssVar: "--font-size-2xl",       label: "Size 2xl",     group: "Typography", kind: "fontSize",   mode: "shared" },
  { cssVar: "--font-size-3xl",       label: "Size 3xl",     group: "Typography", kind: "fontSize",   mode: "shared" },

  // --- Motion (shared) ---
  { cssVar: "--transition-duration", label: "Duration", group: "Motion", kind: "duration", mode: "shared" },
  { cssVar: "--animation-easing",    label: "Easing",   group: "Motion", kind: "easing",   mode: "shared" },
];

export const FONT_FAMILY_OPTIONS = [
  { label: "Instrument Sans", value: '"Instrument Sans", system-ui, -apple-system, sans-serif' },
  { label: "Bricolage Grotesque", value: '"Bricolage Grotesque", system-ui, sans-serif' },
  { label: "Spline Sans Mono", value: '"Spline Sans Mono", ui-monospace, monospace' },
  { label: "System sans-serif", value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { label: "System serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "System monospace", value: 'ui-monospace, "Cascadia Code", monospace' },
];

/** All groups in display order */
export const TOKEN_GROUPS = [
  "Brand colors",
  "Surfaces & text",
  "Status",
  "Entity pills",
  "Pill structure",
  "Radius",
  "Shadows",
  "Typography",
  "Motion",
] as const;

import { TOKEN_SCHEMA } from "./tokenSchema";

const DRAFT_KEY = "newton-theme-editor-draft";

/** Map of cssVar → value string (RGB triplets for colors, raw CSS values for others) */
export type TokenMap = Record<string, string>;

export interface ThemeDraft {
  light: TokenMap;
  dark: TokenMap;
  shared: TokenMap;
}

/** Convert "R G B" triplet string → "#rrggbb" hex for <input type="color"> */
export function tripletToHex(triplet: string): string {
  const parts = triplet.trim().split(/\s+/);
  const [r = 0, g = 0, b = 0] = parts.map((v) => Math.round(Number(v) || 0));
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Convert "#rrggbb" hex → "R G B" triplet string */
export function hexToTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const [r, g, b] = clean.split("").map((c) => parseInt(c + c, 16));
    return `${r} ${g} ${b}`;
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Read a CSS var from a specific element (used for dark-mode probe) */
function readVar(el: Element, cssVar: string): string {
  return getComputedStyle(el).getPropertyValue(cssVar).trim();
}

/** Seed default values by probing the live stylesheet.
 *  Light values come from :root; dark values from a hidden .dark probe div. */
export function seedDefaults(): ThemeDraft {
  const root = document.documentElement;

  // Build a hidden dark-mode probe to read .dark overrides
  const probe = document.createElement("div");
  probe.classList.add("dark");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);

  const light: TokenMap = {};
  const dark: TokenMap = {};
  const shared: TokenMap = {};

  for (const token of TOKEN_SCHEMA) {
    const { cssVar, mode } = token;
    if (mode === "shared") {
      if (!(cssVar in shared)) {
        shared[cssVar] = readVar(root, cssVar);
      }
    } else if (mode === "light") {
      if (!(cssVar in light)) {
        light[cssVar] = readVar(root, cssVar);
      }
    } else {
      if (!(cssVar in dark)) {
        dark[cssVar] = readVar(probe, cssVar);
      }
    }
  }

  document.body.removeChild(probe);
  return { light, dark, shared };
}

export function loadDraft(): ThemeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ThemeDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ThemeDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

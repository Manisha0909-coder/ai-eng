import type { ThemeDraft } from "./themeDraft";
import { buildCssText } from "./applyOverrides";
import { THEME_PRESETS, type ThemePreset } from "./themePresets";

/** localStorage key holding the preset id chosen as the app default. */
const DEFAULT_THEME_KEY = "newton-default-theme";

/** Style element carrying the default preset's tokens. */
const DEFAULT_STYLE_ID = "theme-default-preset";

/** Style element the live Theme Editor preview writes to (see applyOverrides). */
const EDITOR_STYLE_ID = "theme-editor-overrides";

/** Fired whenever the default preset changes, so open editors can re-sync. */
export const DEFAULT_THEME_CHANGED = "newtonDefaultThemeChanged";

export function getDefaultThemePresetId(): string | null {
  try {
    return window.localStorage.getItem(DEFAULT_THEME_KEY);
  } catch {
    return null;
  }
}

export function getDefaultThemePreset(): ThemePreset | null {
  const id = getDefaultThemePresetId();
  if (!id) return null;
  return THEME_PRESETS.find((p) => p.id === id) ?? null;
}

/** Presets only define the tokens they care about — fill the rest in as empty
 *  so buildCssText skips them and the shipped stylesheet keeps supplying them. */
function toFullDraft(preset: ThemePreset): ThemeDraft {
  return {
    light: preset.draft.light ?? {},
    dark: preset.draft.dark ?? {},
    shared: preset.draft.shared ?? {},
  };
}

/** Inject (or refresh) the default preset's stylesheet.
 *  Always placed *before* the Theme Editor's live-preview style so an in-progress
 *  preview keeps winning over the saved default. */
function paintDefaultTheme(preset: ThemePreset | null): void {
  const existing = document.getElementById(DEFAULT_STYLE_ID);
  if (!preset) {
    if (existing) existing.remove();
    return;
  }

  const el =
    (existing as HTMLStyleElement | null) ?? document.createElement("style");
  el.id = DEFAULT_STYLE_ID;
  el.textContent = buildCssText(toFullDraft(preset));

  if (!existing) {
    const editorEl = document.getElementById(EDITOR_STYLE_ID);
    if (editorEl) {
      document.head.insertBefore(el, editorEl);
    } else {
      document.head.appendChild(el);
    }
  }
}

/** Boot-time hook — apply the saved default before the app renders. */
export function applyDefaultTheme(): void {
  paintDefaultTheme(getDefaultThemePreset());
}

export function setDefaultThemePreset(presetId: string): void {
  try {
    window.localStorage.setItem(DEFAULT_THEME_KEY, presetId);
  } catch {
    // ignore storage errors — the paint below still takes effect this session
  }
  paintDefaultTheme(THEME_PRESETS.find((p) => p.id === presetId) ?? null);
  window.dispatchEvent(new CustomEvent(DEFAULT_THEME_CHANGED, { detail: presetId }));
}

export function clearDefaultThemePreset(): void {
  try {
    window.localStorage.removeItem(DEFAULT_THEME_KEY);
  } catch {
    // ignore storage errors
  }
  paintDefaultTheme(null);
  window.dispatchEvent(new CustomEvent(DEFAULT_THEME_CHANGED, { detail: null }));
}

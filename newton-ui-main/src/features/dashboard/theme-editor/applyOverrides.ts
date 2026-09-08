import { TOKEN_SCHEMA } from "./tokenSchema";
import type { ThemeDraft } from "./themeDraft";

const STYLE_ID = "theme-editor-overrides";

/** sessionStorage flag: after logout, don't auto-apply a saved draft until the user edits again. */
export const THEME_EDITOR_LIVE_SUSPENDED_KEY = "theme_editor_live_suspended";

export function isThemeEditorLiveSuspended(): boolean {
  try {
    return window.sessionStorage.getItem(THEME_EDITOR_LIVE_SUSPENDED_KEY) === "true";
  } catch {
    return false;
  }
}

export function suspendThemeEditorLivePreview(): void {
  try {
    window.sessionStorage.setItem(THEME_EDITOR_LIVE_SUSPENDED_KEY, "true");
  } catch {
    // ignore storage errors
  }
}

export function resumeThemeEditorLivePreview(): void {
  try {
    window.sessionStorage.removeItem(THEME_EDITOR_LIVE_SUSPENDED_KEY);
  } catch {
    // ignore storage errors
  }
}

function buildCssText(draft: ThemeDraft): string {
  const rootVars: string[] = [];
  const darkVars: string[] = [];

  // Shared tokens → :root only
  for (const token of TOKEN_SCHEMA) {
    if (token.mode !== "shared") continue;
    const val = draft.shared[token.cssVar];
    if (val !== undefined && val !== "") {
      rootVars.push(`  ${token.cssVar}: ${val};`);
    }
  }

  // Light-mode tokens → :root
  const seenLight = new Set<string>();
  for (const token of TOKEN_SCHEMA) {
    if (token.mode !== "light") continue;
    if (seenLight.has(token.cssVar)) continue;
    seenLight.add(token.cssVar);
    const val = draft.light[token.cssVar];
    if (val !== undefined && val !== "") {
      rootVars.push(`  ${token.cssVar}: ${val};`);
    }
  }

  // Dark-mode tokens → .dark
  const seenDark = new Set<string>();
  for (const token of TOKEN_SCHEMA) {
    if (token.mode !== "dark") continue;
    if (seenDark.has(token.cssVar)) continue;
    seenDark.add(token.cssVar);
    const val = draft.dark[token.cssVar];
    if (val !== undefined && val !== "") {
      darkVars.push(`  ${token.cssVar}: ${val};`);
    }
  }

  const parts: string[] = [];
  if (rootVars.length) {
    parts.push(`:root {\n${rootVars.join("\n")}\n}`);
  }
  if (darkVars.length) {
    parts.push(`.dark {\n${darkVars.join("\n")}\n}`);
  }
  return parts.join("\n\n");
}

export function applyThemeOverrides(draft: ThemeDraft): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCssText(draft);
}

export function clearThemeOverrides(): void {
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
}

export { buildCssText };

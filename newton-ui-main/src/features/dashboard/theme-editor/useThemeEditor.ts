import { useState, useEffect, useCallback, useRef } from "react";
import { isDarkMode, COLOR_SCHEME_CHANGED } from "@/utils/theme";
import {
  seedDefaults,
  loadDraft,
  saveDraft,
  clearDraft,
  type ThemeDraft,
} from "./themeDraft";
import {
  applyThemeOverrides,
  clearThemeOverrides,
  isThemeEditorLiveSuspended,
  resumeThemeEditorLivePreview,
} from "./applyOverrides";
import { downloadThemeCss } from "./generateThemeCss";
import type { ThemePreset } from "./themePresets";

function deepMerge(base: ThemeDraft, override: Partial<ThemeDraft>): ThemeDraft {
  return {
    light: { ...base.light, ...(override.light ?? {}) },
    dark: { ...base.dark, ...(override.dark ?? {}) },
    shared: { ...base.shared, ...(override.shared ?? {}) },
  };
}

export interface UseThemeEditorReturn {
  draft: ThemeDraft;
  currentMode: "light" | "dark";
  setToken: (mode: "light" | "dark" | "shared", cssVar: string, value: string) => void;
  reset: () => void;
  applyPreset: (preset: ThemePreset) => void;
  exportCss: () => void;
  isModified: boolean;
}

export function useThemeEditor(): UseThemeEditorReturn {
  const defaultsRef = useRef<ThemeDraft | null>(null);

  const [draft, setDraft] = useState<ThemeDraft>(() => {
    const defaults = seedDefaults();
    defaultsRef.current = defaults;
    const saved = loadDraft();
    return saved ? deepMerge(defaults, saved) : defaults;
  });

  const [currentMode, setCurrentMode] = useState<"light" | "dark">(() =>
    isDarkMode() ? "dark" : "light"
  );

  // Track whether overrides differ from shipped defaults
  const [isModified, setIsModified] = useState(() => loadDraft() !== null);

  // Debounce ref for live apply
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyDebounced = useCallback((d: ThemeDraft) => {
    if (applyTimer.current) clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => {
      applyThemeOverrides(d);
    }, 60);
  }, []);

  // After logout, live preview is suspended: keep the draft in the form but
  // don't paint it until the user edits again. Mid-session, re-apply on mount
  // so returning to Theme Editor restores overrides without clearing them when
  // navigating to chat or other admin tabs.
  useEffect(() => {
    if (!isThemeEditorLiveSuspended() && loadDraft() !== null) {
      applyThemeOverrides(draft);
    }
    return () => {
      if (applyTimer.current) clearTimeout(applyTimer.current);
    };
    // Intentionally mount/unmount only — `draft` is the initial merged value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => {
      setCurrentMode(isDarkMode() ? "dark" : "light");
    };
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const setToken = useCallback(
    (mode: "light" | "dark" | "shared", cssVar: string, value: string) => {
      resumeThemeEditorLivePreview();
      setDraft((prev) => {
        const next: ThemeDraft = {
          ...prev,
          [mode]: { ...prev[mode], [cssVar]: value },
        };
        saveDraft(next);
        applyDebounced(next);
        return next;
      });
      setIsModified(true);
    },
    [applyDebounced]
  );

  const reset = useCallback(() => {
    if (!defaultsRef.current) return;
    const defaults = defaultsRef.current;
    setDraft(defaults);
    clearDraft();
    clearThemeOverrides();
    resumeThemeEditorLivePreview();
    setIsModified(false);
  }, []);

  const applyPreset = useCallback(
    (preset: ThemePreset) => {
      if (!defaultsRef.current) return;
      resumeThemeEditorLivePreview();
      const next = deepMerge(defaultsRef.current, preset.draft);
      setDraft(next);
      saveDraft(next);
      applyThemeOverrides(next);
      setIsModified(true);
    },
    [],
  );

  const exportCss = useCallback(() => {
    downloadThemeCss(draft);
  }, [draft]);

  return { draft, currentMode, setToken, reset, applyPreset, exportCss, isModified };
}

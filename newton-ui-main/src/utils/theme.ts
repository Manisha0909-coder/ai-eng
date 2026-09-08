export const COLOR_SCHEME_CHANGED = "color-scheme-changed";

export function initTheme() {
  const saved = localStorage.getItem("color-scheme") ?? "dark";
  document.documentElement.classList.toggle("dark", saved === "dark");
}

export function toggleDarkMode(dark?: boolean) {
  const root = document.documentElement;
  const next = dark ?? !root.classList.contains("dark");
  root.classList.toggle("dark", next);
  localStorage.setItem("color-scheme", next ? "dark" : "light");
  window.dispatchEvent(new Event(COLOR_SCHEME_CHANGED));
}

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

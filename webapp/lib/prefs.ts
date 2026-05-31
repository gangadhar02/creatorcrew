/**
 * Client-side user preferences (localStorage). Theme already uses the "theme"
 * key (read by the pre-hydration script in app/layout.tsx); the rest live under
 * the eden.pref.* namespace.
 */

export type ThemeMode = "light" | "dark" | "system";

export function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem("theme");
  return v === "light" || v === "dark" ? v : "system";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  if (mode === "system") {
    localStorage.removeItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    document.documentElement.classList.toggle("dark", prefersDark);
  } else {
    localStorage.setItem("theme", mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
  }
  // Let the sidebar toggle (and anything else) re-sync.
  window.dispatchEvent(new Event("theme:changed"));
}

const PREFIX = "eden.pref.";

export const PREF_KEYS = {
  autoCloseBrackets: "autoCloseBrackets",
  spellCheck: "spellCheck",
  spellLang: "spellLang",
  confirmDeleteBoards: "confirmDeleteBoards",
  confirmDeleteChats: "confirmDeleteChats",
} as const;

export function getBoolPref(key: string, def = false): boolean {
  if (typeof window === "undefined") return def;
  const v = localStorage.getItem(PREFIX + key);
  return v === null ? def : v === "1";
}

export function setBoolPref(key: string, val: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + key, val ? "1" : "0");
}

export function getStrPref(key: string, def: string): string {
  if (typeof window === "undefined") return def;
  return localStorage.getItem(PREFIX + key) ?? def;
}

export function setStrPref(key: string, val: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + key, val);
}

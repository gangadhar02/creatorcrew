export const SIDEBAR_COLLAPSED_KEY = "eden.sidebar.collapsed:v1";

export function isSidebarCollapsed(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("sidebar-collapsed");
}

export function setSidebarCollapsed(collapsed: boolean) {
  document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent("sidebar:toggle", { detail: { collapsed } })
  );
}

export function toggleSidebarCollapsed(): boolean {
  const next = !isSidebarCollapsed();
  setSidebarCollapsed(next);
  return next;
}

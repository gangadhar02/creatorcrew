/**
 * Target rect for a full-page overlay (document / post detail): the main content
 * column, inset 8px on every side so it reads as a rounded panel floating on the
 * page background, mirroring the sidebar and chat-panel insets (Eden-style).
 * Anchored to the viewport height so a scrolled page can't push the header off.
 */
export function getMainInsetRect(): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const GAP = 8;
  if (typeof document !== "undefined") {
    const m = document.querySelector("main");
    if (m) {
      const r = m.getBoundingClientRect();
      return {
        top: GAP,
        left: r.left + GAP,
        width: Math.max(0, r.width - GAP * 2),
        height: h - GAP * 2,
      };
    }
  }
  return { top: GAP, left: GAP, width: w - GAP * 2, height: h - GAP * 2 };
}

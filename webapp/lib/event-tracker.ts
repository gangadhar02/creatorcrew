"use client";

/**
 * Client-side event tracker. Debounces a buffer of interaction events and
 * flushes via POST /api/events/content every ~5s or on tab visibility
 * change. IntersectionObserver dwell tracking is exposed via `trackDwell`.
 */

export type ClientEvent = {
  content_id: string;
  event_type: "view" | "dwell" | "impression" | "click" | "save" | "boost";
  dwell_ms?: number;
  position?: number;
  surface?: string;
  view_mode?: string;
  tab?: string;
  metadata?: Record<string, unknown>;
  creator_id?: string;
};

const SESSION_ID =
  typeof window !== "undefined"
    ? (() => {
        const k = "eden.session-id:v1";
        let v = window.sessionStorage.getItem(k);
        if (!v) {
          v = crypto.randomUUID();
          window.sessionStorage.setItem(k, v);
        }
        return v;
      })()
    : null;

let buffer: (ClientEvent & { session_id: string | null; occurred_at: number })[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 5000;
const MAX_BUFFER = 50;

async function flush() {
  if (typeof window === "undefined") return;
  if (buffer.length === 0) return;
  const payload = { events: buffer.splice(0, buffer.length) };
  try {
    await fetch("/api/events/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Push them back so we retry next tick.
    buffer.unshift(...payload.events);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_MS);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

export function trackEvent(e: ClientEvent): void {
  if (typeof window === "undefined") return;
  buffer.push({ ...e, session_id: SESSION_ID, occurred_at: Date.now() });
  if (buffer.length >= MAX_BUFFER) flush();
  else scheduleFlush();
}

/**
 * Returns a callback you attach to an IntersectionObserver on a post card.
 * Fires `impression` on first viewport entry and `dwell` (with dwell_ms) on
 * exit. Returns a cleanup fn.
 */
export function trackDwell(opts: {
  contentId: string;
  creatorId?: string;
  surface?: string;
  position?: number;
  el: Element;
}): () => void {
  let enteredAt: number | null = null;
  let impressionSent = false;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          enteredAt = Date.now();
          if (!impressionSent) {
            impressionSent = true;
            trackEvent({
              content_id: opts.contentId,
              creator_id: opts.creatorId,
              event_type: "impression",
              surface: opts.surface,
              position: opts.position,
            });
          }
        } else if (enteredAt) {
          const dwell = Date.now() - enteredAt;
          enteredAt = null;
          if (dwell > 200) {
            trackEvent({
              content_id: opts.contentId,
              creator_id: opts.creatorId,
              event_type: "dwell",
              dwell_ms: dwell,
              surface: opts.surface,
              position: opts.position,
            });
          }
        }
      }
    },
    { threshold: 0.5 }
  );
  io.observe(opts.el);
  return () => {
    if (enteredAt) {
      const dwell = Date.now() - enteredAt;
      if (dwell > 200) {
        trackEvent({
          content_id: opts.contentId,
          creator_id: opts.creatorId,
          event_type: "dwell",
          dwell_ms: dwell,
          surface: opts.surface,
          position: opts.position,
        });
      }
    }
    io.disconnect();
  };
}

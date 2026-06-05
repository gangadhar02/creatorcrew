"use client";

/**
 * Eden-style reorderable masonry grid (NOT an infinite canvas).
 *
 * Cards flow into fixed-width columns (shortest-column packing) by their order.
 * Dragging a card lifts it out and, as it moves, the rest re-flow to make space
 * (framer-motion `layout`); on drop it snaps into the nearest slot and the new
 * order is persisted. No panning, no zooming, no free x/y — vertical scroll only.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { COLUMN_WIDTH, CARD_GAP, DRAG_THRESHOLD } from "@/components/canvas/types";

type Item = { id: string };

export default function MasonryGrid<T extends Item>({
  items,
  renderItem,
  onReorder,
  estimateHeight,
  className,
}: {
  items: T[];
  renderItem: (item: T, opts: { dragging: boolean; width: number }) => React.ReactNode;
  onReorder?: (orderedIds: string[]) => void;
  estimateHeight?: (item: T) => number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const heightsRef = useRef<Record<string, number>>({});
  const [heightsVersion, setHeightsVersion] = useState(0);

  const itemById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i] as const)),
    [items]
  );

  // Local order of ids. Seeded from items; preserves manual order across
  // add/remove (new items appended, removed dropped).
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  useEffect(() => {
    setOrder((prev) => {
      const ids = items.map((i) => i.id);
      const idSet = new Set(ids);
      const prevSet = new Set(prev);
      const kept = prev.filter((id) => idSet.has(id));
      const added = ids.filter((id) => !prevSet.has(id));
      return [...kept, ...added];
    });
  }, [items]);

  // Track container width (responsive column count). The board mounts during a
  // page transition where the layout width settles a few frames late and the
  // ResizeObserver can miss it, so poll on rAF until the width holds steady,
  // then rely on the observer + window resize for later changes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = (w: number) => {
      if (w > 0) setContainerW((prev) => (prev !== w ? w : prev));
    };
    let raf = 0;
    let stableFrames = 0;
    let last = -1;
    const tick = () => {
      const w = el.clientWidth;
      if (w !== last) {
        last = w;
        stableFrames = 0;
        apply(w);
      } else {
        stableFrames += 1;
      }
      if (stableFrames < 20) raf = requestAnimationFrame(tick);
    };
    tick();
    const ro = new ResizeObserver(() => apply(el.clientWidth));
    ro.observe(el);
    const onResize = () => apply(el.clientWidth);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // COLUMN_WIDTH is the *minimum* card width: fit as many columns as possible,
  // then stretch each column so the row fills the full container width (flush to
  // both edges, like Eden) instead of leaving wasted margins on the sides.
  const columns = Math.max(
    1,
    Math.floor((containerW + CARD_GAP) / (COLUMN_WIDTH + CARD_GAP))
  );
  const colWidth =
    containerW > 0
      ? Math.floor((containerW - (columns - 1) * CARD_GAP) / columns)
      : COLUMN_WIDTH;
  const originX = 0;

  const heightOf = useCallback(
    (id: string) =>
      heightsRef.current[id] ??
      (estimateHeight && itemById[id] ? estimateHeight(itemById[id]) : 240),
    [estimateHeight, itemById]
  );

  // Pack an arbitrary id list into column positions (shortest-column).
  const packList = useCallback(
    (ids: string[]) => {
      const colH = new Array(columns).fill(0);
      const pos: Record<string, { x: number; y: number; h: number }> = {};
      for (const id of ids) {
        let c = 0;
        for (let i = 1; i < columns; i++) if (colH[i] < colH[c]) c = i;
        const x = originX + c * (colWidth + CARD_GAP);
        const y = colH[c];
        const h = heightOf(id);
        pos[id] = { x, y, h };
        colH[c] += h + CARD_GAP;
      }
      return { pos, totalH: Math.max(0, ...colH) };
    },
    // heightsVersion forces a repack when a measured height changes
    [columns, colWidth, originX, heightOf, heightsVersion]
  );

  const { pos: layout, totalH } = useMemo(
    () => packList(order),
    [packList, order]
  );

  // --- drag state ---
  const dragMeta = useRef<{
    id: string;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    moved: boolean;
  } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  // True right after a drag, so the synthetic click on a link/button card root
  // is swallowed instead of navigating/opening.
  const didDragRef = useRef(false);

  const containerPoint = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: clientX - r.left,
      y: clientY - r.top + containerRef.current!.scrollTop,
    };
  }, []);

  // Insertion index given a cursor point: nearest non-dragged card center.
  const computeOrder = useCallback(
    (dragged: string, point: { x: number; y: number }) => {
      const others = order.filter((id) => id !== dragged);
      const { pos } = packList(others);
      let best = -1;
      let bestD = Infinity;
      let after = false;
      for (let i = 0; i < others.length; i++) {
        const p = pos[others[i]];
        const cx = p.x + colWidth / 2;
        const cy = p.y + p.h / 2;
        const d = Math.hypot(point.x - cx, point.y - cy);
        if (d < bestD) {
          bestD = d;
          best = i;
          after = point.y > cy;
        }
      }
      const idx = best < 0 ? others.length : best + (after ? 1 : 0);
      const next = [...others];
      next.splice(idx, 0, dragged);
      return next;
    },
    [order, packList]
  );

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (e.button !== 0) return;
      // Allow drag from anywhere on the card EXCEPT true edit controls. Cards
      // whose root is a link/button (posts, docs) must stay draggable; a plain
      // click (no movement) still fires their open action, and a drag suppresses
      // that click (see didDragRef / onClickCapture below).
      const t = e.target as HTMLElement;
      if (t.closest("textarea, input, [data-no-drag]")) return;
      const p = containerPoint(e.clientX, e.clientY);
      const slot = layout[id];
      dragMeta.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        grabX: p.x - (slot?.x ?? 0),
        grabY: p.y - (slot?.y ?? 0),
        moved: false,
      };
      // NOTE: pointer capture is set only once a drag actually starts (in
      // onCardPointerMove). Capturing on every press would redirect the click
      // away from inner buttons/links, so cards would never open on a tap.
    },
    [containerPoint, layout]
  );

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const m = dragMeta.current;
      if (!m) return;
      const dist = Math.hypot(e.clientX - m.startX, e.clientY - m.startY);
      if (!m.moved && dist < DRAG_THRESHOLD) return;
      if (!m.moved) {
        m.moved = true;
        setDragId(m.id);
        // Capture now that it's a real drag (keeps pointer events flowing even
        // if the cursor leaves the card).
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      const p = containerPoint(e.clientX, e.clientY);
      setCursor(p);
      const next = computeOrder(m.id, p);
      setOrder((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i])
          ? prev
          : next
      );
    },
    [containerPoint, computeOrder]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const m = dragMeta.current;
      dragMeta.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setDragId(null);
      setCursor(null);
      if (m?.moved) {
        didDragRef.current = true;
        // Safety: clear if no click is synthesized after the drag.
        setTimeout(() => {
          didDragRef.current = false;
        }, 350);
        onReorder?.(order);
      }
    },
    [order, onReorder]
  );

  const onCardClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
    }
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <div className="relative w-full" style={{ height: totalH }}>
        {order.map((id) => {
          const item = itemById[id];
          if (!item) return null;
          const slot = layout[id];
          const isDrag = dragId === id;
          const x = isDrag && cursor ? cursor.x - (dragMeta.current?.grabX ?? 0) : slot?.x ?? 0;
          const y = isDrag && cursor ? cursor.y - (dragMeta.current?.grabY ?? 0) : slot?.y ?? 0;
          return (
            <motion.div
              key={id}
              initial={false}
              animate={
                isDrag
                  ? { x, y, scale: 1.02, zIndex: 50, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.5)" }
                  : { x, y, scale: 1, zIndex: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
              }
              transition={
                isDrag
                  ? { duration: 0 }
                  : { x: { type: "spring", stiffness: 600, damping: 42, mass: 0.7 },
                      y: { type: "spring", stiffness: 600, damping: 42, mass: 0.7 },
                      default: { duration: 0.15 } }
              }
              onPointerDown={(e) => onCardPointerDown(e, id)}
              onPointerMove={onCardPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClickCapture={onCardClickCapture}
              draggable={false}
              // Kill the browser's native image/link drag so dragging a post
              // reorders (our pointer drag) instead of starting an HTML5 drag
              // that re-drops the URL onto the board as a duplicate.
              onDragStart={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: colWidth,
                cursor: isDrag ? "grabbing" : "grab",
                touchAction: "none",
              }}
            >
              <Measured
                onHeight={(h) => {
                  if (heightsRef.current[id] !== h) {
                    heightsRef.current[id] = h;
                    setHeightsVersion((v) => v + 1);
                  }
                }}
              >
                {renderItem(item, { dragging: isDrag, width: colWidth })}
              </Measured>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Measured({
  onHeight,
  children,
}: {
  onHeight: (h: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    onHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [onHeight]);
  return <div ref={ref}>{children}</div>;
}

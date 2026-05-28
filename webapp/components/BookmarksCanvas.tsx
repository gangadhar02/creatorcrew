"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type NodeChange,
  applyNodeChanges,
  type NodeTypes,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import BookmarkCard from "./BookmarkCard";
import type { BookmarkItem } from "@/lib/types-bookmarks";

const CAMERA_KEY = "bookmarks-canvas-camera:v1";

function BookmarkNode({
  data,
}: {
  data: {
    item: BookmarkItem;
    onUpdate: (id: string, patch: Partial<BookmarkItem>) => void;
    onDelete: (id: string) => void;
  };
}) {
  const { item, onUpdate, onDelete } = data;
  const cardKey = `${item.id}:${item.notes_md}:${item.tags.join("\u0000")}`;

  return (
    <BookmarkCard
      key={cardKey}
      item={item}
      onUpdate={(patch) => onUpdate(item.id, patch)}
      onDelete={() => onDelete(item.id)}
    />
  );
}

const NODE_TYPES: NodeTypes = { bookmark: BookmarkNode };

// Default grid: 5 columns, narrow gap. Tuned so 4–5 cards fit on screen
// at zoom 1 in a typical viewport without forcing the canvas to fit-all
// (which made every card tiny when there are 100+ saves).
const DEFAULT_COLS = 5;
const DEFAULT_COL_STEP = 320; // 300px card + 20px gap
// Row height accommodates the tallest cards (IG with 4:5 image + caption +
// notes editor ~620px). Post-measure masonry below repacks tighter.
const DEFAULT_ROW_STEP = 680;

function itemsToNodes(
  items: BookmarkItem[],
  handlers: {
    onUpdate: (id: string, patch: Partial<BookmarkItem>) => void;
    onDelete: (id: string) => void;
  }
): Node[] {
  return items.map((item, i) => ({
    id: item.id,
    type: "bookmark",
    position: {
      x: item.x ?? (i % DEFAULT_COLS) * DEFAULT_COL_STEP,
      y: item.y ?? Math.floor(i / DEFAULT_COLS) * DEFAULT_ROW_STEP,
    },
    data: { item, ...handlers },
    width: item.w ?? 300,
  }));
}

function CanvasInner({
  items,
  onUpdate,
  onDelete,
  onPositionChange,
  forceMasonry,
}: {
  items: BookmarkItem[];
  onUpdate: (id: string, patch: Partial<BookmarkItem>) => void;
  onDelete: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  forceMasonry?: boolean;
}) {
  const rf = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const dragTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const handlers = useMemo(
    () => ({ onUpdate, onDelete }),
    [onUpdate, onDelete]
  );

  const [nodes, setNodes] = useState<Node[]>(() =>
    itemsToNodes(items, handlers)
  );

  // Rebuild nodes when items list changes (sync, filter, delete).
  useEffect(() => {
    // React Flow keeps drag state in `nodes`; when the server-backed items
    // change, the controlled graph needs to be replaced immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(itemsToNodes(items, handlers));
  }, [items, handlers]);

  // One-shot masonry pack — runs only when positions match the simple
  // server grid (i.e., right after "Reset to grid" or a fresh-load fallback).
  // Reads each card's measured height and stacks them column-by-column with
  // no overlap and no wasted vertical space. Skipped for hand-arranged
  // canvases (we detect by comparing every position to the grid formula).
  const masonryDone = useRef(false);
  useEffect(() => {
    if (masonryDone.current) return;
    if (!nodesInitialized || nodes.length === 0) return;

    const measured = rf.getNodes();
    // Wait until every node has a measured height.
    if (measured.some((n) => !n.measured?.height)) return;

    // Repack when explicitly asked (after "Reset to grid"), or when the
    // current positions match the simple grid (fresh sync, no hand-arrange).
    // Otherwise leave hand-arranged cards alone.
    const onSimpleGrid = measured.every((n, i) => {
      const expectedX = (i % DEFAULT_COLS) * DEFAULT_COL_STEP;
      const expectedY = Math.floor(i / DEFAULT_COLS) * DEFAULT_ROW_STEP;
      return (
        Math.abs(n.position.x - expectedX) < 2 &&
        Math.abs(n.position.y - expectedY) < 2
      );
    });

    masonryDone.current = true;
    if (!forceMasonry && !onSimpleGrid) return;

    const GAP = 24;
    const colHeights = new Array(DEFAULT_COLS).fill(0);
    const newPositions = new Map<string, { x: number; y: number }>();

    for (const node of measured) {
      // Place in shortest column for typical masonry packing.
      let col = 0;
      for (let i = 1; i < DEFAULT_COLS; i++) {
        if (colHeights[i] < colHeights[col]) col = i;
      }
      const x = col * DEFAULT_COL_STEP;
      const y = colHeights[col];
      newPositions.set(node.id, { x, y });
      colHeights[col] += (node.measured?.height ?? 480) + GAP;
    }

    setNodes((nds) =>
      nds.map((n) => {
        const p = newPositions.get(n.id);
        return p ? { ...n, position: p } : n;
      })
    );

    // Persist new positions (don't await — UI is already updated).
    for (const node of measured) {
      const p = newPositions.get(node.id);
      if (!p) continue;
      onPositionChange(node.id, Math.round(p.x), Math.round(p.y));
    }
  }, [nodes, nodesInitialized, rf, onPositionChange, forceMasonry]);

  // One-shot initial camera setup. Restore the saved viewport if we have one;
  // otherwise do a single fitView with a sensible max zoom so 4–5 cards are
  // visible. Re-fitting on every node change made cards shrink to nothing.
  const cameraInitialized = useRef(false);
  useEffect(() => {
    if (cameraInitialized.current) return;
    if (nodes.length === 0 || !nodesInitialized) return;
    // Wait for masonry pass (if it's going to run) before placing the camera,
    // so fitView frames the packed layout instead of the loose grid.
    if (!masonryDone.current) return;
    cameraInitialized.current = true;

    let restored = false;
    try {
      const raw = window.localStorage.getItem(CAMERA_KEY);
      if (raw) {
        const cam = JSON.parse(raw) as {
          position: { x: number; y: number };
          zoom: number;
        };
        rf.setViewport(
          { x: cam.position.x, y: cam.position.y, zoom: cam.zoom },
          { duration: 0 }
        );
        restored = true;
      }
    } catch {
      /* ignore */
    }

    if (!restored) {
      const frame = window.requestAnimationFrame(() => {
        void rf.fitView({ padding: 0.2, duration: 300, maxZoom: 1, minZoom: 0.6 });
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [nodes.length, nodesInitialized, rf]);

  function persistCamera() {
    try {
      const v = rf.getViewport();
      window.localStorage.setItem(
        CAMERA_KEY,
        JSON.stringify({
          position: { x: v.x, y: v.y },
          zoom: v.zoom,
          updatedAt: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }
  }

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && !ch.dragging) {
          const id = ch.id;
          const t = dragTimers.current.get(id);
          if (t) clearTimeout(t);
          dragTimers.current.set(
            id,
            setTimeout(() => {
              onPositionChange(
                id,
                Math.round(ch.position!.x),
                Math.round(ch.position!.y)
              );
            }, 250)
          );
        }
      }
    },
    [onPositionChange]
  );

  return (
    <div className="h-[calc(100vh-220px)] min-h-[520px] rounded-lg border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        onMoveEnd={persistCamera}
        nodesDraggable
        panOnDrag
        panOnScroll
        panOnScrollSpeed={1}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls position="bottom-right" />
        <MiniMap pannable zoomable className="!bg-card !border" />
      </ReactFlow>
    </div>
  );
}

export default function BookmarksCanvas(props: {
  items: BookmarkItem[];
  onUpdate: (id: string, patch: Partial<BookmarkItem>) => void;
  onDelete: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  forceMasonry?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

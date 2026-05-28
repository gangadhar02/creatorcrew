"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  applyNodeChanges,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import BoardItemTile from "./BoardItemTile";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";

type CanvasItem = ExpandedBoardItem & {
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
};

const CAMERA_KEY_PREFIX = "canvas-camera-cache:v1";

function ItemNode({ data }: { data: { item: CanvasItem; onDelete: (id: string) => void } }) {
  const { item, onDelete } = data;
  return (
    <div
      style={{
        width: item.w ?? 320,
      }}
      className="rounded-lg shadow-sm"
    >
      <BoardItemTile item={item} onDelete={onDelete} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { item: ItemNode };

function CanvasInner({
  boardId,
  workspaceId,
  items,
  onDelete,
  onPositionChange,
}: {
  boardId: string;
  workspaceId: string;
  items: CanvasItem[];
  onDelete: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}) {
  const rf = useReactFlow();
  const dragTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Restore camera state on first render.
  const cameraKey = `${CAMERA_KEY_PREFIX}:${workspaceId}:${boardId}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(cameraKey);
      if (raw) {
        const cam = JSON.parse(raw) as {
          position: { x: number; y: number };
          zoom: number;
        };
        rf.setViewport(
          { x: cam.position.x, y: cam.position.y, zoom: cam.zoom },
          { duration: 0 }
        );
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist camera state on pan/zoom.
  function persistCamera() {
    try {
      const v = rf.getViewport();
      window.localStorage.setItem(
        cameraKey,
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

  const initialNodes: Node[] = useMemo(() => {
    return items.map((item, i) => ({
      id: item.id,
      type: "item",
      position: {
        x: item.x ?? (i % 4) * 360,
        y: item.y ?? Math.floor(i / 4) * 480,
      },
      data: { item, onDelete },
      // Width must match the node's rendered width so xyflow lays out edges.
      width: item.w ?? 320,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const nodesRef = useRef<Node[]>(initialNodes);
  // Keep ref in sync when items prop changes.
  useEffect(() => {
    nodesRef.current = initialNodes;
  }, [initialNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      nodesRef.current = applyNodeChanges(changes, nodesRef.current);
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && !ch.dragging) {
          const id = ch.id;
          const t = dragTimers.current.get(id);
          if (t) clearTimeout(t);
          dragTimers.current.set(
            id,
            setTimeout(() => {
              onPositionChange(id, Math.round(ch.position!.x), Math.round(ch.position!.y));
            }, 250)
          );
        }
      }
    },
    [onPositionChange]
  );

  const edges: Edge[] = [];

  return (
    <div className="h-[calc(100vh-200px)] min-h-[480px] rounded-lg border bg-card">
      <ReactFlow
        nodes={nodesRef.current}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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

export default function InfiniteCanvas(props: {
  boardId: string;
  workspaceId: string;
  items: CanvasItem[];
  onDelete: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

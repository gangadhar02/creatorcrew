"use client";

/**
 * Drag-and-drop block reordering (Notion/Potion-style grip handle). DndPlugin
 * renders a draggable wrapper above each block and provides the react-dnd
 * context. File-drop handling is intentionally omitted (no upload backend).
 */
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndPlugin } from "@platejs/dnd";
import { BlockDraggable } from "./ui/block-draggable";

export const DndKit = [
  DndPlugin.configure({
    options: { enableScroller: true },
    render: {
      aboveNodes: BlockDraggable,
      aboveSlate: ({ children }) => (
        <DndProvider backend={HTML5Backend}>{children}</DndProvider>
      ),
    },
  }),
];

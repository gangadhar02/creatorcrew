/**
 * Shared types for the Eden-style canvas engine.
 *
 * The canvas is a pan/zoom "camera" (a single CSS matrix transform on a world
 * layer) over absolutely-positioned, fixed-width cards. World coordinates are
 * the card's x/y/w/h (these map straight onto board_items / bookmark_items
 * rows). Screen<->world conversion uses the camera.
 */

export type Camera = { scale: number; panX: number; panY: number };

/** Minimal shape the canvas engine needs to lay out a card. */
export type CanvasNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WorldPoint = { x: number; y: number };

export type CanvasProps<N extends CanvasNode> = {
  /** localStorage namespace for the camera, e.g. a board id or "bookmarks". */
  surfaceId: string;
  nodes: N[];
  /** Render a single card's content. `dragging` is true while this node moves. */
  renderNode: (node: N, opts: { dragging: boolean; selected: boolean }) => React.ReactNode;
  /** Live optimistic move during a drag (no network). */
  onMoveNode?: (id: string, x: number, y: number) => void;
  /** Commit after pointer-up (persist via PATCH). */
  onCommitNode?: (id: string, x: number, y: number) => void;
  /** Right-click / double-click on empty canvas, with the world point. */
  onCreateAt?: (worldPoint: WorldPoint, screen: { x: number; y: number }) => void;
  /** A URL dropped/pasted on the canvas, with the world drop point. */
  onDropUrl?: (url: string, worldPoint: WorldPoint) => void;
  /** Currently-selected node id (e.g. for showing controls). */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Reports a node's measured rendered height (for masonry auto-layout). */
  onNodeHeight?: (id: string, height: number) => void;
  className?: string;
};

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 2.5;
export const DRAG_THRESHOLD = 4; // px before a pointer-down becomes a drag
export const COLUMN_WIDTH = 313; // Eden card width
export const CARD_GAP = 16;

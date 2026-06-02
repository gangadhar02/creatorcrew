"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Tldraw,
  getSnapshot,
  loadSnapshot,
  createShapeId,
  type Editor,
  type TLShapeId,
  type TLStoreSnapshot,
  type TLEditorSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";
import {
  ContentTileShapeUtil,
  TileRendererProvider,
  type ContentTileShape,
} from "./ContentTileShape";

export type CanvasItem = {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const SHAPE_UTILS = [ContentTileShapeUtil];

/**
 * Generic tldraw canvas with server-persisted document. Content tiles are
 * reconciled against `items` (add missing, remove orphaned) and the full
 * document snapshot is debounce-saved via `onSaveSnapshot`. Freeform shapes
 * (drawings, arrows, notes) live in the same document.
 *
 * Must be loaded with `next/dynamic({ ssr: false })` — tldraw is client-only.
 */
export default function ServerTldrawCanvas({
  items,
  initialSnapshot,
  renderTile,
  onSaveSnapshot,
  onDeleteItem,
  onPasteUrl,
  heightClass = "h-[calc(100vh-220px)]",
}: {
  items: CanvasItem[];
  initialSnapshot: TLStoreSnapshot | TLEditorSnapshot | null;
  renderTile: (refKind: string, refId: string) => ReactNode;
  onSaveSnapshot: (snapshot: TLStoreSnapshot) => void;
  onDeleteItem?: (id: string) => void;
  /**
   * Called when a URL is pasted/dropped onto the canvas (tldraw would otherwise
   * make a stray bookmark shape). Receives the URL and the page-space point so
   * the caller can ingest it as a content tile at that location.
   */
  onPasteUrl?: (url: string, point?: { x: number; y: number }) => void | Promise<void>;
  heightClass?: string;
}) {
  // Keep latest items/callbacks accessible from the store listener without
  // re-running onMount (which would re-create the listener).
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onPasteUrlRef = useRef(onPasteUrl);
  onPasteUrlRef.current = onPasteUrl;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Native fullscreen: true edge-to-edge canvas with no app chrome, exited by
  // Escape (handled by the browser) or the corner button. Using the Fullscreen
  // API avoids z-index / transformed-ancestor pitfalls of a fixed overlay.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleMount = useCallback(
    (editor: Editor) => {
      // 1. Restore the saved document.
      if (initialSnapshot) {
        try {
          loadSnapshot(editor.store, initialSnapshot);
        } catch (err) {
          console.warn("[ServerTldrawCanvas] snapshot load failed:", err);
        }
      }

      // Intercept URLs pasted/dropped on the canvas so tldraw doesn't make a
      // stray broken-preview `bookmark` shape. Instead route them to our own
      // ingestion (paste an IG link → a real content-tile card). When no handler
      // is provided the URL is simply ignored.
      editor.registerExternalContentHandler("url", ({ url, point }) => {
        const handler = onPasteUrlRef.current;
        if (handler) {
          void handler(url, point ? { x: point.x, y: point.y } : undefined);
        }
      });

      // 2. Reconcile content tiles with the current item set.
      reconcile(editor, itemsRef.current);

      // 3. Persist on change (debounced) + sync tile deletions back to the DB.
      editor.store.listen(
        (entry) => {
          if (onDeleteItem) {
            for (const rec of Object.values(entry.changes.removed)) {
              const r = rec as {
                typeName?: string;
                type?: string;
                props?: { refId?: string };
              };
              if (r.typeName === "shape" && r.type === "content-tile") {
                const refId = r.props?.refId;
                // Only treat as a user deletion if the item still exists —
                // orphan cleanup in reconcile() must not re-trigger deletes.
                if (refId && itemsRef.current.some((it) => it.id === refId)) {
                  onDeleteItem(refId);
                }
              }
            }
          }

          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            const { document } = getSnapshot(editor.store);
            onSaveSnapshot(document);
          }, 800);
        },
        { source: "user", scope: "document" }
      );
    },
    [initialSnapshot, onSaveSnapshot, onDeleteItem]
  );

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden bg-background ${
        isFullscreen
          ? "h-screen w-screen"
          : `${heightClass} min-h-[480px] rounded-lg border`
      }`}
    >
      <TileRendererProvider render={renderTile}>
        <Tldraw shapeUtils={SHAPE_UTILS} onMount={handleMount} />
      </TileRendererProvider>

      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        className="absolute right-2 top-2 z-[200] inline-flex items-center gap-1 rounded-md border bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent"
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="h-3.5 w-3.5" />
            Exit
          </>
        ) : (
          <>
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </>
        )}
      </button>
    </div>
  );
}

/** Add a content-tile shape for every item that lacks one; remove orphans. */
function reconcile(editor: Editor, items: CanvasItem[]) {
  // Custom shapes aren't part of tldraw's static TLShape union, so cast at this
  // boundary. Runtime shape is exactly ContentTileShape.
  const onPage = editor
    .getCurrentPageShapes()
    .filter((s) => (s.type as string) === "content-tile") as unknown as ContentTileShape[];

  const present = new Set(onPage.map((s) => s.props.refId));
  const liveIds = new Set(items.map((i) => i.id));

  const orphans = onPage
    .filter((s) => !liveIds.has(s.props.refId))
    .map((s) => s.id);
  if (orphans.length) editor.deleteShapes(orphans);

  const toCreate = items
    .filter((i) => !present.has(i.id))
    .map((i) => ({
      id: createShapeId(i.id) as TLShapeId,
      type: "content-tile" as const,
      x: i.x ?? 0,
      y: i.y ?? 0,
      props: {
        w: i.w ?? 320,
        h: i.h ?? 400,
        refKind: i.kind,
        refId: i.id,
      },
    }));
  if (toCreate.length) {
    editor.createShapes(
      toCreate as unknown as Parameters<typeof editor.createShapes>[0]
    );
  }
}

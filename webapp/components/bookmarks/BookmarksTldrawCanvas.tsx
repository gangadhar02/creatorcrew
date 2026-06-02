"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import type { TLStoreSnapshot, TLEditorSnapshot } from "tldraw";
import type { BookmarkItem } from "@/lib/types-bookmarks";
import BookmarkCard from "@/components/BookmarkCard";
import type { CanvasItem } from "@/components/tldraw/ServerTldrawCanvas";

// tldraw is client-only; load with SSR disabled.
const ServerTldrawCanvas = dynamic(
  () => import("@/components/tldraw/ServerTldrawCanvas"),
  { ssr: false }
);

export default function BookmarksTldrawCanvas({
  items,
  initialSnapshot,
  onUpdate,
  onDelete,
  onPasteUrl,
}: {
  items: BookmarkItem[];
  initialSnapshot: TLStoreSnapshot | TLEditorSnapshot | null;
  onUpdate: (id: string, patch: Partial<BookmarkItem>) => void;
  onDelete: (id: string) => void;
  onPasteUrl?: (url: string, point?: { x: number; y: number }) => void | Promise<void>;
}) {
  const byId = useMemo(
    () => new Map(items.map((it) => [it.id, it])),
    [items]
  );

  const renderTile = useCallback(
    (_kind: string, refId: string) => {
      const item = byId.get(refId);
      if (!item) return null;
      return (
        <BookmarkCard
          item={item}
          onUpdate={(patch) => onUpdate(item.id, patch)}
          onDelete={() => onDelete(item.id)}
        />
      );
    },
    [byId, onUpdate, onDelete]
  );

  const canvasItems: CanvasItem[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        kind: it.platform ?? "bookmark",
        x: it.x ?? 0,
        y: it.y ?? 0,
        w: it.w ?? 300,
        // bookmark_items has no height column; default tall enough for an IG
        // card (image + caption + notes), user can resize.
        h: 640,
      })),
    [items]
  );

  const saveSnapshot = useCallback((snapshot: TLStoreSnapshot) => {
    void fetch("/api/bookmarks/canvas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvas_state: snapshot }),
    }).catch(() => {
      /* best-effort; next change retries */
    });
  }, []);

  return (
    <ServerTldrawCanvas
      items={canvasItems}
      initialSnapshot={initialSnapshot}
      renderTile={renderTile}
      onSaveSnapshot={saveSnapshot}
      onDeleteItem={onDelete}
      onPasteUrl={onPasteUrl}
    />
  );
}

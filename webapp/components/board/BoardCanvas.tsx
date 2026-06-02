"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TLStoreSnapshot, TLEditorSnapshot } from "tldraw";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";
import BoardItemTile from "@/components/BoardItemTile";
import type { CanvasItem } from "@/components/tldraw/ServerTldrawCanvas";

// tldraw is client-only (touches window/DOM at import time), so load the canvas
// with SSR disabled.
const ServerTldrawCanvas = dynamic(
  () => import("@/components/tldraw/ServerTldrawCanvas"),
  { ssr: false }
);

export default function BoardCanvas({
  boardId,
  items,
  initialSnapshot,
  onDelete,
}: {
  boardId: string;
  items: ExpandedBoardItem[];
  initialSnapshot: TLStoreSnapshot | TLEditorSnapshot | null;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const byId = useMemo(
    () => new Map(items.map((it) => [it.id, it])),
    [items]
  );

  const renderTile = useCallback(
    (_kind: string, refId: string) => {
      const item = byId.get(refId);
      if (!item) return null;
      return <BoardItemTile item={item} onDelete={onDelete} />;
    },
    [byId, onDelete]
  );

  const canvasItems: CanvasItem[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        kind: it.kind,
        x: it.x ?? 0,
        y: it.y ?? 0,
        w: it.w ?? 320,
        h: it.h ?? 400,
      })),
    [items]
  );

  const saveSnapshot = useCallback(
    (snapshot: TLStoreSnapshot) => {
      void fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_state: snapshot }),
      }).catch(() => {
        /* best-effort; next change retries */
      });
    },
    [boardId]
  );

  // Paste/drop an Instagram link on the canvas → ingest it as a post card at the
  // drop point. Fetching via Apify takes a moment, so show progress.
  const handlePasteUrl = useCallback(
    async (url: string, point?: { x: number; y: number }) => {
      if (!/^https?:\/\//i.test(url)) return;
      const t = toast.loading("Adding post from link…");
      try {
        const res = await fetch(`/api/boards/${boardId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "post", url, x: point?.x, y: point?.y }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        toast.success("Added to board", { id: t });
        router.refresh();
      } catch (e) {
        toast.error("Couldn't add post", {
          id: t,
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [boardId, router]
  );

  return (
    <ServerTldrawCanvas
      items={canvasItems}
      initialSnapshot={initialSnapshot}
      renderTile={renderTile}
      onSaveSnapshot={saveSnapshot}
      onDeleteItem={onDelete}
      onPasteUrl={handlePasteUrl}
    />
  );
}

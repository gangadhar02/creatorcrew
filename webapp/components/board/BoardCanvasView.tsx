"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import MasonryGrid from "@/components/board/MasonryGrid";
import CreateMenu, { type CreateAction } from "@/components/canvas/CreateMenu";
import PromptDialog from "@/components/canvas/PromptDialog";
import { COLUMN_WIDTH } from "@/components/canvas/types";
import BoardItemTile from "@/components/BoardItemTile";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";

/** Right-click menu for a single card. */
function CardMenu({
  open,
  x,
  y,
  onRemove,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  onRemove: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - 80);
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-[61] w-[190px] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg" style={{ left, top }}>
        <button
          onClick={() => { onRemove(); onClose(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-accent"
        >
          <Trash2 className="h-4 w-4" />
          Remove from board
        </button>
      </div>
    </>,
    document.body
  );
}

function estimateHeight(item: ExpandedBoardItem): number {
  switch (item.kind) {
    case "post":
      return 430;
    case "file":
      return item.file?.kind === "image" ? 340 : 150;
    case "document":
      return 220;
    case "card":
    default:
      return 150;
  }
}

/** Persist the new order by writing each item's position index. */
function persistOrder(orderedIds: string[]) {
  Promise.all(
    orderedIds.map((id, index) =>
      fetch(`/api/board-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: index }),
      })
    )
  ).catch(() => toast.error("Couldn't save the new order"));
}

export type BoardCreateHandlers = {
  onCreateCard: (opts: { tag?: string | null }) => void;
  onCreateDocument: (opts: { tag?: string | null }) => void;
  onCreateLink: (url: string, opts: { tag?: string | null }) => void;
  onAddSection: () => void;
  activeTag: string | null;
};

export default function BoardCanvasView({
  items,
  onDelete,
  handlers,
  reorderable = true,
}: {
  boardId?: string;
  items: ExpandedBoardItem[];
  onDelete: (id: string) => void;
  handlers?: BoardCreateHandlers;
  reorderable?: boolean;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [cardMenu, setCardMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [linkDialog, setLinkDialog] = useState(false);
  const reordered = useRef(false);

  const onReorder = useCallback((ids: string[]) => {
    reordered.current = true;
    persistOrder(ids);
  }, []);

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      // Right-click on a card → card menu (Remove); on empty space → create menu.
      const cardEl = (e.target as HTMLElement).closest<HTMLElement>("[data-card-id]");
      if (cardEl?.dataset.cardId) {
        e.preventDefault();
        setCardMenu({ x: e.clientX, y: e.clientY, id: cardEl.dataset.cardId });
        return;
      }
      if (!handlers) return;
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    },
    [handlers]
  );

  const runAction = useCallback(
    (action: CreateAction) => {
      if (!handlers) return;
      const at = { tag: handlers.activeTag };
      if (action === "card") handlers.onCreateCard(at);
      else if (action === "document") handlers.onCreateDocument(at);
      else if (action === "section") handlers.onAddSection();
      else if (action === "link") setLinkDialog(true);
    },
    [handlers]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!handlers) return;
      const url =
        e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text");
      if (url && /^https?:\/\//.test(url.trim())) {
        e.preventDefault();
        handlers.onCreateLink(url.trim(), { tag: handlers.activeTag });
      }
    },
    [handlers]
  );

  return (
    <div
      className="subtle-scroll relative -mx-4 h-[calc(100vh-150px)] w-[calc(100%+2rem)] overflow-y-auto px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6"
      onContextMenu={openMenu}
      onDragOver={(e) => handlers && e.preventDefault()}
      onDrop={onDrop}
    >
      <MasonryGrid<ExpandedBoardItem>
        items={items}
        estimateHeight={estimateHeight}
        onReorder={reorderable ? onReorder : undefined}
        renderItem={(item) => (
          <div data-card data-card-id={item.id} style={{ width: COLUMN_WIDTH }}>
            <BoardItemTile item={item} onDelete={onDelete} />
          </div>
        )}
      />

      <CardMenu
        open={!!cardMenu}
        x={cardMenu?.x ?? 0}
        y={cardMenu?.y ?? 0}
        onRemove={() => cardMenu && onDelete(cardMenu.id)}
        onClose={() => setCardMenu(null)}
      />

      <CreateMenu
        open={!!menu}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        onClose={() => setMenu(null)}
        onPick={runAction}
      />

      <PromptDialog
        open={linkDialog}
        title="Paste a link"
        description="Paste an Instagram post or reel URL to add it to this board."
        placeholder="https://instagram.com/p/…"
        submitLabel="Add"
        onSubmit={(url) => handlers?.onCreateLink(url, { tag: handlers.activeTag })}
        onClose={() => setLinkDialog(false)}
      />
    </div>
  );
}

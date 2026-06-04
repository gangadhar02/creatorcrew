"use client";

/**
 * Optimistic item store for a board canvas.
 *
 * Owns the list of ExpandedBoardItem and exposes optimistic mutations:
 *   - addCard / addDocument / addLink / addFile  — temp placeholder → POST → swap
 *   - deleteItem                                 — remove → DELETE → re-insert on fail
 *   - setTag                                     — assign an item to a section
 *   - reconcile                                  — replace from a fresh server fetch
 *
 * Card/document creation builds the expanded row locally (we know the content),
 * so the canvas shows the new card instantly with no refetch. Link creation
 * needs the joined creator_post, so after the POST it refetches just this board
 * and reconciles. Positions (x/y) live in BoardCanvasView, not here, but new
 * items carry the world point they were created at so they land where clicked.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";
import { fetchJson, withRollback } from "@/lib/optimistic/withRollback";
import { COLUMN_WIDTH } from "@/components/canvas/types";

let tempCounter = 0;
function tempId() {
  tempCounter += 1;
  return `temp-${tempCounter}-${performance.now().toString(36).replace(".", "")}`;
}

type CreateOpts = { tag?: string | null; x?: number; y?: number };

function baseRow(
  kind: ExpandedBoardItem["kind"],
  opts: CreateOpts
): Omit<ExpandedBoardItem, "creator_post" | "card" | "document" | "file"> {
  return {
    id: tempId(),
    board_id: "",
    kind,
    position: 0,
    tag: opts.tag ?? null,
    creator_post_id: null,
    card_id: null,
    document_id: null,
    file_id: null,
    created_at: new Date().toISOString(),
    x: typeof opts.x === "number" ? Math.round(opts.x) : 0,
    y: typeof opts.y === "number" ? Math.round(opts.y) : 0,
    w: COLUMN_WIDTH,
    h: null,
  };
}

export function useBoardItems(
  boardId: string,
  initialItems: ExpandedBoardItem[],
  voiceId: string | null
) {
  const [items, setItems] = useState<ExpandedBoardItem[]>(initialItems);

  // Keep a ref so async swaps don't capture a stale list.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Reconcile when the server payload changes (e.g. parent re-render). We only
  // adopt server items that we don't already have locally as temps in flight.
  useEffect(() => {
    setItems((prev) => {
      const hasTemp = prev.some((i) => i.id.startsWith("temp-"));
      if (!hasTemp) return initialItems;
      // Merge: keep in-flight temps, otherwise trust the server.
      const temps = prev.filter((i) => i.id.startsWith("temp-"));
      return [...initialItems, ...temps];
    });
  }, [initialItems]);

  const removeTemp = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const swapTemp = useCallback((id: string, real: ExpandedBoardItem) => {
    setItems((prev) => prev.map((i) => (i.id === id ? real : i)));
  }, []);

  const addCard = useCallback(
    async (opts: CreateOpts = {}) => {
      const base = baseRow("card", opts);
      const optimistic: ExpandedBoardItem = {
        ...base,
        creator_post: null,
        card: {
          id: `card-${base.id}`,
          body_md: "",
          color: "gray",
          created_at: base.created_at,
          updated_at: base.created_at,
        },
        document: null,
        file: null,
      };
      setItems((prev) => [...prev, optimistic]);
      try {
        const { item } = await fetchJson<{ item: { id: string; card_id: string } }>(
          `/api/boards/${boardId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "card",
              body_md: "",
              tag: opts.tag ?? null,
              x: base.x,
              y: base.y,
            }),
          }
        );
        swapTemp(base.id, {
          ...optimistic,
          id: item.id,
          card_id: item.card_id,
          card: { ...optimistic.card!, id: item.card_id },
        });
        return item.id;
      } catch (e) {
        removeTemp(base.id);
        toast.error("Couldn't add card", {
          description: e instanceof Error ? e.message : undefined,
        });
        return null;
      }
    },
    [boardId, removeTemp, swapTemp]
  );

  const addDocument = useCallback(
    async (opts: CreateOpts = {}) => {
      const base = baseRow("document", opts);
      const optimistic: ExpandedBoardItem = {
        ...base,
        creator_post: null,
        card: null,
        document: {
          id: `doc-${base.id}`,
          title: "Untitled",
          body_md: "",
          voice_id: voiceId,
          created_at: base.created_at,
          updated_at: base.created_at,
        },
        file: null,
      };
      setItems((prev) => [...prev, optimistic]);
      try {
        const { item } = await fetchJson<{
          item: { id: string; document_id: string };
        }>(`/api/boards/${boardId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "document",
            title: "Untitled",
            body_md: "",
            voice_id: voiceId,
            tag: opts.tag ?? null,
            x: base.x,
            y: base.y,
          }),
        });
        swapTemp(base.id, {
          ...optimistic,
          id: item.id,
          document_id: item.document_id,
          document: { ...optimistic.document!, id: item.document_id },
        });
        return item.id;
      } catch (e) {
        removeTemp(base.id);
        toast.error("Couldn't add document", {
          description: e instanceof Error ? e.message : undefined,
        });
        return null;
      }
    },
    [boardId, voiceId, removeTemp, swapTemp]
  );

  const reconcile = useCallback(async () => {
    try {
      const data = await fetchJson<{ items: ExpandedBoardItem[] }>(
        `/api/boards/${boardId}`
      );
      if (Array.isArray(data.items)) {
        setItems((prev) => {
          const temps = prev.filter((i) => i.id.startsWith("temp-"));
          return [...data.items, ...temps];
        });
      }
    } catch {
      /* leave optimistic state in place */
    }
  }, [boardId]);

  const addLink = useCallback(
    async (url: string, opts: CreateOpts = {}) => {
      const base = baseRow("post", opts);
      // Optimistic loading placeholder (rendered as a skeleton card).
      const optimistic: ExpandedBoardItem = {
        ...base,
        creator_post: null,
        card: null,
        document: null,
        file: null,
        // marker so the tile renders a loading skeleton
        // (BoardItemTile checks kind === 'post' && !creator_post)
      };
      setItems((prev) => [...prev, optimistic]);
      try {
        await fetchJson(`/api/boards/${boardId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "post",
            url,
            tag: opts.tag ?? null,
            x: base.x,
            y: base.y,
          }),
        });
        // We don't get the joined creator_post back — refetch and reconcile,
        // dropping our temp placeholder.
        removeTemp(base.id);
        await reconcile();
        return true;
      } catch (e) {
        removeTemp(base.id);
        toast.error("Couldn't add link", {
          description: e instanceof Error ? e.message : undefined,
        });
        return false;
      }
    },
    [boardId, removeTemp, reconcile]
  );

  const addFile = useCallback(
    async (fileId: string, fileRow: ExpandedBoardItem["file"], opts: CreateOpts = {}) => {
      const base = baseRow("file", { ...opts });
      const optimistic: ExpandedBoardItem = {
        ...base,
        file_id: fileId,
        creator_post: null,
        card: null,
        document: null,
        file: fileRow,
      };
      setItems((prev) => [...prev, optimistic]);
      try {
        const { item } = await fetchJson<{ item: { id: string } }>(
          `/api/boards/${boardId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "file",
              file_id: fileId,
              tag: opts.tag ?? null,
              x: base.x,
              y: base.y,
            }),
          }
        );
        swapTemp(base.id, { ...optimistic, id: item.id });
        return item.id;
      } catch (e) {
        removeTemp(base.id);
        toast.error("Couldn't add file", {
          description: e instanceof Error ? e.message : undefined,
        });
        return null;
      }
    },
    [boardId, removeTemp, swapTemp]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      const prev = itemsRef.current;
      const removed = prev.find((i) => i.id === itemId);
      if (!removed) return;
      await withRollback({
        apply: () => setItems((p) => p.filter((i) => i.id !== itemId)),
        revert: () => setItems(() => prev),
        request: () =>
          fetchJson(`/api/board-items/${itemId}`, { method: "DELETE" }),
        errorMessage: "Couldn't remove item",
      });
    },
    []
  );

  /** Sync a document card's preview after it's edited in the overlay. */
  const patchDocumentLocal = useCallback(
    (documentId: string, patch: { title?: string; body_md?: string }) => {
      setItems((prev) =>
        prev.map((i) =>
          i.document && i.document.id === documentId
            ? { ...i, document: { ...i.document, ...patch } }
            : i
        )
      );
    },
    []
  );

  const setTag = useCallback(
    async (itemId: string, tag: string | null) => {
      const prev = itemsRef.current;
      await withRollback({
        apply: () =>
          setItems((p) => p.map((i) => (i.id === itemId ? { ...i, tag } : i))),
        revert: () => setItems(() => prev),
        request: () =>
          fetchJson(`/api/board-items/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tag }),
          }),
        errorMessage: "Couldn't move item",
      });
    },
    []
  );

  return {
    items,
    setItems,
    addCard,
    addDocument,
    addLink,
    addFile,
    deleteItem,
    setTag,
    reconcile,
    patchDocumentLocal,
  };
}

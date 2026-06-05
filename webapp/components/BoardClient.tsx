"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board, FileKind } from "@/lib/types-boards";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";
import BoardItemTile from "./BoardItemTile";
import BoardCanvasView, { type BoardCreateHandlers } from "./board/BoardCanvasView";
import SectionTabs from "./board/SectionTabs";
import PromptDialog from "./canvas/PromptDialog";
import CreateMenu, { type CreateAction } from "./canvas/CreateMenu";
import { DocumentOverlayProvider } from "./canvas/DocumentOverlay";
import { PostOverlayProvider } from "./canvas/PostOverlay";
import BoardSettingsMenu, { type SortMode, type ItemKindFilter } from "./board/BoardSettingsMenu";
import ShareMenu, { type Visibility } from "./board/ShareMenu";
import { usePostChat } from "./post-chat";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, MessageSquare, Share2, Zap, Settings2 } from "lucide-react";

const ALL_KINDS: ItemKindFilter[] = ["document", "card", "post", "file"];

function itemName(i: ExpandedBoardItem): string {
  return (
    i.document?.title ||
    i.card?.body_md ||
    i.creator_post?.title_or_caption ||
    i.file?.original_name ||
    ""
  ).toLowerCase();
}

function itemModified(i: ExpandedBoardItem): string {
  return i.document?.updated_at || i.card?.updated_at || i.created_at || "";
}

function sortItems(list: ExpandedBoardItem[], sort: SortMode): ExpandedBoardItem[] {
  if (sort === "custom") return list;
  const arr = [...list];
  if (sort === "created") arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  else if (sort === "modified") arr.sort((a, b) => itemModified(b).localeCompare(itemModified(a)));
  else if (sort === "name") arr.sort((a, b) => itemName(a).localeCompare(itemName(b)));
  else if (sort === "type") arr.sort((a, b) => a.kind.localeCompare(b.kind));
  return arr;
}
import { useBoardItems } from "@/lib/board/useBoardItems";
import { fetchJson } from "@/lib/optimistic/withRollback";
import { toast } from "sonner";

function readSections(canvasState: unknown): string[] {
  if (
    canvasState &&
    typeof canvasState === "object" &&
    Array.isArray((canvasState as { sections?: unknown }).sections)
  ) {
    return ((canvasState as { sections: unknown[] }).sections).filter(
      (s): s is string => typeof s === "string"
    );
  }
  return [];
}

export default function BoardClient({
  board,
  initialItems,
}: {
  board: Board;
  initialItems: ExpandedBoardItem[];
}) {
  const {
    items,
    addCard,
    addDocument,
    addLink,
    addFile,
    deleteItem,
    patchDocumentLocal,
  } = useBoardItems(board.id, initialItems, board.voice_id);

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [persistedSections, setPersistedSections] = useState<string[]>(() =>
    readSections(board.canvas_state)
  );
  const [sectionDialog, setSectionDialog] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null);
  const [settingsMenu, setSettingsMenu] = useState<{ x: number; y: number } | null>(null);
  const [shareMenu, setShareMenu] = useState<{ x: number; y: number } | null>(null);
  const [sort, setSort] = useState<SortMode>("custom");
  const [enabledKinds, setEnabledKinds] = useState<Set<ItemKindFilter>>(
    () => new Set(ALL_KINDS)
  );
  const [visibility, setVisibility] = useState<Visibility>("private");
  const chatPanel = usePostChat();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runHeaderAction = useCallback(
    (action: CreateAction) => {
      if (action === "card") addCard({ tag: activeTag });
      else if (action === "document") addDocument({ tag: activeTag });
      else if (action === "section") setSectionDialog(true);
      else if (action === "link") {
        const url = window.prompt("Paste an Instagram post or reel URL");
        if (url && url.trim().startsWith("http")) addLink(url.trim(), { tag: activeTag });
      }
    },
    [addCard, addDocument, addLink, activeTag]
  );

  // Section list = persisted (incl. empty) ∪ tags present on items.
  const sections = useMemo(() => {
    const fromItems = items
      .map((i) => i.tag)
      .filter((t): t is string => !!t);
    return Array.from(new Set([...persistedSections, ...fromItems]));
  }, [persistedSections, items]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) if (i.tag) c[i.tag] = (c[i.tag] ?? 0) + 1;
    return c;
  }, [items]);

  const visibleItems = useMemo(() => {
    let list = items.filter((i) => enabledKinds.has(i.kind as ItemKindFilter));
    if (activeTag) list = list.filter((i) => i.tag === activeTag);
    return sortItems(list, sort);
  }, [items, enabledKinds, activeTag, sort]);

  const toggleKind = useCallback((k: ItemKindFilter) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // never allow an empty filter (nothing visible) — re-enable all instead
      if (next.size === 0) return new Set(ALL_KINDS);
      return next;
    });
  }, []);

  const persistSections = useCallback(
    async (next: string[]) => {
      setPersistedSections(next);
      try {
        await fetchJson(`/api/boards/${board.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canvas_state: { sections: next } }),
        });
      } catch {
        toast.error("Couldn't save section");
      }
    },
    [board.id]
  );

  const addSection = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (!sections.includes(trimmed)) {
        persistSections([...persistedSections, trimmed]);
      }
      setActiveTag(trimmed);
    },
    [sections, persistedSections, persistSections]
  );

  // File upload (drag-drop or picker) — optimistic add via the store.
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy("file");
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        try {
          const up = await fetchJson<{ file: { id: string; kind: string; original_name: string | null } }>(
            "/api/files/upload",
            { method: "POST", body: form }
          );
          await addFile(
            up.file.id,
            {
              id: up.file.id,
              kind: (up.file.kind as FileKind) || "file",
              storage_bucket: "",
              storage_path: "",
              original_name: up.file.original_name,
              size_bytes: null,
              mime_type: null,
              created_at: new Date().toISOString(),
            },
            { tag: activeTag }
          );
        } catch (e) {
          toast.error("Upload failed", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      }
      setBusy(null);
    },
    [addFile, activeTag]
  );

  // Keyboard shortcuts: C card, D document, ⇧L link, S section, ⌘V paste url.
  useEffect(() => {
    function isEditable(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        !!el?.isContentEditable ||
        !!el?.closest?.("[role='dialog']")
      );
    }
    function onKey(e: KeyboardEvent) {
      if (isEditable(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "v") return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        addCard({ tag: activeTag });
      } else if (!e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        addDocument({ tag: activeTag });
      } else if (e.shiftKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        setSectionDialog(false);
        // Open link via the canvas dialog isn't reachable from here; quick prompt:
        const url = window.prompt("Paste an Instagram post or reel URL");
        if (url && url.trim().startsWith("http")) addLink(url.trim(), { tag: activeTag });
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSectionDialog(true);
      }
    }
    function onPaste(e: ClipboardEvent) {
      if (isEditable(e.target)) return;
      const text = e.clipboardData?.getData("text") || "";
      if (text.startsWith("http")) {
        e.preventDefault();
        addLink(text.trim(), { tag: activeTag });
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [addCard, addDocument, addLink, activeTag]);

  const handlers: BoardCreateHandlers = {
    onCreateCard: (o) => addCard(o),
    onCreateDocument: (o) => addDocument(o),
    onCreateLink: (url, o) => addLink(url, o),
    onAddSection: () => setSectionDialog(true),
    activeTag,
  };

  // Whole-board drag-drop file upload.
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(e: React.DragEvent) {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    }
  }

  const chatActive = chatPanel.isOpen;
  return (
   <DocumentOverlayProvider onLocalUpdate={patchDocumentLocal}>
    <PostOverlayProvider>
    <div onDragOver={onDragOver} onDrop={onDrop} className="-mt-4 space-y-4 lg:-mt-5">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            render={<Link href="/boards" />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            className="-ml-1 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Back to boards"
            title="Back to boards"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {board.name}
          </h1>
          <button
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setHeaderMenu({ x: r.left, y: r.bottom + 6 });
            }}
            title="Add to board"
            className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={() =>
              chatActive ? chatPanel.close() : chatPanel.openBoard(board.id, board.name)
            }
            className={
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 hover:bg-accent hover:text-foreground " +
              (chatActive ? "bg-accent text-foreground" : "")
            }
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </button>
          <button
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setShareMenu({ x: r.right - 300, y: r.bottom + 6 });
            }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 hover:bg-accent hover:text-foreground"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button
            title="Boost"
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent hover:text-foreground"
          >
            <Zap className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setSettingsMenu({ x: r.right - 256, y: r.bottom + 6 });
            }}
            title="Board settings"
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </header>

      {/* Sections */}
      <SectionTabs
        sections={sections}
        counts={counts}
        total={items.length}
        activeTag={activeTag}
        onSelect={setActiveTag}
        onAddSection={() => setSectionDialog(true)}
      />

      <CreateMenu
        open={!!headerMenu}
        x={headerMenu?.x ?? 0}
        y={headerMenu?.y ?? 0}
        onClose={() => setHeaderMenu(null)}
        onPick={runHeaderAction}
      />

      <BoardSettingsMenu
        open={!!settingsMenu}
        x={settingsMenu?.x ?? 0}
        y={settingsMenu?.y ?? 0}
        sort={sort}
        onSort={setSort}
        enabled={enabledKinds}
        onToggleKind={toggleKind}
        onDisplayAll={() => setEnabledKinds(new Set(ALL_KINDS))}
        onVersionHistory={() => toast.info("Version history is coming soon")}
        onSaveTemplate={() => toast.info("Save as template is coming soon")}
        onClose={() => setSettingsMenu(null)}
      />

      <ShareMenu
        open={!!shareMenu}
        x={shareMenu?.x ?? 0}
        y={shareMenu?.y ?? 0}
        visibility={visibility}
        onChange={(v) => {
          setVisibility(v);
          toast.success(v === "public" ? "Board is now public (read-only)" : "Board is private");
        }}
        onClose={() => setShareMenu(null)}
      />

      {/* Canvas / empty state */}
      {items.length === 0 ? (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center text-sm">
          <p className="font-medium">This board is empty</p>
          <p className="mt-1 text-muted-foreground">
            Right-click the canvas, paste a link (⌘V), or use the buttons above to
            add a card, document, or file.
          </p>
          <div className="mt-4 flex justify-center gap-2 text-xs">
            <button
              onClick={() => addCard({ tag: activeTag })}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-border/30"
            >
              + Card
            </button>
            <button
              onClick={() => addDocument({ tag: activeTag })}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-border/30"
            >
              + Document
            </button>
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing in “{activeTag}” yet. Create an item here, or drag one in.
        </div>
      ) : (
        <BoardCanvasView
          key={sort}
          boardId={board.id}
          items={visibleItems}
          onDelete={deleteItem}
          handlers={handlers}
          reorderable={sort === "custom"}
        />
      )}

      <PromptDialog
        open={sectionDialog}
        title="Add section"
        description="Group cards under a named section. New items land in the active section."
        placeholder="e.g. Hooks, Scripts, References"
        submitLabel="Add section"
        onSubmit={addSection}
        onClose={() => setSectionDialog(false)}
      />
    </div>
    </PostOverlayProvider>
   </DocumentOverlayProvider>
  );
}

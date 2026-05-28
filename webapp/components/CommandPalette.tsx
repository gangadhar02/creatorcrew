"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Lightbulb,
  User,
  Loader2,
  Plus,
  FolderPlus,
  FilePlus,
  Square,
  Link as LinkIcon,
  Sidebar,
  MessageSquarePlus,
  LayoutGrid,
  Compass,
  Hash,
  Columns3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { PaneKind } from "@/lib/panes";
import { openInWorkspaceUrl } from "@/lib/panes";
import { toggleSidebarCollapsed } from "@/lib/sidebar-state";

type Hit = {
  kind:
    | "save"
    | "idea"
    | "profile"
    | "board"
    | "card"
    | "document"
    | "creator"
    | "post";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

type RecentBoard = { id: string; name: string; at: number };

const RECENT_BOARDS_KEY = "eden.recentBoards:v1";

const KIND_ICON: Record<Hit["kind"], React.ComponentType<{ className?: string }>> = {
  save: FileText,
  idea: Lightbulb,
  profile: User,
  board: LayoutGrid,
  card: Square,
  document: FileText,
  creator: User,
  post: Compass,
};

// Map a search hit's kind → workspace pane kind, when supported.
const KIND_TO_PANE: Partial<Record<Hit["kind"], PaneKind>> = {
  board: "board",
  document: "document",
  creator: "creator",
  post: "post",
};

type Action = {
  id: string;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  run: (
    router: ReturnType<typeof useRouter>,
    onClose: () => void
  ) => Promise<void> | void;
};

const ACTIONS: Action[] = [
  {
    id: "new-board",
    label: "New board",
    hint: "Start a fresh canvas",
    Icon: LayoutGrid,
    shortcut: "B",
    run: async (router, onClose) => {
      const t = toast.loading("Creating board…");
      try {
        const res = await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Untitled board" }),
        });
        const data = await res.json();
        if (data?.board?.id) {
          toast.success("Board created", { id: t });
          router.push(`/boards/${data.board.id}`);
          onClose();
        } else {
          toast.error("Failed", {
            id: t,
            description: data?.error || "Unknown error",
          });
        }
      } catch (e) {
        toast.error("Failed", { id: t, description: String(e) });
      }
    },
  },
  {
    id: "new-folder",
    label: "New folder",
    hint: "Group canvases together",
    Icon: FolderPlus,
    shortcut: "F",
    run: async (router, onClose) => {
      const t = toast.loading("Creating folder…");
      try {
        // No dedicated folder kind yet — use a board with a folder icon marker.
        const res = await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "📁 Untitled folder",
            description: "Folder",
            color: "gray",
          }),
        });
        const data = await res.json();
        if (data?.board?.id) {
          toast.success("Folder created", { id: t });
          router.push(`/boards/${data.board.id}`);
          onClose();
        } else {
          toast.error("Failed", { id: t, description: data?.error });
        }
      } catch (e) {
        toast.error("Failed", { id: t, description: String(e) });
      }
    },
  },
  {
    id: "new-document",
    label: "New document",
    hint: "Standalone markdown doc",
    Icon: FilePlus,
    shortcut: "D",
    run: async (router, onClose) => {
      const t = toast.loading("Creating document…");
      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Untitled document" }),
        });
        const data = await res.json();
        if (data?.document?.id) {
          toast.success("Document created", { id: t });
          router.push(`/documents/${data.document.id}`);
          onClose();
        } else {
          toast.error("Failed", { id: t, description: data?.error });
        }
      } catch (e) {
        toast.error("Failed", { id: t, description: String(e) });
      }
    },
  },
  {
    id: "new-card",
    label: "New card",
    hint: "Quick standalone card",
    Icon: Plus,
    shortcut: "⇧C",
    run: async (router, onClose) => {
      const recent = loadRecentBoards();
      const boardId = recent[0]?.id;
      const t = toast.loading("Creating card…");
      try {
        const res = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body_md: "",
            ...(boardId ? { board_id: boardId } : {}),
          }),
        });
        const data = await res.json();
        if (data?.card?.id) {
          toast.success("Card created", {
            id: t,
            description: boardId
              ? "Added to most recent board"
              : "Standalone card",
          });
          if (boardId) router.push(`/boards/${boardId}#card-${data.card.id}`);
          onClose();
        } else {
          toast.error("Failed", { id: t, description: data?.error });
        }
      } catch (e) {
        toast.error("Failed", { id: t, description: String(e) });
      }
    },
  },
  {
    id: "paste-link",
    label: "Paste link",
    hint: "Save a URL to Discover",
    Icon: LinkIcon,
    shortcut: "P",
    run: async (router, onClose) => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !/^https?:\/\//.test(text)) {
          toast.error("Clipboard doesn't contain a URL");
          return;
        }
        toast.success("Routing link…", { description: text.slice(0, 60) });
        router.push(`/discover?q=${encodeURIComponent(text)}`);
        onClose();
      } catch {
        toast.error("Couldn't read clipboard");
      }
    },
  },
  {
    id: "toggle-sidebar",
    label: "Toggle sidebar",
    hint: "Collapse / expand the left panel",
    Icon: Sidebar,
    shortcut: "⌘/",
    run: (_router, onClose) => {
      toggleSidebarCollapsed();
      onClose();
    },
  },
  {
    id: "new-chat",
    label: "New chat",
    hint: "Start a fresh conversation",
    Icon: MessageSquarePlus,
    shortcut: "C",
    run: (router, onClose) => {
      router.push("/chat");
      onClose();
    },
  },
];

function loadRecentBoards(): RecentBoard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_BOARDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentBoard[];
  } catch {
    return [];
  }
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Build a flat ordered list combining actions/recent/results, for arrow navigation
  type Row =
    | { kind: "action"; action: Action }
    | { kind: "recent"; recent: RecentBoard }
    | { kind: "hit"; hit: Hit };

  const rows: Row[] = useMemo(() => {
    const norm = q.trim().toLowerCase();
    const filteredActions = norm
      ? ACTIONS.filter(
          (a) =>
            a.label.toLowerCase().includes(norm) ||
            a.hint.toLowerCase().includes(norm)
        )
      : ACTIONS;
    const filteredRecent = norm
      ? recentBoards.filter((r) => r.name.toLowerCase().includes(norm))
      : recentBoards;
    return [
      ...filteredActions.map((a) => ({ kind: "action" as const, action: a })),
      ...filteredRecent.map((r) => ({ kind: "recent" as const, recent: r })),
      ...hits.map((h) => ({ kind: "hit" as const, hit: h })),
    ];
  }, [q, hits, recentBoards]);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActiveIdx(0);
      setRecentBoards(loadRecentBoards());
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (!query) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=30`
        );
        const data = await res.json();
        setHits((data.hits || []) as Hit[]);
        setActiveIdx(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[activeIdx];
        if (!row) return;
        if (row.kind === "action") {
          row.action.run(router, onClose);
        } else if (row.kind === "recent") {
          if (e.altKey) {
            router.push(openInWorkspaceUrl({ kind: "board", id: row.recent.id }));
          } else {
            router.push(`/boards/${row.recent.id}`);
          }
          onClose();
        } else {
          handleHitOpen(row.hit, e.altKey);
        }
      } else if (e.key === "d" && e.metaKey) {
        e.preventDefault();
        const row = rows[activeIdx];
        if (row && (row.kind === "hit" || row.kind === "recent")) {
          duplicateRow(row);
        }
      }
    }
    function handleHitOpen(hit: Hit, altKey: boolean) {
      const paneKind = KIND_TO_PANE[hit.kind];
      if (altKey && paneKind) {
        router.push(openInWorkspaceUrl({ kind: paneKind, id: hit.id }));
      } else {
        router.push(hit.href);
      }
      onClose();
    }
    async function duplicateRow(row: Row) {
      if (row.kind === "recent" || (row.kind === "hit" && row.hit.kind === "board")) {
        const boardId = row.kind === "recent" ? row.recent.id : row.hit.id;
        // Quick clone: create a new board with " (copy)" suffix.
        const t = toast.loading("Duplicating…");
        try {
          // Fetch source board
          const srcRes = await fetch(`/api/boards/${boardId}`);
          const src = await srcRes.json();
          const srcName = src?.board?.name || "Board";
          const res = await fetch("/api/boards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `${srcName} (copy)` }),
          });
          const data = await res.json();
          if (data?.board?.id) {
            toast.success("Duplicated", { id: t });
            router.push(`/boards/${data.board.id}`);
            onClose();
          } else {
            toast.error("Failed", { id: t, description: data?.error });
          }
        } catch (e) {
          toast.error("Failed", { id: t, description: String(e) });
        }
      } else {
        toast.message("Duplicate not supported for this item");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows, activeIdx, router, onClose]);

  // Compute section starts for visual breaks
  const sectionStarts = useMemo(() => {
    let actionStart = -1,
      recentStart = -1,
      hitStart = -1;
    rows.forEach((r, i) => {
      if (r.kind === "action" && actionStart === -1) actionStart = i;
      if (r.kind === "recent" && recentStart === -1) recentStart = i;
      if (r.kind === "hit" && hitStart === -1) hitStart = i;
    });
    return { actionStart, recentStart, hitStart };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl gap-0">
        <DialogTitle className="sr-only">Find or create</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find or create…"
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No matches for &ldquo;{q}&rdquo;.
            </div>
          ) : (
            rows.map((row, i) => {
              const showActionHeader = i === sectionStarts.actionStart;
              const showRecentHeader = i === sectionStarts.recentStart;
              const showHitHeader = i === sectionStarts.hitStart;

              return (
                <div key={i}>
                  {showActionHeader && <SectionHeader>Actions</SectionHeader>}
                  {showRecentHeader && <SectionHeader>Recent</SectionHeader>}
                  {showHitHeader && <SectionHeader>Results</SectionHeader>}

                  {row.kind === "action" ? (
                    <button
                      onClick={() => row.action.run(router, onClose)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                        i === activeIdx
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <row.action.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{row.action.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {row.action.hint}
                        </div>
                      </div>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {row.action.shortcut}
                      </kbd>
                    </button>
                  ) : row.kind === "recent" ? (
                    <Link
                      href={`/boards/${row.recent.id}`}
                      onClick={onClose}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                        i === activeIdx
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 truncate">
                        {row.recent.name}
                      </div>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        recent
                      </Badge>
                    </Link>
                  ) : (
                    <HitRow
                      hit={row.hit}
                      active={i === activeIdx}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClose={onClose}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>
            <kbd>↑↓</kbd> navigate · <kbd>⏎</kbd> run ·{" "}
            <kbd>⌥⏎</kbd> side peek · <kbd>⌘D</kbd> duplicate
          </span>
          <span>
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HitRow({
  hit,
  active,
  onMouseEnter,
  onClose,
}: {
  hit: Hit;
  active: boolean;
  onMouseEnter: () => void;
  onClose: () => void;
}) {
  const Icon = KIND_ICON[hit.kind] || FileText;
  const router = useRouter();
  const paneKind = KIND_TO_PANE[hit.kind];

  return (
    <div
      onMouseEnter={onMouseEnter}
      className={cn(
        "group flex items-center gap-3 px-4 py-2 text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
      )}
    >
      <Link
        href={hit.href}
        onClick={onClose}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate">{hit.title}</div>
          {hit.subtitle && (
            <div className="truncate text-xs text-muted-foreground">
              {hit.subtitle}
            </div>
          )}
        </div>
      </Link>
      {paneKind && (
        <button
          onClick={(e) => {
            e.preventDefault();
            router.push(openInWorkspaceUrl({ kind: paneKind, id: hit.id }));
            onClose();
          }}
          title="Open in workspace pane (⌥⏎)"
          className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary group-hover:block"
        >
          <Columns3 className="h-3.5 w-3.5" />
        </button>
      )}
      <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
        {hit.kind}
      </Badge>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border/50 bg-muted/20 px-4 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground first:border-t-0">
      {children}
    </div>
  );
}

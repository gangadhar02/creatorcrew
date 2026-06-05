"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Pin,
  Columns2,
  Sparkles,
  Pencil,
  Copy,
  Bookmark,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePostChat } from "./post-chat";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A workspace board in the sidebar with an Eden-style right-click menu:
 * Pin to top · Open in Pane · Chat with · Rename · Duplicate · Save as
 * template · Delete. Mirrors ChatRow's pattern (inline rename + delete confirm).
 */
export default function BoardRow({
  id,
  name,
  active,
  collapsed,
  onRenamed,
  onDeleted,
}: {
  id: string;
  name: string;
  active: boolean;
  collapsed: boolean;
  onRenamed?: (id: string, name: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const chatPanel = usePostChat();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = name || "Untitled board";
  const rowClass = cn(
    "sidebar-nav-link relative flex w-full items-center rounded-md text-sm transition-colors",
    collapsed ? "py-0" : "justify-between px-3 py-1.5",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-accent/60"
  );

  function startRename() {
    setDraft(name);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitRename() {
    const next = draft.trim();
    setRenaming(false);
    if (!next || next === name) return;
    onRenamed?.(id, next); // optimistic
    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      onRenamed?.(id, name); // rollback
      toast.error("Couldn't rename board", { description: String(err) });
    }
  }

  async function pinToTop() {
    if (busy) return;
    setBusy(true);
    try {
      // Boards sort by `position` asc; a strongly-negative value floats it up,
      // with newer pins above older ones.
      const res = await fetch(`/api/boards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: -Math.floor(Date.now() / 1000) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
      toast.success("Pinned to top");
    } catch (err) {
      toast.error("Couldn't pin board", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  function openInPane() {
    router.push(`/workspace?panes=board:${id}`);
  }

  async function duplicate(asTemplate: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/boards/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ as_template: asTemplate }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.refresh();
      toast.success(asTemplate ? "Saved as template" : "Board duplicated");
    } catch (err) {
      toast.error(
        asTemplate ? "Couldn't save template" : "Couldn't duplicate board",
        { description: String(err) }
      );
    } finally {
      setBusy(false);
    }
  }

  async function performDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onDeleted?.(id);
      if (active) router.push("/home");
      router.refresh();
      toast.success("Board deleted");
    } catch (err) {
      toast.error("Couldn't delete board", { description: String(err) });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  const icon = collapsed ? (
    <span className="grid h-4 w-4 place-items-center rounded-sm bg-muted text-[10px] font-semibold leading-none">
      {label.slice(0, 1).toUpperCase()}
    </span>
  ) : (
    <LayoutGrid className="h-4 w-4 shrink-0" />
  );

  // Inline rename input (expanded only).
  if (renaming && !collapsed) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitRename();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setRenaming(false);
          }
        }}
        autoFocus
        className="w-full rounded-md border border-ring bg-background px-3 py-1.5 text-sm text-foreground outline-none"
      />
    );
  }

  const linkInner = (
    <span
      className={cn(
        "flex min-w-0 items-center",
        collapsed ? "w-full justify-center" : "gap-2"
      )}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      {!collapsed && (
        <span className="sidebar-label truncate whitespace-nowrap">{label}</span>
      )}
    </span>
  );

  const link = (
    <motion.div
      whileHover={{ x: collapsed ? 0 : 1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(collapsed && "flex w-full justify-center")}
    >
      <Link href={`/boards/${id}`} className={rowClass}>
        {linkInner}
      </Link>
    </motion.div>
  );

  const menu = (
    <ContextMenuContent className="min-w-52">
      <ContextMenuItem onClick={pinToTop}>
        <Pin />
        Pin to top
      </ContextMenuItem>
      <ContextMenuItem onClick={openInPane}>
        <Columns2 />
        Open in Pane
      </ContextMenuItem>
      <ContextMenuItem onClick={() => chatPanel.openBoard(id, name)}>
        <Sparkles />
        Chat with
      </ContextMenuItem>
      <ContextMenuSeparator />
      {!collapsed && (
        <ContextMenuItem onClick={startRename}>
          <Pencil />
          Rename
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={() => duplicate(false)}>
        <Copy />
        Duplicate
      </ContextMenuItem>
      <ContextMenuItem onClick={() => duplicate(true)}>
        <Bookmark />
        Save as template
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
        <Trash2 />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger render={<div className="w-full" />}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          )}
        </ContextMenuTrigger>
        {menu}
      </ContextMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete board</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <DialogDescription className="text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{label}</span>? Its cards and
              documents will be removed. This action cannot be undone.
            </DialogDescription>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={performDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

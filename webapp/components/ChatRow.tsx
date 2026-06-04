"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBoolPref, setBoolPref, PREF_KEYS } from "@/lib/prefs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
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

export default function ChatRow({
  id,
  title,
  active,
  onDeleted,
  onRenamed,
  showCheck = true,
  className,
}: {
  id: string;
  title: string;
  active?: boolean;
  onDeleted?: (id: string) => void;
  onRenamed?: (id: string, title: string) => void;
  showCheck?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = title || "Untitled chat";

  async function performDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onDeleted?.(id);
      if (active) router.push("/chat");
      router.refresh();
      toast.success("Chat deleted");
    } catch (err) {
      toast.error("Couldn't delete chat", { description: String(err) });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  // Respect the "Confirm before deleting chats" preference (Settings → Preferences).
  // When confirmation is off we delete straight away.
  function requestDelete() {
    if (getBoolPref(PREF_KEYS.confirmDeleteChats, true)) {
      setDontAskAgain(false);
      setConfirmOpen(true);
    } else {
      void performDelete();
    }
  }

  function confirmDelete() {
    if (dontAskAgain) setBoolPref(PREF_KEYS.confirmDeleteChats, false);
    void performDelete();
  }

  function startRename() {
    setDraft(title);
    setRenaming(true);
    // Focus + select on the next tick once the input is mounted.
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitRename() {
    const next = draft.trim();
    setRenaming(false);
    if (!next || next === title) return;
    try {
      const res = await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onRenamed?.(id, next);
      router.refresh();
    } catch (err) {
      toast.error("Couldn't rename chat", { description: String(err) });
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                "group flex min-w-0 items-center gap-0.5",
                className
              )}
            />
          }
        >
          {renaming ? (
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
              className="min-w-0 flex-1 rounded-md border border-ring bg-background px-2 py-1.5 text-xs text-foreground outline-none"
            />
          ) : (
            <Link
              href={`/chats/${id}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                active
                  ? "bg-accent/60 text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {showCheck && (
                <span className="w-4 shrink-0 text-muted-foreground">
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </Link>
          )}
          {!renaming && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                requestDelete();
              }}
              disabled={deleting}
              className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
              title="Delete chat"
              aria-label={`Delete ${label}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={startRename}>
            <Pencil />
            Rename
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={requestDelete}>
            <Trash2 />
            Delete chat
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <DialogDescription className="text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{label}</span>? This action cannot
              be undone.
            </DialogDescription>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="size-4 accent-foreground"
            />
            Don&apos;t ask again
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
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

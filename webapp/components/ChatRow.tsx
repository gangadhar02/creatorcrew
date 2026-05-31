"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBoolPref, PREF_KEYS } from "@/lib/prefs";

export default function ChatRow({
  id,
  title,
  active,
  onDeleted,
  showCheck = true,
  className,
}: {
  id: string;
  title: string;
  active?: boolean;
  onDeleted?: (id: string) => void;
  showCheck?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;
    // Respect the "Confirm before deleting chats" preference (Settings → Preferences).
    if (
      getBoolPref(PREF_KEYS.confirmDeleteChats, true) &&
      !window.confirm(`Delete "${title || "this chat"}"? This can't be undone.`)
    ) {
      return;
    }
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
    }
  }

  return (
    <div className={cn("group flex min-w-0 items-center gap-0.5", className)}>
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
        <span className="min-w-0 flex-1 truncate">{title || "Untitled chat"}</span>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
        title="Delete chat"
        aria-label={`Delete ${title || "chat"}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Floating delete button for a creator card. Lives on the card's hover
 * overlay; clicking confirms + removes the creator (and cascades to its
 * posts, list memberships, and baselines).
 *
 * Rendered as a sibling to the card's <Link>, with stopPropagation so
 * the click doesn't navigate to the creator's detail page.
 */
export default function CreatorCardActions({
  creatorId,
  handle,
}: {
  creatorId: string;
  handle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const ok = window.confirm(
      `Remove @${handle} from your workspace?\n\nThis also deletes their cached posts and any list memberships. Cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Removed @${handle}`);
      router.refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-card/90 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      aria-label={`Remove @${handle}`}
      title={`Remove @${handle}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Expand,
  Search,
  Copy,
  Type as TypeIcon,
  List,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  POST_BOOST_ORDER,
  POST_BOOST_PRESETS,
  type PostBoostPresetId,
  type PostBoostPreset,
} from "@/lib/post-boost-presets";
import type { PostWithCreator } from "@/lib/discover-types";

const ICONS: Record<PostBoostPreset["iconName"], React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  expand: Expand,
  search: Search,
  copy: Copy,
  type: TypeIcon,
  list: List,
};

const ACCENT_TEXT: Record<PostBoostPreset["accent"], string> = {
  violet: "text-violet-500",
  sky: "text-sky-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  pink: "text-pink-500",
  rose: "text-rose-500",
};

export default function PostBoostMenu({
  post,
  onClose,
}: {
  post: PostWithCreator;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [submitting, setSubmitting] = useState<PostBoostPresetId | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Filter presets by eligibility
  const visible = POST_BOOST_ORDER.map((id) => POST_BOOST_PRESETS[id]).filter(
    (p) => !p.showWhen || p.showWhen(post)
  );

  async function runBoost(presetId: PostBoostPresetId) {
    setSubmitting(presetId);
    const t = toast.loading("Starting boost…");
    try {
      const res = await fetch("/api/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, presetId }),
      });
      const data = await res.json();
      if (data?.chat_id) {
        toast.success("Boost started", { id: t });
        // Open in a workspace pane so the post + chat sit side by side.
        router.push(`/workspace?panes=chat:${data.chat_id}&active=0`);
        onClose();
      } else {
        toast.error("Boost failed", {
          id: t,
          description: data?.error || "Unknown error",
        });
      }
    } catch (e) {
      toast.error("Boost failed", { id: t, description: String(e) });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg ring-1 ring-foreground/10"
    >
      <div className="border-b bg-muted/30 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Boosts
      </div>
      <div className="max-h-96 overflow-y-auto p-1">
        {visible.map((preset) => {
          const Icon = ICONS[preset.iconName];
          const accent = ACCENT_TEXT[preset.accent];
          const busy = submitting === preset.id;
          return (
            <button
              key={preset.id}
              disabled={busy}
              onClick={() => runBoost(preset.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent",
                busy && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted",
                  accent
                )}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{preset.title}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">
                  {preset.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

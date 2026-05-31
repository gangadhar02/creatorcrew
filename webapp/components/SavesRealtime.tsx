"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radio } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Subscribes to live changes on the `saves` table via Supabase Realtime and
 * refreshes the server-rendered list when rows arrive (e.g. when a GitHub
 * Actions sync inserts new saves). No polling — Supabase pushes the change.
 *
 * Requires (one-time, in Supabase):
 *   1. RLS SELECT policy on `saves` for the authenticated role.
 *   2. The `saves` table added to the `supabase_realtime` publication.
 */
export default function SavesRealtime() {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    const channel = sb
      .channel("saves-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saves" },
        () => {
          // A sync inserts many rows in a burst — debounce so we refresh once.
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => {
            router.refresh();
            toast.success("New saves synced", { duration: 2500 });
          }, 900);
        }
      )
      .subscribe((status: string) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      sb.removeChannel(channel);
    };
  }, [router]);

  if (!live) return null;
  return (
    <span
      title="Live — new saves appear automatically"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
    >
      <Radio className="h-3 w-3 animate-pulse text-emerald-500" />
      Live
    </span>
  );
}

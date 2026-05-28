"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { igImg } from "@/lib/proxy-image";
import { parsePanes, serializePanes } from "@/lib/panes";
import type { Creator, CreatorPost } from "@/lib/types";

export default function DiscoverPaneContent({
  posts,
}: {
  posts: (CreatorPost & { creator: Creator })[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function openPostInPane(postId: string) {
    const current = parsePanes(searchParams.get("panes"));
    // Replace the discover pane (find current discover slot) with the post,
    // or append if not full.
    const discoverIdx = current.findIndex((p) => p.kind === "discover");
    const next = [...current];
    if (next.length < 3) {
      next.push({ kind: "post", id: postId });
    } else if (discoverIdx !== -1) {
      next[discoverIdx] = { kind: "post", id: postId };
    } else {
      next[next.length - 1] = { kind: "post", id: postId };
    }
    const params = new URLSearchParams();
    params.set("panes", serializePanes(next));
    params.set("active", String(next.length - 1));
    router.push(`/workspace?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {posts.length === 0 && (
        <div className="col-span-2 rounded-md border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
          No posts yet — add creators in /creators
        </div>
      )}
      {posts.map((p) => (
        <button
          key={p.id}
          onClick={() => openPostInPane(p.id)}
          className="group block aspect-[4/5] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)] text-left transition-colors hover:border-[var(--primary)]/40"
        >
          {p.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                p.platform === "instagram"
                  ? igImg(p.thumbnail_url)
                  : p.thumbnail_url
              }
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-2 text-[10px] text-[var(--muted-foreground)]">
              {p.title_or_caption?.slice(0, 60) || "post"}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

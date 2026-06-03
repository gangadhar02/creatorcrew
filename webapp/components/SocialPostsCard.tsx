"use client";

import { useEffect, useState } from "react";
import { Heart, MessageCircle, Eye, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GenerativeCard from "./GenerativeCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { SocialPostTile } from "@/lib/tools";

interface SocialPostsCardProps {
  postIds: string[];
  handle?: string;
  note?: string;
}

function initials(s: string | null | undefined): string {
  const v = (s || "?").replace(/^@/, "").trim();
  return v.slice(0, 2).toUpperCase() || "?";
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "";
  return Math.round(n).toLocaleString();
}

export default function SocialPostsCard({
  postIds,
  handle,
  note,
}: SocialPostsCardProps) {
  const [posts, setPosts] = useState<SocialPostTile[] | null>(null);
  const [boards, setBoards] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [inserting, setInserting] = useState<string | null>(null);

  // Key the fetch on a stable string, not the array identity: ChatThread
  // re-renders this card on every streaming token, which would otherwise
  // re-trigger the fetch on each render.
  const idsKey = postIds.join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts?ids=${idsKey}`);
        const data = await res.json();
        if (!cancelled) setPosts((data.posts || []) as SocialPostTile[]);
      } catch {
        if (!cancelled) setPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  async function ensureBoards() {
    if (boards) return boards;
    const res = await fetch("/api/boards");
    const data = await res.json();
    const list = (data.boards || []) as { id: string; name: string }[];
    setBoards(list);
    return list;
  }

  async function insertToBoard(postId: string, boardId: string) {
    setInserting(postId);
    try {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post", creator_post_id: postId }),
      });
      if (res.ok) {
        toast.success("Added to board");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error("Insert failed", { description: data?.error });
      }
    } catch (e) {
      toast.error("Insert failed", { description: String(e) });
    } finally {
      setInserting(null);
    }
  }

  if (posts === null) {
    return (
      <GenerativeCard label="POSTS">
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      </GenerativeCard>
    );
  }

  if (posts.length === 0) {
    return (
      <GenerativeCard label="POSTS">
        <p className="text-xs text-muted-foreground">No posts found.</p>
      </GenerativeCard>
    );
  }

  return (
    <GenerativeCard label={`${posts.length} POSTS`}>
      {note ? (
        <p className="text-xs text-muted-foreground -mt-2">{note}</p>
      ) : null}
      <div className="grid gap-4">
        {posts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              {p.creator_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.creator_avatar_url}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover bg-muted"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                  {initials(p.creator_handle ?? handle)}
                </span>
              )}
              <span className="text-xs font-medium">
                @{p.creator_handle ?? handle ?? "unknown"}
              </span>
            </div>

            {p.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.thumbnail_url}
                alt=""
                className="w-full aspect-video rounded-lg object-cover bg-muted"
              />
            ) : null}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {p.like_count != null ? (
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  {fmt(p.like_count)}
                </span>
              ) : null}
              {p.comment_count != null ? (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  {fmt(p.comment_count)}
                </span>
              ) : null}
              {p.view_count != null ? (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  {fmt(p.view_count)}
                </span>
              ) : null}
              {p.outlier_multiplier != null && p.outlier_multiplier >= 2 ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  {Math.round(p.outlier_multiplier)}x
                </span>
              ) : null}
            </div>

            {p.title_or_caption ? (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {p.title_or_caption}
              </p>
            ) : null}

            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={ensureBoards}
                      disabled={inserting === p.id}
                    >
                      {inserting === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Add to board</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(boards || []).length === 0 ? (
                    <DropdownMenuItem disabled>No boards yet</DropdownMenuItem>
                  ) : (
                    (boards || []).map((b) => (
                      <DropdownMenuItem
                        key={b.id}
                        onClick={() => insertToBoard(p.id, b.id)}
                      >
                        {b.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        ))}
      </div>
    </GenerativeCard>
  );
}

export type { SocialPostsCardProps };

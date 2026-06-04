"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  MessageSquare,
  Eye,
  MessageCircle,
  Bookmark,
  BadgeCheck,
} from "lucide-react";
import type { PostWithCreator } from "@/lib/discover-types";
import { igImg, mediaImg } from "@/lib/proxy-image";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SaveToBoardMenu from "./SaveToBoardMenu";
import PostDetailModal from "./PostDetailModal";
import { usePostChat } from "./post-chat";
import { trackDwell, trackEvent } from "@/lib/event-tracker";

function fmtNum(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtAge(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = diffMs / day;
  if (days < 1) return `${Math.round(diffMs / (60 * 60 * 1000))}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

function thumbSrc(post: PostWithCreator): string | undefined {
  if (!post.thumbnail_url) return undefined;
  return mediaImg(post.thumbnail_url, post.platform) || undefined;
}

function avatarSrc(post: PostWithCreator): string | undefined {
  const url = post.creator.avatar_url;
  if (!url) return undefined;
  if (/\/social-mirror\//.test(url)) return url;
  return post.platform === "instagram" ? igImg(url) : url;
}

export default function PostCard({
  post,
  surface,
  position,
}: {
  post: PostWithCreator;
  surface?: string;
  position?: number;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const postChat = usePostChat();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    return trackDwell({
      contentId: post.id,
      creatorId: post.creator.id,
      surface,
      position,
      el: cardRef.current,
    });
  }, [post.id, post.creator.id, surface, position]);

  const c = post.creator;
  const src = thumbSrc(post);
  const caption = post.title_or_caption || "";
  const typeLabel = post.media_type || "Post";
  const outlier = post.outlier_multiplier;
  const isHighOutlier = outlier !== null && outlier !== undefined && outlier >= 2;

  function markSeen() {
    fetch(`/api/post-seen/${post.id}`, { method: "POST" }).catch(() => {});
    trackEvent({
      content_id: post.id,
      creator_id: post.creator.id,
      event_type: "click",
      surface,
      position,
    });
  }

  function openDetail() {
    markSeen();
    setDetailOpen(true);
  }

  function openChat() {
    postChat.open(post.id, c.handle);
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="group relative overflow-hidden rounded-lg border bg-card card-hover transition-all hover:border-primary/40 hover:shadow-md">
        {/* Clickable media + body — opens the detail modal */}
        <button onClick={openDetail} className="block w-full text-left">
          <div className="relative aspect-[4/5] bg-muted">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : null}
            <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              {typeLabel}
            </span>
          </div>
          <div className="space-y-1 p-2.5">
            {/* Creator row */}
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={avatarSrc(post)} alt="" />
                <AvatarFallback className="text-[9px]">
                  {c.handle.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                @{c.handle}
              </span>
              {c.is_verified && (
                <BadgeCheck className="h-3 w-3 shrink-0 text-sky-500" />
              )}
            </div>
            {/* Stats */}
            <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-0.5">
                  <Heart className="h-3 w-3" />
                  {fmtNum(post.like_count)}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="h-3 w-3" />
                  {fmtNum(post.comment_count)}
                </span>
                {post.view_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" />
                    {fmtNum(post.view_count)}
                  </span>
                )}
              </div>
              <span>{fmtAge(post.published_at)}</span>
            </div>
            {/* Caption */}
            <div className="line-clamp-2 text-xs text-foreground">{caption}</div>
          </div>
        </button>

        {/* Top-right overlay: hover actions (Chat / Add to board) + outlier badge */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <div className="pointer-events-none flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={openChat}
                    className="rounded-md bg-card/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent>Chat about this post</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSaveOpen((v) => !v);
                    }}
                    className="rounded-md bg-card/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-sky-500/10 hover:text-sky-500"
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent>Add to board</TooltipContent>
            </Tooltip>
          </div>
          {isHighOutlier && (
            <span className="pointer-events-none rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
              {outlier.toFixed(2)}×
            </span>
          )}
        </div>

        {saveOpen && (
          <SaveToBoardMenu
            creatorPostId={post.id}
            onClose={() => setSaveOpen(false)}
          />
        )}
      </div>

      <PostDetailModal
        post={post}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </motion.div>
  );
}

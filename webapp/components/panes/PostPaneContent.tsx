"use client";

import { useState } from "react";
import { igImg } from "@/lib/proxy-image";
import MarkdownView from "../MarkdownView";
import BoostMenu from "../BoostMenu";
import SaveToBoardMenu from "../SaveToBoardMenu";
import type { Creator, CreatorPost } from "@/lib/types";

function fmtNum(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function PostPaneContent({
  post,
  creator,
}: {
  post: CreatorPost;
  creator: Creator | null;
}) {
  const [boostOpen, setBoostOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <div className="relative space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        {creator?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              post.platform === "instagram"
                ? igImg(creator.avatar_url)
                : creator.avatar_url
            }
            alt=""
            className="h-7 w-7 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {creator?.display_name || `@${creator?.handle || ""}`}
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">
            {post.platform} · {fmtNum(creator?.follower_count || 0)} followers
          </div>
        </div>
        {post.outlier_multiplier && post.outlier_multiplier >= 2 && (
          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
            {post.outlier_multiplier.toFixed(1)}×
          </span>
        )}
      </div>

      {/* Thumbnail */}
      {post.thumbnail_url && (
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              post.platform === "instagram"
                ? igImg(post.thumbnail_url)
                : post.thumbnail_url
            }
            alt=""
            className="aspect-[4/5] w-full rounded-md object-cover"
          />
        </a>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-[11px] tabular-nums text-[var(--muted-foreground)]">
        <div className="flex items-center gap-3">
          <span>♡ {fmtNum(post.like_count)}</span>
          <span>💬 {fmtNum(post.comment_count)}</span>
          {post.view_count > 0 && <span>▶ {fmtNum(post.view_count)}</span>}
        </div>
        <span>{post.media_type}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setSaveOpen((v) => !v);
            setBoostOpen(false);
          }}
          className="flex-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--primary)]/40"
        >
          + Save to board
        </button>
        <button
          onClick={() => {
            setBoostOpen((v) => !v);
            setSaveOpen(false);
          }}
          className="flex-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-amber-500/40"
        >
          ⚡ Boost
        </button>
      </div>

      {/* Caption */}
      {post.title_or_caption && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs whitespace-pre-wrap">
          {post.title_or_caption}
        </div>
      )}

      {/* Vision analysis */}
      {post.vision_analysis_md && (
        <details className="text-xs" open>
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Vision analysis
          </summary>
          <div className="mt-2">
            <MarkdownView>{post.vision_analysis_md}</MarkdownView>
          </div>
        </details>
      )}

      {/* Transcript */}
      {post.transcript && (
        <details className="text-xs">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Transcript
          </summary>
          <div className="mt-2 whitespace-pre-wrap text-[var(--muted-foreground)]">
            {post.transcript}
          </div>
        </details>
      )}

      {boostOpen && (
        <div className="absolute right-2 top-44 z-10">
          <BoostMenu postId={post.id} onClose={() => setBoostOpen(false)} />
        </div>
      )}
      {saveOpen && (
        <div className="absolute right-2 top-44 z-10">
          <SaveToBoardMenu
            creatorPostId={post.id}
            onClose={() => setSaveOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { igImg } from "@/lib/proxy-image";
import type { Creator, CreatorPost } from "@/lib/types";

function fmtNum(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function CreatorPaneContent({
  creator,
  recentPosts,
}: {
  creator: Creator;
  recentPosts: CreatorPost[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {creator.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              creator.platform === "instagram"
                ? igImg(creator.avatar_url)
                : creator.avatar_url
            }
            alt=""
            className="h-14 w-14 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {creator.display_name || `@${creator.handle}`}
            {creator.is_verified && (
              <span className="ml-1 text-[10px] text-sky-500">✓</span>
            )}
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">
            {creator.platform} · {fmtNum(creator.follower_count)} followers ·{" "}
            {creator.post_count || 0} posts
          </div>
        </div>
      </div>

      {creator.bio && <p className="text-xs">{creator.bio}</p>}

      <div className="space-y-1.5 text-[11px] tabular-nums text-[var(--muted-foreground)]">
        {creator.typical_reel_views ? (
          <div>Typical reel views: {fmtNum(creator.typical_reel_views)}</div>
        ) : null}
        {creator.typical_post_likes ? (
          <div>Typical post likes: {fmtNum(creator.typical_post_likes)}</div>
        ) : null}
      </div>

      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Recent ({recentPosts.length})
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {recentPosts.slice(0, 12).map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square overflow-hidden rounded border border-[var(--border)] bg-[var(--background)]"
              title={p.title_or_caption || ""}
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
                <div className="flex h-full items-center justify-center text-[9px] text-[var(--muted-foreground)]">
                  {p.media_type}
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

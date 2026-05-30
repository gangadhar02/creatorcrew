"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap,
  Bookmark,
  ExternalLink,
  X as XIcon,
  Heart,
  MessageSquare,
  Eye,
  EyeOff,
  Copy,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { igImg, mediaImg } from "@/lib/proxy-image";
import type { PostWithCreator } from "@/lib/discover-types";
import type { AiOverview, AiOverviewBlock } from "@/lib/types-enrichment";
import MarkdownView from "./MarkdownView";
import PostBoostMenu from "./PostBoostMenu";
import SaveToBoardMenu from "./SaveToBoardMenu";

function fmtNum(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500",
  youtube: "bg-red-500",
  x: "bg-zinc-800",
  linkedin: "bg-sky-700",
  substack: "bg-orange-500",
  tiktok: "bg-zinc-900",
};

export default function PostDetailModal({
  post,
  open,
  onClose,
}: {
  post: PostWithCreator;
  open: boolean;
  onClose: () => void;
}) {
  const [boostOpen, setBoostOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [hideSeen, setHideSeen] = useState(false);
  // Load the live IG embed only on click — keeps the modal instant, never
  // blank, and avoids hammering Instagram's embed endpoint (which rate-limits
  // and then serves a blank/login page).
  const [playing, setPlaying] = useState(false);
  const [enrichment, setEnrichment] = useState<AiOverview | null>(
    normalizeAiOverview(post.ai_overview)
  );
  const [enriching, setEnriching] = useState(false);

  const c = post.creator;
  const platformColor = PLATFORM_COLORS[post.platform] || "bg-zinc-500";

  const thumbnail = post.thumbnail_url
    ? mediaImg(post.thumbnail_url, post.platform)
    : null;

  // Instagram embed — plays the reel / swipes the carousel inline, using IG's
  // own embed iframe (same approach as Eden). Falls back to the thumbnail for
  // non-IG platforms or when we can't resolve a shortcode.
  const igCode = (() => {
    if (post.code) return post.code;
    const m = post.url?.match(/\/(?:p|reel|reels|tv)\/([^/?#]+)/);
    return m ? m[1] : null;
  })();
  const isReel =
    post.media_type === "Reel" || post.media_format === "short_video";
  const embedUrl =
    post.platform === "instagram" && igCode
      ? `https://www.instagram.com/${isReel ? "reel" : "p"}/${igCode}/embed`
      : null;

  // Mark seen when modal opens; reset the player when it closes.
  useEffect(() => {
    if (open) {
      fetch(`/api/post-seen/${post.id}`, { method: "POST" }).catch(() => {});
    } else {
      setPlaying(false);
    }
  }, [open, post.id]);

  useEffect(() => {
    setEnrichment(normalizeAiOverview(post.ai_overview));
  }, [post.id, post.ai_overview]);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(post.title_or_caption || "");
      toast.success("Caption copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  async function hidePost() {
    setHideSeen(true);
    fetch(`/api/post-seen/${post.id}`, { method: "POST" }).catch(() => {});
    toast.success("Hidden");
    setTimeout(onClose, 200);
  }

  async function runEnrich() {
    setEnriching(true);
    try {
      const res = await fetch(`/api/enrich?id=${post.id}&force=1`, {
        method: "POST",
      });
      const data = await res.json();
      if (data?.single?.aiOverview) {
        setEnrichment(normalizeAiOverview(data.single.aiOverview));
        toast.success("Enrichment generated");
      } else {
        toast.error("Enrichment failed", {
          description: data?.error || "Unknown error",
        });
      }
    } catch (e) {
      toast.error("Enrichment failed", { description: String(e) });
    } finally {
      setEnriching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-[600px]"
        style={{ maxHeight: "90vh" }}
      >
        <DialogTitle className="sr-only">
          {post.title_or_caption?.slice(0, 60) || "Post detail"}
        </DialogTitle>

        {/* Top bar */}
        <div className="flex items-center gap-1 border-b px-4 py-2.5">
          <span
            className={cn(
              "mr-2 h-2 w-2 shrink-0 rounded-full",
              platformColor
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {post.title_or_caption || post.taxonomy_label || "Post"}
          </span>
          <div className="relative">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => {
                      setBoostOpen((v) => !v);
                      setSaveOpen(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent>Boost</TooltipContent>
            </Tooltip>
            {boostOpen && (
              <PostBoostMenu post={post} onClose={() => setBoostOpen(false)} />
            )}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={hidePost}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500",
                    hideSeen && "opacity-50"
                  )}
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              }
            />
            <TooltipContent>Hide from feed</TooltipContent>
          </Tooltip>
          <div className="relative">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => {
                      setSaveOpen((v) => !v);
                      setBoostOpen(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent>Save to board</TooltipContent>
            </Tooltip>
            {saveOpen && (
              <SaveToBoardMenu
                creatorPostId={post.id}
                onClose={() => setSaveOpen(false)}
              />
            )}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              }
            />
            <TooltipContent>Open original</TooltipContent>
          </Tooltip>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body — single column, Eden-style */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ maxHeight: "calc(90vh - 49px)" }}
        >
          {/* Media — thumbnail poster by default; click loads the live IG embed
              (reel plays / carousel swipes) inline. Loading on demand keeps the
              modal instant, never blank, and avoids IG embed rate-limiting.
              Light backdrop + ~540px (IG's natural max) so it fills the width. */}
          <div className="bg-muted/40 px-4 py-4">
            {embedUrl && playing ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title="Instagram post"
                loading="lazy"
                allowFullScreen
                scrolling="no"
                className="mx-auto block w-full max-w-[540px] rounded-xl border bg-white"
                style={{ height: 660 }}
              />
            ) : embedUrl ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label="Play"
                className="group relative mx-auto block w-full max-w-[540px] overflow-hidden rounded-xl border bg-black"
              >
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnail}
                    alt=""
                    className="max-h-[660px] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[4/5] w-full bg-muted" />
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-black/70">
                    <Play className="h-6 w-6 translate-x-0.5 fill-current" />
                  </span>
                </span>
              </button>
            ) : thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt=""
                className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"
              />
            ) : null}
          </div>

          {/* Creator row */}
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={
                  c.avatar_url
                    ? /\/social-mirror\//.test(c.avatar_url)
                      ? c.avatar_url
                      : post.platform === "instagram"
                        ? igImg(c.avatar_url)
                        : c.avatar_url
                    : undefined
                }
                alt=""
              />
              <AvatarFallback>
                {c.handle.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="truncate">
                  {c.display_name || `@${c.handle}`}
                </span>
                {c.is_verified && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                @{c.handle}
                {post.published_at
                  ? ` · ${new Date(post.published_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}`
                  : ""}
              </div>
            </div>
            <Link
              href={`/creators/${post.platform}/${c.handle}`}
              className="shrink-0 rounded-md border bg-card px-2 py-1 text-xs hover:border-primary/40"
              onClick={onClose}
            >
              View profile
            </Link>
          </div>

          {/* Stats pill */}
          <div className="border-b px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-3 py-2 text-xs tabular-nums">
              {post.outlier_multiplier !== null &&
                post.outlier_multiplier !== undefined && (
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      post.outlier_multiplier >= 2
                        ? "font-semibold text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}
                  >
                    <Zap className="h-3 w-3" />
                    {post.outlier_multiplier.toFixed(2)}×
                    <span className="text-muted-foreground">vs views</span>
                  </span>
                )}
              {post.view_count > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  {fmtNum(post.view_count)}
                  <span className="text-muted-foreground">views</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-muted-foreground" />
                {fmtNum(post.like_count)}
                <span className="text-muted-foreground">likes</span>
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                {fmtNum(post.comment_count)}
                <span className="text-muted-foreground">comments</span>
              </span>
              {post.engagement_rate !== null &&
                post.engagement_rate !== undefined && (
                  <span className="flex items-center gap-1">
                    {post.engagement_rate.toFixed(2)}%
                    <span className="text-muted-foreground">eng. rate</span>
                  </span>
                )}
            </div>
          </div>

            {/* Caption */}
            {post.title_or_caption && (
              <div className="border-b px-5 py-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Caption
                  </div>
                  <button
                    onClick={copyCaption}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <div className="text-sm whitespace-pre-wrap line-clamp-[12]">
                  {post.title_or_caption}
                </div>
              </div>
            )}

            {/* AI tags */}
            {post.ai_tags && post.ai_tags.length > 0 && (
              <div className="border-b px-5 py-4">
                <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {post.ai_tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI description */}
            {post.ai_description && (
              <div className="border-b px-5 py-4">
                <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Summary
                </div>
                <p className="text-sm">{post.ai_description}</p>
              </div>
            )}

            {/* Vision Analysis / AI overview blocks */}
            <div className="border-b px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Vision Analysis
                </div>
                {!enrichment && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={runEnrich}
                    disabled={enriching}
                  >
                    {enriching ? "Analyzing…" : "Run analysis"}
                  </Button>
                )}
              </div>
              {enrichment ? (
                <AiOverviewBlocks blocks={enrichment.blocks} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No AI overview yet. Click &ldquo;Run analysis&rdquo; to
                  generate hook, pull-quotes, and structure.
                </p>
              )}
            </div>

            {/* Transcript collapsible */}
            {post.transcript && (
              <div className="border-b px-5 py-4">
                <button
                  onClick={() => setTranscriptOpen((v) => !v)}
                  className="flex w-full items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <span>Transcript</span>
                  {transcriptOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {transcriptOpen && (
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                    {post.transcript}
                  </div>
                )}
              </div>
            )}

            {/* Vision analysis (legacy markdown) */}
            {post.vision_analysis_md && (
              <div className="px-4 py-3">
                <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Vision (legacy)
                </div>
                <div className="text-xs">
                  <MarkdownView>{post.vision_analysis_md}</MarkdownView>
                </div>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalizeAiOverview(
  overview: AiOverview | null | undefined
): AiOverview | null {
  if (!overview || !Array.isArray(overview.blocks)) return null;
  const blocks = overview.blocks
    .filter(Boolean)
    .map((b) => normalizeAiOverviewBlock(b as AiOverviewBlock));
  return blocks.length > 0 ? { blocks } : null;
}

function normalizeAiOverviewBlock(block: AiOverviewBlock): AiOverviewBlock {
  if (block.type === "pullQuotes") {
    return { ...block, items: block.items ?? [] };
  }
  if (block.type === "structure") {
    return { ...block, stages: block.stages ?? [] };
  }
  if (block.type === "devices") {
    return { ...block, items: block.items ?? [] };
  }
  return block;
}

function AiOverviewBlocks({ blocks }: { blocks: AiOverviewBlock[] }) {
  const safeBlocks = blocks ?? [];
  if (safeBlocks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No overview blocks yet.</p>
    );
  }
  return (
    <div className="space-y-3">
      {safeBlocks.map((b, i) => (
        <BlockRow key={i} block={b} />
      ))}
    </div>
  );
}

function BlockRow({ block }: { block: AiOverviewBlock }) {
  if (block.type === "hook") {
    return (
      <div className="rounded-md border bg-card p-3">
        <div className="mb-1.5 flex items-center gap-1">
          <Badge className="bg-violet-500 text-white text-[10px]">Hook</Badge>
          <Badge variant="secondary" className="text-[10px]">
            {block.mechanic}
          </Badge>
        </div>
        <blockquote
          className={cn(
            "border-l-2 pl-2 text-sm italic",
            block.tone === "accent" ? "border-violet-500" : "border-border"
          )}
        >
          {block.openingLine}
        </blockquote>
        <div className="mt-1.5 text-xs italic text-muted-foreground">
          {block.why}
        </div>
      </div>
    );
  }
  if (block.type === "pullQuotes") {
    return (
      <div className="rounded-md border bg-card p-3">
        <div className="mb-1.5">
          <Badge className="bg-emerald-500 text-white text-[10px]">
            Pull quotes
          </Badge>
        </div>
        <ul className="space-y-1.5">
          {(block.items ?? []).map((q, i) => (
            <li
              key={i}
              className="border-l-2 border-emerald-500/40 pl-2 text-sm"
            >
              &ldquo;{q}&rdquo;
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.type === "structure") {
    return (
      <div className="rounded-md border bg-card p-3">
        <div className="mb-1.5">
          <Badge className="bg-sky-500 text-white text-[10px]">Structure</Badge>
        </div>
        <ol className="ml-4 list-decimal space-y-0.5 text-xs">
          {(block.stages ?? []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    );
  }
  if (block.type === "devices") {
    return (
      <div className="rounded-md border bg-card p-3">
        <div className="mb-1.5">
          <Badge className="bg-pink-500 text-white text-[10px]">Devices</Badge>
        </div>
        <ul className="space-y-1 text-xs">
          {(block.items ?? []).map((it, i) => (
            <li key={i}>
              <span className="font-medium">{it.label}</span>
              {it.example && (
                <span className="text-muted-foreground"> — {it.example}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.type === "format") {
    return (
      <div className="rounded-md border bg-card p-3">
        <div className="mb-1.5">
          <Badge className="bg-amber-500 text-white text-[10px]">Format</Badge>
        </div>
        <div className="text-sm">{block.label}</div>
        {block.detail && (
          <div className="text-xs text-muted-foreground">{block.detail}</div>
        )}
      </div>
    );
  }
  // generic fallback
  if (block.type === "generic") {
    return (
      <div className="rounded-md border bg-card p-3">
        <div className="mb-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {block.label}
          </Badge>
        </div>
        <div className="text-sm">{block.body}</div>
      </div>
    );
  }
  return null;
}

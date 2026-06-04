"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  ExternalLink,
  X as XIcon,
  MessageCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { mediaImg, mediaAsset } from "@/lib/proxy-image";
import type { PostWithCreator } from "@/lib/discover-types";
import type { AiOverview, AiOverviewBlock } from "@/lib/types-enrichment";
import MarkdownView from "./MarkdownView";
import SaveToBoardMenu from "./SaveToBoardMenu";
import { usePostChat } from "./post-chat";

function fmtNum(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function PostDetailModal({
  post,
  open,
  onClose,
}: {
  post: PostWithCreator;
  open: boolean;
  onClose: () => void;
}) {
  const postChat = usePostChat();
  const [saveOpen, setSaveOpen] = useState(false);
  const [tab, setTab] = useState<"caption" | "transcript" | "vision">("caption");
  const [enrichment, setEnrichment] = useState<AiOverview | null>(
    normalizeAiOverview(post.ai_overview)
  );
  const [enriching, setEnriching] = useState(false);
  // Native video playback. Instagram's reel embed shows a non-interactive
  // "Watch on Instagram" poster for some accounts, so we prefer playing the MP4
  // ourselves (parsed from raw_json server-side) and only fall back to the embed
  // when there's no usable video URL or it fails to load (e.g. an expired CDN URL).
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const thumbnail = post.thumbnail_url
    ? mediaImg(post.thumbnail_url, post.platform)
    : null;

  // Instagram embed — plays the reel / swipes the carousel inline.
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

  useEffect(() => {
    if (open) {
      fetch(`/api/post-seen/${post.id}`, { method: "POST" }).catch(() => {});
    }
  }, [open, post.id]);

  // Resolve a directly-playable video URL when the modal opens.
  useEffect(() => {
    setVideoUrl(null);
    setVideoFailed(false);
    if (!open) return;
    let cancelled = false;
    fetch(`/api/posts/${post.id}/video`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { videoUrl?: string | null } | null) => {
        if (!cancelled && d?.videoUrl) setVideoUrl(d.videoUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, post.id]);

  useEffect(() => {
    setEnrichment(normalizeAiOverview(post.ai_overview));
  }, [post.id, post.ai_overview]);

  function openChat() {
    // Close this modal so the docked split-screen chat panel is visible.
    onClose();
    postChat.open(post.id, post.creator?.handle);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
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
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
        style={{ maxHeight: "90vh" }}
      >
        <DialogTitle className="sr-only">
          {post.title_or_caption?.slice(0, 60) || "Post detail"}
        </DialogTitle>

        {/* Header — title + actions */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            {post.title_or_caption?.split("\n")[0] || "Post"}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={openChat}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent>Chat about this post</TooltipContent>
            </Tooltip>
            <div className="relative">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => setSaveOpen((v) => !v)}
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                  }
                />
                <TooltipContent>Add to board</TooltipContent>
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
        </div>

        {/* Body — scrollable */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ maxHeight: "calc(90vh - 57px)" }}
        >
          {/* Media */}
          <div className="flex items-center justify-center bg-black p-4">
            {videoUrl && !videoFailed ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={videoUrl}
                src={mediaAsset(videoUrl, post.platform)}
                poster={thumbnail || undefined}
                controls
                autoPlay
                playsInline
                onError={() => setVideoFailed(true)}
                className="block max-h-[70vh] w-auto max-w-full rounded"
              />
            ) : embedUrl ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title="Instagram post"
                loading="lazy"
                allowFullScreen
                scrolling="no"
                className="block w-full max-w-[400px] rounded border-0 bg-white"
                style={{ height: 560 }}
              />
            ) : thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt=""
                className="max-h-[55vh] w-auto rounded"
              />
            ) : null}
          </div>

          <div className="space-y-4 p-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
              <Stat
                label="vs views"
                value={
                  post.outlier_multiplier
                    ? `${post.outlier_multiplier.toFixed(2)}×`
                    : "–"
                }
                highlight={
                  !!post.outlier_multiplier && post.outlier_multiplier >= 2
                }
              />
              <Stat label="views" value={fmtNum(post.view_count)} />
              <Stat label="likes" value={fmtNum(post.like_count)} />
              <Stat label="comments" value={fmtNum(post.comment_count)} />
              <Stat
                label="eng. rate"
                value={
                  post.engagement_rate
                    ? `${post.engagement_rate.toFixed(2)}%`
                    : "–"
                }
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b">
              <TabBtn
                active={tab === "caption"}
                onClick={() => setTab("caption")}
                label="Caption"
              />
              <TabBtn
                active={tab === "transcript"}
                onClick={() => setTab("transcript")}
                label={`Transcript${post.transcript ? " ✓" : ""}`}
              />
              <TabBtn
                active={tab === "vision"}
                onClick={() => setTab("vision")}
                label={`Vision${enrichment ? " ✓" : ""}`}
              />
            </div>

            {tab === "caption" &&
              (post.title_or_caption ? (
                <div className="relative">
                  <button
                    onClick={() => copyText(post.title_or_caption || "")}
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <p className="whitespace-pre-wrap rounded-md border bg-background p-3 pr-16 text-sm">
                    {post.title_or_caption}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">(no caption)</p>
              ))}

            {tab === "transcript" &&
              (post.transcript ? (
                <div className="relative">
                  <button
                    onClick={() => copyText(post.transcript || "")}
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <p className="whitespace-pre-wrap rounded-md border bg-background p-3 pr-16 text-sm">
                    {post.transcript}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transcript stored for this post.
                </p>
              ))}

            {tab === "vision" &&
              (enrichment ? (
                <AiOverviewBlocks blocks={enrichment.blocks} />
              ) : post.vision_analysis_md ? (
                <div className="rounded-md border bg-background p-4 text-sm">
                  <MarkdownView>{post.vision_analysis_md}</MarkdownView>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={runEnrich}
                    disabled={enriching}
                  >
                    {enriching ? "Analyzing…" : "Run analysis"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Generate hook, pull-quotes, and structure.
                  </span>
                </div>
              ))}

            {post.published_at && (
              <div className="text-xs text-muted-foreground">
                Posted {new Date(post.published_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-2.5 py-2",
        highlight && "border-amber-400/60 bg-amber-50 dark:bg-amber-400/10"
      )}
    >
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          highlight && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border-b-2 px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
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
                <span className="text-muted-foreground">: {it.example}</span>
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

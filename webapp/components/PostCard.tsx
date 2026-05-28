"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart,
  MessageSquare,
  Eye,
  Zap,
  Bookmark,
  Columns3,
  BadgeCheck,
} from "lucide-react";
import type { PostWithCreator } from "@/lib/discover-types";
import { igImg, mediaImg } from "@/lib/proxy-image";
import { openInWorkspaceUrl } from "@/lib/panes";
import {
  postCardVariant,
  thumbnailLayout,
  viewsLabel,
  type PostCardVariant,
} from "@/lib/post-card-layout";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import BoostMenu from "./BoostMenu";
import SaveToBoardMenu from "./SaveToBoardMenu";
import PostDetailModal from "./PostDetailModal";
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

const PLATFORM_MARK: Record<
  PostCardVariant,
  { label: string; className: string }
> = {
  instagram: { label: "IG", className: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white" },
  youtube: { label: "YT", className: "bg-red-600 text-white" },
  tiktok: { label: "TT", className: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" },
  twitter: { label: "𝕏", className: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" },
  substack: { label: "S", className: "bg-orange-500 text-white" },
  linkedin: { label: "in", className: "bg-sky-700 text-white" },
  default: { label: "•", className: "bg-muted text-muted-foreground" },
};

function thumbSrc(post: PostWithCreator): string | undefined {
  if (!post.thumbnail_url) return undefined;
  return mediaImg(post.thumbnail_url, post.platform) || undefined;
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
  const [boostOpen, setBoostOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const variant = postCardVariant(post);
  const layout = thumbnailLayout(post);
  const c = post.creator;
  const isHighOutlier =
    post.outlier_multiplier !== null && post.outlier_multiplier >= 2;
  const platformMark = PLATFORM_MARK[variant];
  const caption = post.title_or_caption || "";
  const src = thumbSrc(post);
  const showThumb = Boolean(src) || !layout.thumbnailOptional;

  async function markSeen() {
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

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="group relative flex flex-col overflow-hidden p-0 card-hover hover:border-primary/40 hover:shadow-md transition-all">
        <CardBody
          post={post}
          variant={variant}
          layout={layout}
          caption={caption}
          src={src}
          showThumb={showThumb}
          isHighOutlier={isHighOutlier}
          platformMark={platformMark}
          onOpen={openDetail}
          onSave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSaveOpen((v) => !v);
            setBoostOpen(false);
          }}
        />

        <CardToolbar post={post} variant={variant} onBoost={() => {
            setBoostOpen((v) => !v);
            setSaveOpen(false);
          }} />

        {boostOpen && (
          <BoostMenu postId={post.id} onClose={() => setBoostOpen(false)} />
        )}
        {saveOpen && (
          <SaveToBoardMenu
            creatorPostId={post.id}
            onClose={() => setSaveOpen(false)}
          />
        )}
      </Card>

      <PostDetailModal
        post={post}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </motion.div>
  );
}

function CardToolbar({
  post,
  variant,
  onBoost,
}: {
  post: PostWithCreator;
  variant: PostCardVariant;
  onBoost: () => void;
}) {
  const compact = variant === "youtube" || variant === "substack";

  return (
    <div
      className={cn(
        "absolute z-10 flex items-center gap-0.5",
        compact ? "right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity" : "right-2 top-2"
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={onBoost}
              className="rounded p-1 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors bg-card/80 backdrop-blur-sm"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          }
        />
        <TooltipContent>Boost</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={openInWorkspaceUrl({ kind: "post", id: post.id })}
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors bg-card/80 backdrop-blur-sm"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <TooltipContent>Open in workspace pane</TooltipContent>
      </Tooltip>
    </div>
  );
}

function CardBody({
  post,
  variant,
  layout,
  caption,
  src,
  showThumb,
  isHighOutlier,
  platformMark,
  onOpen,
  onSave,
}: {
  post: PostWithCreator;
  variant: PostCardVariant;
  layout: ReturnType<typeof thumbnailLayout>;
  caption: string;
  src: string | undefined;
  showThumb: boolean;
  isHighOutlier: boolean;
  platformMark: { label: string; className: string };
  onOpen: () => void;
  onSave: (e: React.MouseEvent) => void;
}) {
  switch (variant) {
    case "youtube":
      return (
        <YoutubeBody
          post={post}
          layout={layout}
          caption={caption}
          src={src}
          isHighOutlier={isHighOutlier}
          platformMark={platformMark}
          onOpen={onOpen}
          onSave={onSave}
        />
      );
    case "twitter":
      return (
        <TwitterBody
          post={post}
          layout={layout}
          caption={caption}
          src={src}
          isHighOutlier={isHighOutlier}
          platformMark={platformMark}
          onOpen={onOpen}
        />
      );
    case "substack":
      return (
        <SubstackBody
          post={post}
          layout={layout}
          caption={caption}
          src={src}
          isHighOutlier={isHighOutlier}
          platformMark={platformMark}
          onOpen={onOpen}
        />
      );
    default:
      return (
        <DefaultBody
          post={post}
          variant={variant}
          layout={layout}
          caption={caption}
          src={src}
          showThumb={showThumb}
          isHighOutlier={isHighOutlier}
          platformMark={platformMark}
          onOpen={onOpen}
          onSave={onSave}
        />
      );
  }
}

/** Clickable card region — div (not button) so nested action buttons stay valid HTML. */
function CardClickArea({
  onOpen,
  className,
  children,
}: {
  onOpen: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn("flex flex-col text-left cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

function ThumbnailPlaceholder({
  layout,
  variant,
  className,
}: {
  layout: ReturnType<typeof thumbnailLayout>;
  variant?: PostCardVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/40 dark:to-muted",
        layout.aspectClass || "aspect-video min-h-[120px]",
        className
      )}
    >
      <span
        className={cn(
          "text-2xl font-bold",
          variant === "substack" ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
        )}
      >
        {variant === "substack" ? "S" : "·"}
      </span>
    </div>
  );
}

function ThumbnailBlock({
  src,
  layout,
  mediaType,
  onSave,
  className,
  variant,
}: {
  src?: string;
  layout: ReturnType<typeof thumbnailLayout>;
  mediaType?: string | null;
  onSave?: (e: React.MouseEvent) => void;
  className?: string;
  variant?: PostCardVariant;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ThumbnailPlaceholder layout={layout} variant={variant} className={className} />;
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        layout.aspectClass
          ? "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          : "w-full h-auto max-h-[28rem] object-cover transition-transform duration-300 group-hover:scale-[1.01]",
        layout.objectFit === "contain" && "object-contain bg-muted"
      )}
    />
  );

  return (
    <div
      className={cn(
        "relative bg-muted overflow-hidden",
        layout.aspectClass,
        className
      )}
    >
      {img}
      {mediaType && layout.aspectClass && (
        <Badge
          variant="secondary"
          className="absolute left-2 top-2 bg-black/60 text-white hover:bg-black/60 px-1.5 py-0 text-[10px]"
        >
          {mediaType}
        </Badge>
      )}
      {onSave && layout.aspectClass && (
        <button
          type="button"
          onClick={onSave}
          className="absolute right-2 bottom-2 grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100"
        >
          <Bookmark className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function OutlierPill({ value }: { value: number }) {
  return (
    <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 dark:bg-pink-500/15 dark:text-pink-300 px-1.5 py-0 text-[10px] font-semibold border border-pink-200/60 dark:border-pink-400/20 shrink-0">
      {value >= 10 ? Math.round(value) : value.toFixed(1)}×
    </Badge>
  );
}

function StatsRow({
  post,
  isHighOutlier,
  className,
}: {
  post: PostWithCreator;
  isHighOutlier: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-[11px] text-muted-foreground tabular-nums",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isHighOutlier && post.outlier_multiplier != null && (
          <OutlierPill value={post.outlier_multiplier} />
        )}
        <span className="flex items-center gap-0.5" title="likes">
          <Heart className="h-3 w-3" /> {fmtNum(post.like_count)}
        </span>
        <span className="flex items-center gap-0.5" title="comments">
          <MessageSquare className="h-3 w-3" /> {fmtNum(post.comment_count)}
        </span>
        {post.view_count > 0 && (
          <span className="flex items-center gap-0.5" title="views">
            <Eye className="h-3 w-3" /> {fmtNum(post.view_count)}
          </span>
        )}
      </div>
      <span className="shrink-0">{fmtAge(post.published_at)}</span>
    </div>
  );
}

function PlatformMark({
  mark,
  className,
}: {
  mark: { label: string; className: string };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-bold",
        mark.className,
        className
      )}
    >
      {mark.label}
    </span>
  );
}

function CreatorAvatar({
  post,
  size = "sm",
}: {
  post: PostWithCreator;
  size?: "sm" | "md";
}) {
  const c = post.creator;
  const cls = size === "md" ? "h-8 w-8" : "h-6 w-6";
  return (
    <Avatar className={cls}>
      <AvatarImage
        src={
          c.avatar_url
            ? post.platform === "instagram"
              ? igImg(c.avatar_url)
              : c.avatar_url
            : undefined
        }
        alt=""
      />
      <AvatarFallback className="text-[10px]">
        {c.handle.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/** Instagram / TikTok / LinkedIn / default — header + media + stats. */
function DefaultBody({
  post,
  variant,
  layout,
  caption,
  src,
  showThumb,
  isHighOutlier,
  platformMark,
  onOpen,
  onSave,
}: {
  post: PostWithCreator;
  variant: PostCardVariant;
  layout: ReturnType<typeof thumbnailLayout>;
  caption: string;
  src?: string;
  showThumb: boolean;
  isHighOutlier: boolean;
  platformMark: { label: string; className: string };
  onOpen: () => void;
  onSave: (e: React.MouseEvent) => void;
}) {
  const c = post.creator;

  return (
    <CardClickArea onOpen={onOpen}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <CreatorAvatar post={post} />
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <span className="text-xs font-medium truncate">
            {c.display_name || `@${c.handle}`}
          </span>
          {c.is_verified && (
            <BadgeCheck className="h-3 w-3 shrink-0 text-sky-500" />
          )}
        </div>
        <PlatformMark mark={platformMark} />
      </div>

      {showThumb && (
        <ThumbnailBlock
          src={src}
          layout={layout}
          mediaType={post.media_type}
          onSave={onSave}
        />
      )}

      <div className="flex flex-1 flex-col p-2">
        <StatsRow post={post} isHighOutlier={isHighOutlier} />
        {caption && (
          <div className="mt-1 line-clamp-2 text-xs">
            {variant === "instagram" && (
              <span className="font-medium">@{c.handle} </span>
            )}
            {caption}
          </div>
        )}
      </div>
    </CardClickArea>
  );
}

/** YouTube — 16:9 thumb, title + channel below (Eden layout). */
function YoutubeBody({
  post,
  layout,
  caption,
  src,
  isHighOutlier,
  platformMark,
  onOpen,
  onSave,
}: {
  post: PostWithCreator;
  layout: ReturnType<typeof thumbnailLayout>;
  caption: string;
  src?: string;
  isHighOutlier: boolean;
  platformMark: { label: string; className: string };
  onOpen: () => void;
  onSave: (e: React.MouseEvent) => void;
}) {
  const c = post.creator;
  const views = viewsLabel(post);

  return (
    <CardClickArea onOpen={onOpen}>
      <ThumbnailBlock src={src} layout={layout} onSave={onSave} />

      <div className="flex flex-1 gap-2 p-2.5">
        <CreatorAvatar post={post} size="md" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-xs font-semibold leading-snug">
            {caption || "Untitled video"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {c.display_name || c.handle}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            {views && <span>{views}</span>}
            {views && post.published_at && <span>·</span>}
            {post.published_at && <span>{fmtAge(post.published_at)}</span>}
            {isHighOutlier && post.outlier_multiplier != null && (
              <OutlierPill value={post.outlier_multiplier} />
            )}
          </div>
        </div>
        <PlatformMark mark={platformMark} className="self-end shrink-0" />
      </div>
    </CardClickArea>
  );
}

/** X / Twitter — text first, natural-aspect media below. */
function TwitterBody({
  post,
  layout,
  caption,
  src,
  isHighOutlier,
  platformMark,
  onOpen,
}: {
  post: PostWithCreator;
  layout: ReturnType<typeof thumbnailLayout>;
  caption: string;
  src?: string;
  isHighOutlier: boolean;
  platformMark: { label: string; className: string };
  onOpen: () => void;
}) {
  const c = post.creator;

  return (
    <CardClickArea onOpen={onOpen}>
      <div className="flex gap-2 p-3 pb-2">
        <CreatorAvatar post={post} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold">
                {c.display_name || c.handle}
              </span>
              <span className="ml-1 text-[11px] text-muted-foreground">
                @{c.handle}
              </span>
              {post.published_at && (
                <span className="text-[11px] text-muted-foreground">
                  {" "}
                  · {fmtAge(post.published_at)}
                </span>
              )}
            </div>
            <PlatformMark mark={platformMark} className="shrink-0" />
          </div>
          {caption && (
            <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap">
              {caption}
            </p>
          )}
        </div>
      </div>

      {src && (
        <div className="px-3 pb-2">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <ThumbnailBlock src={src} layout={layout} />
          </div>
        </div>
      )}

      <div className="mt-auto border-t px-3 py-2">
        <StatsRow post={post} isHighOutlier={isHighOutlier} />
      </div>
    </CardClickArea>
  );
}

/** Substack — 16:9 hero or text-only article card. */
function SubstackBody({
  post,
  layout,
  caption,
  src,
  isHighOutlier,
  platformMark,
  onOpen,
}: {
  post: PostWithCreator;
  layout: ReturnType<typeof thumbnailLayout>;
  caption: string;
  src?: string;
  isHighOutlier: boolean;
  platformMark: { label: string; className: string };
  onOpen: () => void;
}) {
  const c = post.creator;
  const lines = caption.split("\n").filter(Boolean);
  const title = lines[0] || "Untitled";
  const excerpt = lines.slice(1).join(" ").trim() || lines[0] || "";

  return (
    <CardClickArea onOpen={onOpen}>
      <ThumbnailBlock
        src={src}
        layout={layout}
        variant="substack"
        className="rounded-none"
      />

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title}</h3>
        {excerpt && title !== excerpt && (
          <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground leading-relaxed">
            {excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <CreatorAvatar post={post} />
            <span className="truncate text-[11px] font-medium">
              {c.display_name || c.handle}
            </span>
          </div>
          <PlatformMark mark={platformMark} />
        </div>

        <StatsRow post={post} isHighOutlier={isHighOutlier} className="mt-2" />
      </div>
    </CardClickArea>
  );
}

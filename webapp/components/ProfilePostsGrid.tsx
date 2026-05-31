"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { toast } from "sonner";
import { MessageCircle, Bookmark } from "lucide-react";
import MarkdownView from "./MarkdownView";
import SaveToBoardMenu from "./SaveToBoardMenu";
import { igImg } from "@/lib/proxy-image";

export type ProfilePost = {
  id: string;
  media_pk: string;
  code: string | null;
  url: string;
  type: "Post" | "Reel" | "Carousel" | "IGTV";
  caption: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  play_count: number;
  taken_at: string | null;
  thumbnail_url: string | null;
  engagement_rate: number | null;
  outlier_multiplier: number | null;
  transcript: string | null;
  vision_analysis_md: string | null;
  /** Dual-written creator_posts id — powers Chat / Add-to-board. */
  creator_post_id?: string | null;
};

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

export default function ProfilePostsGrid({ posts }: { posts: ProfilePost[] }) {
  const [open, setOpen] = useState<ProfilePost | null>(null);

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
        No posts match these filters.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((p) => (
          <ProfileCard key={p.id} post={p} onOpen={() => setOpen(p)} />
        ))}
      </div>

      {open && (
        <PostModal
          post={open}
          onClose={() => setOpen(null)}
          onUpdate={(patch) =>
            setOpen((cur) => (cur ? { ...cur, ...patch } : cur))
          }
        />
      )}
    </>
  );
}

function ProfileCard({
  post,
  onOpen,
}: {
  post: ProfilePost;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const cpId = post.creator_post_id ?? null;

  async function openChat() {
    if (!cpId || chatBusy) return;
    setChatBusy(true);
    const t = toast.loading("Starting chat…");
    try {
      const res = await fetch("/api/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: cpId, chat: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.chat_id) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.dismiss(t);
      router.push(`/chats/${data.chat_id}`);
    } catch (e) {
      toast.error("Couldn't start chat", { id: t, description: String(e) });
      setChatBusy(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--primary)]">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[4/5] bg-zinc-200 dark:bg-zinc-800">
          {post.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={igImg(post.thumbnail_url)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {post.type}
          </div>
          <div className="absolute right-2 bottom-2 flex gap-1">
            {post.transcript && (
              <span
                title="Has transcript"
                className="rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] font-semibold text-white"
              >
                T
              </span>
            )}
            {post.vision_analysis_md && (
              <span
                title="Has vision analysis"
                className="rounded bg-sky-500/90 px-1 py-0.5 text-[9px] font-semibold text-white"
              >
                V
              </span>
            )}
          </div>
        </div>
        <div className="p-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] tabular-nums">
            <div className="flex items-center gap-2">
              <span title="likes">♡ {fmtNum(post.like_count)}</span>
              <span title="comments">💬 {fmtNum(post.comment_count)}</span>
              {post.view_count > 0 && (
                <span title="views">▶ {fmtNum(post.view_count)}</span>
              )}
            </div>
            <span>{fmtAge(post.taken_at)}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-[var(--foreground)]">
            {post.caption || ""}
          </div>
        </div>
      </button>

      {/* Top-right overlay: hover actions (Chat / Add to board) + outlier badge */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        {cpId && (
          <div className="pointer-events-none flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
            <button
              onClick={openChat}
              disabled={chatBusy}
              title="Chat about this post"
              className="rounded-md bg-[var(--card)]/80 p-1.5 text-[var(--muted-foreground)] backdrop-blur-sm transition-colors hover:text-emerald-500 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSaveOpen((v) => !v);
              }}
              title="Add to board"
              className="rounded-md bg-[var(--card)]/80 p-1.5 text-[var(--muted-foreground)] backdrop-blur-sm transition-colors hover:text-sky-500"
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        )}
        {post.outlier_multiplier !== null && post.outlier_multiplier >= 2 && (
          <span className="pointer-events-none rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
            {post.outlier_multiplier.toFixed(2)}×
          </span>
        )}
      </div>

      {saveOpen && cpId && (
        <SaveToBoardMenu creatorPostId={cpId} onClose={() => setSaveOpen(false)} />
      )}
    </div>
  );
}

function PostModal({
  post,
  onClose,
  onUpdate,
}: {
  post: ProfilePost;
  onClose: () => void;
  onUpdate: (patch: Partial<ProfilePost>) => void;
}) {
  const [tabState, setTabState] = useState<"caption" | "transcript" | "vision">(
    "caption"
  );
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function transcribe() {
    setErr(null);
    setTranscribing(true);
    setTabState("transcript");
    try {
      const res = await fetch(
        `/api/profile-posts/${post.id}/transcribe`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onUpdate({ transcript: data.transcript });
    } catch (e) {
      setErr(String(e));
    } finally {
      setTranscribing(false);
    }
  }

  async function analyze() {
    setErr(null);
    setAnalyzing(true);
    setTabState("vision");
    try {
      const res = await fetch(`/api/profile-posts/${post.id}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onUpdate({ vision_analysis_md: data.vision_analysis_md });
    } catch (e) {
      setErr(String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const isReelLike = post.type === "Reel" || post.type === "IGTV";

  // Instagram embed — plays the reel / swipes the carousel inline (same as the
  // Discover modal). Resolve the shortcode from `code` or the post URL.
  const igCode =
    post.code || post.url.match(/\/(?:p|reel|reels|tv)\/([^/?#]+)/)?.[1] || null;
  const embedUrl = igCode
    ? `https://www.instagram.com/${post.type === "Reel" ? "reel" : "p"}/${igCode}/embed`
    : null;

  // Portal to <body> so the fixed overlay centers on the viewport instead of
  // anchoring to a transformed ancestor (the page-entry animation), which made
  // it open partway down the page.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sticky top-0 bg-[var(--card)] z-10">
          <div className="truncate text-sm font-medium">
            {post.caption?.split("\n")[0]?.slice(0, 80) || `${post.type} post`}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--border)]/30"
            >
              Open ↗
            </a>
            <button
              onClick={onClose}
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--border)]/30"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="bg-black p-4 flex items-center justify-center">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title="Instagram post"
              loading="lazy"
              allowFullScreen
              scrolling="no"
              className="block w-full max-w-[400px] rounded border-0 bg-white"
              style={{ height: 600 }}
            />
          ) : post.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={igImg(post.thumbnail_url)}
              alt=""
              className="max-h-[50vh] w-auto rounded"
            />
          ) : (
            <div className="aspect-[4/5] w-full max-w-md bg-zinc-800 rounded" />
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <Stat
              label="vs views"
              value={
                post.outlier_multiplier
                  ? `${post.outlier_multiplier.toFixed(2)}×`
                  : "—"
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
                  : "—"
              }
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-[var(--border)]">
            <TabButton
              active={tabState === "caption"}
              onClick={() => setTabState("caption")}
              label="Caption"
            />
            <TabButton
              active={tabState === "transcript"}
              onClick={() => setTabState("transcript")}
              label={`Transcript${post.transcript ? " ✓" : ""}`}
              disabled={!isReelLike}
              title={!isReelLike ? "Reels only" : undefined}
            />
            <TabButton
              active={tabState === "vision"}
              onClick={() => setTabState("vision")}
              label={`Vision${post.vision_analysis_md ? " ✓" : ""}`}
            />
          </div>

          {err && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>
          )}

          {tabState === "caption" && (
            <div>
              {post.caption ? (
                <div className="relative">
                  <CopyButton
                    text={post.caption}
                    className="absolute right-2 top-2"
                  />
                  <p className="whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-3 pr-16 text-sm">
                    {post.caption}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">(no caption)</p>
              )}
            </div>
          )}

          {tabState === "transcript" && (
            <div>
              {post.transcript ? (
                <div className="relative">
                  <CopyButton
                    text={post.transcript}
                    className="absolute right-2 top-2"
                  />
                  <p className="whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-3 pr-16 text-sm">
                    {post.transcript}
                  </p>
                </div>
              ) : !isReelLike ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Transcripts are only generated for Reels and IGTV.
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={transcribe}
                    disabled={transcribing}
                    className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
                  >
                    {transcribing
                      ? "Transcribing… (15-45s)"
                      : "Generate transcript"}
                  </button>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Re-fetches the reel, runs Gemini audio understanding, saves
                    to DB.
                  </span>
                </div>
              )}
            </div>
          )}

          {tabState === "vision" && (
            <div>
              {post.vision_analysis_md ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
                  <MarkdownView>{post.vision_analysis_md}</MarkdownView>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
                  >
                    {analyzing
                      ? "Analyzing… (20-60s)"
                      : "Run vision analysis"}
                  </button>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    8-section deconstruction: hook, structure, on-screen text,
                    audio, technique, tools, takeaway.
                  </span>
                </div>
              )}
            </div>
          )}

          {post.taken_at && (
            <div className="text-xs text-[var(--muted-foreground)]">
              Posted {new Date(post.taken_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function TabButton({
  active,
  onClick,
  label,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "border-b-2 px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-[var(--primary)] text-[var(--foreground)] font-medium"
          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {label}
    </button>
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
      className={clsx(
        "rounded-md border border-[var(--border)] p-2",
        highlight && "border-amber-400/60 bg-amber-400/10"
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={clsx(
        "rounded border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--border)]/30",
        className
      )}
    >
      {done ? "✓ Copied" : "Copy"}
    </button>
  );
}

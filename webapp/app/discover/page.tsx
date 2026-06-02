import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import DiscoverFilters from "@/components/DiscoverFilters";
import DiscoverSearchBar from "@/components/DiscoverSearchBar";
import PillarChips from "@/components/PillarChips";
import type { PostWithCreator } from "@/lib/discover-types";
import { discover } from "@/lib/discover-engine";
import { ingestWebSearchForQuery } from "@/lib/web-search";
import type { WebSearchIngestResult } from "@/lib/web-search";
import {
  DEFAULT_MIN_OUTLIER,
  DEFAULT_DISCOVER_RANGE,
  rangeCutoff,
} from "@/lib/discover-url";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  platform?: string;
  pillar?: string;
  min_outlier?: string;
  range?: string;
  hide_seen?: string;
  hide_images?: string;
  sort?: string;
  tab?: string;
  q?: string;
  web?: string;
}>;

const TOP_TABS = [
  { id: "discover", label: "Discover", href: "/discover" },
  { id: "creators", label: "Creators", href: "/creators" },
  { id: "lists", label: "My Lists", href: "/creators?lists=1" },
];

async function queryDiscoverPosts(
  sb: ReturnType<typeof getSupabase>,
  workspaceId: string,
  opts: {
    platforms: string[] | null;
    pillarId: string;
    minOutlier: number;
    range: string;
    sort: string;
    hideSeen: boolean;
    hideImages: boolean;
    q: string;
  }
): Promise<{ posts: PostWithCreator[]; totalCount: number }> {
  let q = sb
    .from("creator_posts")
    .select(
      "id, platform, platform_pk, code, url, media_type, title_or_caption, like_count, comment_count, view_count, play_count, engagement_rate, outlier_multiplier, published_at, thumbnail_url, transcript, vision_analysis_md, pillar_id, taxonomy_id, taxonomy_label, taxonomy_tier1, content_type_label, media_format, mood, ai_tags, ai_description, ai_overview, enriched_at, creator:creators!inner(id, handle, display_name, follower_count, avatar_url, is_verified, platform, workspace_id)",
      { count: "exact" }
    )
    .eq("creators.workspace_id", workspaceId);

  if (opts.platforms) q = q.in("platform", opts.platforms);
  if (opts.pillarId !== "all") q = q.eq("pillar_id", opts.pillarId);
  if (opts.minOutlier > 0) q = q.gte("outlier_multiplier", opts.minOutlier);
  const cutoff = rangeCutoff(opts.range);
  if (cutoff) q = q.gte("published_at", cutoff);
  if (opts.q) {
    q = q.ilike("title_or_caption", `%${opts.q}%`);
  }

  switch (opts.sort) {
    case "recent":
      q = q.order("published_at", { ascending: false, nullsFirst: false });
      break;
    case "top_liked":
      q = q.order("like_count", { ascending: false });
      break;
    case "top_viewed":
      q = q.order("view_count", { ascending: false });
      break;
    case "outlier":
    default:
      q = q.order("outlier_multiplier", {
        ascending: false,
        nullsFirst: false,
      });
  }

  q = q.limit(120);
  const { data, count } = await q;
  let posts = (data || []) as unknown as PostWithCreator[];
  const totalCount = count || 0;

  if (opts.hideImages) {
    posts = posts.filter(
      (p) => p.media_type !== "image" && p.media_type !== "carousel"
    );
  }

  if (opts.hideSeen && posts.length > 0) {
    const ids = posts.map((r) => r.id);
    const seenRes = await sb
      .from("post_seen")
      .select("post_id")
      .eq("workspace_id", workspaceId)
      .in("post_id", ids);
    const seenIds = new Set(
      (seenRes.data || []).map((r) => (r as { post_id: string }).post_id)
    );
    posts = posts.filter((p) => !seenIds.has(p.id));
  }

  return { posts, totalCount };
}

function sortPosts(
  posts: PostWithCreator[],
  sort: string
): PostWithCreator[] {
  const copy = [...posts];
  switch (sort) {
    case "recent":
      copy.sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
        return tb - ta;
      });
      break;
    case "top_liked":
      copy.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      break;
    case "top_viewed":
      copy.sort(
        (a, b) =>
          (b.view_count || b.play_count || 0) -
          (a.view_count || a.play_count || 0)
      );
      break;
    case "outlier":
    default:
      copy.sort(
        (a, b) => (b.outlier_multiplier || 0) - (a.outlier_multiplier || 0)
      );
  }
  return copy;
}

async function querySemanticDiscoverPosts(
  workspaceId: string,
  opts: {
    platforms: string[] | null;
    pillarId: string;
    minOutlier: number;
    range: string;
    sort: string;
    hideSeen: boolean;
    hideImages: boolean;
    q: string;
    fetchWeb: boolean;
  }
): Promise<{
  posts: PostWithCreator[];
  totalCount: number;
  semantic: boolean;
  webSearch: WebSearchIngestResult | null;
}> {
  const sb = getSupabase();

  // Web-search ingestion is opt-in (?web=1). Without it, the keyword
  // search only ranks against the workspace's existing creator_posts
  // and does NOT auto-create new creator rows for every author found.
  // Toggle exposed in the UI as "Pull fresh posts from the web".
  const webSearch = opts.fetchWeb
    ? await ingestWebSearchForQuery(opts.q, opts.platforms, workspaceId, {
        count: 30,
      })
    : null;

  const result = await discover({
    q: opts.q,
    platforms: opts.platforms || undefined,
    minOutlier: opts.q.trim() ? 0 : opts.minOutlier,
    since: rangeCutoff(opts.range) || undefined,
    workspaceId,
    limit: 120,
  });

  let posts = result.content;
  if (opts.pillarId !== "all") {
    posts = posts.filter((p) => p.pillar_id === opts.pillarId);
  }
  if (opts.hideImages) {
    posts = posts.filter(
      (p) => p.media_type !== "image" && p.media_type !== "carousel"
    );
  }
  posts = sortPosts(posts, opts.sort);

  if (opts.hideSeen && posts.length > 0) {
    const ids = posts.map((r) => r.id);
    const seenRes = await sb
      .from("post_seen")
      .select("post_id")
      .eq("workspace_id", workspaceId)
      .in("post_id", ids);
    const seenIds = new Set(
      (seenRes.data || []).map((r) => (r as { post_id: string }).post_id)
    );
    posts = posts.filter((p) => !seenIds.has(p.id));
  }

  return { posts, totalCount: posts.length, semantic: true, webSearch };
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const platforms =
    sp.platform === "all" || !sp.platform
      ? null
      : sp.platform.split(",").map((s) => s.trim()).filter(Boolean);
  const pillarId = sp.pillar || "all";
  const minOutlier = sp.min_outlier != null
    ? parseFloat(sp.min_outlier)
    : parseFloat(DEFAULT_MIN_OUTLIER);
  const range = sp.range || DEFAULT_DISCOVER_RANGE;
  const hideSeen = sp.hide_seen === "1";
  const hideImages = sp.hide_images === "1";
  const sort = sp.sort || "outlier";
  const q = sp.q?.trim() || "";
  const usingDefaultOutlier = sp.min_outlier == null;
  // ?web=1 → ingest fresh creators+posts from YT/IG/X for this query.
  // Off by default to prevent the search box from auto-adding 100+
  // creators to the workspace every time someone types a topic.
  const fetchWeb = sp.web === "1";

  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  const pillarsRes = ws.workspaceId
    ? await sb
        .from("pillars")
        .select("*")
        .eq("workspace_id", ws.workspaceId)
        .order("position", { ascending: true })
    : { data: [] };
  const pillars = (pillarsRes.data || []) as {
    id: string;
    name: string;
    color: string;
  }[];

  const queryOpts = {
    platforms,
    pillarId,
    minOutlier,
    range,
    sort,
    hideSeen,
    hideImages,
    q,
    fetchWeb,
  };

  let postsResults: PostWithCreator[] = [];
  let totalCount = 0;
  let relaxedOutlier = false;
  let usingSemanticSearch = false;
  let webSearchResult: WebSearchIngestResult | null = null;

  if (ws.workspaceId) {
    if (q) {
      const semantic = await querySemanticDiscoverPosts(
        ws.workspaceId,
        queryOpts
      );
      postsResults = semantic.posts;
      totalCount = semantic.totalCount;
      usingSemanticSearch = true;
      webSearchResult = semantic.webSearch;
    } else {
      const first = await queryDiscoverPosts(sb, ws.workspaceId, queryOpts);
      postsResults = first.posts;
      totalCount = first.totalCount;

      if (
        postsResults.length === 0 &&
        usingDefaultOutlier &&
        minOutlier >= parseFloat(DEFAULT_MIN_OUTLIER) &&
        !q
      ) {
        const relaxed = await queryDiscoverPosts(sb, ws.workspaceId, {
          ...queryOpts,
          minOutlier: 0,
        });
        if (relaxed.posts.length > 0) {
          postsResults = relaxed.posts;
          totalCount = relaxed.totalCount;
          relaxedOutlier = true;
        }
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* Eden: search bar at top */}
      <DiscoverSearchBar sp={sp} basePath="/discover" />

      {/* Top tabs: Discover / Creators / My Lists */}
      <header className="flex items-center gap-6 text-2xl font-semibold border-b pb-2">
        {TOP_TABS.map((t) => {
          const active = t.id === "discover";
          return (
            <Link
              key={t.id}
              href={t.href}
              className={
                active
                  ? "relative text-foreground after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </header>

      {/* Pillar chip row */}
      <PillarChips pillars={pillars} activeId={pillarId} basePath="/discover" sp={sp} />

      {usingSemanticSearch && q && (
        <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground space-y-1">
          <p>
            Searching your library <span className="text-foreground/80">and</span>{" "}
            pulling new videos from Instagram, YouTube, and X for &ldquo;{q}
            &rdquo;.
          </p>
          {webSearchResult && (
            <p className="text-foreground/70">
              {webSearchResult.totalIngested > 0 ? (
                <>
                  Added {webSearchResult.totalIngested} new post
                  {webSearchResult.totalIngested === 1 ? "" : "s"} from the web
                  {formatWebIngestBreakdown(webSearchResult)}.
                </>
              ) : (
                <>
                  No new web results indexed
                  {webSearchResult.instagram.warning && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      Instagram: {webSearchResult.instagram.warning}
                    </span>
                  )}
                  {webSearchResult.x.warning && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      X: {webSearchResult.x.warning}
                    </span>
                  )}
                  {webSearchResult.youtube.warning && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      YouTube: {webSearchResult.youtube.warning}
                    </span>
                  )}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {relaxedOutlier && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-muted-foreground">
          No posts met the default {DEFAULT_MIN_OUTLIER}× outlier filter — showing
          all posts instead.{" "}
          <Link
            href={buildDiscoverKeepAllHref(sp)}
            className="font-medium text-foreground underline hover:no-underline"
          >
            Keep showing all
          </Link>
        </div>
      )}

      <DiscoverFilters
        sp={sp}
        basePath="/discover"
        totalCount={totalCount}
        shown={postsResults.length}
      />

      {postsResults.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <p>No posts match these filters.</p>
          {totalCount > 0 && hideSeen && (
            <p className="mt-2 text-xs">
              ({totalCount} hidden by &ldquo;hide seen&rdquo;)
            </p>
          )}
          {minOutlier > 0 && (
            <Link
              href="/discover?min_outlier=0"
              className="mt-4 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Show all posts
            </Link>
          )}
        </div>
      ) : (
        <MasonryGrid>
          {postsResults.map((p) => (
            <MasonryItem key={p.id}>
              <PostCard post={p} surface="discover" />
            </MasonryItem>
          ))}
        </MasonryGrid>
      )}
    </div>
  );
}

function buildDiscoverKeepAllHref(sp: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "min_outlier") params.set(k, v);
  }
  params.set("min_outlier", "0");
  return `/discover?${params.toString()}`;
}

function formatWebIngestBreakdown(result: WebSearchIngestResult): string {
  const parts: string[] = [];
  if (result.instagram.ingested > 0) {
    parts.push(`${result.instagram.ingested} Instagram`);
  }
  if (result.x.ingested > 0) {
    parts.push(`${result.x.ingested} X`);
  }
  if (result.youtube.ingested > 0) {
    parts.push(`${result.youtube.ingested} YouTube`);
  }
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

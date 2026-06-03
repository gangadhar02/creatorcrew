/**
 * Resolve REAL data for a saved creator so the chat's generative-UI cards
 * (creatorSnapshot, draftDocument, showSocialPosts) are grounded in the
 * workspace's actual numbers instead of model guesses.
 *
 * Looks up the creator by handle (then display name) within the workspace and
 * aggregates their indexed posts. Per-post engagement_rate / outlier_multiplier
 * are already computed and stored on creator_posts, so we just summarize them.
 */
import { getSupabase } from "@/lib/supabase";
import {
  runGeminiOnMediaItem,
  TRANSCRIBE_PROMPT,
  POST_VISION_PROMPT,
} from "@/lib/gemini-media";
import type { IGMediaItem } from "@/lib/instagram";
import { fetchPostByUrlApify, isApifyConfigured } from "@/lib/instagram-apify";

type CreatorRow = {
  id: string;
  handle: string;
  display_name: string | null;
  platform: string;
  follower_count: number | null;
  avatar_url: string | null;
  bio: string | null;
};

const normKey = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Find a saved creator in the workspace by handle or display name, tolerant of
 * spacing/case/punctuation (the model often passes a normalized "ashokreddy"
 * for a record stored as "ashoksangireddyy" / "Ashok Reddy").
 */
async function findCreator(
  workspaceId: string,
  rawHandle: string
): Promise<CreatorRow | null> {
  const q = normKey(rawHandle.replace(/^@/, "").trim());
  if (!q) return null;
  const { data: rows } = await getSupabase()
    .from("creators")
    .select(
      "id, handle, display_name, platform, follower_count, avatar_url, bio"
    )
    .eq("workspace_id", workspaceId)
    .limit(200);
  const candidates = (rows || []) as CreatorRow[];
  const hit = (s: string | null | undefined) => {
    const n = normKey(s);
    return n.length > 0 && (n === q || n.includes(q) || q.includes(n));
  };
  return (
    candidates.find(
      (c) => normKey(c.handle) === q || normKey(c.display_name) === q
    ) ||
    candidates.find((c) => hit(c.handle) || hit(c.display_name)) ||
    null
  );
}

export type CreatorTopPost = {
  id: string;
  url: string;
  caption: string;
  views: number;
  outlier: number | null;
};

export type CreatorData = {
  handle: string;
  displayName?: string;
  platform: string;
  avatarUrl?: string;
  bio?: string;
  followerCount?: number;
  postsIndexed: number;
  totalViews: number;
  avgViews: number;
  totalLikes: number;
  totalComments: number;
  engagementRate: number | null;
  outlierMean: number | null;
  outlierMedian: number | null;
  topPosts: CreatorTopPost[];
};

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
const num = (x: unknown): number | null => (typeof x === "number" ? x : null);

/**
 * Returns aggregated creator data, or `{ error }` if no matching saved creator
 * exists in the workspace (so the model can tell the user instead of guessing).
 */
export async function getCreatorDataForChat(
  rawHandle: string,
  workspaceId: string | null
): Promise<CreatorData | { error: string }> {
  const handle = (rawHandle || "").replace(/^@/, "").trim();
  if (!handle) return { error: "No creator handle provided." };
  if (!workspaceId) return { error: "No workspace." };

  const sb = getSupabase();
  const creator = await findCreator(workspaceId, handle);
  if (!creator) {
    return {
      error: `No saved creator matching "${rawHandle}" in this workspace.`,
    };
  }

  const { data: postRows } = await sb
    .from("creator_posts")
    .select(
      "id, url, title_or_caption, view_count, like_count, comment_count, engagement_rate, outlier_multiplier"
    )
    .eq("creator_id", creator.id)
    .order("view_count", { ascending: false, nullsFirst: false });

  const posts = (postRows || []) as Array<{
    id: string;
    url: string;
    title_or_caption: string | null;
    view_count: number | null;
    like_count: number | null;
    comment_count: number | null;
    engagement_rate: number | null;
    outlier_multiplier: number | null;
  }>;

  const views = posts.map((p) => num(p.view_count) ?? 0);
  const eng = posts
    .map((p) => num(p.engagement_rate))
    .filter((v): v is number => v != null);
  const out = posts
    .map((p) => num(p.outlier_multiplier))
    .filter((v): v is number => v != null);

  return {
    handle: creator.handle,
    displayName: creator.display_name ?? undefined,
    platform: creator.platform,
    avatarUrl: creator.avatar_url ?? undefined,
    bio: creator.bio ?? undefined,
    followerCount: creator.follower_count ?? undefined,
    postsIndexed: posts.length,
    totalViews: sum(views),
    avgViews: posts.length ? Math.round(sum(views) / posts.length) : 0,
    totalLikes: sum(posts.map((p) => num(p.like_count) ?? 0)),
    totalComments: sum(posts.map((p) => num(p.comment_count) ?? 0)),
    engagementRate: round2(mean(eng)),
    outlierMean: round2(mean(out)),
    outlierMedian: round2(median(out)),
    topPosts: posts.slice(0, 5).map((p) => ({
      id: p.id,
      url: p.url,
      caption: (p.title_or_caption || "").slice(0, 120),
      views: num(p.view_count) ?? 0,
      outlier: round2(num(p.outlier_multiplier)),
    })),
  };
}

export type AnalyzedPost = {
  id: string;
  url: string;
  caption: string;
  views: number;
  publishedAt: string | null;
  transcript?: string;
  vision?: string;
  error?: string;
};

export type AnalyzeResult =
  | { handle: string; displayName?: string; posts: AnalyzedPost[] }
  | { error: string };

/**
 * Fetch a creator's recent (or top) posts and run on-demand transcript / vision
 * analysis on each via Gemini multimodal, persisting results to creator_posts.
 * Returns the per-post content so the model can write a grounded analysis.
 *
 * This pulls Instagram media on demand (slow, and IG-fetch-dependent), so count
 * is capped low and each post fails gracefully without aborting the rest.
 */
export async function analyzeCreatorPostsForChat(
  opts: {
    rawHandle: string;
    workspaceId: string | null;
    count?: number;
    include?: string[];
    order?: "latest" | "top";
  },
  onProgress?: (msg: string) => void
): Promise<AnalyzeResult> {
  const handle = (opts.rawHandle || "").replace(/^@/, "").trim();
  if (!handle) return { error: "No creator handle provided." };
  if (!opts.workspaceId) return { error: "No workspace." };

  const creator = await findCreator(opts.workspaceId, handle);
  if (!creator) {
    return { error: `No saved creator matching "${opts.rawHandle}".` };
  }

  const count = Math.min(Math.max(1, opts.count ?? 3), 3);
  const include = opts.include?.length ? opts.include : ["transcript", "vision"];
  const wantTranscript = include.includes("transcript");
  const wantVision = include.includes("vision");
  const orderCol = opts.order === "top" ? "view_count" : "published_at";

  const sb = getSupabase();
  const { data: rows } = await sb
    .from("creator_posts")
    .select(
      "id, url, title_or_caption, view_count, published_at, transcript, vision_analysis_md"
    )
    .eq("creator_id", creator.id)
    .order(orderCol, { ascending: false, nullsFirst: false })
    .limit(count);

  const posts = (rows || []) as Array<{
    id: string;
    url: string;
    title_or_caption: string | null;
    view_count: number | null;
    published_at: string | null;
    transcript: string | null;
    vision_analysis_md: string | null;
  }>;

  // Resolve a downloadable media item for a post, fresh via Apify (cookie-free).
  // Stored raw_json CDN URLs are signed and expire, so we don't reuse them.
  // Resolved once per post so transcript + vision share the same media.
  const resolveMediaItem = async (p: { url: string }): Promise<IGMediaItem> => {
    if (!isApifyConfigured()) {
      throw new Error("Apify not configured (APIFY_API_TOKEN)");
    }
    if (!p.url) throw new Error("no post url to fetch media");
    const fresh = await fetchPostByUrlApify(p.url);
    if (!fresh?.item) throw new Error("Apify returned no media for post");
    return fresh.item;
  };

  const cap = (s: string | null, n: number) => (s ? s.slice(0, n) : undefined);
  const out: AnalyzedPost[] = [];

  let i = 0;
  for (const p of posts) {
    i++;
    const ap: AnalyzedPost = {
      id: p.id,
      url: p.url,
      caption: (p.title_or_caption || "").slice(0, 200),
      views: p.view_count ?? 0,
      publishedAt: p.published_at,
    };
    let transcript = p.transcript;
    let vision = p.vision_analysis_md;
    const canFetch = isApifyConfigured();
    const needT = wantTranscript && !transcript && canFetch;
    const needV = wantVision && !vision && canFetch;
    const errs: string[] = [];
    let tRes: string | null = null;
    let vRes: string | null = null;

    if (needT || needV) {
      onProgress?.(`Analyzing post ${i}/${posts.length}…`);
      try {
        // Resolve the media once (cookie-free where possible), then run both
        // analyses concurrently on the same item.
        const item = await resolveMediaItem(p);
        [tRes, vRes] = await Promise.all([
          needT
            ? runGeminiOnMediaItem(item, TRANSCRIBE_PROMPT).then(
                (r) => r.text,
                (e) => {
                  errs.push(`transcript failed: ${String(e).slice(0, 120)}`);
                  return null;
                }
              )
            : Promise.resolve(null),
          needV
            ? runGeminiOnMediaItem(item, POST_VISION_PROMPT).then(
                (r) => r.text,
                (e) => {
                  errs.push(`vision failed: ${String(e).slice(0, 120)}`);
                  return null;
                }
              )
            : Promise.resolve(null),
        ]);
      } catch (e) {
        errs.push(`media unavailable: ${String(e).slice(0, 120)}`);
      }
    }

    if (tRes != null) {
      transcript = tRes;
      await sb.from("creator_posts").update({ transcript }).eq("id", p.id);
    }
    if (vRes != null) {
      vision = vRes;
      await sb
        .from("creator_posts")
        .update({ vision_analysis_md: vision })
        .eq("id", p.id);
    }

    if (errs.length) ap.error = errs.join("; ");
    ap.transcript = cap(transcript, 3000);
    ap.vision = cap(vision, 3000);
    out.push(ap);
  }

  return {
    handle: creator.handle,
    displayName: creator.display_name ?? undefined,
    posts: out,
  };
}

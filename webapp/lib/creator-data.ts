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
  const cols =
    "id, handle, display_name, platform, follower_count, avatar_url, bio";

  type CreatorRow = {
    id: string;
    handle: string;
    display_name: string | null;
    platform: string;
    follower_count: number | null;
    avatar_url: string | null;
    bio: string | null;
  };

  // Fuzzy match: the model often passes a normalized handle (e.g. "ashokreddy")
  // for a creator stored as handle "ashoksangireddyy" / display name "Ashok
  // Reddy". Compare on a normalized key (lowercase, alphanumerics only) so
  // spaces, case, and punctuation do not block a match.
  const norm = (s: string | null | undefined) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const q = norm(handle);

  const { data: rows } = await sb
    .from("creators")
    .select(cols)
    .eq("workspace_id", workspaceId)
    .limit(200);

  const candidates = (rows || []) as CreatorRow[];
  const matchesQ = (s: string | null | undefined) => {
    const n = norm(s);
    return n.length > 0 && (n === q || n.includes(q) || q.includes(n));
  };
  // Prefer an exact normalized hit, then a contains hit.
  const creator =
    candidates.find((c) => norm(c.handle) === q || norm(c.display_name) === q) ||
    candidates.find((c) => matchesQ(c.handle) || matchesQ(c.display_name));

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

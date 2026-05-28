import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { igImg } from "@/lib/proxy-image";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import AddToListMenu from "@/components/AddToListMenu";
import CreatorProfileToolbar, {
  CreatorProfileHeader,
} from "@/components/CreatorProfileToolbar";
import type { Creator } from "@/lib/types";
import type { PostWithCreator } from "@/lib/discover-types";
import { rangeCutoff } from "@/lib/discover-url";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  sort?: string;
  type?: string;
  range?: string;
  q?: string;
}>;

function fmtNum(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function externalUrl(platform: string, handle: string): string {
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${handle}/`;
    case "youtube":
      return `https://youtube.com/@${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "linkedin":
      return `https://linkedin.com/in/${handle}`;
    default:
      return "#";
  }
}

export default async function CreatorDetail({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string; handle: string }>;
  searchParams: SearchParams;
}) {
  const { platform, handle } = await params;
  const sp = await searchParams;
  const sort = sp.sort || "recent";
  const typeFilter = sp.type || "all";
  const range = sp.range || "all";
  const q = sp.q?.trim() || "";

  const ws = await getWorkspaceContext();
  const sb = getSupabase();
  const { data: creatorRow } = await sb
    .from("creators")
    .select("*")
    .eq("workspace_id", ws.workspaceId || "")
    .eq("platform", platform)
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  const creator = creatorRow as Creator | null;
  if (!creator) notFound();

  let postsQuery = sb
    .from("creator_posts")
    .select(
      "id, platform, platform_pk, code, url, media_type, title_or_caption, like_count, comment_count, view_count, play_count, engagement_rate, outlier_multiplier, published_at, thumbnail_url, transcript, vision_analysis_md, pillar_id, creator:creators!inner(id, handle, display_name, follower_count, avatar_url, is_verified, platform, workspace_id)"
    )
    .eq("creator_id", creator.id);

  if (typeFilter !== "all") postsQuery = postsQuery.eq("media_type", typeFilter);
  const cutoff = rangeCutoff(range);
  if (cutoff) postsQuery = postsQuery.gte("published_at", cutoff);
  if (q) postsQuery = postsQuery.ilike("title_or_caption", `%${q}%`);

  switch (sort) {
    case "top_liked":
      postsQuery = postsQuery.order("like_count", { ascending: false });
      break;
    case "top_viewed":
      postsQuery = postsQuery.order("view_count", { ascending: false });
      break;
    case "top_outlier":
      postsQuery = postsQuery.order("outlier_multiplier", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "recent":
    default:
      postsQuery = postsQuery.order("published_at", {
        ascending: false,
        nullsFirst: false,
      });
  }
  postsQuery = postsQuery.limit(120);
  const { data: postsData } = await postsQuery;
  const posts = (postsData || []) as unknown as PostWithCreator[];

  const { data: lists } = await sb
    .from("creator_lists")
    .select("*")
    .eq("workspace_id", ws.workspaceId || "");
  const { data: memberships } = await sb
    .from("creator_list_members")
    .select("list_id")
    .eq("creator_id", creator.id);

  const listCount = (memberships || []).length;
  const basePath = `/creators/${platform}/${handle}`;
  const displayName = creator.display_name || `@${creator.handle}`;
  const avatarUrl = creator.avatar_url
    ? creator.platform === "instagram"
      ? igImg(creator.avatar_url)
      : creator.avatar_url
    : null;

  return (
    <div className="space-y-5">
      <CreatorProfileHeader
        displayName={displayName}
        handle={creator.handle}
        platform={creator.platform}
        bio={creator.bio}
        avatarUrl={avatarUrl}
        isVerified={Boolean(creator.is_verified)}
        externalUrl={externalUrl(creator.platform, creator.handle)}
        listMenu={
          <AddToListMenu
            creatorId={creator.id}
            lists={(lists || []) as { id: string; name: string }[]}
            initialListIds={(memberships || []).map(
              (m) => (m as { list_id: string }).list_id
            )}
            triggerLabel={
              listCount > 0 ? `In ${listCount} list${listCount === 1 ? "" : "s"}` : undefined
            }
          />
        }
        stats={[
          { label: "followers", value: fmtNum(creator.follower_count) },
          { label: "posts cached", value: posts.length },
          {
            label: "typical reel views",
            value: fmtNum(creator.typical_reel_views),
          },
          {
            label: "typical post likes",
            value: fmtNum(creator.typical_post_likes),
          },
          ...(creator.last_synced_at
            ? [
                {
                  label: "last synced",
                  value: new Date(creator.last_synced_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  ),
                },
              ]
            : []),
        ]}
      />

      <CreatorProfileToolbar basePath={basePath} sp={sp} />

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {q
            ? "No posts match your search."
            : "No posts cached for this creator yet."}
        </div>
      ) : (
        <MasonryGrid>
          {posts.map((p) => (
            <MasonryItem key={p.id}>
              <PostCard post={p} surface="profile" />
            </MasonryItem>
          ))}
        </MasonryGrid>
      )}
    </div>
  );
}

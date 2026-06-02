/**
 * Ingest a single social post from a pasted permalink into
 * creators + creator_posts, returning the creator_posts.id so it can be
 * referenced (boards, chat, add-to-board, etc.).
 *
 * Instagram is fetched via Apify (the chosen IG backend). Server-only.
 */
import { normalizePost } from "../instagram";
import { fetchPostByUrlApify } from "../instagram-apify";
import { upsertCreator, upsertCreatorPost } from "../dual-write";

export type IngestedPost = {
  creatorPostId: string;
  creatorId: string | null;
  handle: string;
};

/** Detect the platform from a pasted URL. */
export function detectPlatform(url: string): "instagram" | "x" | "unknown" {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/(?:^|\/\/|\.)(?:twitter|x)\.com/i.test(url)) return "x";
  return "unknown";
}

/**
 * Fetch a single Instagram post by permalink and upsert it into
 * creators + creator_posts. Returns null if the post couldn't be fetched
 * (private/removed) or lacked an owner handle.
 */
export async function ingestInstagramPostByUrl(
  workspaceId: string,
  url: string
): Promise<IngestedPost | null> {
  const fetched = await fetchPostByUrlApify(url);
  if (!fetched) return null;

  const { profile, item } = fetched;
  const p = normalizePost(item);
  if (!p) return null;

  const handle = (profile.username || item.user?.username || "")
    .replace(/^@/, "")
    .toLowerCase();
  if (!handle) return null;

  const creatorId = await upsertCreator(workspaceId, "instagram", handle, {
    display_name: profile.full_name || null,
    bio: profile.biography || null,
    follower_count: profile.follower_count || null,
    following_count: profile.following_count || null,
    post_count: profile.media_count || null,
    avatar_url: profile.profile_pic_url || null,
    is_verified: profile.is_verified,
    ig_user_id: profile.id || null,
  });

  const creatorPostId = await upsertCreatorPost({
    creator_id: creatorId,
    platform: "instagram",
    platform_pk: p.media_pk,
    code: p.code,
    url: p.url,
    media_type: p.type,
    title_or_caption: p.caption || null,
    like_count: p.like_count,
    comment_count: p.comment_count,
    view_count: p.view_count,
    play_count: p.play_count,
    published_at: p.taken_at,
    thumbnail_url: p.thumbnail_url,
    raw_json: item,
  });
  if (!creatorPostId) return null;

  return { creatorPostId, creatorId, handle };
}

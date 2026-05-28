/**
 * Social-mirror CDN.
 *
 * Downloads thumbnails + avatars from the original platform CDN and re-hosts
 * them in Supabase Storage under `social-mirror/<platform>/...`. Once mirrored
 * the public URL is stable and not blocked by Referer checks or adblockers.
 *
 * Path schemes:
 *   social-mirror/<platform>/<platform_pk>/thumbnail.jpg
 *   social-mirror/<platform>/profiles/<creator_id>/avatar-<sha8>.jpg
 *
 * Idempotent. Safe to call repeatedly — the latest bytes win.
 */
import { createHash } from "crypto";
import { getSupabase } from "./supabase";
import type { Creator, PlatformKind } from "./types";

const BUCKET = "social-mirror";

const UA_BY_PLATFORM: Record<string, string> = {
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  youtube:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  default: "Mozilla/5.0 (compatible; SavesEngine/1.0)",
};

async function downloadBytes(
  url: string,
  platform: string
): Promise<Buffer | null> {
  try {
    const ua = UA_BY_PLATFORM[platform] || UA_BY_PLATFORM.default;
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        ...(platform === "instagram"
          ? { Referer: "https://www.instagram.com/" }
          : {}),
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function ensureBucket(): Promise<void> {
  const sb = getSupabase();
  // createBucket is idempotent-by-attempt — swallow "already exists" errors.
  try {
    await sb.storage.createBucket(BUCKET, { public: true });
  } catch {
    /* ignore */
  }
}

async function uploadBytes(
  path: string,
  bytes: Buffer,
  contentType: string
): Promise<string | null> {
  const sb = getSupabase();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) {
    console.warn(`[mirror] upload ${path} failed:`, error.message);
    return null;
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Mirror a post's thumbnail. Returns the public URL or null on failure.
 * Updates `creator_posts.thumbnail_url` and `media_mirror` if the column
 * exists (gracefully degrades if migration_010_extras hasn't run).
 */
export async function mirrorThumbnail(post: {
  id: string;
  platform: PlatformKind;
  platform_pk: string;
  thumbnail_url: string | null;
}): Promise<string | null> {
  if (!post.thumbnail_url) return null;
  await ensureBucket();
  const bytes = await downloadBytes(post.thumbnail_url, post.platform);
  if (!bytes) return null;
  const path = `${post.platform}/${post.platform_pk}/thumbnail.jpg`;
  const publicUrl = await uploadBytes(path, bytes, "image/jpeg");
  if (!publicUrl) return null;

  const sb = getSupabase();
  await sb
    .from("creator_posts")
    .update({
      thumbnail_url: publicUrl,
      media_mirror: {
        thumbnail: {
          url: publicUrl,
          bytes: bytes.length,
          mirroredAt: new Date().toISOString(),
        },
      },
    })
    .eq("id", post.id);
  return publicUrl;
}

/**
 * Mirror a creator's avatar. Content-hashed path so re-runs are cheap.
 */
export async function mirrorAvatar(
  creator: Pick<Creator, "id" | "avatar_url" | "platform">
): Promise<string | null> {
  if (!creator.avatar_url) return null;
  await ensureBucket();
  const bytes = await downloadBytes(creator.avatar_url, creator.platform);
  if (!bytes) return null;
  const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  const path = `${creator.platform}/profiles/${creator.id}/avatar-${sha}.jpg`;
  const publicUrl = await uploadBytes(path, bytes, "image/jpeg");
  if (!publicUrl) return null;

  const sb = getSupabase();
  await sb
    .from("creators")
    .update({ avatar_url: publicUrl })
    .eq("id", creator.id);
  return publicUrl;
}

/**
 * Backfill all rows that still point at the original CDN. Best-effort; runs
 * in serial to avoid hammering IG's edge.
 */
export async function mirrorAllPending(
  limit = 40
): Promise<{ thumbnails: number; avatars: number; failed: number }> {
  const sb = getSupabase();
  let thumbnails = 0,
    avatars = 0,
    failed = 0;

  // Thumbnails not yet mirrored — pick rows whose thumbnail_url doesn't start
  // with our supabase storage prefix.
  const { data: posts } = await sb
    .from("creator_posts")
    .select("id, platform, platform_pk, thumbnail_url")
    .not("thumbnail_url", "is", null)
    .not("thumbnail_url", "ilike", "%/social-mirror/%")
    .limit(limit);
  for (const p of (posts || []) as Parameters<
    typeof mirrorThumbnail
  >[0][]) {
    const url = await mirrorThumbnail(p);
    if (url) thumbnails += 1;
    else failed += 1;
  }

  const { data: creators } = await sb
    .from("creators")
    .select("id, platform, avatar_url")
    .not("avatar_url", "is", null)
    .not("avatar_url", "ilike", "%/social-mirror/%")
    .limit(limit);
  for (const c of (creators || []) as Pick<
    Creator,
    "id" | "avatar_url" | "platform"
  >[]) {
    const url = await mirrorAvatar(c);
    if (url) avatars += 1;
    else failed += 1;
  }

  return { thumbnails, avatars, failed };
}

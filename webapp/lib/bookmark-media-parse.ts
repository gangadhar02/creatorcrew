import type { BookmarkItem } from "./types-bookmarks";

type IgLike = {
  image_versions2?: { candidates?: { url: string; width?: number }[] };
  video_versions?: { url: string; width?: number }[];
  carousel_media?: IgLike[];
  thumbnail_url?: string;
  video_url?: string;
  videoUrl?: string;
};

export function hasUsableIgRaw(
  raw: Record<string, unknown> | null | undefined
): boolean {
  if (!raw || Object.keys(raw).length === 0) return false;
  const any = raw as IgLike;
  return Boolean(
    any.image_versions2?.candidates?.length ||
    any.video_versions?.length ||
    any.carousel_media?.length
  );
}

function bestIgImage(any: IgLike): string | null {
  const candidates = any.image_versions2?.candidates || [];
  if (candidates.length === 0) {
    const carousel = any.carousel_media?.[0];
    if (carousel) return bestIgImage(carousel);
    return null;
  }
  const best = candidates.reduce((a, b) =>
    (b.width || 0) > (a.width || 0) ? b : a
  );
  return best.url || null;
}

function bestIgVideo(any: IgLike): string | null {
  const versions = any.video_versions || [];
  if (versions.length === 0) return null;
  const best = versions.reduce((a, b) =>
    (b.width || 0) > (a.width || 0) ? b : a
  );
  return best.url || null;
}

export function thumbFromRaw(raw: Record<string, unknown> | null): string | null {
  if (!hasUsableIgRaw(raw)) return null;
  const any = raw as IgLike;
  return (
    any.thumbnail_url ||
    bestIgImage(any) ||
    bestIgVideo(any) ||
    null
  );
}

export function videoFromRaw(raw: Record<string, unknown> | null): string | null {
  if (!hasUsableIgRaw(raw)) return null;
  return bestIgVideo(raw as IgLike);
}

/** Best-effort video URL for IG or X bookmark items. */
export function bookmarkVideoUrl(item: BookmarkItem): string | null {
  if (item.platform === "instagram") {
    const fromRaw = item.raw_json ? videoFromRaw(item.raw_json) : null;
    if (fromRaw) return fromRaw;
  }

  const any = item.raw_json as Record<string, unknown> | null;
  if (!any) return null;

  const direct =
    (typeof any.video_url === "string" && any.video_url) ||
    (typeof any.videoUrl === "string" && any.videoUrl) ||
    null;
  if (direct) return direct;

  const media =
    (any as { extended_entities?: { media?: unknown[] } }).extended_entities
      ?.media?.[0] ||
    (any as { legacy?: { extended_entities?: { media?: unknown[] } } }).legacy
      ?.extended_entities?.media?.[0] ||
    (any as { entities?: { media?: unknown[] } }).entities?.media?.[0] ||
    null;

  const variants = (media as { video_info?: { variants?: unknown[] } })
    ?.video_info?.variants;
  if (!Array.isArray(variants)) return null;

  const mp4s = variants
    .filter(
      (v): v is { url: string; bitrate?: number; content_type?: string } =>
        typeof v === "object" &&
        v !== null &&
        "url" in v &&
        typeof (v as { url: unknown }).url === "string" &&
        String((v as { content_type?: string }).content_type || "").includes(
          "mp4"
        )
    )
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  const url = mp4s[0]?.url;
  return typeof url === "string" ? url.split("?")[0] || url : null;
}

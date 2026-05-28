import type { PostWithCreator } from "./discover-types";

export type PostCardVariant =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "twitter"
  | "substack"
  | "linkedin"
  | "default";

export type ThumbnailLayout = {
  /** Tailwind aspect-* class. null = natural image height (X posts). */
  aspectClass: string | null;
  objectFit: "cover" | "contain";
  /** Tweet-style: caption above media. */
  captionFirst: boolean;
  /** Hide thumbnail area when no image (Substack articles). */
  thumbnailOptional: boolean;
};

function formatKey(post: {
  media_type?: string | null;
  media_format?: string | null;
}): string {
  return `${post.media_format || ""} ${post.media_type || ""}`.toLowerCase();
}

function isShortForm(fmt: string): boolean {
  return (
    fmt.includes("short") ||
    fmt.includes("reel") ||
    fmt === "short_video" ||
    fmt.includes("tiktok")
  );
}

function isVideo(fmt: string): boolean {
  return (
    fmt.includes("video") ||
    fmt === "reel" ||
    fmt.includes("short") ||
    fmt === "igtv"
  );
}

/** Eden-style card variant from platform. */
export function postCardVariant(post: { platform: string }): PostCardVariant {
  switch (post.platform) {
    case "instagram":
      return "instagram";
    case "youtube":
      return "youtube";
    case "tiktok":
      return "tiktok";
    case "x":
      return "twitter";
    case "substack":
      return "substack";
    case "linkedin":
      return "linkedin";
    default:
      return "default";
  }
}

/** Platform-appropriate thumbnail aspect ratio and layout hints. */
export function thumbnailLayout(
  post: {
    platform: string;
    media_type?: string | null;
    media_format?: string | null;
    thumbnail_url?: string | null;
  }
): ThumbnailLayout {
  const fmt = formatKey(post);
  const variant = postCardVariant(post);

  if (variant === "tiktok") {
    return {
      aspectClass: "aspect-[9/16]",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: false,
    };
  }

  if (variant === "youtube") {
    return {
      aspectClass: isShortForm(fmt) ? "aspect-[9/16]" : "aspect-video",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: false,
    };
  }

  if (variant === "instagram") {
    return {
      aspectClass: isShortForm(fmt) || post.media_type === "Reel"
        ? "aspect-[9/16]"
        : "aspect-[4/5]",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: false,
    };
  }

  if (variant === "twitter") {
    return {
      aspectClass: post.thumbnail_url ? null : null,
      objectFit: "cover",
      captionFirst: true,
      thumbnailOptional: true,
    };
  }

  if (variant === "substack") {
    return {
      aspectClass: "aspect-video",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: true,
    };
  }

  if (variant === "linkedin") {
    return {
      aspectClass: isVideo(fmt) ? "aspect-video" : "aspect-[4/5]",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: true,
    };
  }

  // Generic fallback — landscape video vs portrait post.
  if (isShortForm(fmt)) {
    return {
      aspectClass: "aspect-[9/16]",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: false,
    };
  }
  if (isVideo(fmt)) {
    return {
      aspectClass: "aspect-video",
      objectFit: "cover",
      captionFirst: false,
      thumbnailOptional: false,
    };
  }

  return {
    aspectClass: "aspect-[4/5]",
    objectFit: "cover",
    captionFirst: false,
    thumbnailOptional: false,
  };
}

/** Human-readable views line for YouTube-style cards. */
export function viewsLabel(
  post: Pick<PostWithCreator, "view_count" | "play_count">
): string | null {
  const views = post.view_count || post.play_count;
  if (!views) return null;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

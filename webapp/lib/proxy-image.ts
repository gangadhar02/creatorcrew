/**
 * Wrap an Instagram CDN URL with our local image proxy so adblockers,
 * privacy DNS, and Referer-strict CDN paths don't strip the image.
 *
 * If the URL already points at our social-mirror Supabase bucket, return it
 * verbatim — those URLs are already CORS-clean and don't need proxying.
 */
export function igImg(url: string | null | undefined): string {
  if (!url) return "";
  if (url.includes("/social-mirror/")) return url;
  return `/api/ig-image?u=${encodeURIComponent(url)}`;
}

const PROXY_HOST_MARKERS = [
  "substackcdn.com",
  "substack-post-media",
  "ytimg.com",
  "twimg.com",
  "licdn.com",
  "pbs.twimg.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "muscdn.com",
];

/** Proxy Instagram + other CDN thumbnails that block hotlinking. */
export function mediaImg(
  url: string | null | undefined,
  platform?: string
): string {
  if (!url) return "";
  if (url.startsWith("/api/")) return url;
  if (url.includes("/social-mirror/")) return url;
  if (platform === "instagram") return igImg(url);
  const lower = url.toLowerCase();
  if (lower.includes("fbcdn.net") || lower.includes("cdninstagram.com")) {
    return igImg(url);
  }
  if (PROXY_HOST_MARKERS.some((h) => lower.includes(h))) {
    return `/api/proxy-image?u=${encodeURIComponent(url)}`;
  }
  if (platform === "x" && lower.includes("twimg")) {
    return `/api/proxy-image?u=${encodeURIComponent(url)}`;
  }
  return url;
}

/** Proxy media (images/videos) via a strict allowlist. */
export function mediaAsset(
  url: string | null | undefined,
  platform?: string
): string {
  if (!url) return "";
  if (url.startsWith("/api/")) return url;
  if (url.includes("/social-mirror/")) return url;
  const lower = url.toLowerCase();

  // Prefer existing dedicated IG image proxy when it's clearly an image.
  if (
    (platform === "instagram" ||
      lower.includes("fbcdn.net") ||
      lower.includes("cdninstagram.com")) &&
    (lower.includes(".jpg") ||
      lower.includes(".jpeg") ||
      lower.includes(".png") ||
      lower.includes(".webp") ||
      lower.includes("=jpg") ||
      lower.includes("=png") ||
      lower.includes("=webp"))
  ) {
    return igImg(url);
  }

  // Everything else goes through the generic media proxy when host matches.
  if (PROXY_HOST_MARKERS.some((h) => lower.includes(h))) {
    return `/api/proxy-media?u=${encodeURIComponent(url)}`;
  }
  if (
    lower.includes("fbcdn.net") ||
    lower.includes("cdninstagram.com") ||
    lower.includes("twimg.com") ||
    lower.includes("pbs.twimg.com")
  ) {
    return `/api/proxy-media?u=${encodeURIComponent(url)}`;
  }
  return url;
}

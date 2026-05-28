/**
 * Live web search — pulls fresh Instagram + YouTube + X results for a keyword and
 * ingests them into creator_posts before Discover queries the library.
 *
 * Server-only.
 */
import { searchYouTubeByKeyword } from "./ingest/youtube";
import { searchInstagramByKeyword } from "./ingest/instagram-search";
import { searchXByKeyword } from "./ingest/x";

export type WebSearchIngestResult = {
  youtube: { ingested: number; warning?: string };
  instagram: { ingested: number; warning?: string };
  x: { ingested: number; warning?: string };
  totalIngested: number;
};

/**
 * Fetch and ingest posts from Instagram + YouTube + X for a search query.
 * Call this before running discover() so results include new creators.
 */
export async function ingestWebSearchForQuery(
  query: string,
  platforms: string[] | null,
  opts: { count?: number } = {}
): Promise<WebSearchIngestResult> {
  const q = query.trim();
  if (!q) {
    return {
      youtube: { ingested: 0 },
      instagram: { ingested: 0 },
      x: { ingested: 0 },
      totalIngested: 0,
    };
  }

  const count = Math.min(opts.count ?? 25, 50);
  const wantsYouTube = !platforms || platforms.includes("youtube");
  const wantsInstagram = !platforms || platforms.includes("instagram");
  const wantsX =
    !platforms || platforms.includes("x") || platforms.includes("twitter");

  const [youtubeRes, instagramRes, xRes] = await Promise.all([
    wantsYouTube
      ? searchYouTubeByKeyword(q, { maxResults: count }).catch((e) => ({
          ingested: 0,
          warning: String(e),
        }))
      : Promise.resolve({ ingested: 0 }),
    wantsInstagram
      ? searchInstagramByKeyword(q, { maxResults: count }).catch((e) => ({
          ingested: 0,
          warning: String(e),
        }))
      : Promise.resolve({ ingested: 0 }),
    wantsX
      ? searchXByKeyword(q, { maxResults: count }).catch((e) => ({
          ingested: 0,
          warning: String(e),
        }))
      : Promise.resolve({ ingested: 0 }),
  ]);

  const youtube = {
    ingested: youtubeRes.ingested,
    warning:
      "warning" in youtubeRes && typeof youtubeRes.warning === "string"
        ? youtubeRes.warning
        : undefined,
  };

  const instagram = {
    ingested: instagramRes.ingested,
    warning:
      "warning" in instagramRes && typeof instagramRes.warning === "string"
        ? instagramRes.warning
        : undefined,
  };

  const x = {
    ingested: xRes.ingested,
    warning:
      "warning" in xRes && typeof xRes.warning === "string"
        ? xRes.warning
        : undefined,
  };

  return {
    youtube,
    instagram,
    x,
    totalIngested: youtube.ingested + instagram.ingested + x.ingested,
  };
}

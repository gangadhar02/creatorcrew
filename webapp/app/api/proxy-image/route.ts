/**
 * GET /api/proxy-image?u=<encoded image URL>
 *
 * Proxies external CDN images (Substack, YouTube thumbs, etc.) so hotlink
 * protection and referrer checks don't leave broken thumbnails in the feed.
 */
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_HOST_SUFFIXES = [
  "substackcdn.com",
  "substack.com",
  "substack-post-media.s3.amazonaws.com",
  "ytimg.com",
  "youtube.com",
  "i.ytimg.com",
  "twimg.com",
  "licdn.com",
  "linkedin.com",
  "pbs.twimg.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "muscdn.com",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("u");
  if (!url) {
    return new NextResponse("missing ?u", { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (s) => host === s || host.endsWith(`.${s}`)
  );
  if (!allowed) {
    return new NextResponse(`disallowed host: ${host}`, { status: 400 });
  }

  const upstream = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: `${parsed.protocol}//${parsed.host}/`,
    },
    cache: "no-store",
  });
  if (!upstream.ok) {
    return new NextResponse(`upstream ${upstream.status}`, {
      status: upstream.status,
    });
  }
  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

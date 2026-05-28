/**
 * GET /api/proxy-media?u=<encoded media URL>
 *
 * Proxies external media (images/videos) from a small allowlist so hotlink
 * protection, referer checks, and privacy DNS don't break embeds in the UI.
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
  "pbs.twimg.com",
  "fbcdn.net",
  "cdninstagram.com",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("u");
  if (!url) return new NextResponse("missing ?u", { status: 400 });

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
  if (!allowed) return new NextResponse(`disallowed host: ${host}`, { status: 400 });

  const upstream = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
      Referer: `${parsed.protocol}//${parsed.host}/`,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse(`upstream ${upstream.status}`, { status: upstream.status });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}


/**
 * GET /api/ig-image?u=<encoded IG CDN URL>
 *
 * Proxies Instagram CDN images through our own origin so:
 *   1) Adblockers / privacy extensions that block fbcdn.net / cdninstagram.com
 *      domains don't strip our profile pics and thumbnails.
 *   2) We can cache aggressively (Browser cache + Next.js fetch cache).
 *   3) We can attach the Referer header IG sometimes requires.
 *
 * Whitelisted to IG-owned CDN hosts only — we don't want to become an open
 * image proxy.
 */
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_HOST_SUFFIXES = ["fbcdn.net", "cdninstagram.com"];
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
  const host = parsed.hostname;
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (s) => host === s || host.endsWith(`.${s}`)
  );
  if (!allowed) {
    return new NextResponse(`disallowed host: ${host}`, { status: 400 });
  }

  const upstream = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.instagram.com/",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
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

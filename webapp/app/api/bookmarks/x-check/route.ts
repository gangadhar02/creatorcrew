/**
 * GET /api/bookmarks/x-check — verify X session cookies before sync.
 */
import { NextResponse } from "next/server";
import { verifyXCookies, xCookiesConfigured } from "@/lib/x-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!xCookiesConfigured()) {
    return NextResponse.json({
      ok: false,
      error:
        "X cookies not set. Add X_AUTH_TOKEN + X_CT0, or X_COOKIE (full header from a Bookmarks request).",
    });
  }
  const result = await verifyXCookies();
  return NextResponse.json(result);
}

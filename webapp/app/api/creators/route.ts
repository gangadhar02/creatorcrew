/**
 * GET  /api/creators              — list creators in workspace
 * POST /api/creators              — add by { platform, handle, maxItems? }
 *
 * Dispatches to /api/ingest/<platform>. Supported platforms:
 *   - instagram → IG web API (cookies in config.json)
 *   - youtube   → YouTube Data API v3 (YOUTUBE_API_KEY env)
 *   - substack  → RSS feed at /feed (no auth needed)
 *   - x         → X API v2 (X_BEARER_TOKEN env)
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUPPORTED = new Set(["instagram", "youtube", "substack", "x", "twitter"]);

export async function GET() {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ creators: [] });
  const sb = getSupabase();
  const { data } = await sb
    .from("creators")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return NextResponse.json({ creators: data || [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    platform?: string;
    handle?: string;
    maxItems?: number;
  };
  const platform = (body.platform || "instagram").toLowerCase();
  const handle = (body.handle || "").trim();
  if (!handle)
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  const ingestPlatform = platform === "twitter" ? "x" : platform;
  if (!SUPPORTED.has(platform)) {
    return NextResponse.json(
      { error: `Unsupported platform: ${platform}` },
      { status: 400 }
    );
  }

  const url = new URL(`/api/ingest/${ingestPlatform}`, request.url);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Forward the caller's auth cookie so getWorkspaceContext() resolves the
      // same workspace on the sub-request (else the ingest route 401s with
      // "Unauthorized").
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ handle, maxItems: body.maxItems }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

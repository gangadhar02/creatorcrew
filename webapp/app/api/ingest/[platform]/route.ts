/**
 * POST /api/ingest/[platform]
 * Body: { handle: string, maxItems?: number }
 *
 * Per-platform ingestion entry points. The /api/creators POST dispatches
 * here. Each platform's ingestor lives in lib/ingest/<platform>.ts.
 *
 *   - instagram → delegates to /api/profiles/analyze (existing flow)
 *   - youtube   → lib/ingest/youtube.ts
 *   - substack  → lib/ingest/substack.ts
 *   - x         → lib/ingest/x.ts (X_BEARER_TOKEN env)
 */
import { NextResponse, type NextRequest } from "next/server";
import { ingestYouTubeChannel } from "@/lib/ingest/youtube";
import { ingestSubstackPublication } from "@/lib/ingest/substack";
import { ingestXUser } from "@/lib/ingest/x";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: platformParam } = await params;
  const platform = platformParam.toLowerCase();
  const body = (await request.json().catch(() => ({}))) as {
    handle?: string;
    maxItems?: number;
  };
  const handle = (body.handle || "").trim();
  if (!handle) {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }

  // Scope ingest to the caller's workspace (service-role bypasses RLS).
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (platform === "youtube") {
      const r = await ingestYouTubeChannel(handle, ws.workspaceId, {
        maxVideos: body.maxItems,
      });
      return NextResponse.json({ ok: true, ...r });
    }
    if (platform === "substack") {
      const r = await ingestSubstackPublication(handle, ws.workspaceId, {
        maxItems: body.maxItems,
      });
      return NextResponse.json({ ok: true, ...r });
    }
    if (platform === "x" || platform === "twitter") {
      const r = await ingestXUser(handle, ws.workspaceId, {
        maxPosts: body.maxItems,
      });
      return NextResponse.json({ ok: true, ...r });
    }
    if (platform === "instagram") {
      // Reuse the existing analyze endpoint. Forward the request cookie so
      // getWorkspaceContext() resolves the same workspace on the sub-request.
      const url = new URL("/api/profiles/analyze", request.url);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ handle, maxPosts: body.maxItems }),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(
      { error: `Unknown platform: ${platform}. Supported: instagram, youtube, substack, x.` },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

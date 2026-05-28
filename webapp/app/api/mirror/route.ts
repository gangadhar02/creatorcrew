/**
 * POST /api/mirror               — batch backfill (limit in body)
 * POST /api/mirror?post_id=<id>  — mirror a single post's thumbnail
 * POST /api/mirror?creator_id=<id> — mirror a single creator's avatar
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { mirrorAllPending, mirrorAvatar, mirrorThumbnail } from "@/lib/mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const sb = getSupabase();
  const postId = request.nextUrl.searchParams.get("post_id");
  const creatorId = request.nextUrl.searchParams.get("creator_id");

  if (postId) {
    const { data } = await sb
      .from("creator_posts")
      .select("id, platform, platform_pk, thumbnail_url")
      .eq("id", postId)
      .maybeSingle();
    if (!data)
      return NextResponse.json({ error: "post not found" }, { status: 404 });
    const url = await mirrorThumbnail(
      data as Parameters<typeof mirrorThumbnail>[0]
    );
    return NextResponse.json({ url });
  }

  if (creatorId) {
    const { data } = await sb
      .from("creators")
      .select("id, platform, avatar_url")
      .eq("id", creatorId)
      .maybeSingle();
    if (!data)
      return NextResponse.json({ error: "creator not found" }, { status: 404 });
    const url = await mirrorAvatar(
      data as Parameters<typeof mirrorAvatar>[0]
    );
    return NextResponse.json({ url });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 40, 200);
  const result = await mirrorAllPending(limit);
  return NextResponse.json(result);
}

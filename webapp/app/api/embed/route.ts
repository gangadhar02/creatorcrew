/**
 * POST /api/embed       — batch-embed pending posts
 * POST /api/embed?id=…  — embed one post by id
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import { embedPost } from "@/lib/embed-post";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getSupabase();
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    // Only embed posts that belong to the caller's workspace (via creators FK).
    const { data: owned } = await sb
      .from("creator_posts")
      .select("id, creator:creators!inner(workspace_id)")
      .eq("id", id)
      .eq("creators.workspace_id", ws.workspaceId)
      .maybeSingle();
    if (!owned)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    const ok = await embedPost(id);
    return NextResponse.json({ ok });
  }
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 200);
  const { data: pending } = await sb
    .from("creator_posts")
    .select("id, creator:creators!inner(workspace_id)")
    .eq("creators.workspace_id", ws.workspaceId)
    .is("embedding", null)
    .limit(limit);
  let embedded = 0;
  let failed = 0;
  for (const row of (pending || []) as { id: string }[]) {
    const ok = await embedPost(row.id);
    if (ok) embedded += 1;
    else failed += 1;
  }
  return NextResponse.json({ embedded, failed, attempted: (pending || []).length });
}

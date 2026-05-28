/**
 * POST /api/boards/[id]/items — add an item to a board.
 * Accepts one of (mutually exclusive):
 *   { kind: 'post',     creator_post_id: <uuid>, tag? }
 *   { kind: 'card',     body_md, color?, tag? }                — creates a new card
 *   { kind: 'document', title?, body_md?, voice_id?, tag? }    — creates a new document
 *   { kind: 'file',     file_id, tag? }                        — references an uploaded file row
 *   { kind: 'post',     url: <ig url>, tag? }                  — auto-classifies an IG link into an existing/new creator_post
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: boardId } = await ctx.params;
  const body = (await request.json()) as {
    kind: "post" | "card" | "document" | "file";
    creator_post_id?: string;
    body_md?: string;
    color?: string;
    title?: string;
    voice_id?: string | null;
    file_id?: string;
    url?: string;
    tag?: string;
  };
  if (!body.kind)
    return NextResponse.json({ error: "kind required" }, { status: 400 });

  const sb = getSupabase();

  // Find current max position for this board
  const { data: maxRow } = await sb
    .from("board_items")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos =
    ((maxRow?.[0] as { position: number } | undefined)?.position ?? -1) + 1;

  const row: Record<string, unknown> = {
    board_id: boardId,
    kind: body.kind,
    position: nextPos,
    tag: body.tag || null,
  };

  if (body.kind === "post") {
    if (body.creator_post_id) {
      row.creator_post_id = body.creator_post_id;
    } else if (body.url) {
      // Try to find an existing creator_post by URL match (cheap heuristic)
      const { data: existing } = await sb
        .from("creator_posts")
        .select("id")
        .eq("url", body.url)
        .limit(1);
      const existingId = (existing?.[0] as { id: string } | undefined)?.id;
      if (existingId) {
        row.creator_post_id = existingId;
      } else {
        return NextResponse.json(
          {
            error:
              "Pasting raw URLs that aren't in creator_posts yet isn't supported in Phase 9 — use Discover to add the creator first.",
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "post requires creator_post_id or url" },
        { status: 400 }
      );
    }
  } else if (body.kind === "card") {
    const { data: card, error } = await sb
      .from("cards")
      .insert({
        body_md: body.body_md || "",
        color: body.color || "gray",
      })
      .select("id")
      .single();
    if (error || !card)
      return NextResponse.json(
        { error: error?.message || "card create failed" },
        { status: 500 }
      );
    row.card_id = (card as { id: string }).id;
  } else if (body.kind === "document") {
    const { data: doc, error } = await sb
      .from("documents")
      .insert({
        title: body.title || "Untitled",
        body_md: body.body_md || "",
        voice_id: body.voice_id || null,
      })
      .select("id")
      .single();
    if (error || !doc)
      return NextResponse.json(
        { error: error?.message || "document create failed" },
        { status: 500 }
      );
    row.document_id = (doc as { id: string }).id;
  } else if (body.kind === "file") {
    if (!body.file_id)
      return NextResponse.json(
        { error: "file_id required" },
        { status: 400 }
      );
    row.file_id = body.file_id;
  }

  const { data: item, error } = await sb
    .from("board_items")
    .insert(row)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}

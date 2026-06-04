/**
 * POST /api/cards — create a standalone card
 *
 * Cards live independently in the `cards` table; if a `board_id` is supplied,
 * we also attach the card to that board via a `board_items` row so it shows
 * up on the board grid. The palette's "New card" action calls this with the
 * most-recent board id (or omits it for a true standalone card).
 *
 * Body: { body_md?, color?, board_id?, tag? }
 * Returns: { card: { id, ... }, board_item?: { id } }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    body_md?: string;
    color?: string;
    board_id?: string;
    tag?: string;
  };
  const sb = getSupabase();

  // If attaching to a board, it must belong to the caller's workspace.
  if (body.board_id) {
    const { data: board } = await sb
      .from("boards")
      .select("id")
      .eq("id", body.board_id)
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();
    if (!board)
      return NextResponse.json({ error: "board not found" }, { status: 404 });
  }

  const { data: card, error } = await sb
    .from("cards")
    .insert({
      workspace_id: ws.workspaceId,
      body_md: body.body_md || "",
      color: body.color || "gray",
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  let boardItem: { id: string } | null = null;
  if (body.board_id && card) {
    const { data: maxRow } = await sb
      .from("board_items")
      .select("position")
      .eq("board_id", body.board_id)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos =
      ((maxRow?.[0] as { position: number } | undefined)?.position ?? -1) + 1;
    const { data: item } = await sb
      .from("board_items")
      .insert({
        board_id: body.board_id,
        kind: "card",
        position: nextPos,
        card_id: (card as { id: string }).id,
        tag: body.tag || null,
      })
      .select("id")
      .single();
    boardItem = item as { id: string } | null;
  }

  return NextResponse.json({ card, board_item: boardItem });
}

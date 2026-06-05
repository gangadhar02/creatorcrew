/**
 * POST /api/boards/[id]/duplicate
 *
 * Clones a board and all its items. Body: { as_template?: boolean }.
 *  - Plain duplicate  → new board (kind 'board', name "… copy") in the sidebar.
 *  - Save as template → new board with kind 'template' (hidden from the boards
 *    list, surfaced as a template).
 *
 * Owned items (card / document) are deep-cloned so the copy is independent;
 * shared references (post / file) are pointed at the same underlying row.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    as_template?: boolean;
  };
  const asTemplate = !!body.as_template;
  const sb = getSupabase();

  // Source board (scoped to workspace).
  const { data: src } = await sb
    .from("boards")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
  const board = src as Record<string, unknown>;

  // New board row.
  const { data: created, error: createErr } = await sb
    .from("boards")
    .insert({
      workspace_id: ws.workspaceId,
      name: asTemplate ? (board.name as string) : `${board.name as string} copy`,
      description: board.description ?? null,
      icon: board.icon ?? null,
      color: board.color ?? "gray",
      voice_id: board.voice_id ?? null,
      kind: asTemplate ? "template" : "board",
      canvas_state: board.canvas_state ?? null,
    })
    .select("*")
    .single();
  if (createErr || !created)
    return NextResponse.json(
      { error: createErr?.message || "insert failed" },
      { status: 500 }
    );
  const newBoardId = (created as { id: string }).id;

  // Source items.
  const { data: items } = await sb
    .from("board_items")
    .select("*")
    .eq("board_id", id)
    .order("position", { ascending: true });

  for (const raw of items || []) {
    const it = raw as Record<string, unknown>;
    const base = {
      board_id: newBoardId,
      kind: it.kind,
      position: it.position ?? 0,
      tag: it.tag ?? null,
      x: it.x ?? 0,
      y: it.y ?? 0,
      w: it.w ?? 320,
      h: it.h ?? 400,
      creator_post_id: null as string | null,
      card_id: null as string | null,
      document_id: null as string | null,
      file_id: null as string | null,
    };

    if (it.kind === "card" && it.card_id) {
      const { data: card } = await sb
        .from("cards")
        .select("body_md, color")
        .eq("id", it.card_id as string)
        .maybeSingle();
      const { data: newCard } = await sb
        .from("cards")
        .insert({
          body_md: (card as { body_md?: string } | null)?.body_md ?? "",
          color: (card as { color?: string } | null)?.color ?? "gray",
        })
        .select("id")
        .single();
      base.card_id = (newCard as { id: string } | null)?.id ?? null;
    } else if (it.kind === "document" && it.document_id) {
      const { data: doc } = await sb
        .from("documents")
        .select("title, body_md, voice_id")
        .eq("id", it.document_id as string)
        .maybeSingle();
      const d = doc as
        | { title?: string; body_md?: string; voice_id?: string | null }
        | null;
      const { data: newDoc } = await sb
        .from("documents")
        .insert({
          title: d?.title ?? "Untitled",
          body_md: d?.body_md ?? "",
          voice_id: d?.voice_id ?? null,
        })
        .select("id")
        .single();
      base.document_id = (newDoc as { id: string } | null)?.id ?? null;
    } else if (it.kind === "post") {
      base.creator_post_id = (it.creator_post_id as string | null) ?? null;
    } else if (it.kind === "file") {
      base.file_id = (it.file_id as string | null) ?? null;
    }

    // Skip rows that lost their single required FK (e.g. card/doc clone failed).
    const fkCount =
      (base.creator_post_id ? 1 : 0) +
      (base.card_id ? 1 : 0) +
      (base.document_id ? 1 : 0) +
      (base.file_id ? 1 : 0);
    if (fkCount !== 1) continue;

    await sb.from("board_items").insert(base);
  }

  return NextResponse.json({ board: created });
}

/**
 * GET /api/search?q=...&limit=30
 *
 * Backs the ⌘K command palette. Searches saves, content_ideas, profiles,
 * boards, cards, and documents (with their parent board as subtitle).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchHit = {
  kind:
    | "save"
    | "idea"
    | "profile"
    | "board"
    | "card"
    | "document"
    | "creator"
    | "post";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "30", 10) || 30,
    100
  );
  if (!q) return NextResponse.json({ hits: [] });

  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const like = `%${q}%`;

  const [
    savesRes,
    ideasRes,
    profilesRes,
    boardsRes,
    cardsRes,
    docsRes,
    creatorsRes,
  ] = await Promise.all([
    sb
      .from("saves")
      .select("id, author, caption, type")
      .eq("workspace_id", ws.workspaceId)
      .or(`caption.ilike.${like},author.ilike.${like}`)
      .limit(limit),
    sb
      .from("content_ideas")
      .select("id, name, angle, pillar")
      .eq("workspace_id", ws.workspaceId)
      .or(`name.ilike.${like},angle.ilike.${like}`)
      .limit(limit),
    sb
      .from("profiles")
      .select("id, ig_handle, display_name, bio")
      .eq("workspace_id", ws.workspaceId)
      .or(
        `ig_handle.ilike.${like},display_name.ilike.${like},bio.ilike.${like}`
      )
      .limit(limit),
    sb.from("boards").select("id, name").ilike("name", like).limit(limit),
    sb
      .from("cards")
      // cards have no title/board_id of their own; the parent board (if any) is
      // reached through board_items, and the searchable text is body_md.
      .select("id, body_md, board_items(board_id, boards(name))")
      .eq("workspace_id", ws.workspaceId)
      .ilike("body_md", like)
      .limit(limit),
    sb
      .from("documents")
      .select("id, title, board_items(board_id, boards(name))")
      .eq("workspace_id", ws.workspaceId)
      .ilike("title", like)
      .limit(limit),
    sb
      .from("creators")
      .select("id, handle, display_name, platform")
      .or(`handle.ilike.${like},display_name.ilike.${like}`)
      .limit(limit),
  ]);

  const hits: SearchHit[] = [];

  for (const r of (savesRes.data || []) as {
    id: string;
    author: string | null;
    caption: string | null;
    type: string;
  }[]) {
    hits.push({
      kind: "save",
      id: r.id,
      title: `@${r.author || "unknown"} · ${r.type}`,
      subtitle: (r.caption || "").slice(0, 100),
      href: `/saves/${r.id}`,
    });
  }
  for (const r of (ideasRes.data || []) as {
    id: string;
    name: string;
    angle: string | null;
    pillar: string | null;
  }[]) {
    hits.push({
      kind: "idea",
      id: r.id,
      title: r.name,
      subtitle: r.angle || r.pillar || undefined,
      href: `/ideas/${r.id}`,
    });
  }
  for (const r of (profilesRes.data || []) as {
    id: string;
    ig_handle: string;
    display_name: string | null;
    bio: string | null;
  }[]) {
    hits.push({
      kind: "profile",
      id: r.id,
      title: `@${r.ig_handle}`,
      subtitle: r.display_name || r.bio?.slice(0, 100) || undefined,
      href: `/profiles/${r.ig_handle}`,
    });
  }
  for (const r of (boardsRes.data || []) as { id: string; name: string }[]) {
    hits.push({
      kind: "board",
      id: r.id,
      title: r.name,
      href: `/boards/${r.id}`,
    });
  }
  type BoardItemLink = {
    board_id: string | null;
    boards?: { name: string } | { name: string }[] | null;
  };
  const firstBoard = (items?: BoardItemLink[] | null) => {
    const link = items?.find((i) => i.board_id);
    if (!link) return null;
    const board = Array.isArray(link.boards) ? link.boards[0] : link.boards;
    return { board_id: link.board_id as string, name: board?.name };
  };

  for (const r of (cardsRes.data || []) as {
    id: string;
    body_md: string | null;
    board_items?: BoardItemLink[] | null;
  }[]) {
    const parent = firstBoard(r.board_items);
    const text = (r.body_md || "").trim();
    hits.push({
      kind: "card",
      id: r.id,
      title: text.slice(0, 80) || "Untitled card",
      subtitle: parent?.name ? `in ${parent.name}` : undefined,
      href: parent ? `/boards/${parent.board_id}#card-${r.id}` : "/boards",
    });
  }
  for (const r of (docsRes.data || []) as {
    id: string;
    title: string;
    board_items?: BoardItemLink[] | null;
  }[]) {
    const parent = firstBoard(r.board_items);
    hits.push({
      kind: "document",
      id: r.id,
      title: r.title,
      subtitle: parent?.name ? `in ${parent.name}` : undefined,
      href: `/documents/${r.id}`,
    });
  }
  for (const r of (creatorsRes.data || []) as {
    id: string;
    handle: string;
    display_name: string | null;
    platform: string;
  }[]) {
    hits.push({
      kind: "creator",
      id: r.id,
      title: r.display_name || `@${r.handle}`,
      subtitle: `${r.platform} · @${r.handle}`,
      href: `/creators/${r.platform}/${r.handle}`,
    });
  }

  return NextResponse.json({ hits: hits.slice(0, limit) });
}

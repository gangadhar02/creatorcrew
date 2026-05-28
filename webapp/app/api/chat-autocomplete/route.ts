/**
 * GET /api/chat-autocomplete?q=...&tab=items|creators|lists
 * Returns: { hits: { kind, id, label, sublabel? }[] }
 *
 * Powers the @-mention popover in chat input.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hit = {
  kind: "post" | "creator" | "list";
  id: string;
  label: string;
  sublabel?: string;
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const tab = request.nextUrl.searchParams.get("tab") || "creators";
  const ws = await getWorkspaceContext();
  if (!ws.workspaceId) return NextResponse.json({ hits: [] });
  const sb = getSupabase();
  const like = q ? `%${q}%` : null;
  const hits: Hit[] = [];

  if (tab === "creators") {
    let cq = sb
      .from("creators")
      .select("id, handle, display_name, platform, follower_count")
      .eq("workspace_id", ws.workspaceId)
      .limit(20);
    if (like)
      cq = cq.or(`handle.ilike.${like},display_name.ilike.${like}`);
    const { data } = await cq;
    for (const c of (data || []) as Record<string, unknown>[]) {
      const followers = c.follower_count
        ? formatNum(c.follower_count as number)
        : "";
      hits.push({
        kind: "creator",
        id: c.id as string,
        label: (c.display_name as string) || `@${c.handle}`,
        sublabel: `${c.platform} · ${followers}`,
      });
    }
  } else if (tab === "lists") {
    let lq = sb
      .from("creator_lists")
      .select("id, name, description")
      .eq("workspace_id", ws.workspaceId)
      .limit(20);
    if (like) lq = lq.ilike("name", like);
    const { data } = await lq;
    for (const l of (data || []) as Record<string, unknown>[]) {
      hits.push({
        kind: "list",
        id: l.id as string,
        label: l.name as string,
        sublabel: ((l.description as string) || "").slice(0, 50),
      });
    }
  } else {
    // items = posts in any board OR saves
    let pq = sb
      .from("creator_posts")
      .select(
        "id, title_or_caption, platform, creator:creators!inner(handle, workspace_id)"
      )
      .eq("creators.workspace_id", ws.workspaceId)
      .limit(20);
    if (like) pq = pq.ilike("title_or_caption", like);
    const { data } = await pq;
    for (const p of (data || []) as Record<string, unknown>[]) {
      const c = (p.creator as { handle?: string }) || {};
      hits.push({
        kind: "post",
        id: p.id as string,
        label: ((p.title_or_caption as string) || "").slice(0, 60) || "post",
        sublabel: `@${c.handle || "?"} · ${p.platform}`,
      });
    }
  }

  return NextResponse.json({ hits });
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Server-side loader that hydrates each pane in a workspace view.
 *
 * The /workspace page parses ?panes=... and calls loadPaneData for each
 * entry. The resulting discriminated union is handed to <PaneShell/> as a
 * plain JSON-serializable payload — client components render from there.
 */
import { getSupabase } from "./supabase";
import type { Pane } from "./panes";
import type { Board, Document } from "./types-boards";
import type { Chat, ChatMessage } from "./types-chat";
import type { Creator, CreatorPost } from "./types";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";
import type { LoadedPane } from "./pane-types";

export type { LoadedPane } from "./pane-types";

export async function loadPaneData(pane: Pane): Promise<LoadedPane> {
  const sb = getSupabase();
  if (pane.kind === "post") {
    const { data } = await sb
      .from("creator_posts")
      .select("*, creator:creators(*)")
      .eq("id", pane.id)
      .maybeSingle();
    if (!data) return { kind: "post", id: pane.id, data: null };
    const d = data as Record<string, unknown>;
    const creator = (d.creator as Creator | null) ?? null;
    const { creator: _, ...post } = d;
    void _;
    return {
      kind: "post",
      id: pane.id,
      data: { post: post as unknown as CreatorPost, creator },
    };
  }
  if (pane.kind === "board") {
    const { data: boardRow } = await sb
      .from("boards")
      .select("*")
      .eq("id", pane.id)
      .maybeSingle();
    if (!boardRow) return { kind: "board", id: pane.id, data: null };
    const { data: itemsRow } = await sb
      .from("board_items")
      .select(
        `*,
         creator_post:creator_posts(*, creator:creators(*)),
         card:cards(*),
         document:documents(*),
         file:files(*)`
      )
      .eq("board_id", pane.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    return {
      kind: "board",
      id: pane.id,
      data: {
        board: boardRow as Board,
        items: (itemsRow || []) as unknown as ExpandedBoardItem[],
      },
    };
  }
  if (pane.kind === "chat") {
    const { data: chatRow } = await sb
      .from("chats")
      .select("*")
      .eq("id", pane.id)
      .maybeSingle();
    if (!chatRow) return { kind: "chat", id: pane.id, data: null };
    const { data: msgs } = await sb
      .from("chat_messages")
      .select("*")
      .eq("chat_id", pane.id)
      .order("created_at", { ascending: true });
    return {
      kind: "chat",
      id: pane.id,
      data: {
        chat: chatRow as Chat,
        messages: (msgs || []) as ChatMessage[],
      },
    };
  }
  if (pane.kind === "document") {
    const { data } = await sb
      .from("documents")
      .select("*")
      .eq("id", pane.id)
      .maybeSingle();
    return { kind: "document", id: pane.id, data: (data as Document | null) ?? null };
  }
  if (pane.kind === "creator") {
    const { data: creatorRow } = await sb
      .from("creators")
      .select("*")
      .eq("id", pane.id)
      .maybeSingle();
    if (!creatorRow) return { kind: "creator", id: pane.id, data: null };
    const { data: posts } = await sb
      .from("creator_posts")
      .select("*")
      .eq("creator_id", pane.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20);
    return {
      kind: "creator",
      id: pane.id,
      data: {
        creator: creatorRow as Creator,
        recentPosts: (posts || []) as CreatorPost[],
      },
    };
  }
  if (pane.kind === "discover") {
    const { data } = await sb
      .from("creator_posts")
      .select("*, creator:creators!inner(*)")
      .order("outlier_multiplier", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(24);
    return {
      kind: "discover",
      id: pane.id,
      data: { posts: (data || []) as (CreatorPost & { creator: Creator })[] },
    };
  }
  return { kind: pane.kind, id: pane.id, data: null };
}

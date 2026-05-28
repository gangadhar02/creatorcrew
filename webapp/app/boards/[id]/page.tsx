import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Board, BoardItem, Card, Document, FileRow } from "@/lib/types-boards";
import type { PostWithCreator } from "@/lib/discover-types";
import BoardClient from "@/components/BoardClient";
import RecentBoardTracker from "@/components/RecentBoardTracker";

export const dynamic = "force-dynamic";

export type ExpandedBoardItem = BoardItem & {
  creator_post: (PostWithCreator & { creator: PostWithCreator["creator"] | null }) | null;
  card: Card | null;
  document: Document | null;
  file: FileRow | null;
};

export default async function BoardDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();
  const { data: boardRow } = await sb
    .from("boards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const board = boardRow as Board | null;
  if (!board) notFound();

  const { data: itemsRow } = await sb
    .from("board_items")
    .select(
      `*,
       creator_post:creator_posts(*, creator:creators(*)),
       card:cards(*),
       document:documents(*),
       file:files(*)`
    )
    .eq("board_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const items = (itemsRow || []) as unknown as ExpandedBoardItem[];

  return (
    <div className="space-y-5">
      <Link
        href="/boards"
        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        ← Back to boards
      </Link>

      <RecentBoardTracker boardId={board.id} name={board.name} />
      <BoardClient board={board} initialItems={items} />
    </div>
  );
}

import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Board } from "@/lib/types-boards";
import NewBoardClient from "@/components/NewBoardClient";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  const [wsBoardsRes, templatesRes] = await Promise.all([
    ws.workspaceId
      ? sb
          .from("boards")
          .select("*")
          .eq("workspace_id", ws.workspaceId)
          .eq("kind", "board")
          .order("position", { ascending: true })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    sb
      .from("boards")
      .select("*")
      .eq("kind", "template")
      .order("position", { ascending: true }),
  ]);
  const boards = (wsBoardsRes.data || []) as Board[];
  const templates = (templatesRes.data || []) as Board[];

  // For each board, count items
  const counts: Record<string, number> = {};
  if (boards.length > 0) {
    const ids = boards.map((b) => b.id);
    const { data } = await sb
      .from("board_items")
      .select("board_id")
      .in("board_id", ids);
    for (const r of (data || []) as { board_id: string }[]) {
      counts[r.board_id] = (counts[r.board_id] || 0) + 1;
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Boards</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Curated workspaces. Save posts, jot cards, draft documents, and chat
            with the whole board to generate ideas in your voice.
          </p>
        </div>
        <NewBoardClient />
      </header>

      <section>
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Your boards
        </h2>
        {boards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No boards yet. Create one above, or start from a template below.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <div
                key={b.id}
                className="group relative rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
              >
                <Link href={`/boards/${b.id}`} className="block">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 rounded grid place-items-center text-sm bg-[var(--border)]">
                      {b.icon || "📋"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{b.name}</div>
                      {b.description && (
                        <div className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
                          {b.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-[var(--muted-foreground)] font-mono tabular-nums">
                    {counts[b.id] || 0} {counts[b.id] === 1 ? "item" : "items"}
                  </div>
                </Link>
                <Link
                  href={`/workspace?panes=board%3A${b.id}&active=0`}
                  title="Open in workspace pane"
                  className="absolute right-2 top-2 rounded p-1 text-[var(--muted-foreground)] opacity-0 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="7" height="16" rx="1" />
                    <rect x="13" y="4" width="7" height="16" rx="1" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Starter templates
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => (
            <NewBoardClient key={t.id} template={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

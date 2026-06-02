import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import StatusBadge from "@/components/StatusBadge";
import type { ContentIdea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const { data } = await sb
    .from("content_ideas")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("created_at", { ascending: false });
  const ideas = (data || []) as ContentIdea[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Content Ideas</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {ideas.length} ideas
        </p>
      </header>

      <div className="space-y-3">
        {ideas.map((idea) => (
          <Link
            key={idea.id}
            href={`/ideas/${idea.id}`}
            className="block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{idea.name}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {idea.pillar && (
                    <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs">
                      {idea.pillar}
                    </span>
                  )}
                  {(idea.platforms || []).map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]"
                    >
                      {p}
                    </span>
                  ))}
                  {idea.format && (
                    <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      {idea.format}
                    </span>
                  )}
                </div>
                {idea.angle && (
                  <p className="mt-2 text-sm text-[var(--muted-foreground)] line-clamp-2">
                    {idea.angle}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge value={idea.priority} />
                <StatusBadge value={idea.status} />
              </div>
            </div>
          </Link>
        ))}
        {ideas.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
            No content ideas yet. Run /ideate to generate from your saves.
          </div>
        )}
      </div>
    </div>
  );
}

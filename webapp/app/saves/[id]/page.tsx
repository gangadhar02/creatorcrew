import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import MarkdownView from "@/components/MarkdownView";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SaveDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();
  const ws = await getWorkspaceContext();

  const { data: save } = await sb
    .from("saves")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();

  if (!save) notFound();

  // Find any content ideas linked to this save
  const { data: ideas } = await sb
    .from("content_ideas")
    .select("id, name, pillar, priority, status")
    .eq("save_id", id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/saves"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to saves
        </Link>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={save.status} />
          <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            {save.type}
          </span>
          {save.collection_name && (
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
              {save.collection_name}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold">@{save.author || "unknown"}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
          <a
            href={save.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            View on Instagram ↗
          </a>
          <span>media_pk: {save.media_pk}</span>
          {save.saved_at && (
            <span>saved {new Date(save.saved_at).toLocaleString()}</span>
          )}
        </div>
      </header>

      {save.caption && (
        <section>
          <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Caption
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
            {save.caption}
          </p>
        </section>
      )}

      {ideas && ideas.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Linked content ideas
          </h2>
          <div className="space-y-2">
            {ideas.map((i) => (
              <Link
                key={i.id}
                href={`/ideas/${i.id}`}
                className="block rounded-md border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--primary)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i.name}</span>
                  <div className="flex gap-2">
                    {i.pillar && (
                      <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs">
                        {i.pillar}
                      </span>
                    )}
                    <StatusBadge value={i.priority} />
                    <StatusBadge value={i.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {save.vision_analysis_md ? (
        <section>
          <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Vision analysis
          </h2>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <MarkdownView>{save.vision_analysis_md}</MarkdownView>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted-foreground)]">
          No vision analysis yet. Run sync to analyze.
        </section>
      )}
    </div>
  );
}

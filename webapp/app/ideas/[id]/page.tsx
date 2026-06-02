import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import StatusBadge from "@/components/StatusBadge";
import EditableSection from "@/components/EditableSection";
import type { ContentIdea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeaDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();
  const ws = await getWorkspaceContext();

  const { data } = await sb
    .from("content_ideas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const idea = data as ContentIdea | null;

  if (!idea) notFound();

  // Optional source save (scoped to this workspace)
  let sourceSave: { id: string; author: string | null; url: string } | null = null;
  if (idea.save_id) {
    const { data: s } = await sb
      .from("saves")
      .select("id, author, url")
      .eq("id", idea.save_id)
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();
    sourceSave = (s as { id: string; author: string | null; url: string } | null) || null;
  }

  const platforms = idea.platforms || [];
  const showIG = platforms.includes("Instagram") || !!idea.ig_breakdown_md;
  const showX = platforms.includes("X") || !!idea.x_breakdown_md;
  const showYT = platforms.includes("YouTube") || !!idea.youtube_breakdown_md;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/ideas"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to ideas
        </Link>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {idea.pillar && (
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs">
              {idea.pillar}
            </span>
          )}
          <StatusBadge value={idea.priority} />
          <StatusBadge value={idea.status} />
          {idea.format && (
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
              {idea.format}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold leading-tight">{idea.name}</h1>
        {idea.angle && (
          <p className="text-base text-[var(--muted-foreground)]">{idea.angle}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
          {platforms.map((p) => (
            <span key={p}>{p}</span>
          ))}
          {idea.week_of && <span>Week of {idea.week_of}</span>}
          {sourceSave && (
            <Link
              href={`/saves/${sourceSave.id}`}
              className="hover:underline"
            >
              from @{sourceSave.author}
            </Link>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Hook variations
        </h2>
        <div className="space-y-2">
          {[
            ["Curiosity", idea.hook_curiosity],
            ["Value", idea.hook_value],
            ["Emotional", idea.hook_emotional],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
                  {label}
                </div>
                <div className="mt-1 text-sm">{value}</div>
              </div>
            ))}
        </div>
      </section>

      <EditableSection
        ideaId={idea.id}
        field="outline_md"
        initial={idea.outline_md || ""}
        label="Outline"
        placeholder="HOOK → key points → CTA"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {showIG && (
          <EditableSection
            ideaId={idea.id}
            field="ig_breakdown_md"
            initial={idea.ig_breakdown_md || ""}
            label="Instagram"
            placeholder="Slide list / shot list…"
          />
        )}
        {showX && (
          <EditableSection
            ideaId={idea.id}
            field="x_breakdown_md"
            initial={idea.x_breakdown_md || ""}
            label="X / Twitter"
            placeholder="Thread structure…"
          />
        )}
        {showYT && (
          <EditableSection
            ideaId={idea.id}
            field="youtube_breakdown_md"
            initial={idea.youtube_breakdown_md || ""}
            label="YouTube"
            placeholder="Long-form notes…"
          />
        )}
      </div>

      <EditableSection
        ideaId={idea.id}
        field="body_md"
        initial={idea.body_md || ""}
        label="Notes"
        placeholder="Production notes, references, research, anything else…"
      />
    </div>
  );
}

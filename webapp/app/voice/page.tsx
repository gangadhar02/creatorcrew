import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Voice } from "@/lib/types";
import VoiceLibraryClient from "@/components/VoiceLibraryClient";

export const dynamic = "force-dynamic";

export default async function VoiceLibrary() {
  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  const [wsVoicesRes, archetypesRes] = await Promise.all([
    ws.workspaceId
      ? sb
          .from("voices")
          .select("*")
          .eq("workspace_id", ws.workspaceId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    sb
      .from("voices")
      .select("*")
      .eq("is_archetype", true)
      .order("name"),
  ]);

  const wsVoices = (wsVoicesRes.data || []) as Voice[];
  const archetypes = (archetypesRes.data || []) as Voice[];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Voice</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your intellectual signature. Every AI generation in Saves Engine
            uses the voice you pick.
          </p>
        </div>
        <VoiceLibraryClient />
      </header>

      <section>
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Your voices
        </h2>
        {wsVoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              You haven&apos;t built a voice yet. Click <b>Build voice</b> above to start.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wsVoices.map((v) => (
              <VoiceCard key={v.id} voice={v} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
          Archetypes
        </h2>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          Built-in starting points. Click any one in the Build voice modal to
          clone it into your workspace.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archetypes.map((v) => (
            <VoiceCard key={v.id} voice={v} readOnly />
          ))}
        </div>
      </section>
    </div>
  );
}

function VoiceCard({ voice, readOnly }: { voice: Voice; readOnly?: boolean }) {
  return (
    <Link
      href={readOnly ? "/voice" : `/voice/${voice.id}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium truncate">{voice.name}</h3>
        {voice.is_default && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
            default
          </span>
        )}
        {voice.is_archetype && (
          <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 dark:bg-sky-900/30 dark:text-sky-200">
            archetype
          </span>
        )}
      </div>
      {voice.archetype && voice.archetype !== voice.name && (
        <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
          {voice.archetype}
        </div>
      )}
      {voice.mission_md && (
        <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-3">
          {voice.mission_md}
        </p>
      )}
    </Link>
  );
}

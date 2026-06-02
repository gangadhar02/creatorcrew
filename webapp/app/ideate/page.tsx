import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Save } from "@/lib/types";
import IdeationFlow from "@/components/IdeationFlow";

export const dynamic = "force-dynamic";

export default async function IdeatePage() {
  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const { data } = await sb
    .from("saves")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .eq("status", "New")
    .order("saved_at", { ascending: true });
  const newSaves = (data || []) as Save[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Ideate</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Generate content ideas from saves where Status = New. Each idea is
          produced by Gemini using the full vision analysis as primary context.
        </p>
      </header>

      {newSaves.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No new saves to ideate. Run a sync to pull more, or flip a save
            back to Status = New from{" "}
            <Link href="/saves" className="underline">
              /saves
            </Link>
            .
          </p>
        </div>
      ) : (
        <IdeationFlow saves={newSaves} />
      )}
    </div>
  );
}

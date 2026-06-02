import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import StatusBadge from "@/components/StatusBadge";
import SavesRealtime from "@/components/SavesRealtime";
import type { SaveStatus, SaveType } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  type?: string;
  collection?: string;
  q?: string;
}>;

const STATUSES: SaveStatus[] = ["New", "Reviewed", "Used"];
const TYPES: SaveType[] = ["Post", "Reel", "Carousel", "IGTV"];

export default async function SavesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const sb = getSupabase();
  const ws = await getWorkspaceContext();

  let query = sb
    .from("saves")
    .select("*")
    .eq("workspace_id", ws.workspaceId)
    .order("saved_at", { ascending: false })
    .limit(200);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.type) query = query.eq("type", sp.type);
  if (sp.collection) query = query.eq("collection_name", sp.collection);
  if (sp.q) query = query.or(`caption.ilike.%${sp.q}%,author.ilike.%${sp.q}%`);

  const { data: saves } = await query;

  // For the collection filter dropdown
  const { data: collections } = await sb
    .from("saves")
    .select("collection_name")
    .eq("workspace_id", ws.workspaceId)
    .not("collection_name", "is", null);
  const uniqueCollections = Array.from(
    new Set((collections || []).map((c) => c.collection_name).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Saves</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {saves?.length || 0} {sp.status ? `${sp.status} ` : ""}saves
          </p>
        </div>
        <SavesRealtime />
      </header>

      {/* Filters */}
      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
        method="get"
      >
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Search caption or author…"
          className="flex-1 min-w-[200px] rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <select
          name="status"
          defaultValue={sp.status || ""}
          className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={sp.type || ""}
          className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          name="collection"
          defaultValue={sp.collection || ""}
          className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">All collections</option>
          {uniqueCollections.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Filter
        </button>
        {(sp.status || sp.type || sp.collection || sp.q) && (
          <Link
            href="/saves"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Reset
          </Link>
        )}
      </form>

      {/* List */}
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--border)]/30 text-left text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Author</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Collection</th>
              <th className="px-4 py-2 font-medium">Caption</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Vision</th>
            </tr>
          </thead>
          <tbody>
            {(saves || []).length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--muted-foreground)]"
                >
                  No saves match. Try resetting filters.
                </td>
              </tr>
            ) : (
              (saves || []).map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-[var(--border)] hover:bg-[var(--border)]/20"
                >
                  <td className="px-4 py-2 font-medium">
                    <Link
                      href={`/saves/${s.id}`}
                      className="hover:underline"
                    >
                      @{s.author || "unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">{s.type}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">
                    {s.collection_name || "—"}
                  </td>
                  <td className="px-4 py-2 max-w-md truncate text-[var(--muted-foreground)]">
                    {s.caption?.slice(0, 100) || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge value={s.status} />
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-[var(--muted-foreground)] tabular-nums">
                    {s.vision_analysis_md
                      ? `${Math.round(s.vision_analysis_md.length / 100) / 10}k`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

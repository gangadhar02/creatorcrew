import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Creator } from "@/lib/types";
import CreatorsClient from "@/components/CreatorsClient";
import CreatorsGrid from "@/components/CreatorsGrid";

export const dynamic = "force-dynamic";

const TOP_TABS = [
  { id: "discover", label: "Discover", href: "/discover" },
  { id: "creators", label: "Creators", href: "/creators" },
  { id: "lists", label: "My Lists", href: "/creators?lists=1" },
];

type SearchParams = Promise<{ list?: string; lists?: string }>;

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const activeListId = sp.list || null;
  const listsView = sp.lists === "1";
  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  // Fetch creators in workspace
  const creatorsRes = ws.workspaceId
    ? await sb
        .from("creators")
        .select("*")
        .eq("workspace_id", ws.workspaceId)
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    : { data: [] };
  const allCreators = (creatorsRes.data || []) as Creator[];

  // Fetch lists
  const listsRes = ws.workspaceId
    ? await sb
        .from("creator_lists")
        .select("*")
        .eq("workspace_id", ws.workspaceId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] };
  const lists = (listsRes.data || []) as {
    id: string;
    name: string;
    color: string;
  }[];

  // If a list is active, filter creators by membership
  let creators = allCreators;
  if (activeListId) {
    const { data: members } = await sb
      .from("creator_list_members")
      .select("creator_id")
      .eq("list_id", activeListId);
    const memberIds = new Set(
      (members || []).map((m) => (m as { creator_id: string }).creator_id)
    );
    creators = allCreators.filter((c) => memberIds.has(c.id));
  }

  // Member counts for the list tabs
  const memberCounts: Record<string, number> = {};
  if (lists.length > 0) {
    const { data } = await sb
      .from("creator_list_members")
      .select("list_id");
    for (const m of (data || []) as { list_id: string }[]) {
      memberCounts[m.list_id] = (memberCounts[m.list_id] || 0) + 1;
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-6 text-2xl font-semibold border-b border-border pb-2">
        {TOP_TABS.map((t) => {
          const active =
            t.id === "creators"
              ? !listsView && !activeListId
              : t.id === "lists"
                ? listsView || Boolean(activeListId)
                : false;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={
                active
                  ? "relative text-foreground after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </header>

      <CreatorsClient
        lists={lists}
        memberCounts={memberCounts}
        activeListId={activeListId}
        totalCreators={allCreators.length}
        listsView={listsView}
      />

      {listsView && !activeListId ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {lists.length === 0
            ? "Create your first list using the field above, then add creators from their profile pages."
            : "Select a list above to view its creators, or switch to All Following to browse everyone."}
        </div>
      ) : creators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {activeListId
            ? "No creators in this list yet. Add some from the 'All Following' tab."
            : listsView && lists.length === 0
              ? "No lists yet. Create one above to organize creators."
              : "No creators yet. Use the form above to add one."}
        </div>
      ) : (
        <CreatorsGrid creators={creators} />
      )}
    </div>
  );
}

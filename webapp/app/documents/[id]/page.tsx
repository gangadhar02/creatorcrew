import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Document } from "@/lib/types-boards";
import DocumentEditor from "@/components/DocumentEditor";

export const dynamic = "force-dynamic";

export default async function DocumentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const doc = data as Document | null;
  if (!doc) notFound();
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link
        href="/boards"
        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        ← Back
      </Link>
      <DocumentEditor initial={doc} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Voice } from "@/lib/types";
import VoiceDetailClient from "@/components/VoiceDetailClient";

export const dynamic = "force-dynamic";

export default async function VoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb
    .from("voices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const voice = data as Voice | null;
  if (!voice) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/voice"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to voices
        </Link>
      </div>

      <VoiceDetailClient initial={voice} />
    </div>
  );
}

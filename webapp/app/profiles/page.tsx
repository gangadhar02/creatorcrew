import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import AnalyzeProfileForm from "@/components/AnalyzeProfileForm";
import { igImg } from "@/lib/proxy-image";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  ig_handle: string;
  display_name: string | null;
  bio: string | null;
  follower_count: number | null;
  post_count: number | null;
  profile_pic_url: string | null;
  is_verified: boolean | null;
  typical_reel_views: number | null;
  typical_post_likes: number | null;
  analyzed_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
};

function fmtNum(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ProfilesPage() {
  const sb = getSupabase();
  const { data } = await sb
    .from("profiles")
    .select(
      "id, ig_handle, display_name, bio, follower_count, post_count, profile_pic_url, is_verified, typical_reel_views, typical_post_likes, analyzed_at, sync_status, sync_error"
    )
    .order("analyzed_at", { ascending: false, nullsFirst: false });
  const profiles = (data || []) as ProfileRow[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Profile Analyzer</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Paste any Instagram handle to cache their recent posts, compute outlier
          scores, and surface their top-performing content.
        </p>
      </header>

      <AnalyzeProfileForm />

      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          No profiles analyzed yet. Add a handle above to get started.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href={`/profiles/${p.ig_handle}`}
              className="block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
            >
              <div className="flex items-start gap-3">
                {p.profile_pic_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={igImg(p.profile_pic_url)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--border)]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium truncate">
                      {p.display_name || `@${p.ig_handle}`}
                    </div>
                    {p.is_verified && (
                      <span className="text-xs text-sky-500">✓</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate">
                    @{p.ig_handle}
                  </div>
                </div>
              </div>
              {p.bio && (
                <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-2">
                  {p.bio}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-[var(--muted-foreground)]">followers</div>
                  <div className="font-medium tabular-nums">
                    {fmtNum(p.follower_count)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--muted-foreground)]">reel views</div>
                  <div className="font-medium tabular-nums">
                    {fmtNum(p.typical_reel_views)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--muted-foreground)]">post likes</div>
                  <div className="font-medium tabular-nums">
                    {fmtNum(p.typical_post_likes)}
                  </div>
                </div>
              </div>
              {p.sync_status === "failed" && (
                <div className="mt-2 text-[10px] text-rose-500 truncate">
                  {p.sync_error || "Sync failed"}
                </div>
              )}
              {p.sync_status === "syncing" && (
                <div className="mt-2 text-[10px] text-amber-500">Syncing…</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

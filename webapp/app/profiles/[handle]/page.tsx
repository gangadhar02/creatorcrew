import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import ProfilePostsGrid, { type ProfilePost } from "@/components/ProfilePostsGrid";
import RefreshProfileButton from "@/components/RefreshProfileButton";
import { igImg } from "@/lib/proxy-image";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  sort?: string;
  type?: string;
  range?: string;
  q?: string;
}>;

const RANGE_OPTIONS = [
  { id: "all", label: "All time" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "6mo", label: "6 months" },
  { id: "1y", label: "1 year" },
];

function rangeToCutoff(range: string): string | null {
  const days: Record<string, number> = {
    "30d": 30,
    "90d": 90,
    "6mo": 180,
    "1y": 365,
  };
  if (!days[range]) return null;
  const d = new Date();
  d.setDate(d.getDate() - days[range]);
  return d.toISOString();
}

function fmtNum(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ProfileDetail({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: SearchParams;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const sort = sp.sort || "recent";
  const typeFilter = sp.type || "all";
  const range = sp.range || "all";
  const q = sp.q || "";

  const sb = getSupabase();
  const ws = await getWorkspaceContext();
  const { data: profileData } = await sb
    .from("profiles")
    .select("*")
    .eq("ig_handle", handle.toLowerCase())
    .eq("workspace_id", ws.workspaceId)
    .maybeSingle();
  if (!profileData) notFound();
  const profile = profileData as {
    id: string;
    ig_handle: string;
    display_name: string | null;
    bio: string | null;
    follower_count: number | null;
    following_count: number | null;
    post_count: number | null;
    profile_pic_url: string | null;
    is_verified: boolean | null;
    typical_reel_views: number | null;
    typical_post_likes: number | null;
    analyzed_at: string | null;
    last_synced_at: string | null;
    sync_status: string | null;
  };

  // Build posts query
  let query = sb.from("profile_posts").select("*").eq("profile_id", profile.id);
  if (typeFilter !== "all") {
    const typeMap: Record<string, string> = {
      reels: "Reel",
      carousels: "Carousel",
      photos: "Post",
    };
    if (typeMap[typeFilter]) query = query.eq("type", typeMap[typeFilter]);
  }
  const cutoff = rangeToCutoff(range);
  if (cutoff) query = query.gte("taken_at", cutoff);
  if (q) query = query.ilike("caption", `%${q}%`);

  switch (sort) {
    case "top_liked":
      query = query.order("like_count", { ascending: false });
      break;
    case "top_viewed":
      query = query.order("view_count", { ascending: false });
      break;
    case "top_outlier":
      query = query.order("outlier_multiplier", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "recent":
    default:
      query = query.order("taken_at", { ascending: false, nullsFirst: false });
  }
  query = query.limit(200);

  const { data: postsData } = await query;
  const posts = (postsData || []) as ProfilePost[];

  // Map each profile_posts row to its dual-written creator_posts id so the
  // card's Chat / Add-to-board actions (which operate on creator_posts) work.
  const mediaPks = posts.map((p) => p.media_pk).filter(Boolean);
  if (ws.workspaceId && mediaPks.length > 0) {
    const { data: creatorRows } = await sb
      .from("creators")
      .select("id")
      .eq("workspace_id", ws.workspaceId)
      .eq("platform", "instagram")
      .eq("handle", handle.toLowerCase());
    const creatorIds = (creatorRows || []).map((r) => (r as { id: string }).id);
    if (creatorIds.length > 0) {
      const { data: cps } = await sb
        .from("creator_posts")
        .select("id, platform_pk")
        .in("creator_id", creatorIds)
        .in("platform_pk", mediaPks);
      const cpMap: Record<string, string> = {};
      for (const cp of (cps || []) as { id: string; platform_pk: string }[]) {
        cpMap[cp.platform_pk] = cp.id;
      }
      for (const p of posts) {
        p.creator_post_id = cpMap[p.media_pk] ?? null;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/profiles"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to profiles
        </Link>
      </div>

      <header className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start gap-4">
          {profile.profile_pic_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={igImg(profile.profile_pic_url)}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-full bg-[var(--border)]" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {profile.display_name || `@${profile.ig_handle}`}
              </h1>
              {profile.is_verified && (
                <span className="text-sm text-sky-500">✓</span>
              )}
            </div>
            <div className="text-sm text-[var(--muted-foreground)]">
              @{profile.ig_handle}
            </div>
            {profile.bio && (
              <p className="mt-2 text-sm whitespace-pre-wrap">{profile.bio}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <a
              href={`https://instagram.com/${profile.ig_handle}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--border)]/30"
            >
              Open on IG ↗
            </a>
            <RefreshProfileButton handle={profile.ig_handle} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <Stat label="followers" value={fmtNum(profile.follower_count)} />
          <Stat label="posts cached" value={posts.length} />
          <Stat
            label="typical reel views"
            value={fmtNum(profile.typical_reel_views)}
          />
          <Stat
            label="typical post likes"
            value={fmtNum(profile.typical_post_likes)}
          />
          {profile.last_synced_at && (
            <Stat
              label="last synced"
              value={new Date(profile.last_synced_at).toLocaleString()}
            />
          )}
        </div>
      </header>

      {/* Filters */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search captions…"
          className="flex-1 min-w-[200px] rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="type" value={typeFilter} />
        <input type="hidden" name="range" value={range} />
        <button
          type="submit"
          className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <TabGroup
          name="sort"
          value={sort}
          options={[
            { id: "recent", label: "Recent" },
            { id: "top_liked", label: "Top liked" },
            { id: "top_viewed", label: "Top viewed" },
            { id: "top_outlier", label: "Top outlier" },
          ]}
          baseHref={`/profiles/${profile.ig_handle}`}
          otherParams={{ type: typeFilter, range, q }}
        />
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Type
        </span>
        <TabGroup
          name="type"
          value={typeFilter}
          options={[
            { id: "reels", label: "Reels" },
            { id: "carousels", label: "Carousels" },
            { id: "photos", label: "Photos" },
            { id: "all", label: "All" },
          ]}
          baseHref={`/profiles/${profile.ig_handle}`}
          otherParams={{ sort, range, q }}
        />
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Range
        </span>
        <TabGroup
          name="range"
          value={range}
          options={RANGE_OPTIONS}
          baseHref={`/profiles/${profile.ig_handle}`}
          otherParams={{ sort, type: typeFilter, q }}
        />
      </div>

      <ProfilePostsGrid posts={posts} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[var(--muted-foreground)]">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function TabGroup({
  value,
  options,
  baseHref,
  otherParams,
  name,
}: {
  name: string;
  value: string;
  options: { id: string; label: string }[];
  baseHref: string;
  otherParams: Record<string, string>;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5">
      {options.map((o) => {
        const params = new URLSearchParams({ ...otherParams, [name]: o.id });
        return (
          <Link
            key={o.id}
            href={`${baseHref}?${params.toString()}`}
            className={
              value === o.id
                ? "rounded px-3 py-1 text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "rounded px-3 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

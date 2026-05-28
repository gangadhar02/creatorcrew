"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, ChevronDown, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { PostWithCreator } from "@/lib/discover-types";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
type ListPill = { id: string; name: string; color: string };

type Sort = "recent" | "top_liked" | "top_viewed" | "outlier";
const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "top_liked", label: "Top liked" },
  { id: "top_viewed", label: "Top viewed" },
  { id: "outlier", label: "Top outlier" },
];

const PLATFORMS: { id: string; label: string }[] = [
  { id: "all", label: "All platforms" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "substack", label: "Substack" },
  { id: "x", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
];

const FILTER_KEY = "home-following-filter:v1";
type StoredFilter = {
  listId: "all" | string;
  sort: Sort;
  platform: string;
};

export default function HomeFollowingFeed({ lists }: { lists: ListPill[] }) {
  const [filter, setFilter] = useState<StoredFilter>({
    listId: "all",
    sort: "recent",
    platform: "all",
  });
  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFollowing, setHasFollowing] = useState<boolean | null>(null);

  // Restore filter from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredFilter>;
        setFilter((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  function updateFilter(patch: Partial<StoredFilter>) {
    setFilter((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(FILTER_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Fetch posts when filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const qs = new URLSearchParams({
        sort: filter.sort,
        platform: filter.platform,
        ...(filter.listId !== "all" ? { list: String(filter.listId) } : {}),
        limit: "12",
      });
      try {
        const res = await fetch(`/api/home-feed?${qs.toString()}`);
        const data = await res.json();
        if (!cancelled) {
          setPosts(data.posts || []);
          setHasFollowing(Boolean(data.hasFollowing));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const headerPills = useMemo(
    () => [
      { id: "all", name: "Following", color: "gray" },
      ...lists.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    ],
    [lists]
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">My lists</h2>
        </div>
        <PlatformDropdown
          value={filter.platform}
          onChange={(p) => updateFilter({ platform: p })}
        />
      </div>

      {/* Filter pills */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {headerPills.map((p) => {
          const active = filter.listId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => updateFilter({ listId: p.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <ColorDot color={p.color} active={active} />
              {p.name}
            </button>
          );
        })}
        <Link
          href="/creators"
          className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          + Add creators
        </Link>
      </div>

      {/* Sort tabs */}
      <div className="mb-3 flex items-center gap-1 border-b text-xs">
        {SORTS.map((s) => {
          const active = filter.sort === s.id;
          return (
            <button
              key={s.id}
              onClick={() => updateFilter({ sort: s.id })}
              className={cn(
                "relative px-3 py-2 transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
          Loading feed…
        </Card>
      ) : posts.length === 0 ? (
        hasFollowing === false ? (
          <Card className="border-dashed p-10 text-center">
            <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-muted grid place-items-center">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              You aren&apos;t following anyone yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Head to{" "}
              <Link href="/creators" className="underline">
                Creators
              </Link>
              , search for accounts you like, and tap Follow.
            </p>
          </Card>
        ) : (
          <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
            No posts match the current filter.
          </Card>
        )
      ) : (
        <MasonryGrid>
          {posts.map((p, i) => (
            <MasonryItem key={p.id}>
              <PostCard post={p} surface="home" position={i} />
            </MasonryItem>
          ))}
        </MasonryGrid>
      )}

      {/* Browse-more link */}
      <div className="mt-3 text-right">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Browse Discover
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

function PlatformDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const active = PLATFORMS.find((p) => p.id === value) || PLATFORMS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
            {active.label}
            <ChevronDown className="h-3 w-3" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Platform</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PLATFORMS.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => onChange(p.id)}>
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColorDot({ color, active }: { color: string; active: boolean }) {
  if (active) return null;
  const map: Record<string, string> = {
    blue: "bg-sky-400",
    purple: "bg-purple-400",
    orange: "bg-orange-400",
    green: "bg-emerald-400",
    pink: "bg-pink-400",
    red: "bg-rose-400",
    gray: "bg-zinc-400",
  };
  return (
    <span
      className={cn(
        "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
        map[color] || map.gray
      )}
    />
  );
}

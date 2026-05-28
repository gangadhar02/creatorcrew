"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import FilterNavLink from "@/components/FilterNavLink";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildFilterHref, DISCOVER_RANGES } from "@/lib/discover-url";

const SORT_OPTIONS = [
  { id: "recent", label: "Recent" },
  { id: "top_liked", label: "Top liked" },
  { id: "top_viewed", label: "Top viewed" },
  { id: "top_outlier", label: "Top outlier" },
] as const;

const TYPE_OPTIONS = [
  { id: "Reel", label: "Reels" },
  { id: "Carousel", label: "Carousels" },
  { id: "Post", label: "Photos" },
  { id: "all", label: "All" },
] as const;

export default function CreatorProfileToolbar({
  basePath,
  sp,
}: {
  basePath: string;
  sp: Record<string, string | undefined>;
}) {
  const router = useRouter();

  const sort = sp.sort || "recent";
  const typeFilter = sp.type || "all";
  const range = sp.range || "all";
  const q = sp.q || "";

  function href(patch: Record<string, string | null | undefined>) {
    return buildFilterHref(basePath, sp, patch);
  }

  const rangeLabel =
    DISCOVER_RANGES.find((r) => r.id === range)?.label || "All time";

  return (
    <div className="space-y-3">
      {/* Search + time period — Eden layout */}
      <div className="flex items-center gap-2">
        <form
          className="relative flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const next = String(fd.get("q") || "").trim();
            router.push(href({ q: next || null }));
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search posts…"
            className="h-10 rounded-full border-border bg-card pl-9 pr-4 shadow-sm"
          />
        </form>

        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-2 text-xs shadow-sm hover:border-primary/40 transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{rangeLabel}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            }
          />
          <PopoverContent className="w-48 p-1" align="end">
            {DISCOVER_RANGES.map((r) => {
              const active = r.id === range;
              return (
                <FilterNavLink
                  key={r.id}
                  href={href({ range: r.id === "all" ? null : r.id })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/60"
                  )}
                >
                  <span className="flex-1">{r.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </FilterNavLink>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* Sort + type pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <PillGroup
          options={SORT_OPTIONS}
          value={sort}
          omitDefault="recent"
          name="sort"
          href={href}
        />
        <span className="ml-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Type
        </span>
        <PillGroup
          options={TYPE_OPTIONS}
          value={typeFilter}
          omitDefault="all"
          name="type"
          href={href}
        />
      </div>
    </div>
  );
}

function PillGroup({
  options,
  value,
  omitDefault,
  name,
  href,
}: {
  options: readonly { id: string; label: string }[];
  value: string;
  omitDefault: string;
  name: string;
  href: (patch: Record<string, string | null | undefined>) => string;
}) {
  return (
    <div className="inline-flex rounded-full border bg-card p-0.5 shadow-sm">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <Link
            key={o.id}
            href={href({ [name]: o.id === omitDefault ? null : o.id })}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function CreatorProfileHeader({
  displayName,
  handle,
  platform,
  bio,
  avatarUrl,
  isVerified,
  externalUrl,
  listMenu,
  stats,
}: {
  displayName: string;
  handle: string;
  platform: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  externalUrl: string;
  listMenu: React.ReactNode;
  stats: { label: string; value: string | number }[];
}) {
  return (
    <>
      <Link
        href="/creators"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {displayName}
      </Link>

      <header className="space-y-4">
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-full bg-muted ring-2 ring-border" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{displayName}</h1>
              {isVerified && (
                <span className="text-sm text-sky-500" aria-label="Verified">
                  ✓
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              @{handle}
              {platform !== "instagram" && (
                <span className="ml-2 capitalize">{platform}</span>
              )}
            </div>
            {bio && (
              <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">
                {bio}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            {listMenu}
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs shadow-sm hover:border-primary/40 transition-colors"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-muted-foreground">{s.label}</div>
              <div className="font-medium tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      </header>
    </>
  );
}

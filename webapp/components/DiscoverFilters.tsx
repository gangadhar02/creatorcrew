"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  Eye,
  ImageOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import FilterNavLink from "@/components/FilterNavLink";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  buildFilterHref,
  DEFAULT_DISCOVER_RANGE,
  DEFAULT_DISCOVER_SORT,
  DEFAULT_MIN_OUTLIER,
  DISCOVER_OUTLIER_THRESHOLDS,
  DISCOVER_PLATFORMS,
  DISCOVER_RANGES,
  DISCOVER_SORTS,
  discoverSummary,
  isDiscoverDirty,
} from "@/lib/discover-url";

const OUTLIER_ICONS = ["text-emerald-500", "text-sky-500", "text-violet-500", "text-amber-500", "text-rose-500"];

export default function DiscoverFilters({
  sp,
  basePath,
  totalCount,
  shown,
}: {
  sp: Record<string, string | undefined>;
  basePath: string;
  totalCount: number;
  shown: number;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const range = sp.range || DEFAULT_DISCOVER_RANGE;
  const platform = sp.platform || "all";
  const minOutlier = sp.min_outlier ?? DEFAULT_MIN_OUTLIER;
  const hideSeen = sp.hide_seen === "1";
  const hideImages = sp.hide_images === "1";
  const sort = sp.sort || DEFAULT_DISCOVER_SORT;
  const dirty = isDiscoverDirty(sp);

  function href(patch: Record<string, string | null | undefined>) {
    return buildFilterHref(basePath, sp, patch);
  }

  const selectedPlatforms =
    platform === "all"
      ? DISCOVER_PLATFORMS.map((p) => p.id)
      : platform.split(",").map((s) => s.trim()).filter(Boolean);

  function togglePlatform(id: string) {
    if (platform === "all") {
      return href({ platform: id });
    }
    const set = new Set(selectedPlatforms);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = [...set];
    if (next.length === 0 || next.length === DISCOVER_PLATFORMS.length) {
      return href({ platform: null });
    }
    return href({ platform: next.join(",") });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Eden-style consolidated filter */}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-sm hover:border-primary/40 transition-colors",
                dirty && "border-primary/60 bg-primary/5"
              )}
            >
              <span>{discoverSummary(sp)}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  dirty ? "bg-emerald-500" : "bg-emerald-500/70"
                )}
              />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          }
        />
        <PopoverContent
          className="w-[min(100vw-2rem,22rem)] space-y-4 p-4 backdrop-blur-xl"
          align="start"
        >
          {/* Platforms */}
          <section>
            <SectionLabel>Platforms</SectionLabel>
            <div className="mt-2 space-y-0.5">
              {DISCOVER_PLATFORMS.map((p) => {
                const checked =
                  platform === "all" || selectedPlatforms.includes(p.id);
                return (
                  <FilterNavLink
                    key={p.id}
                    href={togglePlatform(p.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/60 transition-colors"
                  >
                    <PlatformDot id={p.id} />
                    <span className="flex-1">{p.label}</span>
                    {checked && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </FilterNavLink>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {platform === "all"
                  ? `${DISCOVER_PLATFORMS.length} of ${DISCOVER_PLATFORMS.length} selected`
                  : `${selectedPlatforms.length} of ${DISCOVER_PLATFORMS.length} selected`}
              </span>
              {platform !== "all" && (
                <FilterNavLink
                  href={href({ platform: null })}
                  className="font-medium text-foreground hover:underline"
                >
                  Select all
                </FilterNavLink>
              )}
            </div>
          </section>

          {/* Min outlier */}
          <section>
            <SectionLabel>Min outlier score</SectionLabel>
            <div className="mt-2 space-y-0.5">
              {DISCOVER_OUTLIER_THRESHOLDS.map((o, i) => {
                const active = o.id === minOutlier;
                return (
                  <FilterNavLink
                    key={o.id}
                    href={href({
                      min_outlier:
                        o.id === DEFAULT_MIN_OUTLIER ? null : o.id,
                    })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                      active ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <Sparkles
                      className={cn("h-3.5 w-3.5", OUTLIER_ICONS[i] || "text-muted-foreground")}
                    />
                    <span className="flex-1">{o.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </FilterNavLink>
                );
              })}
            </div>
          </section>

          {/* Time period */}
          <section>
            <SectionLabel>Posted within</SectionLabel>
            <div className="mt-2 space-y-0.5">
              {DISCOVER_RANGES.map((r) => {
                const active = r.id === range;
                return (
                  <FilterNavLink
                    key={r.id}
                    href={href({
                      range: r.id === DEFAULT_DISCOVER_RANGE ? null : r.id,
                    })}
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
            </div>
          </section>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 shadow-sm hover:border-primary/40 transition-colors"
            >
              Sort:{" "}
              <span className="font-medium">
                {DISCOVER_SORTS.find((s) => s.id === sort)?.label || "Top outlier"}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          }
        />
        <PopoverContent className="w-44 p-1" align="start">
          {DISCOVER_SORTS.map((s) => (
            <FilterNavLink
              key={s.id}
              href={href({ sort: s.id === DEFAULT_DISCOVER_SORT ? null : s.id })}
              className={cn(
                "block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                sort === s.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              {s.label}
            </FilterNavLink>
          ))}
        </PopoverContent>
      </Popover>

      {dirty && (
        <Link
          href={basePath}
          className="text-muted-foreground underline hover:text-foreground px-2"
        >
          Reset
        </Link>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <UtilityIcon
          active={hideSeen}
          title={hideSeen ? "Showing all posts" : "Hide posts you've seen"}
          href={href({ hide_seen: hideSeen ? null : "1" })}
        >
          <Eye className={cn("h-3.5 w-3.5", hideSeen && "opacity-50")} />
          {hideSeen && (
            <span className="absolute inset-x-0 top-1/2 h-px -rotate-12 bg-current" />
          )}
        </UtilityIcon>
        <UtilityIcon
          active={hideImages}
          title={hideImages ? "Showing all media" : "Hide images"}
          href={href({ hide_images: hideImages ? null : "1" })}
        >
          <ImageOff className="h-3.5 w-3.5" />
        </UtilityIcon>
        <UtilityIcon
          active={refreshing}
          title="Refresh feed"
          onClick={() => {
            setRefreshing(true);
            router.refresh();
            setTimeout(() => setRefreshing(false), 500);
          }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </UtilityIcon>

        <span className="ml-2 text-muted-foreground tabular-nums">
          {shown} shown
          {totalCount > shown ? ` of ${totalCount}` : ""}
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function PlatformDot({ id }: { id: string }) {
  const colors: Record<string, string> = {
    instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
    youtube: "bg-red-600",
    substack: "bg-orange-500",
    x: "bg-zinc-900 dark:bg-zinc-100",
    linkedin: "bg-sky-700",
    tiktok: "bg-zinc-900 dark:bg-zinc-100",
  };
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 rounded-sm",
        colors[id] || "bg-muted-foreground"
      )}
    />
  );
}

function UtilityIcon({
  active,
  title,
  href,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls = cn(
    "relative grid h-7 w-7 place-items-center rounded-md border transition-colors",
    active
      ? "border-primary/60 bg-primary/10 text-primary"
      : "border-border text-muted-foreground hover:text-foreground"
  );

  if (href) {
    return (
      <Link href={href} title={title} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}

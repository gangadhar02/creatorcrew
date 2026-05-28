import { Skeleton } from "@/components/ui/skeleton";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";

export default function DiscoverLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6 border-b pb-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <MasonryGrid>
        {Array.from({ length: 12 }).map((_, i) => (
          <MasonryItem key={i}>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-8 w-full rounded-none" />
              <Skeleton
                className="w-full rounded-none"
                style={{ aspectRatio: i % 3 === 0 ? "16/9" : i % 3 === 1 ? "9/16" : "4/5" }}
              />
              <Skeleton className="h-12 w-full rounded-none" />
            </div>
          </MasonryItem>
        ))}
      </MasonryGrid>
    </div>
  );
}

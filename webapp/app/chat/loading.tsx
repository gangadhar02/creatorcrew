import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center pt-4">
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="mx-auto max-w-3xl space-y-8">
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

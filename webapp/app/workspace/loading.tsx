import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="flex h-[calc(100vh-5rem)] gap-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 rounded-lg" />
      ))}
    </div>
  );
}

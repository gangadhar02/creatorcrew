"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buildFilterHref } from "@/lib/discover-url";

export default function DiscoverSearchBar({
  sp,
  basePath,
}: {
  sp: Record<string, string | undefined>;
  basePath: string;
}) {
  const router = useRouter();
  const qFromUrl = sp.q || "";
  const [q, setQ] = useState(qFromUrl);

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  return (
    <form
      className="relative flex-1 min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        const next = q.trim();
        router.push(buildFilterHref(basePath, sp, { q: next || null }));
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by topic, keyword, or idea…"
        className="h-10 rounded-full border-border bg-card pl-9 pr-4 shadow-sm"
      />
    </form>
  );
}

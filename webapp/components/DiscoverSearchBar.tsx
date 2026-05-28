"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Globe, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  function pullFromWeb() {
    const next = q.trim();
    if (!next) return;
    setPulling(true);
    // ?web=1 triggers ingestWebSearchForQuery server-side. The page
    // takes ~5–20s to come back while it fetches YT/IG/X — the loader
    // state lets the user know we're working.
    router.push(buildFilterHref(basePath, sp, { q: next, web: "1" }));
  }

  return (
    <div className="flex flex-1 items-center gap-2 min-w-0">
      <form
        className="relative flex-1 min-w-0"
        onSubmit={(e) => {
          e.preventDefault();
          const next = q.trim();
          // Plain search — clears ?web=1 so we don't keep re-ingesting.
          router.push(
            buildFilterHref(basePath, sp, { q: next || null, web: null })
          );
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!q.trim() || pulling}
              onClick={pullFromWeb}
              className="h-10 shrink-0 rounded-full"
            >
              {pulling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              <span className="hidden sm:inline ml-1.5">Pull from web</span>
            </Button>
          }
        />
        <TooltipContent>
          Search YouTube + Instagram + X for this query and add new
          creators to your workspace.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

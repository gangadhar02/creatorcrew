"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sparkles, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MentionHit = {
  kind: "post" | "creator" | "list";
  id: string;
  label: string;
  sublabel?: string;
};

type TabId = "items" | "creators" | "lists";
const TABS: {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "items", label: "Items", Icon: FileText },
  { id: "creators", label: "Creators", Icon: Sparkles },
  { id: "lists", label: "Lists", Icon: List },
];

export default function MentionAutocomplete({
  query,
  onPick,
  onClose,
}: {
  query: string;
  onPick: (hit: MentionHit) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("creators");
  const [hits, setHits] = useState<MentionHit[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounce = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: query, tab });
      const res = await fetch(`/api/chat-autocomplete?${params}`);
      const data = await res.json();
      setHits((data.hits || []) as MentionHit[]);
      setActiveIdx(0);
    }, 120);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, tab]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && hits[activeIdx]) {
        e.preventDefault();
        onPick(hits[activeIdx]);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const idx = TABS.findIndex((t) => t.id === tab);
        const nextIdx = (idx + (e.shiftKey ? -1 : 1) + TABS.length) % TABS.length;
        setTab(TABS[nextIdx].id);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [hits, activeIdx, onPick, onClose, tab]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-full left-2 mb-2 z-50 w-80 max-h-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl flex flex-col"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-0">
        <TabsList className="m-1 h-auto">
          {TABS.map((t) => {
            const Icon = t.Icon;
            return (
              <TabsTrigger key={t.id} value={t.id} className="text-xs">
                <Icon className="h-3 w-3" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <div className="flex-1 overflow-y-auto border-t">
        <AnimatePresence mode="wait">
          {hits.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-4 text-xs text-muted-foreground text-center"
            >
              {query ? `No ${tab} matching "${query}"` : `Type to search ${tab}…`}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {hits.map((h, i) => (
                <button
                  key={`${h.kind}-${h.id}`}
                  onClick={() => onPick(h)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                    i === activeIdx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{h.label}</div>
                    {h.sublabel && (
                      <div className="truncate text-[10px] text-muted-foreground">
                        {h.sublabel}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="border-t bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>
          <kbd>↑↓</kbd> navigate · <kbd>⏎</kbd> insert
        </span>
        <span>
          <kbd>Tab</kbd> switch type
        </span>
      </div>
    </motion.div>
  );
}

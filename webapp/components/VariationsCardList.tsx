"use client";

import { useState } from "react";
import { Copy, Plus, CheckCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import GenerativeCard from "./GenerativeCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { BoostVariation } from "@/lib/tools";

export default function VariationsCardList({
  variations,
}: {
  variations: BoostVariation[];
}) {
  const [boards, setBoards] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [inserting, setInserting] = useState<number | null>(null);

  async function ensureBoards() {
    if (boards) return boards;
    const res = await fetch("/api/boards");
    const data = await res.json();
    const list = (data.boards || []) as { id: string; name: string }[];
    setBoards(list);
    return list;
  }

  async function copyVariation(idx: number) {
    const v = variations[idx];
    try {
      await navigator.clipboard.writeText(v.body);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  async function insertToBoard(idx: number, boardId: string) {
    setInserting(idx);
    const v = variations[idx];
    try {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "card",
          body_md: `**${v.label}**\n\n${v.body}\n\n_${v.why}_`,
          tag: "variation",
        }),
      });
      if (res.ok) {
        toast.success("Added to board");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error("Insert failed", { description: data?.error });
      }
    } catch (e) {
      toast.error("Insert failed", { description: String(e) });
    } finally {
      setInserting(null);
    }
  }

  async function insertAllToBoard(boardId: string) {
    const t = toast.loading(`Inserting ${variations.length} variations…`);
    try {
      for (let i = 0; i < variations.length; i++) {
        await insertToBoard(i, boardId);
      }
      toast.success("All inserted", { id: t });
    } catch {
      toast.error("Some inserts failed", { id: t });
    }
  }

  const saveAllAction = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            onClick={ensureBoards}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:border-primary/40"
          >
            <CheckCheck className="h-3 w-3" /> Save all to board
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Choose board</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(boards || []).length === 0 ? (
          <DropdownMenuItem disabled>No boards yet</DropdownMenuItem>
        ) : (
          (boards || []).map((b) => (
            <DropdownMenuItem key={b.id} onClick={() => insertAllToBoard(b.id)}>
              {b.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <GenerativeCard
      label={`${variations.length} VARIATIONS`}
      action={saveAllAction}
    >
      <div className="grid gap-2">
        {variations.map((v, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="p-3 card-hover">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Badge
                  className={cn(
                    "text-white text-[10px]",
                    accentForIndex(i)
                  )}
                >
                  {v.label}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyVariation(i)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={ensureBoards}
                          disabled={inserting === i}
                        >
                          {inserting === i ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Insert to board</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(boards || []).length === 0 ? (
                        <DropdownMenuItem disabled>
                          No boards yet
                        </DropdownMenuItem>
                      ) : (
                        (boards || []).map((b) => (
                          <DropdownMenuItem
                            key={b.id}
                            onClick={() => insertToBoard(i, b.id)}
                          >
                            {b.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="whitespace-pre-wrap text-sm">{v.body}</div>
              <div className="mt-2 text-[11px] italic text-muted-foreground">
                {v.why}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </GenerativeCard>
  );
}

function accentForIndex(i: number): string {
  const palette = [
    "bg-violet-500",
    "bg-sky-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-pink-500",
  ];
  return palette[i % palette.length];
}

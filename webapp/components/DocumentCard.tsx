"use client";

import { useState } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import GenerativeCard from "./GenerativeCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface DocumentCardProps {
  kind: "breakdown" | "analysis" | "plan" | "other";
  title: string;
  content: string; // markdown
}

export default function DocumentCard({
  kind,
  title,
  content,
}: DocumentCardProps) {
  const [boards, setBoards] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [inserting, setInserting] = useState(false);

  async function ensureBoards() {
    if (boards) return boards;
    const res = await fetch("/api/boards");
    const data = await res.json();
    const list = (data.boards || []) as { id: string; name: string }[];
    setBoards(list);
    return list;
  }

  async function insertToBoard(boardId: string) {
    setInserting(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "card", body_md: content, tag: kind }),
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
      setInserting(false);
    }
  }

  const action = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            onClick={ensureBoards}
            disabled={inserting}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:border-primary/40"
          >
            {inserting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3 w-3" />
            )}{" "}
            Save to board
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
            <DropdownMenuItem key={b.id} onClick={() => insertToBoard(b.id)}>
              {b.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <GenerativeCard label={kind.toUpperCase()} title={title} action={action}>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <Streamdown>{content}</Streamdown>
      </div>
    </GenerativeCard>
  );
}

export type { DocumentCardProps };

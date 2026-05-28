"use client";

import Link from "next/link";
import { Compass, MessageCircle, LayoutGrid } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EmptyPanePicker() {
  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <div className="max-w-md space-y-5 rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">Workspace panes</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Open up to 3 things side-by-side: a post, a chat about it, a document
          you&apos;re writing. Use{" "}
          <Kbd>⌥</Kbd>
          <Kbd>1</Kbd>/<Kbd>⌥</Kbd>
          <Kbd>2</Kbd>/<Kbd>⌥</Kbd>
          <Kbd>3</Kbd> to switch active pane, <Kbd>⌥</Kbd>
          <Kbd>W</Kbd> to close.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/workspace?panes=discover:&active=0"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Compass className="h-3.5 w-3.5" />
            Discover feed
          </Link>
          <Link
            href="/chat"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Start chat
          </Link>
          <Link
            href="/boards"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Pick board
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Most cards in /discover, /boards, /chat have an &ldquo;Open in pane&rdquo; button to bring them here.
        </p>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1 py-0 text-[10px] font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}

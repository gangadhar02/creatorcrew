"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clampActive, MAX_PANES, parsePanes, serializePanes } from "@/lib/panes";
import type { LoadedPane } from "@/lib/pane-types";
import PaneFrame from "./PaneFrame";
import ChatThread from "./ChatThread";
import DocumentEditor from "./DocumentEditor";
import PostPaneContent from "./panes/PostPaneContent";
import BoardPaneContent from "./panes/BoardPaneContent";
import CreatorPaneContent from "./panes/CreatorPaneContent";
import DiscoverPaneContent from "./panes/DiscoverPaneContent";
import EmptyPanePicker from "./panes/EmptyPanePicker";

type Props = {
  initialPanes: LoadedPane[];
  initialActive: number;
};

export default function PaneShell({ initialPanes, initialActive }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(
    clampActive(initialActive, Math.max(initialPanes.length, 1))
  );

  // Keep `active` in sync if URL changes
  useEffect(() => {
    const a = Number(searchParams.get("active") || "0");
    setActive(clampActive(a, Math.max(initialPanes.length, 1)));
  }, [searchParams, initialPanes.length]);

  // ⌥1 / ⌥2 / ⌥3 focuses pane. ⌥W closes the active pane.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        const idx = Number(e.key) - 1;
        if (idx < initialPanes.length) {
          e.preventDefault();
          setActiveAndPushUrl(idx);
        }
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        closePane(active);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, initialPanes.length]);

  function setActiveAndPushUrl(idx: number) {
    setActive(idx);
    const params = new URLSearchParams(searchParams.toString());
    params.set("active", String(idx));
    router.replace(`/workspace?${params.toString()}`);
  }

  function closePane(idx: number) {
    const current = parsePanes(searchParams.get("panes"));
    const next = current.filter((_, i) => i !== idx);
    const params = new URLSearchParams();
    if (next.length > 0) {
      params.set("panes", serializePanes(next));
      params.set("active", String(Math.max(0, Math.min(active, next.length - 1))));
      router.replace(`/workspace?${params.toString()}`);
    } else {
      router.replace("/workspace");
    }
  }

  const panes = initialPanes;
  const showEmpty = panes.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3">
      {showEmpty ? (
        <EmptyPanePicker />
      ) : (
        <>
          {panes.map((p, i) => (
            <PaneFrame
              key={`${p.kind}-${p.id}-${i}`}
              title={titleFor(p)}
              subtitle={subtitleFor(p)}
              index={i}
              active={i === active}
              openInNewTabHref={openHref(p)}
              onFocus={() => setActiveAndPushUrl(i)}
              onClose={() => closePane(i)}
            >
              <PaneBody pane={p} />
            </PaneFrame>
          ))}
          {panes.length < MAX_PANES && (
            <div className="hidden xl:flex w-72 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)]/40">
              <AddPanePicker existingCount={panes.length} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PaneBody({ pane }: { pane: LoadedPane }) {
  if (pane.kind === "post") {
    return pane.data ? (
      <PostPaneContent post={pane.data.post} creator={pane.data.creator} />
    ) : (
      <Missing kind="post" id={pane.id} />
    );
  }
  if (pane.kind === "board") {
    return pane.data ? (
      <BoardPaneContent board={pane.data.board} items={pane.data.items} />
    ) : (
      <Missing kind="board" id={pane.id} />
    );
  }
  if (pane.kind === "chat") {
    return pane.data ? (
      <ChatThread chat={pane.data.chat} initialMessages={pane.data.messages} />
    ) : (
      <Missing kind="chat" id={pane.id} />
    );
  }
  if (pane.kind === "document") {
    return pane.data ? (
      <DocumentEditor initial={pane.data} />
    ) : (
      <Missing kind="document" id={pane.id} />
    );
  }
  if (pane.kind === "creator") {
    return pane.data ? (
      <CreatorPaneContent
        creator={pane.data.creator}
        recentPosts={pane.data.recentPosts}
      />
    ) : (
      <Missing kind="creator" id={pane.id} />
    );
  }
  if (pane.kind === "discover") {
    return <DiscoverPaneContent posts={pane.data.posts} />;
  }
  return (
    <div className="text-sm text-[var(--muted-foreground)]">
      Pane kind {pane.kind} not yet implemented.
    </div>
  );
}

function titleFor(p: LoadedPane): string {
  if (p.kind === "post" && p.data) {
    return p.data.post.title_or_caption?.slice(0, 60) || "Post";
  }
  if (p.kind === "board" && p.data) return p.data.board.name;
  if (p.kind === "chat" && p.data) return p.data.chat.title;
  if (p.kind === "document" && p.data) return p.data.title || "Untitled";
  if (p.kind === "creator" && p.data)
    return p.data.creator.display_name || `@${p.data.creator.handle}`;
  if (p.kind === "discover") return "Discover";
  return `${p.kind} ${p.id.slice(0, 6)}`;
}

function subtitleFor(p: LoadedPane): string | undefined {
  if (p.kind === "post" && p.data?.creator) {
    return `@${p.data.creator.handle} · ${p.data.post.platform}`;
  }
  if (p.kind === "board" && p.data) {
    return `${p.data.items.length} items`;
  }
  if (p.kind === "chat" && p.data) {
    return `${p.data.messages.length} messages`;
  }
  if (p.kind === "creator" && p.data) {
    return `${p.data.creator.platform} · ${p.data.recentPosts.length} posts cached`;
  }
  if (p.kind === "discover" && p.data) {
    return `${p.data.posts.length} posts`;
  }
  return undefined;
}

function openHref(p: LoadedPane): string | undefined {
  if (p.kind === "post" && p.data) return p.data.post.url;
  if (p.kind === "board") return `/boards/${p.id}`;
  if (p.kind === "chat") return `/chats/${p.id}`;
  if (p.kind === "document") return `/documents/${p.id}`;
  if (p.kind === "creator" && p.data)
    return `/creators?focus=${p.data.creator.handle}`;
  if (p.kind === "discover") return "/discover";
  return undefined;
}

function Missing({ kind, id }: { kind: string; id: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
      {kind} {id.slice(0, 8)} not found
    </div>
  );
}

function AddPanePicker({ existingCount }: { existingCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  function pick(kind: string, label: string) {
    const id = prompt(`${label} id (or leave blank for empty pane)?`) || "";
    const current = parsePanes(searchParams.get("panes"));
    const next = [...current, { kind: kind as never, id }];
    const params = new URLSearchParams();
    params.set("panes", serializePanes(next));
    params.set("active", String(next.length - 1));
    router.replace(`/workspace?${params.toString()}`);
  }
  return (
    <div className="space-y-1.5 p-4 text-xs text-[var(--muted-foreground)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest">
        Add pane ({existingCount}/{MAX_PANES})
      </div>
      {[
        { k: "discover", l: "Discover feed" },
        { k: "chat", l: "Chat" },
        { k: "board", l: "Board" },
        { k: "document", l: "Document" },
      ].map((o) => (
        <button
          key={o.k}
          onClick={() => pick(o.k, o.l)}
          className="block w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-left hover:border-[var(--primary)]/40"
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

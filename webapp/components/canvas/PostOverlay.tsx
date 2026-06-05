"use client";

/**
 * Eden-style post zoom. Clicking an Instagram/post card on a board opens a
 * full-page detail panel (inline reel embed, metrics, caption / transcript /
 * vision) that FLIP-animates out of the card's on-screen box and zooms back on
 * close — the post-equivalent of DocumentOverlay. Replaces the old behaviour of
 * linking out to the original post in a new tab.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ExternalLink, MessageSquare, Bookmark } from "lucide-react";
import type { PostWithCreator } from "@/lib/discover-types";
import PostDetailBody from "@/components/PostDetailBody";
import SaveToBoardMenu from "@/components/SaveToBoardMenu";
import { usePostChat } from "@/components/post-chat";
import { getMainInsetRect } from "./overlay-rect";

type OpenPostPayload = {
  post: PostWithCreator;
  rect: { top: number; left: number; width: number; height: number };
};

type Ctx = {
  openPost: (payload: OpenPostPayload) => void;
  enabled: boolean;
};

const PostOverlayContext = createContext<Ctx | null>(null);

export function usePostOverlay(): Ctx {
  return useContext(PostOverlayContext) ?? { openPost: () => {}, enabled: false };
}

export function PostOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenPostPayload | null>(null);
  const openPost = useCallback((payload: OpenPostPayload) => setOpen(payload), []);

  return (
    <PostOverlayContext.Provider value={{ openPost, enabled: true }}>
      {children}
      <PostOverlay open={open} onClose={() => setOpen(null)} />
    </PostOverlayContext.Provider>
  );
}

function PostOverlay({
  open,
  onClose,
}: {
  open: OpenPostPayload | null;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && <OverlayInner key={open.post.id} payload={open} onClose={onClose} />}
    </AnimatePresence>,
    document.body
  );
}

function OverlayInner({
  payload,
  onClose,
}: {
  payload: OpenPostPayload;
  onClose: () => void;
}) {
  const { post } = payload;
  const postChat = usePostChat();
  const [saveOpen, setSaveOpen] = useState(false);
  const [main, setMain] = useState(() => getMainInsetRect());

  useEffect(() => {
    const onResize = () => setMain(getMainInsetRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const r = payload.rect;
  const iconBtn =
    "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <motion.div
      className="fixed z-[91] flex flex-col overflow-hidden border border-border/70 bg-card shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)]"
      initial={{ top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: 16 }}
      animate={{ top: main.top, left: main.left, width: main.width, height: main.height, borderRadius: 16 }}
      exit={{ top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: 16, opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      style={{ position: "fixed" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <button onClick={onClose} className={iconBtn} title="Back (Esc)">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onClose();
              postChat.open(post.id, post.creator?.handle);
            }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </button>
          <div className="relative">
            <button
              onClick={() => setSaveOpen((v) => !v)}
              className={iconBtn}
              title="Add to board"
            >
              <Bookmark className="h-4 w-4" />
            </button>
            {saveOpen && (
              <SaveToBoardMenu
                creatorPostId={post.id}
                onClose={() => setSaveOpen(false)}
              />
            )}
          </div>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className={iconBtn}
            title="Open original"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="subtle-scroll min-h-0 flex-1 overflow-y-auto">
        <PostDetailBody post={post} mediaBg="bg-transparent" />
      </div>
    </motion.div>
  );
}

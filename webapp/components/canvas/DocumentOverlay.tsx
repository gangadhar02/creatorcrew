"use client";

/**
 * Eden-style document zoom. Clicking a document card opens a full-screen editor
 * that FLIP-animates out of the card's on-screen box (measured at click time,
 * so it works even under the canvas's CSS scale transform — no layoutId), and
 * zooms back home on close. The editor (BlockEditor) lives here at scale 1.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Share2, Zap, Settings2 } from "lucide-react";
import BlockEditor from "@/components/editor/BlockEditor";
import { fetchJson } from "@/lib/optimistic/withRollback";

export type OpenDocPayload = {
  documentId: string;
  title: string;
  body_md: string;
  rect: { top: number; left: number; width: number; height: number };
};

type Ctx = {
  openDocument: (payload: OpenDocPayload) => void;
  enabled: boolean;
};

const DocumentOverlayContext = createContext<Ctx | null>(null);

export function useDocumentOverlay(): Ctx {
  return (
    useContext(DocumentOverlayContext) ?? { openDocument: () => {}, enabled: false }
  );
}

export function DocumentOverlayProvider({
  children,
  onLocalUpdate,
}: {
  children: React.ReactNode;
  /** Sync the card preview when the doc is edited. */
  onLocalUpdate?: (documentId: string, patch: { title?: string; body_md?: string }) => void;
}) {
  const [open, setOpen] = useState<OpenDocPayload | null>(null);

  const openDocument = useCallback((payload: OpenDocPayload) => setOpen(payload), []);

  return (
    <DocumentOverlayContext.Provider value={{ openDocument, enabled: true }}>
      {children}
      <DocumentOverlay open={open} onClose={() => setOpen(null)} onLocalUpdate={onLocalUpdate} />
    </DocumentOverlayContext.Provider>
  );
}

function DocumentOverlay({
  open,
  onClose,
  onLocalUpdate,
}: {
  open: OpenDocPayload | null;
  onClose: () => void;
  onLocalUpdate?: (documentId: string, patch: { title?: string; body_md?: string }) => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <OverlayInner key={open.documentId} payload={open} onClose={onClose} onLocalUpdate={onLocalUpdate} />
      )}
    </AnimatePresence>,
    document.body
  );
}

function OverlayInner({
  payload,
  onClose,
  onLocalUpdate,
}: {
  payload: OpenDocPayload;
  onClose: () => void;
  onLocalUpdate?: (documentId: string, patch: { title?: string; body_md?: string }) => void;
}) {
  const [title, setTitle] = useState(payload.title || "Untitled");
  const bodyRef = useRef(payload.body_md);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveTitle = useCallback(
    (next: string) => {
      setTitle(next);
      onLocalUpdate?.(payload.documentId, { title: next });
      if (titleTimer.current) clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(() => {
        fetchJson(`/api/documents/${payload.documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: next }),
        }).catch(() => {});
      }, 500);
    },
    [payload.documentId, onLocalUpdate]
  );

  const saveBody = useCallback(
    (markdown: string) => {
      bodyRef.current = markdown;
      onLocalUpdate?.(payload.documentId, { body_md: markdown });
      if (bodyTimer.current) clearTimeout(bodyTimer.current);
      bodyTimer.current = setTimeout(() => {
        fetchJson(`/api/documents/${payload.documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body_md: markdown }),
        }).catch(() => {});
      }, 600);
    },
    [payload.documentId, onLocalUpdate]
  );

  const r = payload.rect;
  // Target = the main content area (so the sidebar stays visible), Eden-style.
  const [main, setMain] = useState(() => getMainRect());
  useEffect(() => {
    const onResize = () => setMain(getMainRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const wordCount = bodyRef.current.trim() ? bodyRef.current.trim().split(/\s+/).length : 0;
  const charCount = bodyRef.current.length;

  return (
    <motion.div
      className="fixed z-[91] overflow-hidden bg-background"
      initial={{ top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: 12 }}
      animate={{ top: main.top, left: main.left, width: main.width, height: main.height, borderRadius: 0 }}
      exit={{ top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: 12, opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      style={{ position: "fixed" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Back (Esc)"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 hover:bg-accent hover:text-foreground">
              <MessageSquare className="h-4 w-4" /> Chat
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 hover:bg-accent hover:text-foreground">
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              title="Boost"
              className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent hover:text-foreground"
            >
              <Zap className="h-4 w-4" />
            </button>
            <button
              title="Document settings"
              className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="subtle-scroll min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-[720px]">
            <input
              value={title}
              onChange={(e) => saveTitle(e.target.value)}
              placeholder="Untitled"
              className="mb-4 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
            />
            <BlockEditor initialMarkdown={payload.body_md} onChange={saveBody} />
          </div>
        </div>
        <div className="flex justify-end px-6 py-2 text-[11px] tabular-nums text-muted-foreground/60">
          {wordCount}w · {charCount}c
        </div>
      </div>
    </motion.div>
  );
}

function getMainRect() {
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  if (typeof document !== "undefined") {
    const m = document.querySelector("main");
    if (m) {
      const r = m.getBoundingClientRect();
      // Anchor to the viewport (full height in the main column) so a scrolled
      // page doesn't push the doc's header off-screen.
      return { top: 0, left: r.left, width: r.width, height: h };
    }
  }
  return { top: 0, left: 0, width: w, height: h };
}

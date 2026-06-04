"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import ChatPanel from "./ChatPanel";
import OnboardingFlow from "./OnboardingFlow";
import { PostChatContext, type ChatTarget } from "./post-chat";

// Floating chat panel width (mirrors the sidebar on the right).
const PANEL_WIDTH = "clamp(340px, 30vw, 460px)";
// Main content yields the panel width + the panel's right inset + a gap.
const PANEL_MARGIN = `calc(${PANEL_WIDTH} + 1rem)`;

type SidebarProps = {
  onboardingCompleted: number;
  onboardingTotal: number;
  workspaceName: string;
  workspaceEmail: string;
  boards: { id: string; name: string }[];
  recentChats: { id: string; title: string }[];
};

type OnboardingProps = {
  show: boolean;
  defaultName: string;
  defaultWorkspaceName: string;
};

/**
 * Authenticated app shell: floating sidebar (left) + main content + a global,
 * floating chat side panel (right) that mirrors the sidebar — rounded, inset,
 * bordered, parallel. Opening it reflows the main content (true split). Any
 * page can open it via the PostChatContext (posts, boards, or a freeform chat
 * from the sidebar Chat item).
 */
export default function AppShell({
  sidebar,
  onboarding,
  children,
}: {
  sidebar: SidebarProps;
  onboarding: OnboardingProps;
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<ChatTarget | null>(null);

  const open = useCallback(
    (postId: string, handle?: string | null) => setTarget({ kind: "post", postId, handle }),
    []
  );
  const openBoard = useCallback(
    (boardId: string, boardName: string) => setTarget({ kind: "board", boardId, boardName }),
    []
  );
  const openFreeform = useCallback(() => setTarget({ kind: "freeform" }), []);
  const toggleFreeform = useCallback(
    () => setTarget((t) => (t ? null : { kind: "freeform" })),
    []
  );
  const close = useCallback(() => setTarget(null), []);

  const panelKey = target
    ? target.kind === "post"
      ? `post:${target.postId}`
      : target.kind === "board"
        ? `board:${target.boardId}`
        : "freeform"
    : "none";

  return (
    <PostChatContext.Provider
      value={{ open, openBoard, openFreeform, toggleFreeform, close, isOpen: !!target }}
    >
      <div className="flex min-h-screen">
        <Sidebar {...sidebar} />
        <main
          className="min-w-0 flex-1 overflow-x-hidden transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ marginRight: target ? PANEL_MARGIN : 0 }}
        >
          <div className="w-full animate-page-in px-6 py-8 lg:px-8 lg:py-10">{children}</div>
        </main>
      </div>

      <AnimatePresence>
        {target && (
          <motion.aside
            key={panelKey}
            initial={{ x: "110%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "110%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-2 top-2 z-40 h-[calc(100svh-1rem)] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)]"
            style={{ width: PANEL_WIDTH }}
          >
            <ChatPanel target={target} onClose={close} />
          </motion.aside>
        )}
      </AnimatePresence>

      {onboarding.show && (
        <OnboardingFlow
          defaultName={onboarding.defaultName}
          defaultWorkspaceName={onboarding.defaultWorkspaceName}
        />
      )}
    </PostChatContext.Provider>
  );
}

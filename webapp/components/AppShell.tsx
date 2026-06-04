"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import PostChatPanel from "./PostChatPanel";
import OnboardingFlow from "./OnboardingFlow";
import { PostChatContext } from "./post-chat";
import { isSidebarCollapsed, setSidebarCollapsed } from "@/lib/sidebar-state";

// Width of the docked chat panel (and the room the main content yields).
const PANEL_WIDTH = "clamp(340px, 28vw, 520px)";

type SidebarProps = {
  onboardingCompleted: number;
  onboardingTotal: number;
  workspaceName: string;
  workspaceEmail: string;
  boards: { id: string; name: string }[];
  recentChats: { id: string; title: string }[];
};

type PanelState = { postId: string; handle?: string | null } | null;

/**
 * Authenticated app shell: sidebar + main content + a docked, split-screen chat
 * panel on the right. Opening the panel reflows the main content (true split,
 * not an overlay) and collapses the sidebar so the workspace has room; closing
 * restores the prior sidebar state.
 */
type OnboardingProps = {
  show: boolean;
  defaultName: string;
  defaultWorkspaceName: string;
};

export default function AppShell({
  sidebar,
  onboarding,
  children,
}: {
  sidebar: SidebarProps;
  onboarding: OnboardingProps;
  children: React.ReactNode;
}) {
  const [panel, setPanel] = useState<PanelState>(null);
  const prevCollapsedRef = useRef(false);

  const open = useCallback((postId: string, handle?: string | null) => {
    setPanel((cur) => {
      // Remember the sidebar state only on the first open (not when switching
      // from one post's chat to another).
      if (!cur) prevCollapsedRef.current = isSidebarCollapsed();
      return { postId, handle };
    });
    setSidebarCollapsed(true);
  }, []);

  const close = useCallback(() => {
    setPanel(null);
    setSidebarCollapsed(prevCollapsedRef.current);
  }, []);

  return (
    <PostChatContext.Provider value={{ open, close, isOpen: !!panel }}>
      <div className="flex min-h-screen">
        <Sidebar {...sidebar} />
        <main
          className="min-w-0 flex-1 overflow-x-hidden transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ marginRight: panel ? PANEL_WIDTH : 0 }}
        >
          <div className="w-full animate-page-in px-6 py-8 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {panel && (
          <motion.aside
            key={panel.postId}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-40 h-screen border-l bg-background shadow-[-12px_0_40px_-32px_rgba(0,0,0,0.6)]"
            style={{ width: PANEL_WIDTH }}
          >
            <PostChatPanel
              postId={panel.postId}
              handle={panel.handle}
              onClose={close}
            />
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

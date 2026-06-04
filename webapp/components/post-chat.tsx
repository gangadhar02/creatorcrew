"use client";

import { createContext, useContext } from "react";

/**
 * App-wide handle to open the docked chat side panel (split screen). The
 * provider lives in AppShell; deep components (post cards, the post modal, the
 * profile grid, board headers, the sidebar) call these to launch a chat without
 * navigating away. Kept named `PostChat*`/`usePostChat` for back-compat with
 * existing post consumers.
 */
export type ChatTarget =
  | { kind: "post"; postId: string; handle?: string | null }
  | { kind: "board"; boardId: string; boardName: string }
  | { kind: "freeform" };

export type PostChatApi = {
  /** Open a chat about a single post (back-compat name). */
  open: (postId: string, handle?: string | null) => void;
  /** Open a board-context chat. */
  openBoard: (boardId: string, boardName: string) => void;
  /** Open a fresh, context-free chat. */
  openFreeform: () => void;
  /** Toggle the freeform chat panel (used by the sidebar Chat item). */
  toggleFreeform: () => void;
  close: () => void;
  isOpen: boolean;
};

export const PostChatContext = createContext<PostChatApi>({
  open: () => {},
  openBoard: () => {},
  openFreeform: () => {},
  toggleFreeform: () => {},
  close: () => {},
  isOpen: false,
});

export function usePostChat(): PostChatApi {
  return useContext(PostChatContext);
}

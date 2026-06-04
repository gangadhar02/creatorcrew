"use client";

import { createContext, useContext } from "react";

/**
 * App-wide handle to open the docked post-chat side panel (split screen). The
 * provider lives in AppShell; deep components (post cards, the post modal, the
 * profile grid) call open() to launch a chat about a specific post without
 * navigating away.
 */
export type PostChatApi = {
  open: (postId: string, handle?: string | null) => void;
  close: () => void;
  isOpen: boolean;
};

export const PostChatContext = createContext<PostChatApi>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function usePostChat(): PostChatApi {
  return useContext(PostChatContext);
}

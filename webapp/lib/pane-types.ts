/**
 * Type-only definitions for pane payloads. Lives separate from `pane-data.ts`
 * (which has the server-only Supabase loader) so client components can import
 * the types without pulling Supabase into the bundle.
 */
import type { Chat, ChatMessage } from "./types-chat";
import type { Board, Document } from "./types-boards";
import type { Creator, CreatorPost } from "./types";
import type { ExpandedBoardItem } from "@/app/boards/[id]/page";

export type LoadedPane =
  | { kind: "post"; id: string; data: PostPanePayload | null }
  | { kind: "board"; id: string; data: BoardPanePayload | null }
  | { kind: "chat"; id: string; data: ChatPanePayload | null }
  | { kind: "document"; id: string; data: Document | null }
  | { kind: "creator"; id: string; data: CreatorPanePayload | null }
  | { kind: "discover"; id: string; data: DiscoverPanePayload }
  | { kind: "saves"; id: string; data: null }
  | { kind: "ideate"; id: string; data: null }
  | { kind: "voice"; id: string; data: null };

export type PostPanePayload = {
  post: CreatorPost;
  creator: Creator | null;
};

export type BoardPanePayload = {
  board: Board;
  items: ExpandedBoardItem[];
};

export type ChatPanePayload = {
  chat: Chat;
  messages: ChatMessage[];
};

export type CreatorPanePayload = {
  creator: Creator;
  recentPosts: CreatorPost[];
};

export type DiscoverPanePayload = {
  posts: (CreatorPost & { creator: Creator })[];
};

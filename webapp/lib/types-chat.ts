export type ChatContextKind =
  | "creator_post"
  | "board"
  | "document"
  | "idea"
  | "save"
  | "voice_build"
  | "profile"
  | "freeform";

export interface Chat {
  id: string;
  workspace_id: string | null;
  title: string;
  voice_id: string | null;
  context_kind: ChatContextKind | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content_md: string;
  thoughts_md: string | null;
  tool_calls: { name: string; args: unknown }[] | null;
  attached_item_ids: string[] | null;
  mentions: Record<string, unknown> | null;
  created_at: string;
}

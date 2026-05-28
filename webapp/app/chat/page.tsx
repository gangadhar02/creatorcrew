import { getSupabase } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Chat } from "@/lib/types-chat";
import NewChatHome from "@/components/NewChatHome";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const ws = await getWorkspaceContext();
  const sb = getSupabase();

  let recent: Chat[] = [];
  if (ws.workspaceId) {
    try {
      const { data } = await sb
        .from("chats")
        .select("*")
        .eq("workspace_id", ws.workspaceId)
        .order("updated_at", { ascending: false })
        .limit(20);
      recent = (data || []) as Chat[];
    } catch {
      // table may not exist if migration 009 not yet applied
    }
  }

  return <NewChatHome recent={recent} />;
}

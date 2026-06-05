"use client";

import { useState } from "react";
import {
  Bookmark,
  ExternalLink,
  X as XIcon,
  MessageCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PostWithCreator } from "@/lib/discover-types";
import PostDetailBody from "./PostDetailBody";
import SaveToBoardMenu from "./SaveToBoardMenu";
import { usePostChat } from "./post-chat";

export default function PostDetailModal({
  post,
  open,
  onClose,
}: {
  post: PostWithCreator;
  open: boolean;
  onClose: () => void;
}) {
  const postChat = usePostChat();
  const [saveOpen, setSaveOpen] = useState(false);

  function openChat() {
    // Close this modal so the docked split-screen chat panel is visible.
    onClose();
    postChat.open(post.id, post.creator?.handle);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
        style={{ maxHeight: "90vh" }}
      >
        <DialogTitle className="sr-only">
          {post.title_or_caption?.slice(0, 60) || "Post detail"}
        </DialogTitle>

        {/* Header — title + actions */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            {post.title_or_caption?.split("\n")[0] || "Post"}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={openChat}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                }
              />
              <TooltipContent>Chat about this post</TooltipContent>
            </Tooltip>
            <div className="relative">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => setSaveOpen((v) => !v)}
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                  }
                />
                <TooltipContent>Add to board</TooltipContent>
              </Tooltip>
              {saveOpen && (
                <SaveToBoardMenu
                  creatorPostId={post.id}
                  onClose={() => setSaveOpen(false)}
                />
              )}
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                }
              />
              <TooltipContent>Open original</TooltipContent>
            </Tooltip>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ maxHeight: "calc(90vh - 57px)" }}
        >
          <PostDetailBody post={post} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

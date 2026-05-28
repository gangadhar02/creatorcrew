"use client";

import { useEffect, useState } from "react";
import { Volume2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Voice = { voice_id: string; name: string };

const STORAGE_KEY = "eden.tts.voice:v1";
const AUTOPLAY_KEY = "eden.tts.autoplay:v1";

export default function VoicePickerEveMax({
  onVoiceChange,
}: {
  onVoiceChange?: (voiceId: string | null) => void;
}) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    try {
      setVoiceId(window.localStorage.getItem(STORAGE_KEY));
      setAutoplay(window.localStorage.getItem(AUTOPLAY_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  async function loadVoices() {
    if (voices.length > 0) return;
    const res = await fetch("/api/tts");
    const data = await res.json();
    const list = (data.voices || []) as Voice[];
    setVoices(list);
  }

  const active = voices.find((v) => v.voice_id === voiceId);
  const displayName = active?.name || "Eve Max";

  function pick(id: string | null) {
    setVoiceId(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    onVoiceChange?.(id);
  }

  function toggleAutoplay() {
    const v = !autoplay;
    setAutoplay(v);
    try {
      window.localStorage.setItem(AUTOPLAY_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            onClick={loadVoices}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[10px]",
              "text-muted-foreground hover:text-foreground"
            )}
            title="Voice for text-to-speech"
          >
            <Volume2 className="h-3 w-3" />
            <span>{displayName} ⌄</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Read aloud voice</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => pick(null)}>
          (none — text only)
        </DropdownMenuItem>
        {voices.length === 0 ? (
          <DropdownMenuItem disabled>Loading voices…</DropdownMenuItem>
        ) : (
          voices.slice(0, 20).map((v) => (
            <DropdownMenuItem key={v.voice_id} onClick={() => pick(v.voice_id)}>
              {v.name}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleAutoplay}>
          {autoplay ? "✓ " : ""}Auto-play assistant replies
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getAutoplay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTOPLAY_KEY) === "1";
  } catch {
    return false;
  }
}

export function getVoiceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

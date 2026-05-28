"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function MicButton({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        for (const t of stream.getTracks()) t.stop();
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("file", blob, "voice.webm");
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (data.text) {
            onTranscript(data.text);
            toast.success("Transcribed");
          } else {
            toast.error("Transcription failed", { description: data.error });
          }
        } catch (e) {
          toast.error("Transcription failed", { description: String(e) });
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      toast.error("Mic permission denied", { description: String(e) });
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : start())}
      disabled={busy}
      title={recording ? "Stop recording" : "Record voice memo"}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md transition-colors",
        recording
          ? "bg-rose-500 text-white animate-pulse"
          : "border border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : recording ? (
        <MicOff className="h-3.5 w-3.5" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

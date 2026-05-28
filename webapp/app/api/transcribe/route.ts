/**
 * POST /api/transcribe (multipart with `file=...`)
 *
 * Wraps Groq's Whisper endpoint (whisper-large-v3-turbo) — same shape as
 * OpenAI's audio-transcriptions API. Cheap, fast, no token quota issues.
 */
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_BASE = "https://api.groq.com/openai/v1";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY || process.env.WHISPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY (or WHISPER_API_KEY) not configured" },
      { status: 500 }
    );
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", file);
  upstreamForm.append("model", "whisper-large-v3-turbo");
  upstreamForm.append("response_format", "json");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstreamForm,
  });
  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json(
      { error: `groq ${res.status}: ${t.slice(0, 200)}` },
      { status: 500 }
    );
  }
  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: data.text || "" });
}

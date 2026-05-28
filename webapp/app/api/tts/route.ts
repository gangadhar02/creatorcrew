/**
 * POST /api/tts
 * Body: { text, voice_id }
 * Returns: audio/mpeg stream
 *
 * GET /api/tts/voices  → list available ElevenLabs voices
 */
import { NextResponse, type NextRequest } from "next/server";
import { listVoices, streamTTS } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey)
    return NextResponse.json({ voices: [], error: "no api key" });
  const voices = await listVoices(apiKey);
  return NextResponse.json({ voices });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  const body = (await request.json()) as { text?: string; voice_id?: string };
  if (!body.text || !body.voice_id) {
    return NextResponse.json(
      { error: "text and voice_id required" },
      { status: 400 }
    );
  }
  try {
    const stream = await streamTTS({
      apiKey,
      voiceId: body.voice_id,
      text: body.text.slice(0, 5000),
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

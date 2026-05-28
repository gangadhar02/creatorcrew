/**
 * ElevenLabs TTS streaming client. Returns the raw audio stream from
 * /v1/text-to-speech/<voice_id>/stream so the API route can pipe it to the
 * browser.
 */

const EL_BASE = "https://api.elevenlabs.io";

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
};

export async function listVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${EL_BASE}/v1/voices`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { voices?: ElevenLabsVoice[] };
  return data.voices || [];
}

export async function streamTTS({
  apiKey,
  voiceId,
  text,
  modelId = "eleven_flash_v2_5",
}: {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(
    `${EL_BASE}/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok || !res.body) {
    throw new Error(`ElevenLabs ${res.status}`);
  }
  return res.body;
}

import {
  clampApiSpeed,
  clientPlaybackRate,
} from "../config.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
export const MODEL_ID = "eleven_v3";
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

export { clampApiSpeed, clientPlaybackRate };

function stringifyErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail.message === "string") return detail.message;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/**
 * Generate text to speech via ElevenLabs REST API.
 * @see https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming
 */
export async function streamTextToSpeech(apiKey, text, options = {}) {
  const voiceId = options.voiceId ?? DEFAULT_VOICE_ID;
  const languageCode = options.languageCode?.trim() || null;
  const requestedSpeed = options.playbackSpeed ?? 1;
  const apiSpeed = clampApiSpeed(requestedSpeed);
  const outputFormat = options.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  const url = new URL(`${ELEVENLABS_API}/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", outputFormat);

  const body = {
    text,
    model_id: options.modelId ?? MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.85,
      style: 0,
      use_speaker_boost: true,
      speed: apiSpeed,
      ...options.voiceSettings,
    },
  };

  if (languageCode) {
    body.language_code = languageCode;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const err = await response.json();
      detail = stringifyErrorDetail(err.detail) || stringifyErrorDetail(err);
    } catch {
      // non-JSON error body
    }
    throw new Error(detail || `ElevenLabs request failed (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.includes("audio/") && !contentType.includes("application/octet-stream")) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // ignore unreadable non-audio body
    }
    throw new Error(detail || `ElevenLabs returned ${contentType}, not playable audio`);
  }

  if (!response.body) {
    throw new Error("ElevenLabs returned an empty audio stream");
  }

  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.length) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  if (totalLength === 0) {
    throw new Error("ElevenLabs returned empty audio");
  }

  const audio = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }

  const mimeType = contentType.split(";")[0] || "audio/mpeg";
  const blob = new Blob([audio], { type: mimeType });
  return { blob, playbackRate: clientPlaybackRate(requestedSpeed, apiSpeed) };
}

import {
  DEFAULT_SARVAM_LANGUAGE,
  DEFAULT_SARVAM_VOICE,
  getSarvamLanguage,
  getSarvamVoice,
} from "../config.js";

const SARVAM_TTS_API = "https://api.sarvam.ai/text-to-speech";
const MODEL = "bulbul:v3";
const MAX_CHARS = 2500;
const PACE_MIN = 0.5;
const PACE_MAX = 2.0;
const DEFAULT_MIME_TYPE = "audio/wav";

export function clampSarvamPace(speed) {
  const value = speed ?? 1;
  return Math.min(PACE_MAX, Math.max(PACE_MIN, value));
}

function splitText(text, maxLength = MAX_CHARS) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLength) return [normalized];

  const sentences = Array.from(normalized.matchAll(/[^.!?]+[.!?]+|\S.+$/g));
  const chunks = [];
  let current = "";

  for (const match of sentences.length ? sentences : [{ 0: normalized }]) {
    const sentence = match[0].trim();
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = sentence;

    while (current.length > maxLength) {
      chunks.push(current.slice(0, maxLength));
      current = current.slice(maxLength).trimStart();
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function stringifyErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.detail === "string") return detail.detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function mapSarvamError(status, detail) {
  if (status === 403) return "Invalid Sarvam API key. Check your key in settings.";
  if (status === 422) return "Text too long or invalid voice selected.";
  if (status === 429) return "Sarvam API quota exceeded. Please wait or upgrade your plan.";
  if (status >= 500) return "Sarvam service error. Please try again.";
  return detail ? `Sarvam request failed (${status}). ${detail}` : `Sarvam request failed (${status}).`;
}

function base64ToBytes(base64) {
  const clean = base64.includes(",") ? base64.split(",").pop() : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function requestSpeechChunk(apiKey, input, options) {
  const response = await fetch(SARVAM_TTS_API, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      inputs: [input],
      target_language_code: getSarvamLanguage(options.language).code,
      speaker: getSarvamVoice(options.voice).id,
      model: MODEL,
      pace: options.pace,
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = stringifyErrorDetail(await response.json()) || detail;
    } catch {
      // Non-JSON error body.
    }
    throw new Error(mapSarvamError(response.status, detail));
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Sarvam service error. Please try again.");
  }

  const audio = payload?.audios?.[0];
  if (!audio || typeof audio !== "string") {
    throw new Error("Sarvam service error. Please try again.");
  }

  const bytes = base64ToBytes(audio);
  if (bytes.length === 0) {
    throw new Error("Sarvam service error. Please try again.");
  }
  return bytes;
}

export async function streamTextToSpeech(apiKey, text, options = {}) {
  if (!apiKey) {
    throw new Error("Invalid Sarvam API key. Check your key in settings.");
  }

  const chunks = splitText(text);
  if (chunks.length === 0) {
    throw new Error("Text too long or invalid voice selected.");
  }

  const pace = clampSarvamPace(options.playbackSpeed);
  const buffers = [];

  for (const chunk of chunks) {
    buffers.push(
      await requestSpeechChunk(apiKey, chunk, {
        voice: options.voice ?? DEFAULT_SARVAM_VOICE,
        language: options.language ?? DEFAULT_SARVAM_LANGUAGE,
        pace,
      }),
    );
  }

  return {
    blob: new Blob(buffers, { type: DEFAULT_MIME_TYPE }),
    playbackRate: 1,
  };
}

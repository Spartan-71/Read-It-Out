import {
  DEFAULT_SMALLEST_AI_MODEL,
  DEFAULT_SMALLEST_AI_VOICE,
  SMALLEST_AI_FALLBACK_VOICES,
  SMALLEST_AI_MODELS,
} from "../config.js";

const TTS_API = "https://api.smallest.ai/waves/v1/tts";
const VOICES_API = "https://api.smallest.ai/waves/v1/voices";
const SAMPLE_RATE = 24000;
const OUTPUT_FORMAT = "pcm";
const TARGET_CHARS = 140;
const MAX_CHARS = 250;
const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;
const DEFAULT_MIME_TYPE = "audio/wav";

export function clampSmallestAISpeed(speed) {
  const value = speed ?? 1;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

function normalizeModel(model) {
  return SMALLEST_AI_MODELS.some((option) => option.id === model)
    ? model
    : DEFAULT_SMALLEST_AI_MODEL;
}

function splitText(text, targetLength = TARGET_CHARS, maxLength = MAX_CHARS) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLength) return [normalized];

  const sentences = Array.from(normalized.matchAll(/[^.!?]+[.!?]+|\S.+$/g));
  const chunks = [];
  let current = "";

  for (const match of sentences.length ? sentences : [{ 0: normalized }]) {
    const sentence = match[0].trim();
    const next = current ? `${current} ${sentence}` : sentence;

    if (next.length <= targetLength || (!current && next.length <= maxLength)) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = sentence;

    while (current.length > maxLength) {
      let splitAt = Math.max(
        current.lastIndexOf(" ", maxLength),
        current.lastIndexOf(",", maxLength),
        current.lastIndexOf(";", maxLength),
      );
      if (splitAt < 80) splitAt = maxLength;
      chunks.push(current.slice(0, splitAt).trim());
      current = current.slice(splitAt).trimStart();
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function stringifyErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.error === "string") return detail.error;
  if (typeof detail.error?.message === "string") return detail.error.message;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function mapSmallestAIError(status, detail) {
  if (status === 401) return "Invalid or missing Smallest AI API key. Check your key in settings.";
  if (status === 403) return "Smallest AI API key expired or unauthorized.";
  if (status === 429) return "Smallest AI rate limit hit. Please wait and try again.";
  if (status >= 500) return "Smallest AI service error. Please try again.";
  return detail ? `Smallest AI request failed (${status}). ${detail}` : `Smallest AI request failed (${status}).`;
}

function parseVoiceList(payload) {
  const rawVoices = Array.isArray(payload)
    ? payload
    : payload?.voices || payload?.data || payload?.items || [];

  const voices = rawVoices
    .map((voice) => {
      const id = voice.voice_id || voice.id || voice.name;
      if (!id) return null;
      const label = voice.display_name || voice.label || voice.name || id;
      const tags = voice.tags || {};
      const descriptors = [tags.language, tags.accent, tags.gender].filter(Boolean).join(", ");
      return { id, label: descriptors ? `${label} - ${descriptors}` : label };
    })
    .filter(Boolean);

  return voices.length ? voices : SMALLEST_AI_FALLBACK_VOICES;
}

export async function fetchVoices(apiKey, model = DEFAULT_SMALLEST_AI_MODEL) {
  if (!apiKey) return SMALLEST_AI_FALLBACK_VOICES;
  const selectedModel = normalizeModel(model);

  const response = await fetch(`${VOICES_API}?model=${encodeURIComponent(selectedModel)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return SMALLEST_AI_FALLBACK_VOICES;
  }

  try {
    return parseVoiceList(await response.json());
  } catch {
    return SMALLEST_AI_FALLBACK_VOICES;
  }
}

async function requestSpeechChunk(apiKey, text, options) {
  const response = await fetch(TTS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/octet-stream",
    },
    body: JSON.stringify({
      text,
      model: normalizeModel(options.model),
      voice_id: options.voice || DEFAULT_SMALLEST_AI_VOICE,
      speed: options.speed,
      language: "auto",
      sample_rate: SAMPLE_RATE,
      output_format: OUTPUT_FORMAT,
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = stringifyErrorDetail(await response.json()) || detail;
    } catch {
      // Non-JSON error body.
    }
    throw new Error(mapSmallestAIError(response.status, detail));
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let detail = "";
    try {
      detail = stringifyErrorDetail(await response.json());
    } catch {
      // Ignore unreadable JSON body.
    }
    throw new Error(detail || "Smallest AI service error. Please try again.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("Smallest AI service error. Please try again.");
  }
  return bytes;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function pcmToWav(pcmChunks, sampleRate = SAMPLE_RATE) {
  const dataLength = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  const bytes = new Uint8Array(buffer, 44);
  let offset = 0;
  for (const chunk of pcmChunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([buffer], { type: DEFAULT_MIME_TYPE });
}

export async function streamTextToSpeech(apiKey, text, options = {}) {
  if (!apiKey) {
    throw new Error("Invalid or missing Smallest AI API key. Check your key in settings.");
  }

  const chunks = splitText(text);
  if (chunks.length === 0) {
    throw new Error("Smallest AI service error. Please try again.");
  }

  const speed = clampSmallestAISpeed(options.playbackSpeed);
  const model = normalizeModel(options.model);
  const buffers = [];

  for (const chunk of chunks) {
    buffers.push(await requestSpeechChunk(apiKey, chunk, {
      model,
      voice: options.voice ?? DEFAULT_SMALLEST_AI_VOICE,
      speed,
    }));
  }

  return {
    blob: pcmToWav(buffers),
    playbackRate: 1,
  };
}

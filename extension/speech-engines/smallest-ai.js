import {
  DEFAULT_SMALLEST_AI_MODEL,
  DEFAULT_SMALLEST_AI_VOICE,
  SMALLEST_AI_FALLBACK_VOICES,
  SMALLEST_AI_MODELS,
} from "../config.js";

const STREAM_API = "https://api.smallest.ai/waves/v1/tts/live";
const VOICES_API = "https://api.smallest.ai/waves/v1/voices";
const SAMPLE_RATE = 24000;
const OUTPUT_FORMAT = "mp3";
const TARGET_CHARS = 140;
const MAX_CHARS = 250;
const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;
const DEFAULT_MIME_TYPE = "audio/mpeg";

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

function base64ToBytes(base64) {
  const clean = base64.includes(",") ? base64.split(",").pop() : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

function parseSSEFrames(buffer) {
  const frames = [];
  let nextBuffer = buffer;
  let separatorIndex = nextBuffer.indexOf("\n\n");

  while (separatorIndex !== -1) {
    const frame = nextBuffer.slice(0, separatorIndex);
    frames.push(frame);
    nextBuffer = nextBuffer.slice(separatorIndex + 2);
    separatorIndex = nextBuffer.indexOf("\n\n");
  }

  return { frames, buffer: nextBuffer };
}

async function collectSSEAudio(response) {
  if (!response.body) {
    throw new Error("Smallest AI service error. Please try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const parsed = parseSSEFrames(buffer);
    buffer = parsed.buffer;

    for (const frame of parsed.frames) {
      const dataLines = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      for (const data of dataLines) {
        if (!data || data === "[DONE]") continue;
        let event;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event.done) continue;
        if (event.audio) chunks.push(base64ToBytes(event.audio));
      }
    }
  }

  buffer += decoder.decode().replace(/\r\n/g, "\n");
  if (buffer.trim()) {
    const parsed = parseSSEFrames(`${buffer}\n\n`);
    for (const frame of parsed.frames) {
      const data = frame
        .split(/\r?\n/)
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!data || data === "[DONE]") continue;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.audio) chunks.push(base64ToBytes(event.audio));
    }
  }

  if (chunks.length === 0) {
    throw new Error("Smallest AI service error. Please try again.");
  }

  return chunks;
}

async function requestSpeechChunk(apiKey, text, options) {
  const response = await fetch(STREAM_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
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

  return collectSSEAudio(response);
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
    buffers.push(...await requestSpeechChunk(apiKey, chunk, {
      model,
      voice: options.voice ?? DEFAULT_SMALLEST_AI_VOICE,
      speed,
    }));
  }

  return {
    blob: new Blob(buffers, { type: DEFAULT_MIME_TYPE }),
    playbackRate: 1,
  };
}

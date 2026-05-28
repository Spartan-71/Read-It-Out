import {
  clientPlaybackRate,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_OUTPUT_FORMAT,
  DEFAULT_OPENAI_VOICE,
  getOpenAIModel,
  getOpenAIVoice,
} from "../config.js";

const OPENAI_SPEECH_API = "https://api.openai.com/v1/audio/speech";
const OPENAI_SPEED_MIN = 0.25;
const OPENAI_SPEED_MAX = 4.0;
const OPENAI_MAX_CHARS = 1500;

const MIME_TYPES = {
  mp3: "audio/mpeg",
  opus: "audio/ogg; codecs=opus",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/pcm",
};

export function clampOpenAISpeed(speed) {
  const value = speed ?? 1;
  return Math.min(OPENAI_SPEED_MAX, Math.max(OPENAI_SPEED_MIN, value));
}

function stringifyErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.error?.message === "string") return detail.error.message;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function mapOpenAIError(status, detail) {
  const suffix = detail ? ` ${detail}` : "";
  if (status === 401) return `OpenAI API key missing or invalid.${suffix}`;
  if (status === 429) return `OpenAI quota or rate limit error.${suffix}`;
  if (status === 400) return `OpenAI rejected the request.${suffix}`;
  if (status === 403) return `OpenAI rejected the request. Check your API key and account access.${suffix}`;
  return `OpenAI request failed (${status}).${suffix}`;
}

function splitText(text, maxLength = OPENAI_MAX_CHARS) {
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

async function readAudioResponse(response, fallbackFormat) {
  const fallbackMimeType = MIME_TYPES[fallbackFormat] || "audio/mpeg";
  const contentType = response.headers.get("content-type") || fallbackMimeType;
  if (contentType && !contentType.includes("audio/") && !contentType.includes("application/octet-stream")) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // Ignore unreadable non-audio body.
    }
    throw new Error(detail || `OpenAI returned ${contentType}, not playable audio`);
  }

  if (!response.body) {
    throw new Error("OpenAI returned an empty audio stream");
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
    throw new Error("OpenAI returned empty audio");
  }

  const audio = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }

  const responseMimeType = contentType.split(";")[0];
  const mimeType = responseMimeType && responseMimeType !== "application/octet-stream"
    ? contentType
    : fallbackMimeType;
  return { buffer: audio.buffer, mimeType };
}

async function requestSpeechChunk(apiKey, input, options) {
  const model = getOpenAIModel(options.model).id;
  const voice = getOpenAIVoice(options.voice).id;
  const responseFormat = options.outputFormat ?? DEFAULT_OPENAI_OUTPUT_FORMAT;
  const body = {
    model,
    voice,
    input,
    response_format: responseFormat,
    speed: options.apiSpeed,
  };

  const response = await fetch(OPENAI_SPEECH_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: MIME_TYPES[responseFormat] || "audio/*",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = stringifyErrorDetail(await response.json()) || detail;
    } catch {
      // Non-JSON error body.
    }
    throw new Error(mapOpenAIError(response.status, detail));
  }

  return readAudioResponse(response, responseFormat);
}

export async function streamTextToSpeech(apiKey, text, options = {}) {
  if (!apiKey) {
    throw new Error("OpenAI API key missing or invalid.");
  }

  const chunks = splitText(text);
  if (chunks.length === 0) {
    throw new Error("OpenAI request text was empty.");
  }

  const requestedSpeed = options.playbackSpeed ?? 1;
  const apiSpeed = clampOpenAISpeed(requestedSpeed);
  const outputFormat = options.outputFormat ?? DEFAULT_OPENAI_OUTPUT_FORMAT;
  const buffers = [];
  let mimeType = MIME_TYPES[outputFormat] || "audio/mpeg";

  for (const chunk of chunks) {
    const audio = await requestSpeechChunk(apiKey, chunk, {
      model: options.model ?? DEFAULT_OPENAI_MODEL,
      voice: options.voice ?? DEFAULT_OPENAI_VOICE,
      outputFormat,
      apiSpeed,
    });
    buffers.push(audio.buffer);
    mimeType = audio.mimeType || mimeType;
  }

  return {
    blob: new Blob(buffers, { type: mimeType }),
    playbackRate: clientPlaybackRate(requestedSpeed, apiSpeed),
  };
}

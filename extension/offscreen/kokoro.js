import {
  DEFAULT_KOKORO_VOICE,
  KOKORO_VOICES,
} from "../config.js";
import {
  DEFAULT_PACKAGED_KOKORO_PLATFORM,
  ENABLE_WEBGPU,
} from "../build-flavor.js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const WASM_ROOT = chrome.runtime.getURL("vendor/onnxruntime-web/");
const KOKORO_BUNDLE = chrome.runtime.getURL("vendor/kokoro-js/kokoro.web.js");
const HUGGING_FACE_ROOT = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/";
const MAX_CHUNK_LENGTH = 220;
const SILENCE_BETWEEN_CHUNKS_MS = 180;
const SAMPLE_RATE = 24000;

let kokoroModulePromise = null;
const ttsByRuntime = new Map();

const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (resource, init) => {
  const url = typeof resource === "string" ? resource : resource?.url;
  if (url?.startsWith(HUGGING_FACE_ROOT)) {
    const relativePath = url.slice(HUGGING_FACE_ROOT.length);
    return nativeFetch(chrome.runtime.getURL(`models/kokoro/${relativePath}`), init);
  }
  return nativeFetch(resource, init);
};

function validVoice(voice) {
  return KOKORO_VOICES.some((option) => option.id === voice) ? voice : DEFAULT_KOKORO_VOICE;
}

function errorText(err) {
  const message = String(err?.message || err || "").trim();
  const cause = String(err?.cause?.message || err?.cause || "").trim();
  return cause && !message.includes(cause) ? `${message}: ${cause}` : message;
}

function kokoroSpeed(playbackSpeed) {
  const speed = Number(playbackSpeed) || 1;
  return Math.min(2, Math.max(0.5, speed));
}

function wasmThreadCount() {
  if (!globalThis.crossOriginIsolated) return 1;
  return Math.min(4, Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function splitText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (normalized.length <= MAX_CHUNK_LENGTH) return [normalized];

  const sentences = Array.from(normalized.matchAll(/[^.!?;:]+[.!?;:]+|\S.+$/g), (match) => match[0].trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  function pushPiece(piece) {
    const trimmed = piece.trim();
    if (!trimmed) return;
    const next = current ? `${current} ${trimmed}` : trimmed;
    if (next.length <= MAX_CHUNK_LENGTH) {
      current = next;
      return;
    }
    if (current) chunks.push(current);
    current = trimmed;
    while (current.length > MAX_CHUNK_LENGTH) {
      let splitAt = Math.max(
        current.lastIndexOf(",", MAX_CHUNK_LENGTH),
        current.lastIndexOf(" and ", MAX_CHUNK_LENGTH),
        current.lastIndexOf(" but ", MAX_CHUNK_LENGTH),
        current.lastIndexOf(" or ", MAX_CHUNK_LENGTH),
        current.lastIndexOf(" ", MAX_CHUNK_LENGTH),
      );
      if (splitAt < 80) splitAt = MAX_CHUNK_LENGTH;
      chunks.push(current.slice(0, splitAt).trim());
      current = current.slice(splitAt).trimStart();
    }
  }

  for (const sentence of sentences.length ? sentences : [normalized]) {
    const pieces = sentence.length > MAX_CHUNK_LENGTH
      ? sentence.split(/(?<=,)\s+|\s+(?=and |but |or )/i)
      : [sentence];
    for (const piece of pieces) pushPiece(piece);
  }

  if (current) chunks.push(current);
  return chunks;
}

async function loadKokoroModule() {
  if (!kokoroModulePromise) {
    kokoroModulePromise = import(KOKORO_BUNDLE).then((mod) => {
      mod.env.wasmPaths = WASM_ROOT;
      mod.env.wasmNumThreads = wasmThreadCount();
      mod.env.wasmProxy = false;
      return mod;
    });
  }
  return kokoroModulePromise;
}

async function createTTS(device) {
  const { KokoroTTS } = await loadKokoroModule();
  const dtype = device === "webgpu" ? "fp32" : "q8";
  try {
    return await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype,
      device,
    });
  } catch (err) {
    console.error(`Kokoro ${device} model load failed`, err);
    const detail = errorText(err);
    throw new Error(`Kokoro ${device} model could not be loaded. ${detail || "Reload the extension and try again."}`);
  }
}

function normalizePlatform(platform) {
  return ["auto", "wasm", "webgpu"].includes(platform) ? platform : "auto";
}

function configuredRuntime(platform) {
  const normalized = normalizePlatform(platform);
  if (normalized === "auto") {
    return DEFAULT_PACKAGED_KOKORO_PLATFORM === "webgpu" && ENABLE_WEBGPU && navigator.gpu
      ? "webgpu"
      : "wasm";
  }
  return normalized;
}

async function getTTS(platform) {
  const runtime = configuredRuntime(platform);
  if (ttsByRuntime.has(runtime)) return ttsByRuntime.get(runtime);

  const tts = await createTTS(runtime);
  console.info(`Kokoro loaded with ${runtime}`);
  ttsByRuntime.set(runtime, tts);
  return tts;
}

function concatenateAudio(chunks) {
  const silenceLength = Math.round(SAMPLE_RATE * SILENCE_BETWEEN_CHUNKS_MS / 1000);
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + Math.max(0, chunks.length - 1) * silenceLength;
  const output = new Float32Array(totalLength);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    output.set(chunk, offset);
    offset += chunk.length;
    if (i < chunks.length - 1) offset += silenceLength;
  }
  return output;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodePcmWav(samples, sampleRate = SAMPLE_RATE) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const finite = Number.isFinite(sample) ? sample : 0;
    const clamped = Math.max(-1, Math.min(1, finite));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function blobHeader(blob, length = 12) {
  const bytes = new Uint8Array(await blob.slice(0, length).arrayBuffer());
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function synthesize({ text, voice, platform, playbackSpeed }) {
  const chunks = splitText(text);
  if (chunks.length === 0) {
    throw new Error("Kokoro could not generate audio for this text. Try a shorter selection.");
  }

  const tts = await getTTS(platform);
  const audioChunks = [];
  for (const chunk of chunks) {
    const audio = await tts.generate(chunk, {
      voice: validVoice(voice),
      speed: kokoroSpeed(playbackSpeed),
    });
    audioChunks.push(audio.audio);
  }

  const samples = concatenateAudio(audioChunks);
  const blob = encodePcmWav(samples);
  return {
    ok: true,
    audio: await blobToBase64(blob),
    mimeType: "audio/wav",
    byteLength: blob.size,
    debug: {
      samples: samples.length,
      header: await blobHeader(blob),
    },
    playbackRate: 1,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "synthesizeKokoro") return false;

  (async () => {
    try {
      sendResponse(await synthesize(message));
    } catch (err) {
      const messageText = String(err?.message || err);
      console.error("Kokoro synthesis failed", err);
      const detail = errorText(err);
      const userMessage = /Kokoro .*model could not be loaded/i.test(messageText)
        ? messageText
        : `Kokoro could not generate audio for this text. ${detail || "Try a shorter selection."}`;
      sendResponse({ ok: false, error: userMessage });
    }
  })();

  return true;
});

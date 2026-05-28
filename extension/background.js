import { DEFAULT_VOICE_ID, MODEL_ID as DEFAULT_ELEVENLABS_MODEL_ID, streamTextToSpeech } from "./speech-engines/elevenlabs.js";
import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_OUTPUT_FORMAT,
  DEFAULT_OPENAI_VOICE,
  DEFAULT_KOKORO_PLATFORM,
  DEFAULT_KOKORO_VOICE,
  DEFAULT_SARVAM_LANGUAGE,
  DEFAULT_SARVAM_VOICE,
  DEFAULT_SMALLEST_AI_MODEL,
  DEFAULT_SMALLEST_AI_VOICE,
} from "./config.js";
import { KOKORO_ENABLED } from "./build-flavor.js";
import { extensionApi, runtimeSendMessage, storageGet, storageSet } from "./browser-api.js";
import { streamTextToSpeech as streamOpenAITextToSpeech } from "./speech-engines/openai.js";
import { streamTextToSpeech as streamSarvamTextToSpeech } from "./speech-engines/sarvam.js";
import { streamTextToSpeech as streamSmallestAITextToSpeech } from "./speech-engines/smallest-ai.js";

const MENU_ID = "read-it-out";
const KOKORO_OFFSCREEN_URL = "offscreen/kokoro.html";
let creatingKokoroOffscreen;

extensionApi.runtime.onInstalled.addListener(() => {
  (async () => {
    await extensionApi.contextMenus.removeAll();
    await extensionApi.contextMenus.create({
      id: MENU_ID,
      title: "Read It Out",
      contexts: ["selection"],
    });
  })().catch((err) => console.error("Read It Out context menu setup failed", err));
});

extensionApi.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return;
  }

  storageSet({ selectedText: info.selectionText }).catch(() => {});
});

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function ensureKokoroOffscreenDocument() {
  if (!KOKORO_ENABLED || !extensionApi.offscreen?.createDocument) {
    throw new Error("Kokoro local speech requires Chrome offscreen document support.");
  }

  const offscreenUrl = extensionApi.runtime.getURL(KOKORO_OFFSCREEN_URL);
  if (extensionApi.runtime.getContexts) {
    const contexts = await extensionApi.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl],
    });
    if (contexts.length > 0) return;
  } else if (extensionApi.offscreen.hasDocument && await extensionApi.offscreen.hasDocument()) {
    return;
  }

  if (!creatingKokoroOffscreen) {
    creatingKokoroOffscreen = extensionApi.offscreen.createDocument({
      url: KOKORO_OFFSCREEN_URL,
      reasons: ["BLOBS"],
      justification: "Generate local Kokoro speech audio with bundled ONNX Runtime assets.",
    }).finally(() => {
      creatingKokoroOffscreen = null;
    });
  }
  await creatingKokoroOffscreen;
}

async function synthesizeKokoroSpeech(text, options) {
  await ensureKokoroOffscreenDocument();
  return runtimeSendMessage({
    action: "synthesizeKokoro",
    text,
    ...options,
  });
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "openPopup") {
    extensionApi.action?.openPopup?.().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === "synthesize") {
    (async () => {
      let provider = "elevenLabs";
      try {
        const stored = await storageGet([
          "speechProvider",
          "elevenLabsApiKey",
          "elevenLabsVoiceId",
          "elevenLabsModel",
          "openaiApiKey",
          "openaiModel",
          "openaiVoice",
          "sarvamApiKey",
          "sarvamVoice",
          "sarvamLanguage",
          "smallestAiApiKey",
          "smallestAiModel",
          "smallestAiVoice",
          "kokoroVoice",
          "kokoroPlatform",
          "languageCode",
          "playbackSpeed",
        ]);

        if (stored.speechProvider === "kokoro" && !KOKORO_ENABLED) {
          await storageSet({ speechProvider: "webSpeech" }).catch(() => {});
          sendResponse({ ok: false, error: "Kokoro Local is not supported in the Firefox extension yet.", provider: "kokoro" });
          return;
        }

        provider = ["openAI", "sarvam", "smallestAI", ...(KOKORO_ENABLED ? ["kokoro"] : [])].includes(stored.speechProvider)
          ? stored.speechProvider
          : "elevenLabs";
        let result;

        if (provider === "kokoro") {
          result = await synthesizeKokoroSpeech(message.text, {
            voice: stored.kokoroVoice || DEFAULT_KOKORO_VOICE,
            platform: stored.kokoroPlatform || DEFAULT_KOKORO_PLATFORM,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
          if (!result?.ok) {
            sendResponse({
              ok: false,
              error: result?.error || "Kokoro could not generate audio for this text. Try a shorter selection.",
              provider,
            });
            return;
          }
          sendResponse({ ...result, provider });
          return;
        } else if (provider === "openAI") {
          const apiKey = stored.openaiApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "OpenAI API key missing or invalid.", provider });
            return;
          }

          result = await streamOpenAITextToSpeech(apiKey, message.text, {
            model: stored.openaiModel || DEFAULT_OPENAI_MODEL,
            voice: stored.openaiVoice || DEFAULT_OPENAI_VOICE,
            outputFormat: message.outputFormat || DEFAULT_OPENAI_OUTPUT_FORMAT,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
        } else if (provider === "sarvam") {
          const apiKey = stored.sarvamApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "Invalid Sarvam API key. Check your key in settings.", provider });
            return;
          }

          result = await streamSarvamTextToSpeech(apiKey, message.text, {
            voice: stored.sarvamVoice || DEFAULT_SARVAM_VOICE,
            language: stored.sarvamLanguage || DEFAULT_SARVAM_LANGUAGE,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
        } else if (provider === "smallestAI") {
          const apiKey = stored.smallestAiApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "Invalid or missing Smallest AI API key. Check your key in settings.", provider });
            return;
          }

          result = await streamSmallestAITextToSpeech(apiKey, message.text, {
            model: stored.smallestAiModel || DEFAULT_SMALLEST_AI_MODEL,
            voice: stored.smallestAiVoice || DEFAULT_SMALLEST_AI_VOICE,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
        } else {
          const apiKey = stored.elevenLabsApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "Missing ElevenLabs API key", provider });
            return;
          }

          result = await streamTextToSpeech(apiKey, message.text, {
            voiceId: stored.elevenLabsVoiceId || DEFAULT_VOICE_ID,
            modelId: stored.elevenLabsModel || DEFAULT_ELEVENLABS_MODEL_ID,
            languageCode: stored.languageCode || null,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
            outputFormat: message.outputFormat,
          });
        }

        const { blob, playbackRate } = result;

        sendResponse({
          ok: true,
          audio: await blobToBase64(blob),
          mimeType: blob.type || "audio/mpeg",
          byteLength: blob.size,
          playbackRate,
          provider,
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || "Speech generation failed", provider });
      }
    })();
    return true;
  }

  return false;
});

import { DEFAULT_VOICE_ID, streamTextToSpeech } from "./speech-engines/elevenlabs.js";
import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_OUTPUT_FORMAT,
  DEFAULT_OPENAI_STYLE,
  DEFAULT_OPENAI_VOICE,
  DEFAULT_SARVAM_EXPRESSIVENESS,
  DEFAULT_SARVAM_LANGUAGE,
  DEFAULT_SARVAM_VOICE,
  DEFAULT_SMALLEST_AI_VOICE,
  getOpenAIStyle,
} from "./config.js";
import { streamTextToSpeech as streamOpenAITextToSpeech } from "./speech-engines/openai.js";
import { streamTextToSpeech as streamSarvamTextToSpeech } from "./speech-engines/sarvam.js";
import { streamTextToSpeech as streamSmallestAITextToSpeech } from "./speech-engines/smallest-ai.js";

const MENU_ID = "read-it-out";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Read It Out",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return;
  }

  chrome.storage.local.set({ selectedText: info.selectionText });
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "openPopup") {
    chrome.action.openPopup().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === "synthesize") {
    (async () => {
      try {
        const stored = await chrome.storage.local.get([
          "speechProvider",
          "elevenLabsApiKey",
          "elevenLabsVoiceId",
          "openaiApiKey",
          "openaiModel",
          "openaiVoice",
          "openaiStyle",
          "sarvamApiKey",
          "sarvamVoice",
          "sarvamLanguage",
          "sarvamExpressiveness",
          "smallestAiApiKey",
          "smallestAiVoice",
          "languageCode",
          "playbackSpeed",
        ]);

        const provider = ["openAI", "sarvam", "smallestAI"].includes(stored.speechProvider)
          ? stored.speechProvider
          : "elevenLabs";
        let result;

        if (provider === "openAI") {
          const apiKey = stored.openaiApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "OpenAI API key missing or invalid." });
            return;
          }

          result = await streamOpenAITextToSpeech(apiKey, message.text, {
            model: stored.openaiModel || DEFAULT_OPENAI_MODEL,
            voice: stored.openaiVoice || DEFAULT_OPENAI_VOICE,
            instructions: getOpenAIStyle(stored.openaiStyle || DEFAULT_OPENAI_STYLE).instructions,
            outputFormat: message.outputFormat || DEFAULT_OPENAI_OUTPUT_FORMAT,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
        } else if (provider === "sarvam") {
          const apiKey = stored.sarvamApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "Invalid Sarvam API key. Check your key in settings." });
            return;
          }

          result = await streamSarvamTextToSpeech(apiKey, message.text, {
            voice: stored.sarvamVoice || DEFAULT_SARVAM_VOICE,
            language: stored.sarvamLanguage || DEFAULT_SARVAM_LANGUAGE,
            expressiveness: stored.sarvamExpressiveness || DEFAULT_SARVAM_EXPRESSIVENESS,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
        } else if (provider === "smallestAI") {
          const apiKey = stored.smallestAiApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "Invalid or missing Smallest AI API key. Check your key in settings." });
            return;
          }

          result = await streamSmallestAITextToSpeech(apiKey, message.text, {
            voice: stored.smallestAiVoice || DEFAULT_SMALLEST_AI_VOICE,
            playbackSpeed: message.playbackSpeed ?? stored.playbackSpeed,
          });
        } else {
          const apiKey = stored.elevenLabsApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: "Missing ElevenLabs API key" });
            return;
          }

          result = await streamTextToSpeech(apiKey, message.text, {
            voiceId: stored.elevenLabsVoiceId || DEFAULT_VOICE_ID,
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
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || "Speech generation failed" });
      }
    })();
    return true;
  }

  return false;
});

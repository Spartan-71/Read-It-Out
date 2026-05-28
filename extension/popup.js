import {
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_ELEVENLABS_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_VOICE,
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_KOKORO_VOICE,
  DEFAULT_KOKORO_PLATFORM,
  KOKORO_LANGUAGES,
  KOKORO_PLATFORMS,
  DEFAULT_SARVAM_LANGUAGE,
  DEFAULT_SARVAM_VOICE,
  DEFAULT_SMALLEST_AI_MODEL,
  DEFAULT_SMALLEST_AI_VOICE,
  KOKORO_VOICES,
  DEFAULT_SPEECH_PROVIDER,
  ELEVENLABS_MODELS,
  LANGUAGES,
  OPENAI_MODELS,
  OPENAI_VOICES,
  PLAYBACK_SPEEDS,
  SARVAM_LANGUAGES,
  SARVAM_VOICES,
  SMALLEST_AI_FALLBACK_VOICES,
  SMALLEST_AI_MODELS,
  SETTINGS_KEYS,
  SPEECH_PROVIDERS,
  VOICES,
  isKokoroPlatform,
  isSpeechProviderId,
  languageOptionLabel,
} from "./config.js";
import { storageGet, storageSet } from "./browser-api.js";
import { fetchVoices as fetchSmallestAIVoices } from "./speech-engines/smallest-ai.js";

const form = document.getElementById("settings-form");
const statusText = form.querySelector(".status-text");
const tabButtons = Array.from(form.querySelectorAll(".settings-tab"));
const tabPanels = Array.from(form.querySelectorAll(".settings-tab-panel"));
const speechProviderSelect = document.getElementById("speech-provider");
const selectionPopupEnabledInput = document.getElementById("selection-popup-enabled");
const floatingDockEnabledInput = document.getElementById("floating-dock-enabled");
const elevenLabsSection = document.getElementById("elevenlabs-section");
const openAISection = document.getElementById("openai-section");
const sarvamSection = document.getElementById("sarvam-section");
const smallestAISection = document.getElementById("smallest-ai-section");
const kokoroSection = document.getElementById("kokoro-section");
const speedButtonsEl = document.getElementById("speed-buttons");
const languageSelect = document.getElementById("language");
const elevenLabsApiKeyInput = document.getElementById("elevenlabs-api-key");
const elevenLabsModelSelect = document.getElementById("elevenlabs-model");
const elevenLabsVoiceSelect = document.getElementById("elevenlabs-voice");
const elevenLabsLanguageSelect = document.getElementById("elevenlabs-language");
const openAIApiKeyInput = document.getElementById("openai-api-key");
const openAIModelSelect = document.getElementById("openai-model");
const openAIVoiceSelect = document.getElementById("openai-voice");
const sarvamApiKeyInput = document.getElementById("sarvam-api-key");
const sarvamVoiceSelect = document.getElementById("sarvam-voice");
const sarvamLanguageSelect = document.getElementById("sarvam-language");
const smallestAIApiKeyInput = document.getElementById("smallest-ai-api-key");
const smallestAIModelSelect = document.getElementById("smallest-ai-model");
const smallestAIVoiceSelect = document.getElementById("smallest-ai-voice");
const kokoroVoiceSelect = document.getElementById("kokoro-voice");
const kokoroPlatformSelect = document.getElementById("kokoro-platform");
const saveButton = document.getElementById("save-settings");
const errorToast = document.getElementById("popup-error-toast");

let playbackSpeed = DEFAULT_PLAYBACK_SPEED;
let speechProvider = DEFAULT_SPEECH_PROVIDER;
let savedLanguageCode = DEFAULT_LANGUAGE_CODE;
let errorToastTimer = null;
let smallestAIVoiceCache = null;
let smallestAIVoiceCacheKey = "";

function schedulePopupResize() {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function setPanelState(state) {
  form.classList.remove("is-ready", "is-playing", "is-generating", "is-paused", "is-saved");
  form.classList.add(`is-${state}`);
  schedulePopupResize();
}

function setStatus(label) {
  statusText.textContent = label;
  schedulePopupResize();
}

function showToast(message, type = "error") {
  if (!errorToast) return;
  errorToast.textContent = message.length > 180 ? `${message.slice(0, 177)}...` : message;
  errorToast.classList.toggle("is-success", type === "success");
  errorToast.hidden = false;
  schedulePopupResize();
  clearTimeout(errorToastTimer);
  errorToastTimer = setTimeout(() => {
    errorToast.hidden = true;
    schedulePopupResize();
  }, 3600);
}

function markDirty() {
  setPanelState("ready");
  setStatus("Unsaved");
}

function activateTab(targetId) {
  for (const button of tabButtons) {
    const active = button.dataset.tabTarget === targetId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }

  for (const panel of tabPanels) {
    const active = panel.id === targetId;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  }
  schedulePopupResize();
}

function formatSpeed(speed) {
  return `${speed}x`;
}

function updateSpeedButtons() {
  for (const btn of speedButtonsEl.querySelectorAll("[data-speed]")) {
    const speed = Number(btn.dataset.speed);
    const active = speed === playbackSpeed;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  }
}

function updateProviderVisibility() {
  const elevenLabs = speechProvider === "elevenLabs";
  const openAI = speechProvider === "openAI";
  const sarvam = speechProvider === "sarvam";
  const smallestAI = speechProvider === "smallestAI";
  const kokoro = speechProvider === "kokoro";
  form.classList.toggle("uses-elevenlabs", elevenLabs);
  form.classList.toggle("uses-openai", openAI);
  form.classList.toggle("uses-sarvam", sarvam);
  form.classList.toggle("uses-smallest-ai", smallestAI);
  form.classList.toggle("uses-kokoro", kokoro);
  if (elevenLabsSection) elevenLabsSection.hidden = !elevenLabs;
  if (openAISection) openAISection.hidden = !openAI;
  if (sarvamSection) sarvamSection.hidden = !sarvam;
  if (smallestAISection) smallestAISection.hidden = !smallestAI;
  if (kokoroSection) kokoroSection.hidden = !kokoro;
  schedulePopupResize();
}

function webSpeechLanguageCodes() {
  if (!("speechSynthesis" in window)) return new Set();
  const codes = new Set();
  for (const voice of speechSynthesis.getVoices()) {
    const lang = voice.lang?.trim().toLowerCase();
    if (!lang) continue;
    codes.add(lang);
    codes.add(lang.split("-")[0]);
  }
  return codes;
}

function supportedLanguageOptions() {
  const languages = LANGUAGES.filter((lang) => lang.code !== "");
  if (speechProvider === "kokoro") {
    return KOKORO_LANGUAGES;
  }
  if (speechProvider === "elevenLabs") return languages;

  const supportedCodes = webSpeechLanguageCodes();
  if (supportedCodes.size === 0) {
    return languages.filter((lang) => lang.code === DEFAULT_LANGUAGE_CODE);
  }

  return languages.filter((lang) => supportedCodes.has(lang.code.toLowerCase()));
}

function populateLanguageSelect(preferredCode = languageSelect.value || savedLanguageCode) {
  const options = supportedLanguageOptions();
  populateSelect(
    languageSelect,
    options.length ? options : LANGUAGES.filter((lang) => lang.code === DEFAULT_LANGUAGE_CODE),
    (lang) => lang.code,
    (lang) => languageOptionLabel(lang),
  );

  languageSelect.value = options.some((lang) => lang.code === preferredCode)
    ? preferredCode
    : languageSelect.options[0]?.value || DEFAULT_LANGUAGE_CODE;
}

function populateElevenLabsLanguageSelect(preferredCode = elevenLabsLanguageSelect.value || savedLanguageCode) {
  const options = LANGUAGES.filter((lang) => lang.code !== "");
  populateSelect(
    elevenLabsLanguageSelect,
    options,
    (lang) => lang.code,
    (lang) => languageOptionLabel(lang),
  );
  elevenLabsLanguageSelect.value = options.some((lang) => lang.code === preferredCode)
    ? preferredCode
    : DEFAULT_LANGUAGE_CODE;
}

function selectedLanguageCode() {
  return speechProvider === "elevenLabs"
    ? elevenLabsLanguageSelect.value || DEFAULT_LANGUAGE_CODE
    : languageSelect.value || DEFAULT_LANGUAGE_CODE;
}

function populateSelect(select, options, getValue, getLabel) {
  select.replaceChildren();
  for (const option of options) {
    const el = document.createElement("option");
    el.value = getValue(option);
    el.textContent = getLabel(option);
    el.disabled = Boolean(option.disabled);
    select.appendChild(el);
  }
}

function populateSmallestAIVoiceSelect(voices, preferredVoice = smallestAIVoiceSelect.value) {
  populateSelect(
    smallestAIVoiceSelect,
    voices.length ? voices : SMALLEST_AI_FALLBACK_VOICES,
    (voice) => voice.id,
    (voice) => voice.label,
  );
  smallestAIVoiceSelect.value = [...smallestAIVoiceSelect.options].some((option) => option.value === preferredVoice)
    ? preferredVoice
    : DEFAULT_SMALLEST_AI_VOICE;
}

function populateKokoroVoiceSelect(preferredVoice = kokoroVoiceSelect.value) {
  const language = languageSelect.value || savedLanguageCode || DEFAULT_LANGUAGE_CODE;
  const voices = KOKORO_VOICES.filter((voice) => voice.language === language);
  const options = voices.length ? voices : KOKORO_VOICES.filter((voice) => voice.language === "en-US");
  populateSelect(
    kokoroVoiceSelect,
    options,
    (voice) => voice.id,
    (voice) => voice.label,
  );
  kokoroVoiceSelect.value = options.some((voice) => voice.id === preferredVoice)
    ? preferredVoice
    : options[0]?.id || DEFAULT_KOKORO_VOICE;
}

function setSmallestAIVoiceLoading() {
  smallestAIVoiceSelect.replaceChildren();
  const option = document.createElement("option");
  option.value = "";
  option.textContent = "Loading voices...";
  smallestAIVoiceSelect.appendChild(option);
  smallestAIVoiceSelect.disabled = true;
}

async function loadSmallestAIVoices(preferredVoice = smallestAIVoiceSelect.value) {
  const apiKey = smallestAIApiKeyInput.value.trim();
  const model = smallestAIModelSelect.value || DEFAULT_SMALLEST_AI_MODEL;
  if (!apiKey) {
    smallestAIVoiceCache = null;
    smallestAIVoiceCacheKey = "";
    populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, preferredVoice);
    smallestAIVoiceSelect.disabled = false;
    return;
  }

  const cacheKey = `${apiKey}:${model}`;
  if (smallestAIVoiceCache && smallestAIVoiceCacheKey === cacheKey) {
    populateSmallestAIVoiceSelect(smallestAIVoiceCache, preferredVoice);
    smallestAIVoiceSelect.disabled = false;
    return;
  }

  setSmallestAIVoiceLoading();
  try {
    const voices = await fetchSmallestAIVoices(apiKey, model);
    smallestAIVoiceCache = voices;
    smallestAIVoiceCacheKey = cacheKey;
    populateSmallestAIVoiceSelect(voices, preferredVoice);
  } catch (_err) {
    populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, preferredVoice);
  } finally {
    smallestAIVoiceSelect.disabled = false;
    schedulePopupResize();
  }
}

function populateSarvamVoiceSelect(preferredVoice = sarvamVoiceSelect.value || DEFAULT_SARVAM_VOICE) {
  sarvamVoiceSelect.replaceChildren();
  for (const gender of ["Male", "Female"]) {
    const group = document.createElement("optgroup");
    group.label = gender;
    for (const voice of SARVAM_VOICES.filter((v) => v.gender === gender)) {
      const option = document.createElement("option");
      option.value = voice.id;
      option.textContent = voice.label;
      group.appendChild(option);
    }
    if (group.children.length > 0) sarvamVoiceSelect.appendChild(group);
  }
  sarvamVoiceSelect.value = SARVAM_VOICES.some((voice) => voice.id === preferredVoice)
    ? preferredVoice
    : DEFAULT_SARVAM_VOICE;
}

function initControls() {
  populateSelect(
    speechProviderSelect,
    SPEECH_PROVIDERS,
    (provider) => provider.id,
    (provider) => provider.label,
  );
  populateSelect(
    elevenLabsModelSelect,
    ELEVENLABS_MODELS,
    (model) => model.id,
    (model) => model.label,
  );
  populateSelect(
    elevenLabsVoiceSelect,
    VOICES,
    (voice) => voice.id,
    (voice) => voice.label,
  );
  populateElevenLabsLanguageSelect(DEFAULT_LANGUAGE_CODE);
  populateSelect(
    openAIModelSelect,
    OPENAI_MODELS,
    (model) => model.id,
    (model) => model.label,
  );
  populateSelect(
    openAIVoiceSelect,
    OPENAI_VOICES,
    (voice) => voice.id,
    (voice) => voice.label,
  );
  populateSarvamVoiceSelect(DEFAULT_SARVAM_VOICE);
  populateSelect(
    sarvamLanguageSelect,
    SARVAM_LANGUAGES,
    (language) => language.code,
    (language) => language.label,
  );
  populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, DEFAULT_SMALLEST_AI_VOICE);
  populateSelect(
    smallestAIModelSelect,
    SMALLEST_AI_MODELS,
    (model) => model.id,
    (model) => model.label,
  );
  populateSelect(
    kokoroPlatformSelect,
    KOKORO_PLATFORMS,
    (platform) => platform.id,
    (platform) => platform.label,
  );
  populateKokoroVoiceSelect(DEFAULT_KOKORO_VOICE);

  populateLanguageSelect();
  for (const speed of PLAYBACK_SPEEDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.speed = String(speed);
    btn.textContent = formatSpeed(speed);
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      playbackSpeed = speed;
      updateSpeedButtons();
      markDirty();
    });
    speedButtonsEl.appendChild(btn);
  }

}

async function loadSettings() {
  const stored = await storageGet(SETTINGS_KEYS);
  speechProvider = isSpeechProviderId(stored.speechProvider)
    ? stored.speechProvider
    : DEFAULT_SPEECH_PROVIDER;
  speechProviderSelect.value = speechProvider;
  updateProviderVisibility();
  selectionPopupEnabledInput.checked = stored.selectionPopupEnabled !== false;
  floatingDockEnabledInput.checked = stored.floatingDockEnabled !== false;

  elevenLabsApiKeyInput.value = stored.elevenLabsApiKey || "";
  elevenLabsModelSelect.value = ELEVENLABS_MODELS.some((model) => model.id === stored.elevenLabsModel)
    ? stored.elevenLabsModel
    : DEFAULT_ELEVENLABS_MODEL;
  elevenLabsVoiceSelect.value = VOICES.some((voice) => voice.id === stored.elevenLabsVoiceId)
    ? stored.elevenLabsVoiceId
    : VOICES[0].id;
  openAIApiKeyInput.value = stored.openaiApiKey || "";
  openAIModelSelect.value = OPENAI_MODELS.some((model) => model.id === stored.openaiModel)
    ? stored.openaiModel
    : DEFAULT_OPENAI_MODEL;
  openAIVoiceSelect.value = OPENAI_VOICES.some((voice) => voice.id === stored.openaiVoice)
    ? stored.openaiVoice
    : DEFAULT_OPENAI_VOICE;
  sarvamApiKeyInput.value = stored.sarvamApiKey || "";
  populateSarvamVoiceSelect(stored.sarvamVoice || DEFAULT_SARVAM_VOICE);
  sarvamLanguageSelect.value = SARVAM_LANGUAGES.some((language) => language.code === stored.sarvamLanguage)
    ? stored.sarvamLanguage
    : DEFAULT_SARVAM_LANGUAGE;
  smallestAIApiKeyInput.value = stored.smallestAiApiKey || "";
  smallestAIModelSelect.value = SMALLEST_AI_MODELS.some((model) => model.id === stored.smallestAiModel)
    ? stored.smallestAiModel
    : DEFAULT_SMALLEST_AI_MODEL;
  populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, stored.smallestAiVoice || DEFAULT_SMALLEST_AI_VOICE);
  loadSmallestAIVoices(stored.smallestAiVoice || DEFAULT_SMALLEST_AI_VOICE);

  savedLanguageCode = stored.languageCode ?? DEFAULT_LANGUAGE_CODE;
  populateLanguageSelect(savedLanguageCode);
  populateElevenLabsLanguageSelect(savedLanguageCode);
  populateKokoroVoiceSelect(stored.kokoroVoice || DEFAULT_KOKORO_VOICE);
  kokoroPlatformSelect.value = isKokoroPlatform(stored.kokoroPlatform)
    ? stored.kokoroPlatform
    : DEFAULT_KOKORO_PLATFORM;
  updateProviderVisibility();

  playbackSpeed = PLAYBACK_SPEEDS.includes(stored.playbackSpeed)
    ? stored.playbackSpeed
    : DEFAULT_PLAYBACK_SPEED;

  updateSpeedButtons();
  setPanelState("ready");
  setStatus("Saved");
}

async function saveSettings() {
  saveButton.disabled = true;
  setPanelState("generating");
  setStatus("Saving");

  try {
    await storageSet({
      speechProvider,
      selectionPopupEnabled: selectionPopupEnabledInput.checked,
      floatingDockEnabled: floatingDockEnabledInput.checked,
      elevenLabsApiKey: elevenLabsApiKeyInput.value.trim(),
      elevenLabsModel: elevenLabsModelSelect.value || DEFAULT_ELEVENLABS_MODEL,
      elevenLabsVoiceId: elevenLabsVoiceSelect.value || VOICES[0].id,
      openaiApiKey: openAIApiKeyInput.value.trim(),
      openaiModel: openAIModelSelect.value || DEFAULT_OPENAI_MODEL,
      openaiVoice: openAIVoiceSelect.value || DEFAULT_OPENAI_VOICE,
      sarvamApiKey: sarvamApiKeyInput.value.trim(),
      sarvamVoice: sarvamVoiceSelect.value || DEFAULT_SARVAM_VOICE,
      sarvamLanguage: sarvamLanguageSelect.value || DEFAULT_SARVAM_LANGUAGE,
      smallestAiApiKey: smallestAIApiKeyInput.value.trim(),
      smallestAiModel: smallestAIModelSelect.value || DEFAULT_SMALLEST_AI_MODEL,
      smallestAiVoice: smallestAIVoiceSelect.value || DEFAULT_SMALLEST_AI_VOICE,
      kokoroVoice: kokoroVoiceSelect.value || DEFAULT_KOKORO_VOICE,
      kokoroPlatform: isKokoroPlatform(kokoroPlatformSelect.value)
        ? kokoroPlatformSelect.value
        : DEFAULT_KOKORO_PLATFORM,
      languageCode: selectedLanguageCode(),
      playbackSpeed,
    });
    setPanelState("saved");
    setStatus("Saved");
  } catch (err) {
    setPanelState("ready");
    setStatus("Error");
    showToast(err?.message || "Settings could not be saved.");
  } finally {
    saveButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings();
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tabTarget);
  });
}

elevenLabsApiKeyInput.addEventListener("input", markDirty);
elevenLabsModelSelect.addEventListener("change", markDirty);
elevenLabsVoiceSelect.addEventListener("change", markDirty);
elevenLabsLanguageSelect.addEventListener("change", () => {
  savedLanguageCode = elevenLabsLanguageSelect.value || DEFAULT_LANGUAGE_CODE;
  languageSelect.value = savedLanguageCode;
  markDirty();
});
openAIApiKeyInput.addEventListener("input", markDirty);
openAIVoiceSelect.addEventListener("change", markDirty);
sarvamApiKeyInput.addEventListener("input", markDirty);
sarvamVoiceSelect.addEventListener("change", markDirty);
sarvamLanguageSelect.addEventListener("change", markDirty);
smallestAIApiKeyInput.addEventListener("input", markDirty);
smallestAIApiKeyInput.addEventListener("change", () => {
  loadSmallestAIVoices();
});
smallestAIApiKeyInput.addEventListener("blur", () => {
  loadSmallestAIVoices();
});
smallestAIModelSelect.addEventListener("change", () => {
  smallestAIVoiceCache = null;
  smallestAIVoiceCacheKey = "";
  loadSmallestAIVoices();
  markDirty();
});
smallestAIVoiceSelect.addEventListener("change", markDirty);
kokoroVoiceSelect.addEventListener("change", markDirty);
kokoroPlatformSelect.addEventListener("change", markDirty);
openAIModelSelect.addEventListener("change", () => {
  updateProviderVisibility();
  markDirty();
});
selectionPopupEnabledInput.addEventListener("change", markDirty);
floatingDockEnabledInput.addEventListener("change", markDirty);
speechProviderSelect.addEventListener("change", () => {
  speechProvider = isSpeechProviderId(speechProviderSelect.value)
    ? speechProviderSelect.value
    : DEFAULT_SPEECH_PROVIDER;
  updateProviderVisibility();
  populateLanguageSelect(languageSelect.value || savedLanguageCode);
  populateElevenLabsLanguageSelect(elevenLabsLanguageSelect.value || savedLanguageCode);
  if (speechProvider === "kokoro") {
    populateKokoroVoiceSelect();
  }
  markDirty();
});
languageSelect.addEventListener("change", () => {
  savedLanguageCode = languageSelect.value || DEFAULT_LANGUAGE_CODE;
  elevenLabsLanguageSelect.value = savedLanguageCode;
  if (speechProvider === "kokoro") {
    populateKokoroVoiceSelect();
  }
  markDirty();
});

if ("speechSynthesis" in window) {
  speechSynthesis.addEventListener("voiceschanged", () => {
    if (speechProvider !== "webSpeech") return;
    populateLanguageSelect(languageSelect.value || savedLanguageCode);
  });
  setTimeout(() => {
    if (speechProvider !== "webSpeech") return;
    populateLanguageSelect(languageSelect.value || savedLanguageCode);
  }, 800);
}

window.addEventListener("load", schedulePopupResize);

initControls();
loadSettings().finally(schedulePopupResize);

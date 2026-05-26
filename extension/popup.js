import {
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_STYLE,
  DEFAULT_OPENAI_VOICE,
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_SARVAM_EXPRESSIVENESS,
  DEFAULT_SARVAM_LANGUAGE,
  DEFAULT_SARVAM_VOICE,
  DEFAULT_SMALLEST_AI_VOICE,
  DEFAULT_SPEECH_PROVIDER,
  LANGUAGES,
  OPENAI_MODELS,
  OPENAI_STYLES,
  OPENAI_VOICES,
  PLAYBACK_SPEEDS,
  SARVAM_EXPRESSIVENESS,
  SARVAM_LANGUAGES,
  SARVAM_VOICES,
  SMALLEST_AI_FALLBACK_VOICES,
  SETTINGS_KEYS,
  SPEECH_PROVIDERS,
  isSpeechProviderId,
  languageOptionLabel,
} from "./config.js";
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
const openAIStyleSection = document.getElementById("openai-style-section");
const sarvamSection = document.getElementById("sarvam-section");
const smallestAISection = document.getElementById("smallest-ai-section");
const speedButtonsEl = document.getElementById("speed-buttons");
const sarvamExpressivenessEl = document.getElementById("sarvam-expressiveness");
const languageSelect = document.getElementById("language");
const openAIStyleTagsEl = document.getElementById("openai-style-tags");
const elevenLabsApiKeyInput = document.getElementById("elevenlabs-api-key");
const openAIApiKeyInput = document.getElementById("openai-api-key");
const openAIModelSelect = document.getElementById("openai-model");
const openAIVoiceSelect = document.getElementById("openai-voice");
const sarvamApiKeyInput = document.getElementById("sarvam-api-key");
const sarvamVoiceSelect = document.getElementById("sarvam-voice");
const sarvamLanguageSelect = document.getElementById("sarvam-language");
const smallestAIApiKeyInput = document.getElementById("smallest-ai-api-key");
const smallestAIVoiceSelect = document.getElementById("smallest-ai-voice");
const saveButton = document.getElementById("save-settings");
const errorToast = document.getElementById("popup-error-toast");

let playbackSpeed = DEFAULT_PLAYBACK_SPEED;
let openAIStyle = DEFAULT_OPENAI_STYLE;
let sarvamExpressiveness = DEFAULT_SARVAM_EXPRESSIVENESS;
let speechProvider = DEFAULT_SPEECH_PROVIDER;
let savedLanguageCode = DEFAULT_LANGUAGE_CODE;
let errorToastTimer = null;
let smallestAIVoiceCache = null;
let smallestAIVoiceCacheKey = "";

function setPanelState(state) {
  form.classList.remove("is-ready", "is-playing", "is-generating", "is-paused", "is-saved");
  form.classList.add(`is-${state}`);
}

function setStatus(label) {
  statusText.textContent = label;
}

function showToast(message, type = "error") {
  if (!errorToast) return;
  errorToast.textContent = message.length > 180 ? `${message.slice(0, 177)}...` : message;
  errorToast.classList.toggle("is-success", type === "success");
  errorToast.hidden = false;
  clearTimeout(errorToastTimer);
  errorToastTimer = setTimeout(() => {
    errorToast.hidden = true;
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

function updateOpenAIStyleTags() {
  for (const btn of openAIStyleTagsEl.querySelectorAll("[data-openai-style]")) {
    const active = btn.dataset.openaiStyle === openAIStyle;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  }
}

function updateSarvamExpressiveness() {
  for (const btn of sarvamExpressivenessEl.querySelectorAll("[data-expressiveness]")) {
    const active = btn.dataset.expressiveness === sarvamExpressiveness;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  }
}

function updateProviderVisibility() {
  const elevenLabs = speechProvider === "elevenLabs";
  const openAI = speechProvider === "openAI";
  const sarvam = speechProvider === "sarvam";
  const smallestAI = speechProvider === "smallestAI";
  form.classList.toggle("uses-elevenlabs", elevenLabs);
  form.classList.toggle("uses-openai", openAI);
  form.classList.toggle("uses-sarvam", sarvam);
  form.classList.toggle("uses-smallest-ai", smallestAI);
  if (elevenLabsSection) elevenLabsSection.hidden = !elevenLabs;
  if (openAISection) openAISection.hidden = !openAI;
  if (sarvamSection) sarvamSection.hidden = !sarvam;
  if (smallestAISection) smallestAISection.hidden = !smallestAI;
  if (openAIStyleSection) {
    openAIStyleSection.hidden = !openAI || openAIModelSelect.value === "tts-1";
  }
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

function populateSelect(select, options, getValue, getLabel) {
  select.replaceChildren();
  for (const option of options) {
    const el = document.createElement("option");
    el.value = getValue(option);
    el.textContent = getLabel(option);
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
  if (!apiKey) {
    smallestAIVoiceCache = null;
    smallestAIVoiceCacheKey = "";
    populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, preferredVoice);
    smallestAIVoiceSelect.disabled = false;
    return;
  }

  if (smallestAIVoiceCache && smallestAIVoiceCacheKey === apiKey) {
    populateSmallestAIVoiceSelect(smallestAIVoiceCache, preferredVoice);
    smallestAIVoiceSelect.disabled = false;
    return;
  }

  setSmallestAIVoiceLoading();
  try {
    const voices = await fetchSmallestAIVoices(apiKey);
    smallestAIVoiceCache = voices;
    smallestAIVoiceCacheKey = apiKey;
    populateSmallestAIVoiceSelect(voices, preferredVoice);
  } catch (_err) {
    populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, preferredVoice);
  } finally {
    smallestAIVoiceSelect.disabled = false;
  }
}

function populateSarvamVoiceSelect() {
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
    sarvamVoiceSelect.appendChild(group);
  }
}

function initControls() {
  populateSelect(
    speechProviderSelect,
    SPEECH_PROVIDERS,
    (provider) => provider.id,
    (provider) => provider.label,
  );
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
  populateSarvamVoiceSelect();
  populateSelect(
    sarvamLanguageSelect,
    SARVAM_LANGUAGES,
    (language) => language.code,
    (language) => language.label,
  );
  populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, DEFAULT_SMALLEST_AI_VOICE);

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

  for (const style of OPENAI_STYLES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "style-tag";
    btn.dataset.openaiStyle = style.id;
    btn.textContent = style.label;
    btn.title = style.instructions;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      openAIStyle = OPENAI_STYLES.some((s) => s.id === style.id)
        ? style.id
        : DEFAULT_OPENAI_STYLE;
      updateOpenAIStyleTags();
      markDirty();
    });
    openAIStyleTagsEl.appendChild(btn);
  }

  for (const option of SARVAM_EXPRESSIVENESS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.expressiveness = option.id;
    btn.textContent = option.label;
    btn.setAttribute("aria-pressed", "false");
    btn.title = "Controls voice variation. Lower = consistent, Higher = expressive.";
    btn.addEventListener("click", () => {
      sarvamExpressiveness = SARVAM_EXPRESSIVENESS.some((e) => e.id === option.id)
        ? option.id
        : DEFAULT_SARVAM_EXPRESSIVENESS;
      updateSarvamExpressiveness();
      markDirty();
    });
    sarvamExpressivenessEl.appendChild(btn);
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEYS);
  speechProvider = isSpeechProviderId(stored.speechProvider)
    ? stored.speechProvider
    : DEFAULT_SPEECH_PROVIDER;
  speechProviderSelect.value = speechProvider;
  updateProviderVisibility();
  selectionPopupEnabledInput.checked = stored.selectionPopupEnabled !== false;
  floatingDockEnabledInput.checked = stored.floatingDockEnabled !== false;

  elevenLabsApiKeyInput.value = stored.elevenLabsApiKey || "";
  openAIApiKeyInput.value = stored.openaiApiKey || "";
  openAIModelSelect.value = OPENAI_MODELS.some((model) => model.id === stored.openaiModel)
    ? stored.openaiModel
    : DEFAULT_OPENAI_MODEL;
  openAIVoiceSelect.value = OPENAI_VOICES.some((voice) => voice.id === stored.openaiVoice)
    ? stored.openaiVoice
    : DEFAULT_OPENAI_VOICE;
  openAIStyle = OPENAI_STYLES.some((style) => style.id === stored.openaiStyle)
    ? stored.openaiStyle
    : DEFAULT_OPENAI_STYLE;
  sarvamApiKeyInput.value = stored.sarvamApiKey || "";
  sarvamVoiceSelect.value = SARVAM_VOICES.some((voice) => voice.id === stored.sarvamVoice)
    ? stored.sarvamVoice
    : DEFAULT_SARVAM_VOICE;
  sarvamLanguageSelect.value = SARVAM_LANGUAGES.some((language) => language.code === stored.sarvamLanguage)
    ? stored.sarvamLanguage
    : DEFAULT_SARVAM_LANGUAGE;
  sarvamExpressiveness = SARVAM_EXPRESSIVENESS.some((option) => option.id === stored.sarvamExpressiveness)
    ? stored.sarvamExpressiveness
    : DEFAULT_SARVAM_EXPRESSIVENESS;
  smallestAIApiKeyInput.value = stored.smallestAiApiKey || "";
  populateSmallestAIVoiceSelect(SMALLEST_AI_FALLBACK_VOICES, stored.smallestAiVoice || DEFAULT_SMALLEST_AI_VOICE);
  loadSmallestAIVoices(stored.smallestAiVoice || DEFAULT_SMALLEST_AI_VOICE);

  savedLanguageCode = stored.languageCode ?? DEFAULT_LANGUAGE_CODE;
  populateLanguageSelect(savedLanguageCode);
  updateProviderVisibility();

  playbackSpeed = PLAYBACK_SPEEDS.includes(stored.playbackSpeed)
    ? stored.playbackSpeed
    : DEFAULT_PLAYBACK_SPEED;

  updateSpeedButtons();
  updateOpenAIStyleTags();
  updateSarvamExpressiveness();
  setPanelState("ready");
  setStatus("Saved");
}

async function saveSettings() {
  saveButton.disabled = true;
  setPanelState("generating");
  setStatus("Saving");

  try {
    await chrome.storage.local.set({
      speechProvider,
      selectionPopupEnabled: selectionPopupEnabledInput.checked,
      floatingDockEnabled: floatingDockEnabledInput.checked,
      elevenLabsApiKey: elevenLabsApiKeyInput.value.trim(),
      openaiApiKey: openAIApiKeyInput.value.trim(),
      openaiModel: openAIModelSelect.value || DEFAULT_OPENAI_MODEL,
      openaiVoice: openAIVoiceSelect.value || DEFAULT_OPENAI_VOICE,
      openaiStyle: openAIStyle || DEFAULT_OPENAI_STYLE,
      sarvamApiKey: sarvamApiKeyInput.value.trim(),
      sarvamVoice: sarvamVoiceSelect.value || DEFAULT_SARVAM_VOICE,
      sarvamLanguage: sarvamLanguageSelect.value || DEFAULT_SARVAM_LANGUAGE,
      sarvamExpressiveness: sarvamExpressiveness || DEFAULT_SARVAM_EXPRESSIVENESS,
      smallestAiApiKey: smallestAIApiKeyInput.value.trim(),
      smallestAiVoice: smallestAIVoiceSelect.value || DEFAULT_SMALLEST_AI_VOICE,
      languageCode: languageSelect.value || DEFAULT_LANGUAGE_CODE,
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
smallestAIVoiceSelect.addEventListener("change", markDirty);
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
  markDirty();
});
languageSelect.addEventListener("change", () => {
  savedLanguageCode = languageSelect.value || DEFAULT_LANGUAGE_CODE;
  markDirty();
});

if ("speechSynthesis" in window) {
  speechSynthesis.addEventListener("voiceschanged", () => {
    if (speechProvider !== "webSpeech") return;
    populateLanguageSelect(languageSelect.value || savedLanguageCode);
  });
}

initControls();
loadSettings();

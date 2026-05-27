/**
 * Floating selection panel (classic script — no ES module imports).
 */
(function () {
  const LANGUAGES = [
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "es", label: "Spanish", flag: "🇪🇸" },
    { code: "fr", label: "French", flag: "🇫🇷" },
    { code: "de", label: "German", flag: "🇩🇪" },
    { code: "it", label: "Italian", flag: "🇮🇹" },
    { code: "pt", label: "Portuguese", flag: "🇵🇹" },
    { code: "pl", label: "Polish", flag: "🇵🇱" },
    { code: "nl", label: "Dutch", flag: "🇳🇱" },
    { code: "sv", label: "Swedish", flag: "🇸🇪" },
    { code: "da", label: "Danish", flag: "🇩🇰" },
    { code: "fi", label: "Finnish", flag: "🇫🇮" },
    { code: "no", label: "Norwegian", flag: "🇳🇴" },
    { code: "ru", label: "Russian", flag: "🇷🇺" },
    { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
    { code: "cs", label: "Czech", flag: "🇨🇿" },
    { code: "sk", label: "Slovak", flag: "🇸🇰" },
    { code: "bg", label: "Bulgarian", flag: "🇧🇬" },
    { code: "ro", label: "Romanian", flag: "🇷🇴" },
    { code: "hr", label: "Croatian", flag: "🇭🇷" },
    { code: "el", label: "Greek", flag: "🇬🇷" },
    { code: "tr", label: "Turkish", flag: "🇹🇷" },
    { code: "ar", label: "Arabic", flag: "🇸🇦" },
    { code: "hi", label: "Hindi", flag: "🇮🇳" },
    { code: "ja", label: "Japanese", flag: "🇯🇵" },
    { code: "ko", label: "Korean", flag: "🇰🇷" },
    { code: "zh", label: "Chinese", flag: "🇨🇳" },
    { code: "id", label: "Indonesian", flag: "🇮🇩" },
    { code: "ms", label: "Malay", flag: "🇲🇾" },
    { code: "fil", label: "Filipino", flag: "🇵🇭" },
    { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
    { code: "hu", label: "Hungarian", flag: "🇭🇺" },
    { code: "ta", label: "Tamil", flag: "🇱🇰" },
  ];

  function languageOptionLabel(lang) {
    return `${lang.flag} ${lang.label}`;
  }

  const VOICES = [
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
    { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura" },
    { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie" },
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George" },
    { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum" },
    { id: "SAz9YHcvj6GT2YYXdXww", label: "River" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam" },
    { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte" },
    { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice" },
  ];

  const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];
  const TOOLBAR_SPEEDS = [1.0, 1.25, 1.5, 2.0];
  const API_SPEED_MIN = 0.7;
  const API_SPEED_MAX = 1.2;

  function clampApiSpeed(speed) {
    const value = speed ?? 1;
    return Math.min(API_SPEED_MAX, Math.max(API_SPEED_MIN, value));
  }

  function clientPlaybackRate(requested, apiSpeed = clampApiSpeed(requested)) {
    return requested / apiSpeed;
  }

  function currentAudioPlaybackRate(speed) {
    return ["sarvam", "smallestAI", "kokoro"].includes(speechProvider) ? 1 : clientPlaybackRate(speed);
  }

  const SETTINGS_KEYS = [
    "speechProvider",
    "selectionPopupEnabled",
    "floatingDockEnabled",
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
    "languageCode",
    "playbackSpeed",
  ];

  const SHELL_HTML = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${chrome.runtime.getURL("panel.css")}" />
    ${globalThis.ReadItOutSelectionPlayer.html()}
    <button type="button" class="dock-dismiss-layer" aria-label="Close quick controls"></button>
    ${globalThis.ReadItOutFloatingDock.html(chrome.runtime.getURL("assets/logo.png"))}
    <div class="read-error-toast" role="alert" aria-live="assertive" hidden></div>
  `;

  let host = null;
  let shadow = null;
  let ui = null;
  let selectedText = "";
  let selectionRect = null;
  let dismissedSelectionText = "";
  const selectionPlayer = {
    audio: null,
    objectUrl: null,
    utterance: null,
    speed: 1,
    isGenerating: false,
    isPaused: false,
    startedAt: 0,
    elapsedBeforePause: 0,
    timerId: null,
  };
  const pagePlayer = {
    audio: null,
    objectUrl: null,
    utterance: null,
    speed: 1,
    isGenerating: false,
    isPaused: false,
    active: false,
    items: [],
    index: 0,
    elapsedOffset: 0,
    startedAt: 0,
    elapsedBeforePause: 0,
    timerId: null,
  };
  let speechProvider = "webSpeech";
  let languageCode = "en";
  let selectionPopupEnabled = true;
  let floatingDockEnabled = true;
  let highlightedElement = null;
  let suppressHideUntil = 0;
  let errorToastTimer = null;
  const PAGE_READER_HIGHLIGHT_CLASS = "read-it-out-current-text";

  function getSelectionText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return "";
    return sel.toString().trim();
  }

  function getSelectionRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;
    const rects = range.getClientRects();
    if (rects.length === 0) return null;
    return rects[0];
  }

  function getSelectionSnapshot() {
    const text = getSelectionText();
    if (!text) return { text: "", rect: null };
    return { text, rect: getSelectionRect() };
  }

  function stopEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    suppressHideUntil = Date.now() + 300;
  }

  function saveLocal(values) {
    try {
      globalThis.chrome?.storage?.local?.set(values);
    } catch (_err) {
      // Selection playback should still work if extension storage is unavailable.
    }
  }

  function loadLocal(keys, callback) {
    try {
      globalThis.chrome?.storage?.local?.get(keys, callback);
    } catch (_err) {
      callback({});
    }
  }

  function normalizeSpeechProvider(provider) {
    return ["elevenLabs", "openAI", "sarvam", "smallestAI", "kokoro"].includes(provider)
      ? provider
      : "webSpeech";
  }

  function loadLocalAsync(keys) {
    return new Promise((resolve) => {
      loadLocal(keys, resolve);
    });
  }

  function ensurePageHighlightStyles() {
    if (document.getElementById("read-it-out-highlight-style")) return;
    const style = document.createElement("style");
    style.id = "read-it-out-highlight-style";
    style.textContent = `
      .${PAGE_READER_HIGHLIGHT_CLASS} {
        background: rgba(91, 192, 174, 0.22) !important;
        box-shadow: 0 0 0 3px rgba(91, 192, 174, 0.18) !important;
        border-radius: 4px !important;
        transition: background 160ms ease, box-shadow 160ms ease !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clearPageHighlight() {
    highlightedElement?.classList.remove(PAGE_READER_HIGHLIGHT_CLASS);
    highlightedElement = null;
  }

  function highlightPageItem(item) {
    clearPageHighlight();
    if (!item?.element) return;
    ensurePageHighlightStyles();
    highlightedElement = item.element;
    highlightedElement.classList.add(PAGE_READER_HIGHLIGHT_CLASS);
    highlightedElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  function isElementReadable(el) {
    if (!el || el.closest("script, style, noscript, svg, canvas, audio, video, img, picture, iframe, input, textarea, select, button, nav, footer, aside, [aria-hidden='true'], [hidden]")) {
      return false;
    }
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizeReadableText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function splitReadableText(text, maxLength = 1200) {
    if (text.length <= maxLength) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+|\S.+$/g) || [text];
    const chunks = [];
    let current = "";

    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
      if (next.length <= maxLength) {
        current = next;
        continue;
      }
      if (current) chunks.push(current);
      current = sentence.trim();
      while (current.length > maxLength) {
        chunks.push(current.slice(0, maxLength));
        current = current.slice(maxLength).trim();
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  function collectPageReadItems() {
    const selectors = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "li",
      "blockquote",
      "figcaption",
      "summary",
      "dt",
      "dd",
      "td",
      "th",
      "caption",
    ].join(",");
    const elements = Array.from(document.body?.querySelectorAll(selectors) || []);
    const seen = new Set();
    const items = [];

    for (const element of elements) {
      if (!isElementReadable(element)) continue;
      const text = normalizeReadableText(element.innerText || element.textContent || "");
      if (text.length < 2 || seen.has(text)) continue;
      seen.add(text);
      for (const chunk of splitReadableText(text)) {
        items.push({ element, text: chunk });
      }
    }

    if (items.length > 0) return items;

    const fallbackText = normalizeReadableText(document.body?.innerText || "");
    return fallbackText
      ? splitReadableText(fallbackText).map((text) => ({ element: document.body, text }))
      : [];
  }

  function setSelectionState(state) {
    ui.panel?.classList.remove("is-ready", "is-playing", "is-generating", "is-paused");
    ui.panel?.classList.add(`is-${state}`);
  }

  function setDockState(state) {
    ui.dockControls?.classList.remove("is-ready", "is-playing", "is-generating", "is-paused");
    ui.dockControls?.classList.add(`is-${state}`);
    ui.dock?.classList.remove("is-ready", "is-playing", "is-generating", "is-paused");
    ui.dock?.classList.add(`is-${state}`);
  }

  function setSelectionStatus(label) {
    if (ui?.statusText) ui.statusText.textContent = label;
  }

  function applyFeatureVisibility() {
    if (!ui) return;
    if (ui.dock) {
      ui.dock.hidden = !floatingDockEnabled;
      if (!floatingDockEnabled) {
        ui.dock.classList.remove("is-open");
        ui.dockDismissLayer?.classList.remove("is-visible");
        ui.dockLogoBtn?.setAttribute("aria-expanded", "false");
        releasePageAudio();
      }
    }
    if (!selectionPopupEnabled) {
      hideToolbar();
      releaseSelectionAudio();
    }
  }

  function speechErrorMessage(err) {
    const message = String(err?.message || err || "Speech generation failed").trim();
    if (/extension context invalidated|context invalidated|receiving end does not exist/i.test(message)) {
      return "Read It Out was reloaded. Refresh this page once, then try again.";
    }
    if (speechProvider === "kokoro") {
      if (/model could not be loaded/i.test(message)) {
        return message.length > 180 ? `${message.slice(0, 177)}...` : message;
      }
      if (/browser cannot play|no supported source|not playable audio|empty audio|empty audio stream|decode|incomplete/i.test(message)) {
        return `Kokoro generated audio could not be played: ${message}`;
      }
      return `Kokoro error: ${message}`;
    }
    if (/openai/i.test(message)) {
      if (/api key|401|unauthorized/i.test(message)) {
        return "OpenAI API key missing or invalid. Open settings and check your API key.";
      }
      if (/quota|rate limit|429|credits|billing/i.test(message)) {
        return `OpenAI quota or rate limit error: ${message}`;
      }
      if (/400|bad request|rejected/i.test(message)) {
        return `OpenAI rejected the request: ${message}`;
      }
      if (/no supported source|not playable audio|empty audio|empty audio stream|decode/i.test(message)) {
        return "OpenAI did not return playable audio. Try a shorter selection or switch the model or voice.";
      }
      return `OpenAI error: ${message}`;
    }
    if (/^Text too long or invalid voice selected\.$/.test(message)) {
      return message;
    }
    if (/sarvam/i.test(message)) {
      if (/invalid sarvam api key|api key|403/i.test(message)) {
        return "Invalid Sarvam API key. Check your key in settings.";
      }
      if (/text too long|invalid voice|422/i.test(message)) {
        return "Text too long or invalid voice selected.";
      }
      if (/quota|429/i.test(message)) {
        return "Sarvam API quota exceeded. Please wait or upgrade your plan.";
      }
      if (/service error|500|502|503|504/i.test(message)) {
        return "Sarvam service error. Please try again.";
      }
      return `Sarvam error: ${message}`;
    }
    if (/smallest ai/i.test(message)) {
      if (/invalid or missing|api key|401/i.test(message)) {
        return "Invalid or missing Smallest AI API key. Check your key in settings.";
      }
      if (/expired|unauthorized|403/i.test(message)) {
        return "Smallest AI API key expired or unauthorized.";
      }
      if (/rate limit|429/i.test(message)) {
        return "Smallest AI rate limit hit. Please wait and try again.";
      }
      if (/service error|500|502|503|504/i.test(message)) {
        return "Smallest AI service error. Please try again.";
      }
      return `Smallest AI error: ${message}`;
    }
    if (/kokoro/i.test(message)) {
      if (/model could not be loaded/i.test(message)) {
        return message.length > 180 ? `${message.slice(0, 177)}...` : message;
      }
      return "Kokoro could not generate audio for this text. Try a shorter selection.";
    }
    if (/api key/i.test(message)) {
      return "ElevenLabs API key missing or invalid. Open settings and check your API key.";
    }
    if (/quota|limit|credits|subscription/i.test(message)) {
      return `ElevenLabs limit error: ${message}`;
    }
    if (/401|403|unauthorized|forbidden/i.test(message)) {
      return "ElevenLabs rejected the request. Check your API key and account access.";
    }
    if (/no supported source|not playable audio|empty audio|empty audio stream/i.test(message)) {
      return "ElevenLabs did not return playable audio. Try a shorter selection or check the voice/model settings.";
    }
    if (/web speech|speech synthesis|not-allowed|synthesis-failed|interrupted/i.test(message)) {
      return `Browser Speech error: ${message}`;
    }
    return `ElevenLabs error: ${message}`;
  }

  function providerKeyErrorMessage(rawMessage = "") {
    const message = String(rawMessage || "");
    if (speechProvider === "openAI") {
      return "OpenAI API key missing or invalid. Open settings and check your API key.";
    }
    if (speechProvider === "sarvam") {
      return "Invalid Sarvam API key. Check your key in settings.";
    }
    if (speechProvider === "smallestAI") {
      if (/expired|unauthorized|403/i.test(message)) {
        return "Smallest AI API key expired or unauthorized.";
      }
      return "Invalid or missing Smallest AI API key. Check your key in settings.";
    }
    if (speechProvider === "kokoro") {
      return "Kokoro could not generate audio for this text. Try a shorter selection.";
    }
    if (/401|403|unauthorized|forbidden/i.test(message)) {
      return "ElevenLabs rejected the request. Check your API key and account access.";
    }
    return "ElevenLabs API key missing or invalid. Open settings and check your API key.";
  }

  function providerLimitErrorMessage(message) {
    if (speechProvider === "openAI") {
      return `OpenAI quota or rate limit error: ${message}`;
    }
    if (speechProvider === "sarvam") {
      return "Sarvam API quota exceeded. Please wait or upgrade your plan.";
    }
    if (speechProvider === "smallestAI") {
      return "Smallest AI rate limit hit. Please wait and try again.";
    }
    return `ElevenLabs limit error: ${message}`;
  }

  function isApiKeyError(err) {
    const message = String(err?.message || err || "").trim();
    return /api key|401|403|unauthorized|forbidden|expired/i.test(message);
  }

  function isLimitError(err) {
    const message = String(err?.message || err || "").trim();
    return /429|quota|rate limit|limit|credits|subscription/i.test(message);
  }

  function showErrorToast(err) {
    if (!ui?.errorToast) return;
    const rawMessage = String(err?.message || err || "Speech generation failed").trim();
    const message = isApiKeyError(err)
      ? providerKeyErrorMessage(rawMessage)
      : isLimitError(err)
        ? providerLimitErrorMessage(rawMessage || "Speech limit reached")
        : speechErrorMessage(err);
    ui.errorToast.textContent = message.length > 180 ? `${message.slice(0, 177)}...` : message;
    ui.errorToast.hidden = false;
    ui.errorToast.classList.add("is-visible");
    clearTimeout(errorToastTimer);
    errorToastTimer = setTimeout(() => {
      ui.errorToast?.classList.remove("is-visible");
      if (ui?.errorToast) ui.errorToast.hidden = true;
    }, 5200);
  }

  function safeOpenPopup() {
    try {
      globalThis.chrome?.runtime?.sendMessage?.({ action: "openPopup" });
    } catch (_err) {
      showErrorToast("Read It Out was reloaded. Refresh this page once, then try again.");
    }
  }

  function updateSpeedButtons() {
    updateSelectionSpeedButton();
    updateDockSpeedButton();
    if (!ui.speedButtons) return;
    for (const btn of ui.speedButtons.querySelectorAll("[data-speed]")) {
      const speed = Number(btn.dataset.speed);
      btn.classList.toggle("active", speed === selectionPlayer.speed);
      btn.setAttribute("aria-pressed", String(speed === selectionPlayer.speed));
    }
  }

  function formatSpeedLabel(speed) {
    return `${Number.isInteger(speed) ? speed.toFixed(1) : speed}x`;
  }

  function updateSelectionSpeedButton() {
    const label = formatSpeedLabel(selectionPlayer.speed);
    if (ui?.speedCycleBtn) {
      ui.speedCycleBtn.textContent = label;
      ui.speedCycleBtn.setAttribute("aria-label", `Change speed, currently ${label}`);
    }
  }

  function updateDockSpeedButton() {
    const label = formatSpeedLabel(pagePlayer.speed);
    if (ui?.dockSpeedBtn) {
      ui.dockSpeedBtn.textContent = label;
      ui.dockSpeedBtn.setAttribute("aria-label", `Change speed, currently ${label}`);
    }
  }

  function updateSelectionPlayButton(playing) {
    ui.playBtn?.classList.toggle("is-pause", playing);
    ui.iconPlay?.toggleAttribute("hidden", playing);
    ui.iconStop?.toggleAttribute("hidden", !playing);
    ui.playBtn?.setAttribute("aria-label", playing ? "Pause" : "Play selected text");
  }

  function updateDockPlayButton(playing) {
    ui.dockPlayBtn?.classList.toggle("is-pause", playing);
    ui.dockIconPlay?.toggleAttribute("hidden", playing);
    ui.dockIconStop?.toggleAttribute("hidden", !playing);
    ui.dockPlayBtn?.setAttribute("aria-label", playing ? "Pause" : "Play current page");
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
  }

  function updateSelectionProgress() {
    const { audio } = selectionPlayer;
    if (!audio) {
      if (ui.progressFill) ui.progressFill.style.width = "0%";
      if (ui.timerCurrent) ui.timerCurrent.textContent = "0:00";
      return;
    }
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      if (ui.progressFill) ui.progressFill.style.width = "0%";
      if (ui.timerCurrent) ui.timerCurrent.textContent = formatTime(audio.currentTime);
      return;
    }
    if (ui.progressFill) ui.progressFill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    if (ui.timerCurrent) ui.timerCurrent.textContent = formatTime(audio.currentTime);
  }

  function updateDockProgress() {
    const { audio } = pagePlayer;
    if (pagePlayer.utterance) {
      if (ui.dockTimerCurrent) {
        ui.dockTimerCurrent.textContent = formatTime(pagePlayer.elapsedOffset + getSpeechElapsed(pagePlayer));
      }
      return;
    }
    if (!audio) {
      if (ui.dockTimerCurrent) {
        ui.dockTimerCurrent.textContent = formatTime(pagePlayer.active ? pagePlayer.elapsedOffset : 0);
      }
      return;
    }
    if (ui.dockTimerCurrent) {
      ui.dockTimerCurrent.textContent = formatTime(pagePlayer.elapsedOffset + audio.currentTime);
    }
  }

  function getSpeechElapsed(player) {
    if (!player.utterance) return 0;
    const activeElapsed = player.startedAt ? (Date.now() - player.startedAt) / 1000 : 0;
    return player.elapsedBeforePause + activeElapsed;
  }

  function startSpeechTimer(player, updateFn) {
    clearInterval(player.timerId);
    player.timerId = setInterval(updateFn, 250);
    updateFn();
  }

  function stopSpeechTimer(player) {
    clearInterval(player.timerId);
    player.timerId = null;
    player.startedAt = 0;
    player.elapsedBeforePause = 0;
  }

  function resetSpeechState(player) {
    stopSpeechTimer(player);
    player.isPaused = false;
  }

  function currentPageChunkElapsed() {
    if (pagePlayer.utterance) return getSpeechElapsed(pagePlayer);
    if (!pagePlayer.audio) return 0;
    if (pagePlayer.audio.ended && Number.isFinite(pagePlayer.audio.duration)) {
      return pagePlayer.audio.duration;
    }
    return Number.isFinite(pagePlayer.audio.currentTime) ? pagePlayer.audio.currentTime : 0;
  }

  function carryPageChunkElapsed() {
    pagePlayer.elapsedOffset += currentPageChunkElapsed();
  }

  function releaseSelectionAudio() {
    if (selectionPlayer.utterance) {
      selectionPlayer.utterance = null;
      try {
        speechSynthesis.cancel();
      } catch (_err) {
        // Browser Speech may be unavailable in restricted pages.
      }
      resetSpeechState(selectionPlayer);
    }
    if (selectionPlayer.audio) {
      selectionPlayer.audio.pause();
      selectionPlayer.audio.removeEventListener("timeupdate", updateSelectionProgress);
      selectionPlayer.audio.removeAttribute("src");
      selectionPlayer.audio.load();
      selectionPlayer.audio = null;
    }
    if (selectionPlayer.objectUrl) {
      URL.revokeObjectURL(selectionPlayer.objectUrl);
      selectionPlayer.objectUrl = null;
    }
    selectionPlayer.isGenerating = false;
    selectionPlayer.isPaused = false;
    updateSelectionProgress();
    updateSelectionPlayButton(false);
    setSelectionState("ready");
    setSelectionStatus("Ready");
  }

  function releasePageAudio({ keepQueue = false } = {}) {
    if (keepQueue) carryPageChunkElapsed();
    if (pagePlayer.utterance) {
      pagePlayer.utterance = null;
      try {
        speechSynthesis.cancel();
      } catch (_err) {
        // Browser Speech may be unavailable in restricted pages.
      }
      resetSpeechState(pagePlayer);
    }
    if (pagePlayer.audio) {
      pagePlayer.audio.pause();
      pagePlayer.audio.removeEventListener("timeupdate", updateDockProgress);
      pagePlayer.audio.removeAttribute("src");
      pagePlayer.audio.load();
      pagePlayer.audio = null;
    }
    if (pagePlayer.objectUrl) {
      URL.revokeObjectURL(pagePlayer.objectUrl);
      pagePlayer.objectUrl = null;
    }
    pagePlayer.isGenerating = false;
    if (!keepQueue) {
      pagePlayer.isPaused = false;
      pagePlayer.active = false;
      pagePlayer.items = [];
      pagePlayer.index = 0;
      pagePlayer.elapsedOffset = 0;
      clearPageHighlight();
      setDockState("ready");
      updateDockPlayButton(false);
    }
    updateDockProgress();
  }

  function releaseCurrentPageAudio() {
    releasePageAudio({ keepQueue: true });
  }

  function wireSelectionAudio(rate = clientPlaybackRate(selectionPlayer.speed)) {
    const element = selectionPlayer.audio;
    element.playbackRate = rate;
    element.addEventListener("timeupdate", updateSelectionProgress);
    element.addEventListener("loadedmetadata", updateSelectionProgress);
    element.addEventListener("durationchange", updateSelectionProgress);
    element.addEventListener("play", () => {
      setSelectionState("playing");
      setSelectionStatus("Playing");
      updateSelectionPlayButton(true);
    });
    element.addEventListener("pause", () => {
      if (element.ended || selectionPlayer.audio !== element) return;
      setSelectionState("paused");
      setSelectionStatus("Paused");
      updateSelectionPlayButton(false);
    });
    element.addEventListener("ended", () => {
      if (selectionPlayer.audio === element) releaseSelectionAudio();
    });
    element.addEventListener("error", () => {
      if (selectionPlayer.audio === element) {
        showErrorToast(mediaErrorMessage(element));
        releaseSelectionAudio();
      }
    });
  }

  function wirePageAudio(rate = clientPlaybackRate(pagePlayer.speed)) {
    const element = pagePlayer.audio;
    element.playbackRate = rate;
    element.addEventListener("timeupdate", updateDockProgress);
    element.addEventListener("loadedmetadata", updateDockProgress);
    element.addEventListener("durationchange", updateDockProgress);
    element.addEventListener("play", () => {
      setDockState("playing");
      updateDockPlayButton(true);
    });
    element.addEventListener("pause", () => {
      if (element.ended || pagePlayer.audio !== element) return;
      setDockState("paused");
      updateDockPlayButton(false);
    });
    element.addEventListener("ended", () => {
      if (pagePlayer.audio === element) playNextPageItem();
    });
    element.addEventListener("error", () => {
      if (pagePlayer.audio === element) {
        showErrorToast(mediaErrorMessage(element));
        releasePageAudio();
      }
    });
  }

  function ensureToolbar() {
    if (host) return;

    host = document.createElement("div");
    host.id = "read-it-out-toolbar-host";
    host.className = "toolbar-host";
    host.style.cssText =
      "position:fixed;z-index:2147483647;inset:0;overflow:visible;pointer-events:none;";

    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = SHELL_HTML;

    const root = document.body || document.documentElement;
    root.appendChild(host);

    ui = {
      ...globalThis.ReadItOutSelectionPlayer.collect(shadow),
      ...globalThis.ReadItOutFloatingDock.collect(shadow),
      dockDismissLayer: shadow.querySelector(".dock-dismiss-layer"),
      errorToast: shadow.querySelector(".read-error-toast"),
      progressFill: shadow.querySelector(".progress-fill"),
      speedButtons: shadow.querySelector(".speed-segmented"),
      langSelect: shadow.querySelector(".lang-select"),
      voiceSelect: shadow.querySelector(".voice-select"),
    };

    for (const lang of LANGUAGES) {
      if (!ui.langSelect) break;
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = languageOptionLabel(lang);
      ui.langSelect.appendChild(opt);
    }

    for (const voice of VOICES) {
      if (!ui.voiceSelect) break;
      const opt = document.createElement("option");
      opt.value = voice.id;
      opt.textContent = voice.label;
      ui.voiceSelect.appendChild(opt);
    }

    for (const speed of PLAYBACK_SPEEDS) {
      if (!ui.speedButtons) break;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.speed = String(speed);
      btn.textContent = `${speed}x`;
      btn.addEventListener("mousedown", stopEvent);
      btn.addEventListener("click", (e) => {
        stopEvent(e);
        setSelectionPlaybackSpeed(speed);
      });
      ui.speedButtons.appendChild(btn);
    }

    const actions = {
      stopEvent,
      togglePlayPause,
      togglePagePlayback,
      cycleSelectionPlaybackSpeed,
      cycleDockPlaybackSpeed,
      hideToolbar,
      toggleDock,
      openSettings,
      dismissSelection: () => {
        dismissedSelectionText = selectedText || getSelectionText();
      },
    };
    globalThis.ReadItOutSelectionPlayer.bind(ui, actions);
    globalThis.ReadItOutFloatingDock.bind(ui, actions);
    ui.langSelect?.addEventListener("pointerdown", stopEvent);
    ui.langSelect?.addEventListener("mousedown", stopEvent);
    ui.langSelect?.addEventListener("change", () => {
      languageCode = ui.langSelect.value || "en";
      saveLocal({ languageCode });
    });
    ui.voiceSelect?.addEventListener("pointerdown", stopEvent);
    ui.voiceSelect?.addEventListener("mousedown", stopEvent);
    ui.voiceSelect?.addEventListener("change", () =>
      saveLocal({ elevenLabsVoiceId: ui.voiceSelect.value }),
    );
    ui.dockDismissLayer?.addEventListener("pointerdown", closeDock);

    shadow.addEventListener("pointerdown", stopEvent);
    shadow.addEventListener("mousedown", stopEvent);
    loadSettings();
  }

  function setSelectionPlaybackSpeed(speed) {
    if (!PLAYBACK_SPEEDS.includes(speed)) return;
    selectionPlayer.speed = speed;
    if (selectionPlayer.audio) {
      selectionPlayer.audio.playbackRate = currentAudioPlaybackRate(selectionPlayer.speed);
    }
    updateSpeedButtons();
    saveLocal({ playbackSpeed: selectionPlayer.speed });
  }

  function setDockPlaybackSpeed(speed) {
    if (!PLAYBACK_SPEEDS.includes(speed)) return;
    pagePlayer.speed = speed;
    if (pagePlayer.audio) {
      pagePlayer.audio.playbackRate = currentAudioPlaybackRate(pagePlayer.speed);
    }
    updateDockSpeedButton();
  }

  function cycleSelectionPlaybackSpeed() {
    const index = TOOLBAR_SPEEDS.indexOf(selectionPlayer.speed);
    const nextIndex = index === -1 ? 0 : (index + 1) % TOOLBAR_SPEEDS.length;
    setSelectionPlaybackSpeed(TOOLBAR_SPEEDS[nextIndex]);
  }

  function cycleDockPlaybackSpeed() {
    const index = TOOLBAR_SPEEDS.indexOf(pagePlayer.speed);
    const nextIndex = index === -1 ? 0 : (index + 1) % TOOLBAR_SPEEDS.length;
    setDockPlaybackSpeed(TOOLBAR_SPEEDS[nextIndex]);
  }

  function toggleDock() {
    if (!floatingDockEnabled) return;
    const open = !ui.dock.classList.contains("is-open");
    ui.dock.classList.toggle("is-open", open);
    ui.dockDismissLayer?.classList.toggle("is-visible", open);
    ui.dockLogoBtn.setAttribute("aria-expanded", String(open));
  }

  function closeDock() {
    if (!ui?.dock?.classList.contains("is-open")) return;
    ui.dock.classList.remove("is-open");
    ui.dockDismissLayer?.classList.remove("is-visible");
    ui.dockLogoBtn?.setAttribute("aria-expanded", "false");
  }

  function handleOutsideDockPointerDown(event) {
    if (!ui?.dock?.classList.contains("is-open")) return;
    if (event.composedPath?.().includes(host)) return;
    closeDock();
  }

  function openSettings() {
    safeOpenPopup();
  }

  function applyStoredSettings(stored) {
    if (!ui) return;
    if (ui.langSelect) {
      ui.langSelect.value = stored.languageCode && LANGUAGES.some((l) => l.code === stored.languageCode)
        ? stored.languageCode
        : "en";
      languageCode = ui.langSelect.value || "en";
    }
    const voiceId = stored.elevenLabsVoiceId || VOICES[0].id;
    if (ui.voiceSelect) {
      ui.voiceSelect.value = VOICES.some((v) => v.id === voiceId) ? voiceId : VOICES[0].id;
    }
    selectionPopupEnabled = stored.selectionPopupEnabled !== false;
    floatingDockEnabled = stored.floatingDockEnabled !== false;
    speechProvider = normalizeSpeechProvider(stored.speechProvider);
    if (PLAYBACK_SPEEDS.includes(stored.playbackSpeed)) {
      selectionPlayer.speed = stored.playbackSpeed;
      pagePlayer.speed = stored.playbackSpeed;
    }
    updateSpeedButtons();
    applyFeatureVisibility();
  }

  async function loadSettings() {
    applyStoredSettings(await loadLocalAsync(SETTINGS_KEYS));
  }

  function positionToolbar() {
    try {
      if (!ui?.panel) return;
      const rect = getSelectionRect() || selectionRect;
      if (!rect) return;

      const panel = ui.panel;
      const margin = 10;
      const panelWidth = panel.offsetWidth || 142;
      const panelHeight = panel.offsetHeight || 36;
      const viewportWidth = document.documentElement?.clientWidth || globalThis.innerWidth || panelWidth + margin * 2;
      const viewportHeight = document.documentElement?.clientHeight || globalThis.innerHeight || panelHeight + margin * 2;

      let left = rect.left + rect.width / 2 - panelWidth / 2;
      let y = rect.top - panelHeight - margin;
      if (y < margin) y = rect.bottom + margin;

      const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
      const maxTop = Math.max(margin, viewportHeight - panelHeight - margin);
      left = Math.max(margin, Math.min(left, maxLeft));
      y = Math.max(margin, Math.min(y, maxTop));

      panel.style.position = "fixed";
      panel.style.left = `${left}px`;
      panel.style.top = `${y}px`;
      panel.style.zIndex = "2147483647";
    } catch (_err) {
      hideToolbar();
    }
  }

  function showToolbar(snapshot = getSelectionSnapshot()) {
    if (!selectionPopupEnabled) return;
    ensureToolbar();
    selectedText = snapshot.text;
    selectionRect = snapshot.rect;
    if (!selectedText) {
      hideToolbar();
      return;
    }
    if (selectedText === dismissedSelectionText) {
      hideToolbar();
      return;
    }

    saveLocal({ selectedText });
    ui.panel.style.visibility = "visible";
    ui.panel.style.opacity = "1";
    ui.panel.style.pointerEvents = "auto";
    ui.panel.setAttribute("data-visible", "true");
    host.style.pointerEvents = "none";

    requestAnimationFrame(() => {
      positionToolbar();
      requestAnimationFrame(positionToolbar);
    });
  }

  function hideToolbar() {
    if (!ui) return;
    ui.panel.style.visibility = "hidden";
    ui.panel.style.pointerEvents = "none";
    ui.panel.removeAttribute("data-visible");
  }

  function synthesizeSpeech(text, playbackSpeed, options = {}) {
    return new Promise((resolve, reject) => {
      const runtime = globalThis.chrome?.runtime;
      if (!runtime?.sendMessage) {
        reject(new Error("Read It Out was reloaded. Refresh this page once, then try again."));
        return;
      }
      try {
        runtime.sendMessage({ action: "synthesize", text, playbackSpeed, ...options }, (response) => {
          const lastError = runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error || "Speech generation failed"));
            return;
          }
          resolve(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function base64ToAudioBlob(base64, mimeType = "audio/mpeg", byteLength = 0) {
    if (!base64) {
      throw new Error("Speech provider returned empty audio");
    }
    const binary = atob(base64);
    if (byteLength && binary.length !== byteLength) {
      throw new Error("Speech provider audio response was incomplete");
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.length === 0) {
      throw new Error("Speech provider returned empty audio");
    }
    return new Blob([bytes], { type: mimeType || "audio/mpeg" });
  }

  function base64ToBytes(base64, byteLength = 0) {
    if (!base64) {
      throw new Error("Speech provider returned empty audio");
    }
    const binary = atob(base64);
    if (byteLength && binary.length !== byteLength) {
      throw new Error("Speech provider audio response was incomplete");
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.length === 0) {
      throw new Error("Speech provider returned empty audio");
    }
    return bytes;
  }

  class WebAudioPlayback extends EventTarget {
    constructor(buffer, debug = "") {
      super();
      this.context = new AudioContext();
      this.buffer = buffer;
      this.debug = debug;
      this.source = null;
      this.startedAt = 0;
      this.offset = 0;
      this.paused = true;
      this.ended = false;
      this.error = null;
      this._playbackRate = 1;
      setTimeout(() => {
        this.dispatchEvent(new Event("loadedmetadata"));
        this.dispatchEvent(new Event("durationchange"));
        this.dispatchEvent(new Event("timeupdate"));
      }, 0);
    }

    get duration() {
      return this.buffer.duration;
    }

    get currentTime() {
      if (this.paused || !this.source) return Math.min(this.offset, this.duration);
      const elapsed = (this.context.currentTime - this.startedAt) * this._playbackRate;
      return Math.min(this.offset + elapsed, this.duration);
    }

    set currentTime(value) {
      this.offset = Math.min(Math.max(Number(value) || 0, 0), this.duration);
      if (!this.paused) {
        this.pause();
        this.play();
      }
    }

    get playbackRate() {
      return this._playbackRate;
    }

    set playbackRate(value) {
      this._playbackRate = Math.min(4, Math.max(0.25, Number(value) || 1));
      if (this.source) this.source.playbackRate.value = this._playbackRate;
    }

    async play() {
      if (!this.paused) return;
      if (this.ended) {
        this.offset = 0;
        this.ended = false;
      }
      await this.context.resume();
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.playbackRate.value = this._playbackRate;
      source.connect(this.context.destination);
      let stoppedByPause = false;
      source.onended = () => {
        if (stoppedByPause || this.source !== source) return;
        this.offset = this.duration;
        this.paused = true;
        this.ended = true;
        this.source = null;
        this.dispatchEvent(new Event("timeupdate"));
        this.dispatchEvent(new Event("ended"));
      };
      this.source = source;
      this.startedAt = this.context.currentTime;
      this.paused = false;
      source.start(0, this.offset);
      source._stopForPause = () => {
        stoppedByPause = true;
        source.stop();
      };
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("timeupdate"));
    }

    pause() {
      if (this.paused) return;
      this.offset = this.currentTime;
      const source = this.source;
      this.source = null;
      this.paused = true;
      if (source?._stopForPause) source._stopForPause();
      this.dispatchEvent(new Event("pause"));
      this.dispatchEvent(new Event("timeupdate"));
    }

    removeAttribute() {}

    load() {
      if (this.source?._stopForPause) this.source._stopForPause();
      this.source = null;
      this.paused = true;
      this.context.close().catch(() => {});
    }
  }

  async function createKokoroAudioFromResult(result) {
    const bytes = base64ToBytes(result.audio, result.byteLength);
    const context = new AudioContext();
    let buffer;
    try {
      buffer = await context.decodeAudioData(bytes.buffer.slice(0));
    } catch (err) {
      const parts = [];
      if (result.byteLength) parts.push(`${result.byteLength} bytes`);
      if (result.debug?.samples) parts.push(`${result.debug.samples} samples`);
      if (result.debug?.header) parts.push(result.debug.header);
      const suffix = parts.length ? ` (${parts.join(", ")})` : "";
      throw new Error(`Kokoro WAV could not be decoded: ${err?.message || err}${suffix}`);
    } finally {
      context.close().catch(() => {});
    }

    const parts = [];
    if (result.byteLength) parts.push(`${result.byteLength} bytes`);
    if (result.debug?.samples) parts.push(`${result.debug.samples} samples`);
    if (result.debug?.header) parts.push(result.debug.header);
    return { audio: new WebAudioPlayback(buffer, parts.join(", ")), objectUrl: null };
  }

  async function createAudioFromResult(result) {
    if (speechProvider === "kokoro") {
      return createKokoroAudioFromResult(result);
    }

    const mimeType = result.mimeType || "audio/mpeg";
    const probe = document.createElement("audio");
    if (mimeType && probe.canPlayType(mimeType) === "") {
      const provider =
        speechProvider === "openAI"
          ? "OpenAI"
          : speechProvider === "sarvam"
            ? "Sarvam"
            : speechProvider === "smallestAI"
              ? "Smallest AI"
              : speechProvider === "kokoro"
                ? "Kokoro"
                : "ElevenLabs";
      throw new Error(`Browser cannot play ${provider} audio type ${mimeType}`);
    }
    const blob = base64ToAudioBlob(result.audio, mimeType, result.byteLength);
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.dataset.speechProvider = speechProvider;
    if (result.debug) {
      const parts = [];
      if (result.byteLength) parts.push(`${result.byteLength} bytes`);
      if (result.debug.samples) parts.push(`${result.debug.samples} samples`);
      if (result.debug.header) parts.push(result.debug.header);
      audio.dataset.speechDebug = parts.join(", ");
    }
    return {
      audio,
      objectUrl,
    };
  }

  async function synthesizePlayableSpeech(text, playbackSpeed) {
    let result;
    try {
      result = await synthesizeSpeech(text, playbackSpeed);
    } catch (err) {
      const canRetryElevenLabs =
        speechProvider === "elevenLabs" &&
        /not playable audio|empty audio|empty audio stream|decode|no supported source/i.test(String(err?.message || err));
      if (!canRetryElevenLabs) throw err;

      result = await synthesizeSpeech(text, playbackSpeed, { outputFormat: "mp3_22050_32" });
    }

    try {
      return { result, audioResult: await createAudioFromResult(result) };
    } catch (err) {
      if (speechProvider === "kokoro") throw err;
      const message = String(err?.message || err);
      const canRetryOpenAIMp3 =
        speechProvider === "openAI" &&
        result?.mimeType &&
        !/mpeg|mp3/i.test(result.mimeType) &&
        /cannot play OpenAI audio type|not playable audio/i.test(message);
      const canRetryElevenLabsMp3 =
        speechProvider === "elevenLabs" &&
        /cannot play ElevenLabs audio type|not playable audio|no supported source/i.test(message);
      if (!canRetryOpenAIMp3 && !canRetryElevenLabsMp3) throw err;

      const outputFormat = canRetryElevenLabsMp3 ? "mp3_22050_32" : "mp3";
      const fallbackResult = await synthesizeSpeech(text, playbackSpeed, { outputFormat });
      return { result: fallbackResult, audioResult: await createAudioFromResult(fallbackResult) };
    }
  }

  function mediaErrorMessage(element) {
    const code = element?.error?.code;
    const debug = element?.dataset?.speechDebug ? ` (${element.dataset.speechDebug})` : "";
    if (speechProvider === "kokoro" || element?.dataset?.speechProvider === "kokoro") {
      if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        return `Kokoro generated audio could not be played: no supported source${debug}`;
      }
      if (code === MediaError.MEDIA_ERR_DECODE) {
        return `Kokoro generated audio could not be decoded${debug}`;
      }
      return `Kokoro audio playback failed${debug}`;
    }
    if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return "Generated audio could not be played by this browser. Try again with a shorter selection.";
    }
    if (code === MediaError.MEDIA_ERR_DECODE) {
      return "Generated audio could not be decoded. Try again.";
    }
    if (code === MediaError.MEDIA_ERR_NETWORK) {
      return "Audio loading was interrupted. Check your connection and try again.";
    }
    return "Audio playback failed.";
  }

  function hasWebSpeech() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  function getWebSpeechVoice() {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    const lang = languageCode || document.documentElement.lang || navigator.language || "en";
    const languageFamily = lang.toLowerCase().split("-")[0];
    return (
      voices.find((voice) => voice.lang === lang) ||
      voices.find((voice) => voice.lang?.toLowerCase().startsWith(`${languageFamily}-`)) ||
      voices.find((voice) => voice.lang?.toLowerCase() === languageFamily) ||
      voices.find((voice) => voice.default) ||
      voices[0]
    );
  }

  function createWebSpeechUtterance(text, player) {
    if (!hasWebSpeech()) {
      throw new Error("Web Speech API is not available on this page");
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode || document.documentElement.lang || navigator.language || "en";
    utterance.rate = Math.min(2, Math.max(0.5, player.speed || 1));
    utterance.pitch = 1;
    const voice = getWebSpeechVoice();
    if (voice) utterance.voice = voice;
    return utterance;
  }

  function pauseWebSpeechPlayer(player, setState, updateButton) {
    if (!player.utterance) return;
    player.elapsedBeforePause = getSpeechElapsed(player);
    player.startedAt = 0;
    player.isPaused = true;
    try {
      speechSynthesis.pause();
    } catch (_err) {
      // Ignore pause failures from the browser speech engine.
    }
    setState("paused");
    updateButton(false);
  }

  function resumeWebSpeechPlayer(player, setState, updateButton, updateFn) {
    if (!player.utterance) return;
    player.startedAt = Date.now();
    player.isPaused = false;
    try {
      speechSynthesis.resume();
    } catch (_err) {
      // Ignore resume failures from the browser speech engine.
    }
    setState("playing");
    updateButton(true);
    if (updateFn) startSpeechTimer(player, updateFn);
  }

  function startSelectionWebSpeech(text) {
    releasePageAudio();
    releaseSelectionAudio();

    try {
      const utterance = createWebSpeechUtterance(text, selectionPlayer);
      selectionPlayer.utterance = utterance;
      selectionPlayer.startedAt = 0;
      selectionPlayer.elapsedBeforePause = 0;
      selectionPlayer.isPaused = false;
      setSelectionState("generating");
      setSelectionStatus("Generating");
      updateSelectionPlayButton(false);

      utterance.onstart = () => {
        if (selectionPlayer.isPaused) {
          try {
            speechSynthesis.pause();
          } catch (_err) {
            // Ignore pause failures from the browser speech engine.
          }
          setSelectionState("paused");
          updateSelectionPlayButton(false);
          return;
        }
        setSelectionState("playing");
        setSelectionStatus("Playing");
        updateSelectionPlayButton(true);
        selectionPlayer.startedAt = Date.now();
        startSpeechTimer(selectionPlayer, updateSelectionProgress);
      };
      utterance.onend = () => {
        if (selectionPlayer.utterance === utterance) releaseSelectionAudio();
      };
      utterance.onerror = (event) => {
        if (selectionPlayer.utterance !== utterance) return;
        showErrorToast(event.error || "Web Speech synthesis failed");
        releaseSelectionAudio();
      };

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch (err) {
      releaseSelectionAudio();
      setSelectionStatus("Error");
      showErrorToast(err);
    }
  }

  function startPageWebSpeechItem() {
    if (!pagePlayer.active) return;

    releaseCurrentPageAudio();

    if (pagePlayer.index >= pagePlayer.items.length) {
      releasePageAudio();
      return;
    }

    const item = pagePlayer.items[pagePlayer.index];
    pagePlayer.index += 1;
    highlightPageItem(item);

    try {
      const utterance = createWebSpeechUtterance(item.text, pagePlayer);
      pagePlayer.utterance = utterance;
      pagePlayer.startedAt = 0;
      pagePlayer.elapsedBeforePause = 0;
      pagePlayer.isPaused = false;
      setDockState("generating");
      updateDockPlayButton(false);

      utterance.onstart = () => {
        if (pagePlayer.isPaused) {
          try {
            speechSynthesis.pause();
          } catch (_err) {
            // Ignore pause failures from the browser speech engine.
          }
          setDockState("paused");
          updateDockPlayButton(false);
          return;
        }
        setDockState("playing");
        updateDockPlayButton(true);
        pagePlayer.startedAt = Date.now();
        startSpeechTimer(pagePlayer, updateDockProgress);
      };
      utterance.onend = () => {
        if (pagePlayer.utterance !== utterance) return;
        carryPageChunkElapsed();
        pagePlayer.utterance = null;
        stopSpeechTimer(pagePlayer);
        startPageWebSpeechItem();
      };
      utterance.onerror = (event) => {
        if (pagePlayer.utterance !== utterance) return;
        showErrorToast(event.error || "Web Speech synthesis failed");
        releasePageAudio();
      };

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch (err) {
      releasePageAudio();
      showErrorToast(err);
    }
  }

  async function playNextPageItem() {
    await loadSettings();

    if (speechProvider === "webSpeech") {
      startPageWebSpeechItem();
      return;
    }

    if (!pagePlayer.active) return;

    releaseCurrentPageAudio();

    if (pagePlayer.index >= pagePlayer.items.length) {
      releasePageAudio();
      return;
    }

    const item = pagePlayer.items[pagePlayer.index];
    pagePlayer.index += 1;
    highlightPageItem(item);
    pagePlayer.isGenerating = true;
    if (ui.dockPlayBtn) ui.dockPlayBtn.disabled = true;
    setDockState("generating");
    updateDockPlayButton(false);

    try {
      const { result, audioResult } = await synthesizePlayableSpeech(item.text, pagePlayer.speed);
      if (!pagePlayer.active) return;
      pagePlayer.objectUrl = audioResult.objectUrl;
      pagePlayer.audio = audioResult.audio;
      wirePageAudio(result.playbackRate ?? clientPlaybackRate(pagePlayer.speed));
      await pagePlayer.audio.play();
    } catch (err) {
      releasePageAudio();
      setSelectionStatus("Error");
      showErrorToast(err);
      if (isApiKeyError(err)) {
        safeOpenPopup();
      }
    } finally {
      pagePlayer.isGenerating = false;
      if (ui.dockPlayBtn) ui.dockPlayBtn.disabled = false;
      if (pagePlayer.audio && !pagePlayer.audio.paused) {
        setDockState("playing");
        updateDockPlayButton(true);
      }
    }
  }

  async function startPlayback() {
    await loadSettings();
    const text = selectedText.trim() || getSelectionText().trim();
    if (!text) return;

    if (speechProvider === "webSpeech") {
      startSelectionWebSpeech(text);
      return;
    }

    releaseSelectionAudio();
    selectionPlayer.isGenerating = true;
    if (ui.playBtn) ui.playBtn.disabled = true;
    setSelectionState("generating");
    setSelectionStatus("Generating");
    updateSelectionPlayButton(false);

    try {
      const { result, audioResult } = await synthesizePlayableSpeech(text, selectionPlayer.speed);
      selectionPlayer.objectUrl = audioResult.objectUrl;
      selectionPlayer.audio = audioResult.audio;
      wireSelectionAudio(result.playbackRate ?? clientPlaybackRate(selectionPlayer.speed));
      await selectionPlayer.audio.play();
    } catch (err) {
      releaseSelectionAudio();
      setSelectionStatus("Error");
      showErrorToast(err);
      if (isApiKeyError(err)) {
        safeOpenPopup();
      }
    } finally {
      selectionPlayer.isGenerating = false;
      if (ui.playBtn) ui.playBtn.disabled = false;
      if (selectionPlayer.audio && !selectionPlayer.audio.paused) {
        setSelectionState("playing");
        setSelectionStatus("Playing");
        updateSelectionPlayButton(true);
      }
    }
  }

  async function togglePlayPause() {
    if (selectionPlayer.isGenerating) return;
    if (selectionPlayer.utterance) {
      if (selectionPlayer.isPaused) {
        resumeWebSpeechPlayer(selectionPlayer, setSelectionState, updateSelectionPlayButton, updateSelectionProgress);
        setSelectionStatus("Playing");
      } else {
        pauseWebSpeechPlayer(selectionPlayer, setSelectionState, updateSelectionPlayButton);
        setSelectionStatus("Paused");
      }
      return;
    }
    if (!selectionPlayer.audio) {
      await startPlayback();
      return;
    }
    if (selectionPlayer.audio.paused) await selectionPlayer.audio.play();
    else selectionPlayer.audio.pause();
  }

  async function startPagePlayback() {
    await loadSettings();
    releasePageAudio();
    pagePlayer.items = collectPageReadItems();
    pagePlayer.index = 0;
    if (pagePlayer.items.length === 0) {
      setDockState("ready");
      return;
    }
    pagePlayer.active = true;
    if (speechProvider === "webSpeech") {
      startPageWebSpeechItem();
      return;
    }
    await playNextPageItem();
  }

  async function togglePagePlayback() {
    if (!floatingDockEnabled) return;
    if (pagePlayer.isGenerating) return;
    if (pagePlayer.utterance) {
      if (pagePlayer.isPaused) {
        resumeWebSpeechPlayer(pagePlayer, setDockState, updateDockPlayButton, updateDockProgress);
      } else {
        pauseWebSpeechPlayer(pagePlayer, setDockState, updateDockPlayButton);
      }
      return;
    }
    if (!pagePlayer.active || !pagePlayer.audio) {
      await startPagePlayback();
      return;
    }
    if (pagePlayer.audio.paused) await pagePlayer.audio.play();
    else pagePlayer.audio.pause();
  }

  function handleSelectionUpdate() {
    requestAnimationFrame(() => {
      const snapshot = getSelectionSnapshot();
      const { text } = snapshot;
      if (text !== dismissedSelectionText) {
        dismissedSelectionText = "";
      }
      if (text.length > 0) {
        showToolbar(snapshot);
      } else if (Date.now() > suppressHideUntil && !selectionPlayer.audio && !selectionPlayer.isGenerating) {
        hideToolbar();
      }
    });
  }

  document.addEventListener("selectionchange", handleSelectionUpdate);
  document.addEventListener("pointerup", handleSelectionUpdate);
  document.addEventListener("mouseup", handleSelectionUpdate);
  document.addEventListener("keyup", handleSelectionUpdate);
  document.addEventListener("pointerdown", handleOutsideDockPointerDown, true);

  window.addEventListener(
    "scroll",
    () => {
      if (ui?.panel?.dataset.visible === "true") positionToolbar();
    },
    true,
  );
  window.addEventListener("resize", () => {
    if (ui?.panel?.dataset.visible === "true") positionToolbar();
  });

  try {
    globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
      if (area !== "local" || !ui) return;
      if (changes.languageCode && ui.langSelect) {
        ui.langSelect.value = changes.languageCode.newValue ?? "en";
        languageCode = ui.langSelect.value || "en";
      }
      if (changes.speechProvider) {
        speechProvider = normalizeSpeechProvider(changes.speechProvider.newValue);
      }
      if (changes.selectionPopupEnabled) {
        selectionPopupEnabled = changes.selectionPopupEnabled.newValue !== false;
        applyFeatureVisibility();
      }
      if (changes.floatingDockEnabled) {
        floatingDockEnabled = changes.floatingDockEnabled.newValue !== false;
        applyFeatureVisibility();
      }
      if (changes.elevenLabsVoiceId && ui.voiceSelect) {
        ui.voiceSelect.value = changes.elevenLabsVoiceId.newValue ?? VOICES[0].id;
      }
      if (changes.playbackSpeed && PLAYBACK_SPEEDS.includes(changes.playbackSpeed.newValue)) {
        selectionPlayer.speed = changes.playbackSpeed.newValue;
        updateSpeedButtons();
        if (selectionPlayer.audio) {
          selectionPlayer.audio.playbackRate = currentAudioPlaybackRate(selectionPlayer.speed);
        }
      }
    });
  } catch (_err) {
    // Ignore storage listener failures in page contexts where the extension API is unavailable.
  }

  ensureToolbar();
  hideToolbar();
})();

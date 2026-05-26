/** ISO 639-1 codes supported by ElevenLabs multilingual / flash models. */
export const LANGUAGES = [
  { code: "", label: "Auto-detect", flag: "🌐" },
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

export const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice" },
];

export const OPENAI_VOICES = [
  { id: "alloy", label: "Alloy" },
  { id: "ash", label: "Ash" },
  { id: "coral", label: "Coral" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "nova", label: "Nova" },
  { id: "onyx", label: "Onyx" },
  { id: "sage", label: "Sage" },
  { id: "shimmer", label: "Shimmer" },
  { id: "ballad", label: "Ballad" },
  { id: "verse", label: "Verse" },
  { id: "marin", label: "Marin" },
  { id: "cedar", label: "Cedar" },
];

export const OPENAI_MODELS = [
  { id: "gpt-4o-mini-tts", label: "GPT-4o mini TTS" },
  { id: "tts-1", label: "TTS-1 (lower latency)" },
];

export const OPENAI_STYLES = [
  {
    id: "podcast",
    label: "Podcast",
    instructions:
      "Speak in a warm, conversational tone with natural pacing and slight pauses at paragraph breaks. Like a friend reading aloud to you.",
  },
  {
    id: "newscast",
    label: "Newscast",
    instructions:
      "Speak in a clear, neutral, and composed tone. Steady pace, crisp pronunciation. Professional broadcast style.",
  },
  {
    id: "technical",
    label: "Technical",
    instructions:
      "Speak in a focused, precise tone with measured pace and no dramatic inflection. Like a senior engineer explaining something clearly.",
  },
  {
    id: "narrator",
    label: "Narrator",
    instructions:
      "Speak with subtle expressiveness, honoring punctuation and rhythm. Gentle variation in tone to reflect the author's voice. Like a thoughtful narrator.",
  },
  {
    id: "express",
    label: "Express",
    instructions:
      "Speak at a brisk, efficient pace. Clear and direct with no unnecessary pauses. Like quickly scanning content out loud.",
  },
];

export const SARVAM_VOICES = [
  { id: "shubh", label: "Shubh", gender: "Male" },
  { id: "manan", label: "Manan", gender: "Male" },
  { id: "mani", label: "Mani", gender: "Male" },
  { id: "gokul", label: "Gokul", gender: "Male" },
  { id: "vijay", label: "Vijay", gender: "Male" },
  { id: "soham", label: "Soham", gender: "Male" },
  { id: "ritu", label: "Ritu", gender: "Female" },
  { id: "priya", label: "Priya", gender: "Female" },
  { id: "neha", label: "Neha", gender: "Female" },
  { id: "pooja", label: "Pooja", gender: "Female" },
];

export const SARVAM_LANGUAGES = [
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mr-IN", label: "Marathi" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "or-IN", label: "Odia" },
  { code: "en-IN", label: "English (India)" },
];

export const SARVAM_EXPRESSIVENESS = [
  { id: "low", label: "Low", temperature: 0.2 },
  { id: "medium", label: "Medium", temperature: 0.5 },
  { id: "high", label: "High", temperature: 0.8 },
];

export const SMALLEST_AI_FALLBACK_VOICES = [
  { id: "magnus", label: "Magnus - English (Male)" },
  { id: "maithili", label: "Maithili - Hindi/English (Female)" },
  { id: "jeevan", label: "Jeevan - Tamil (Male)" },
  { id: "carlos", label: "Carlos - Spanish (Male)" },
  { id: "rajeshwari", label: "Rajeshwari - Tamil (Female)" },
];

/** ElevenLabs API accepts roughly 0.7–1.2; values outside use client playbackRate. */
export const API_SPEED_MIN = 0.7;
export const API_SPEED_MAX = 1.2;

export const DEFAULT_LANGUAGE_CODE = "en";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_OPENAI_VOICE = "alloy";
export const DEFAULT_OPENAI_STYLE = "podcast";
export const DEFAULT_OPENAI_OUTPUT_FORMAT = "opus";
export const DEFAULT_SARVAM_VOICE = "shubh";
export const DEFAULT_SARVAM_LANGUAGE = "en-IN";
export const DEFAULT_SARVAM_EXPRESSIVENESS = "medium";
export const DEFAULT_SMALLEST_AI_VOICE = "magnus";
export const SPEECH_PROVIDERS = [
  { id: "webSpeech", label: "Browser Speech (free)" },
  { id: "elevenLabs", label: "ElevenLabs AI" },
  { id: "openAI", label: "OpenAI" },
  { id: "sarvam", label: "Sarvam AI" },
  { id: "smallestAI", label: "Smallest AI" },
];
export const DEFAULT_SPEECH_PROVIDER = "webSpeech";

export const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];
export const DEFAULT_PLAYBACK_SPEED = 1;

export const SETTINGS_KEYS = [
  "speechProvider",
  "selectionPopupEnabled",
  "floatingDockEnabled",
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
];

export function isSpeechProviderId(providerId) {
  return SPEECH_PROVIDERS.some((provider) => provider.id === providerId);
}

export function clampApiSpeed(speed) {
  const value = speed ?? DEFAULT_PLAYBACK_SPEED;
  return Math.min(API_SPEED_MAX, Math.max(API_SPEED_MIN, value));
}

/** Compensate client playbackRate when API speed differs from the user's target. */
export function clientPlaybackRate(requestedSpeed, apiSpeed = clampApiSpeed(requestedSpeed)) {
  return requestedSpeed / apiSpeed;
}

export function getVoice(voiceId) {
  return VOICES.find((v) => v.id === voiceId) ?? VOICES[0];
}

export function getOpenAIModel(model) {
  return OPENAI_MODELS.find((m) => m.id === model) ?? OPENAI_MODELS[0];
}

export function getOpenAIVoice(voice) {
  return OPENAI_VOICES.find((v) => v.id === voice) ?? OPENAI_VOICES[0];
}

export function getOpenAIStyle(style) {
  return OPENAI_STYLES.find((s) => s.id === style) ?? OPENAI_STYLES[0];
}

export function getSarvamVoice(voice) {
  return SARVAM_VOICES.find((v) => v.id === voice) ?? SARVAM_VOICES[0];
}

export function getSarvamLanguage(language) {
  return SARVAM_LANGUAGES.find((l) => l.code === language) ?? SARVAM_LANGUAGES.find((l) => l.code === DEFAULT_SARVAM_LANGUAGE);
}

export function getSarvamExpressiveness(expressiveness) {
  return SARVAM_EXPRESSIVENESS.find((e) => e.id === expressiveness) ?? SARVAM_EXPRESSIVENESS[1];
}

export function getSmallestAIVoice(voice) {
  return SMALLEST_AI_FALLBACK_VOICES.find((v) => v.id === voice) ?? SMALLEST_AI_FALLBACK_VOICES[0];
}

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === "en");
}

export function languageFlag(code) {
  return getLanguage(code)?.flag ?? "🌐";
}

export function languageOptionLabel(lang) {
  return `${lang.flag} ${lang.label}`;
}

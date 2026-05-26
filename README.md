# Read It Out

A Chrome extension that reads web pages and selected text aloud using natural AI voices. 

Works out of the box with the browser's free built-in speech engine, local Kokoro ONNX speech, or connect OpenAI, ElevenLabs, Sarvam AI, or Smallest.ai for higher quality AI voices.

---

## ✨ Features

- **Floating dock** — read the entire page with play, pause, and speed controls
- **Inline mini player** — highlight any text and hear it instantly
- **Sentence highlighting** — follows along with what's being read
- **Adjustable speed** — 0.75x to 2x
- **Privacy first** — API keys stored locally, never shared

---

## 🔊 Speech Engines


| Engine         | Quality   | Cost | Languages                     |
| -------------- | --------- | ---- | ----------------------------- |
| Browser Speech | Good      | Free | 20+                           |
| Kokoro Local   | Great     | Free | English                       |
| OpenAI TTS     | Great     | BYOK | Auto-detect                   |
| ElevenLabs     | Excellent | BYOK | 30+                           |
| Sarvam AI      | Great     | BYOK | 11 Indian languages           |
| Smallest.ai    | Excellent | BYOK | 15 (44kHz, ultra-low latency) |


**BYOK** = Bring Your Own Key. 

Keys are stored locally in your browser and sent only to the provider you select.

Kokoro Local bundles the ONNX model and runtime assets with the extension, so the extension folder is larger but speech generation works without sending text to a remote TTS provider.

---

## 🚀 Install

### Manual (Developer Mode)

No build step required.

1. Clone this repo

```bash
   git clone https://github.com/Spartan-71/read-it-out.git
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

> After loading, refresh any already-open tabs before using the extension on them.

---

## 🗂 Project Structure

```text
extension/
├── manifest.json          Extension manifest (MV3)
├── background.js          Service worker — context menu + 
│                          provider synthesis bridge
├── popup.html             Settings popup
├── popup.js               Settings UI behavior
├── panel.css              Shared popup and content UI styles
├── config.js              Providers, voices, languages, defaults
├── offscreen/             Local Kokoro synthesis document
├── models/                Bundled Kokoro ONNX assets
├── vendor/                Bundled browser runtime assets
├── content/               Selected-text mini player + 
│                          floating dock controls
└── speech-engines/        Provider-specific TTS adapters
```

---

## 🤝 Contributing

Contributions are welcome — especially new speech engine adapters.

Each provider lives in `speech-engines/` behind a common `SpeechEngine` interface. Adding a new provider means implementing  one adapter file and registering it in `config.js`.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-engine-name`
3. Make your changes
4. Open a pull request

---

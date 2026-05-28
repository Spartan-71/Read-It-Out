# Read It Out

A browser extension that reads web pages and selected text aloud.

Read It Out works out of the box with the browser's built-in speech engine. In Chrome, you can also switch to bundled local Kokoro ONNX speech. Chrome and Firefox builds both support bring-your-own-key speech with ElevenLabs, OpenAI, Sarvam AI, or Smallest AI.

Privacy details are documented in [PRIVACY.md](PRIVACY.md).

## ✨ Features

- **Floating dock** - read the current page with play, pause, stop, timer, and speed controls
- **Selection mini player** - highlight text and play it from a compact inline control
- **Current-item highlighting** - scrolls the active page item into view while reading
- **Speech engine picker** - switch between Browser Speech, Kokoro Local, ElevenLabs, OpenAI, Sarvam AI, and Smallest AI
- **Local TTS model support** - run Kokoro locally with bundled ONNX model and runtime assets in Chrome builds
- **Adjustable speed** - choose 0.75x, 1x, 1.25x, 1.5x, or 2x in settings
- **Page control toggles** - enable or disable the selected-text popup and floating dock
- **Local key storage** - API keys are stored in Chrome extension storage and sent only to the selected provider


## 🔊 Speech Engines


| Engine         | Cost | Current implementation                                                                                                                                                           |
| -------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser Speech | Free | Uses the page's Web Speech API directly in the content script. Language options are filtered to voices available in the browser when possible.                                   |
| Kokoro Local   | Free | Chrome only for now. Uses bundled Kokoro ONNX model, voice embeddings, tokenizer, and ONNX Runtime assets through an offscreen document. Supports Auto, WASM, and WebGPU runtime settings. In Firefox v1, this provider is visible but disabled. |
| ElevenLabs     | BYOK | Uses the ElevenLabs text-to-speech endpoint with configured models: Eleven v3, Multilingual v2, Flash v2.5, and Turbo v2.5.                                                      |
| OpenAI         | BYOK | Uses `/v1/audio/speech` with `gpt-4o-mini-tts` or `tts-1`, configured OpenAI voices, and Opus output by default with MP3 fallback when needed.                                   |
| Sarvam AI      | BYOK | Uses Sarvam text-to-speech with `bulbul:v3`, grouped male/female voices, pace control, and 11 Indian language options.                                                           |
| Smallest AI    | BYOK | Uses Waves live TTS with `lightning_v3.1` or `lightning_v3.1_pro`, loads voices from the provider when an API key is present, and falls back to bundled voice choices otherwise. |


**BYOK** = Bring Your Own Key. 

Keys are stored locally in your browser and sent only to the provider you select.

Kokoro Local bundles the ONNX model and runtime assets with the extension, so the extension folder is larger but speech generation can run without sending text to a remote TTS provider.


## 🚀 Install

### GitHub Release

Each published GitHub release automatically uploads downloadable extension zips:

- [read-it-out-wasm-v1.0.0.zip](https://github.com/Spartan-71/read-it-out/releases/download/v1.0.0/read-it-out-wasm-v1.0.0.zip) — defaults Kokoro Auto mode to WASM
- [read-it-out-webgpu-v1.0.0.zip](https://github.com/Spartan-71/read-it-out/releases/download/v1.0.0/read-it-out-webgpu-v1.0.0.zip) — defaults Kokoro Auto mode to WebGPU when available
- `read-it-out-firefox-v1.0.0.zip` — Firefox MV3 build without bundled Kokoro model/runtime support

To install from a release zip, you do not need to clone the repo:

1. Download one of the release zip files from the GitHub Releases page
2. Extract the zip anywhere on your machine
3. Open `chrome://extensions` in Chrome or `about:debugging#/runtime/this-firefox` in Firefox
4. Enable **Developer mode** in Chrome, or click **Load Temporary Add-on...** in Firefox
5. In Chrome, click **Load unpacked** and select the extracted folder
6. In Firefox, select the extracted `manifest.json`

> After loading, refresh any already-open tabs before using the extension on them.

Kokoro settings include a Runtime selector: Auto, WASM, or WebGPU.
Choosing WebGPU is strict and does not fall back to WASM.

### From Source (Developer)

No build step required.

1. Clone this repo

```bash
git clone https://github.com/Spartan-71/read-it-out.git
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Run `bash scripts/package-release.sh`
5. Extract `dist/read-it-out-wasm-v1.0.0.zip`
6. Select the extracted folder

For Firefox development, run `bash scripts/package-release.sh`, extract `dist/read-it-out-firefox-v1.0.0.zip`, then load the extracted `manifest.json` from `about:debugging#/runtime/this-firefox`.

> After loading, refresh any already-open tabs before using the extension on them.

The source checkout currently defaults the packaged Kokoro Auto mode to WASM through `extension/build-flavor.js`. The popup still lets you choose Auto, WASM, or WebGPU.

### Git LFS Note

The ONNX model files are tracked with Git LFS. Before committing model changes,
install Git LFS and run:

```bash
git lfs install
git lfs status
```


## 🗂 Project Structure

```text
extension/
├── manifest.chrome.json   Chrome package manifest (MV3)
├── manifest.firefox.json  Firefox package manifest (MV3)
├── background.js          Service worker — context menu + 
│                          cloud/local synthesis bridge
├── popup.html             Settings popup
├── popup.js               Settings UI behavior
├── panel.css              Shared popup and content UI styles
├── config.js              Providers, voices, languages, defaults
├── build-flavor.js        Generated package target flags
├── offscreen/             Local Kokoro synthesis document
├── models/                Bundled Kokoro ONNX assets
├── vendor/                Bundled browser runtime assets
├── content/               Selected-text mini player + 
│                          floating dock controls
└── speech-engines/        Provider-specific TTS adapters
```

Browser-specific differences should stay in manifest/build target files and small target-gated config. Shared popup, content, CSS, assets, and provider adapters should not be duplicated between Chrome and Firefox.


## 🤝 Contributing

Contributions are welcome — especially new speech engine adapters.

Cloud provider adapters live in `extension/speech-engines/`. Adding a new provider usually means adding one adapter, registering provider metadata in `extension/config.js`, wiring settings in `extension/popup.js` and `extension/popup.html`, and routing synthesis in `extension/background.js`.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-engine-name`
3. Make your changes
4. Open a pull request

---

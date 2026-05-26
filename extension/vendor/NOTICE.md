# Vendored Runtime Assets

This extension bundles browser runtime assets for local Kokoro synthesis:

- `kokoro-js` 1.2.1, Apache-2.0
- ONNX Runtime Web WASM asset matched to `@huggingface/transformers` 3.5.1, MIT
- Kokoro ONNX model and selected voice embeddings from `onnx-community/Kokoro-82M-v1.0-ONNX`

The bundled model files allow Kokoro Local to run without remote model or voice downloads after install.

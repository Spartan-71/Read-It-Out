#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist"
VERSION="$(node -e "console.log(require('./extension/manifest.chrome.json').version)")"

mkdir -p "${OUT_DIR}"

package_variant() {
  local label="$1"
  local webgpu="$2"
  local default_platform="$3"
  local browser_target="${4:-chrome}"
  local kokoro_enabled="${5:-true}"
  local staging_dir
  local package_dir
  local zip_path

  if [[ "${kokoro_enabled}" == "true" ]]; then
    for model in model_quantized.onnx model.onnx; do
      if [[ ! -f "${ROOT_DIR}/extension/models/kokoro/onnx/${model}" ]]; then
        echo "Missing required model: extension/models/kokoro/onnx/${model}" >&2
        exit 1
      fi
    done
  fi

  staging_dir="$(mktemp -d)"
  package_dir="${staging_dir}/read-it-out"
  zip_path="${OUT_DIR}/read-it-out-${label}-v${VERSION}.zip"

  mkdir -p "${package_dir}"
  cp -R "${ROOT_DIR}/extension/." "${package_dir}/"
  cp "${ROOT_DIR}/extension/manifest.chrome.json" "${package_dir}/manifest.json"
  printf "export const ENABLE_WEBGPU = %s;\nexport const DEFAULT_PACKAGED_KOKORO_PLATFORM = \"%s\";\nexport const BROWSER_TARGET = \"%s\";\nexport const KOKORO_ENABLED = %s;\n" "${webgpu}" "${default_platform}" "${browser_target}" "${kokoro_enabled}" > "${package_dir}/build-flavor.js"
  printf "(function () {\n  globalThis.ReadItOutBuildTarget = {\n    browserTarget: \"%s\",\n    kokoroEnabled: %s,\n  };\n})();\n" "${browser_target}" "${kokoro_enabled}" > "${package_dir}/content/build-target.js"

  if [[ "${browser_target}" == "firefox" ]]; then
    cp "${ROOT_DIR}/extension/manifest.firefox.json" "${package_dir}/manifest.json"
    rm -rf "${package_dir}/models/kokoro" \
      "${package_dir}/vendor/kokoro-js" \
      "${package_dir}/vendor/onnxruntime-web" \
      "${package_dir}/offscreen"
    rmdir "${package_dir}/models" 2>/dev/null || true
  fi

  rm -f "${package_dir}/manifest.chrome.json" "${package_dir}/manifest.firefox.json"

  if [[ -f "${zip_path}" ]]; then
    unlink "${zip_path}"
  fi

  (
    cd "${package_dir}"
    if command -v zip >/dev/null 2>&1; then
      zip -qr "${zip_path}" .
    elif command -v bsdtar >/dev/null 2>&1; then
      bsdtar -a -cf "${zip_path}" .
    else
      echo "zip or bsdtar is required to create release packages." >&2
      exit 1
    fi
  )

  rm -rf "${staging_dir}"
  echo "Created ${zip_path}"
}

package_variant "wasm" "false" "wasm"
package_variant "webgpu" "true" "webgpu"
package_variant "firefox" "false" "wasm" "firefox" "false"

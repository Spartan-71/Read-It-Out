#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist"
VERSION="$(node -e "console.log(require('./extension/manifest.json').version)")"

mkdir -p "${OUT_DIR}"

package_variant() {
  local label="$1"
  local webgpu="$2"
  local default_platform="$3"
  local staging_dir
  local package_dir
  local zip_path

  for model in model_quantized.onnx model.onnx; do
    if [[ ! -f "${ROOT_DIR}/extension/models/kokoro/onnx/${model}" ]]; then
      echo "Missing required model: extension/models/kokoro/onnx/${model}" >&2
      exit 1
    fi
  done

  staging_dir="$(mktemp -d)"
  package_dir="${staging_dir}/read-it-out"
  zip_path="${OUT_DIR}/read-it-out-${label}-v${VERSION}.zip"

  mkdir -p "${package_dir}"
  cp -R "${ROOT_DIR}/extension/." "${package_dir}/"
  printf "export const ENABLE_WEBGPU = %s;\nexport const DEFAULT_PACKAGED_KOKORO_PLATFORM = \"%s\";\n" "${webgpu}" "${default_platform}" > "${package_dir}/build-flavor.js"

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

export const extensionApi = globalThis.browser ?? globalThis.chrome;

function lastRuntimeError() {
  return extensionApi?.runtime?.lastError;
}

function promisifyCallbackApi(call) {
  return new Promise((resolve, reject) => {
    call((result) => {
      const error = lastRuntimeError();
      if (error) {
        reject(new Error(error.message || String(error)));
        return;
      }
      resolve(result);
    });
  });
}

export function storageGet(keys) {
  const result = extensionApi.storage.local.get(keys);
  if (result?.then) return result;
  return promisifyCallbackApi((done) => extensionApi.storage.local.get(keys, done));
}

export function storageSet(values) {
  const result = extensionApi.storage.local.set(values);
  if (result?.then) return result;
  return promisifyCallbackApi((done) => extensionApi.storage.local.set(values, done));
}

export function runtimeSendMessage(message) {
  const result = extensionApi.runtime.sendMessage(message);
  if (result?.then) return result;
  return promisifyCallbackApi((done) => extensionApi.runtime.sendMessage(message, done));
}

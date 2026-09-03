export const OPENAI_BASE_URL_SESSION_KEY = 'story-maker.openai.base-url.v1';
export const OFFICIAL_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const LOCAL_OPENAI_BASE_URL = 'http://localhost:20128/v1';
export const LOCAL_LEDGER_OPENAI_TEXT_MODELS = [
  'cx/gpt-5.5',
  'cx/gpt-5.4',
  'cx/gpt-5.4-mini',
];
export const CUSTOM_OPENAI_TEXT_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
];
export const OFFICIAL_OPENAI_TEXT_MODELS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
];

function runtimeLocation(runtime = globalThis) {
  return runtime?.location || runtime?.window?.location || null;
}

function runtimeDocument(runtime = globalThis) {
  return runtime?.document || runtime?.window?.document || null;
}

function runtimeSessionStorage(runtime = globalThis) {
  try {
    return runtime?.sessionStorage || runtime?.window?.sessionStorage || null;
  } catch {
    return null;
  }
}

export function defaultOpenAiBaseUrl(runtime = globalThis) {
  const hostname = String(runtimeLocation(runtime)?.hostname || '').toLowerCase();
  return ['localhost', '127.0.0.1'].includes(hostname)
    ? LOCAL_OPENAI_BASE_URL
    : OFFICIAL_OPENAI_BASE_URL;
}

export function normalizeOpenAiBaseUrl(value) {
  const raw = String(value || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return '';

    let pathname = parsed.pathname.replace(/\/+/g, '/');
    pathname = pathname.replace(/\/(?:chat\/completions|responses)\/?$/i, '');
    pathname = pathname.replace(/\/+$/, '');
    return `${parsed.origin}${pathname}`;
  } catch {
    return '';
  }
}

export function validateOpenAiBaseUrl(value) {
  const normalized = normalizeOpenAiBaseUrl(value);
  if (!String(value || '').trim()) {
    return {
      ok: false,
      normalized: '',
      message: 'Hãy nhập OpenAI Base URL, ví dụ http://localhost:20128/v1.',
    };
  }
  if (!normalized) {
    return {
      ok: false,
      normalized: '',
      message: 'OpenAI Base URL phải là địa chỉ HTTP/HTTPS hợp lệ và không chứa query, fragment hoặc thông tin đăng nhập.',
    };
  }
  return { ok: true, normalized, message: '' };
}

export function readStoredOpenAiBaseUrl(runtime = globalThis) {
  try {
    return normalizeOpenAiBaseUrl(
      runtimeSessionStorage(runtime)?.getItem(OPENAI_BASE_URL_SESSION_KEY),
    );
  } catch {
    return '';
  }
}

export function writeOpenAiBaseUrl(value, runtime = globalThis) {
  const result = validateOpenAiBaseUrl(value);
  if (!result.ok) return result;
  try {
    runtimeSessionStorage(runtime)?.setItem(
      OPENAI_BASE_URL_SESSION_KEY,
      result.normalized,
    );
  } catch {
    // Session storage can be disabled; the visible field remains the runtime source.
  }
  return result;
}

export function getOpenAiBaseUrl(runtime = globalThis) {
  const fieldValue = runtimeDocument(runtime)
    ?.getElementById?.('openai-base-url')
    ?.value;
  return normalizeOpenAiBaseUrl(fieldValue)
    || readStoredOpenAiBaseUrl(runtime)
    || defaultOpenAiBaseUrl(runtime);
}

export function getOpenAiChatCompletionsUrl(runtime = globalThis) {
  return `${getOpenAiBaseUrl(runtime)}/chat/completions`;
}

export function isOfficialOpenAiBaseUrl(value) {
  return normalizeOpenAiBaseUrl(value) === OFFICIAL_OPENAI_BASE_URL;
}

export function isLocalLedgerOpenAiBaseUrl(value) {
  return normalizeOpenAiBaseUrl(value) === LOCAL_OPENAI_BASE_URL;
}

export function openAiTextModelsForBaseUrl(value) {
  const normalized = normalizeOpenAiBaseUrl(value);
  if (normalized === LOCAL_OPENAI_BASE_URL) return LOCAL_LEDGER_OPENAI_TEXT_MODELS;
  if (normalized === OFFICIAL_OPENAI_BASE_URL) return OFFICIAL_OPENAI_TEXT_MODELS;
  return CUSTOM_OPENAI_TEXT_MODELS;
}

export function mapOpenAiModelForBaseUrl(model, baseUrl) {
  const sourceModel = String(model || '').trim();
  const targetModels = openAiTextModelsForBaseUrl(baseUrl);

  if (isLocalLedgerOpenAiBaseUrl(baseUrl) && sourceModel.startsWith('cx/')) {
    return sourceModel;
  }
  if (!isLocalLedgerOpenAiBaseUrl(baseUrl) && sourceModel.startsWith('cx/')) {
    return sourceModel.slice(3);
  }
  if (targetModels.includes(sourceModel)) {
    return sourceModel;
  }
  if (sourceModel.includes('nano')) {
    return targetModels[2];
  }
  if (sourceModel.includes('mini')) {
    return targetModels[1];
  }
  return targetModels[0];
}

export function installOpenAiEndpointConfig(runtime = globalThis) {
  const doc = runtimeDocument(runtime);
  if (!doc?.addEventListener) return false;

  const alertUser = message => {
    if (typeof runtime?.alert === 'function') runtime.alert(message);
    else if (typeof runtime?.window?.alert === 'function') runtime.window.alert(message);
  };

  const field = () => doc.getElementById?.('openai-base-url');
  const syncLockedState = () => {
    const input = field();
    if (!input) return;
    input.readOnly = !!doc.getElementById?.('banner')?.classList?.contains?.('locked');
  };

  const initialize = () => {
    const input = field();
    if (!input) return;
    input.value = readStoredOpenAiBaseUrl(runtime) || defaultOpenAiBaseUrl(runtime);
    input.addEventListener?.('input', () => input.setCustomValidity?.(''));
    input.addEventListener?.('blur', () => {
      const result = validateOpenAiBaseUrl(input.value);
      input.setCustomValidity?.(result.ok ? '' : result.message);
      if (result.ok) input.value = result.normalized;
    });
    syncLockedState();
  };

  doc.addEventListener('click', event => {
    const button = event?.target?.closest?.('button');
    if (!button) return;

    if (button.id === 'key-save') {
      const input = field();
      if (!input) return;
      const result = validateOpenAiBaseUrl(input.value);
      input.setCustomValidity?.(result.ok ? '' : result.message);
      if (!result.ok) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        alertUser(result.message);
        input.focus?.();
        return;
      }
      input.value = result.normalized;
      writeOpenAiBaseUrl(result.normalized, runtime);
      setTimeout(syncLockedState, 0);
      setTimeout(syncLockedState, 300);
      return;
    }

    if (button.id === 'key-edit' || button.id === 'btn-switch-api') {
      setTimeout(syncLockedState, 0);
      setTimeout(syncLockedState, 300);
    }
  }, true);

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
  return true;
}

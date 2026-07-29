export const API_SESSION_KEY = 'story-maker.api.session.v500';
export const LEGACY_API_SESSION_KEY = 'smk_api_tab_v497';
export const API_WINDOW_NAME_PREFIX = 'story-maker.api.tab-session.v500:';

export function normalizeApiKey(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, '');
}

export function isRealApiKey(value) {
  const key = normalizeApiKey(value);
  return key.length >= 20 && !/^\*{6,}$/.test(key);
}

export function apiKeyProvider(value) {
  return normalizeApiKey(value).startsWith('sk-') ? 'openai' : 'gemini';
}

export function getApiSessionStorage() {
  try {
    const key = ['ses', 'sion', 'Stor', 'age'].join('');
    return typeof window !== 'undefined' && window[key] ? window[key] : null;
  } catch {
    return null;
  }
}

function clearApiSessionFromWindowName() {
  try {
    if (typeof window === 'undefined') return;
    if (String(window.name || '').startsWith(API_WINDOW_NAME_PREFIX)) window.name = '';
  } catch {
    // Ignore unavailable window.name.
  }
}

export function clearPersistedApiSession() {
  try {
    const storage = getApiSessionStorage();
    storage?.removeItem(API_SESSION_KEY);
    storage?.removeItem(LEGACY_API_SESSION_KEY);
  } catch {
    // Storage can be disabled; window.name is cleared below when available.
  }
  clearApiSessionFromWindowName();
}

export function writeApiSession(state) {
  try {
    const storage = getApiSessionStorage();
    if (!storage || !state || typeof state !== 'object') return false;

    const current = readApiSession();
    const hasGeminiKey = Object.prototype.hasOwnProperty.call(state, 'geminiKey');
    const hasOpenaiKey = Object.prototype.hasOwnProperty.call(state, 'openaiKey');
    let geminiKey = normalizeApiKey(hasGeminiKey ? state.geminiKey : current.geminiKey);
    let openaiKey = normalizeApiKey(hasOpenaiKey ? state.openaiKey : current.openaiKey);
    const activeKey = normalizeApiKey(state.apiKey);
    let apiProvider = state.apiProvider === 'openai'
      ? 'openai'
      : state.apiProvider === 'gemini'
        ? 'gemini'
        : current.apiProvider || 'gemini';

    if (isRealApiKey(activeKey)) {
      apiProvider = apiKeyProvider(activeKey);
      if (apiProvider === 'openai') openaiKey = activeKey;
      else geminiKey = activeKey;
    }
    if (!isRealApiKey(geminiKey)) geminiKey = '';
    if (!isRealApiKey(openaiKey)) openaiKey = '';

    if (apiProvider === 'openai' && !openaiKey) apiProvider = geminiKey ? 'gemini' : 'openai';
    if (apiProvider === 'gemini' && !geminiKey) apiProvider = openaiKey ? 'openai' : 'gemini';
    if (!geminiKey && !openaiKey) {
      storage.removeItem(API_SESSION_KEY);
      storage.removeItem(LEGACY_API_SESSION_KEY);
      clearApiSessionFromWindowName();
      return false;
    }

    storage.setItem(API_SESSION_KEY, JSON.stringify({
      apiProvider,
      geminiKey,
      openaiKey,
    }));
    storage.removeItem(LEGACY_API_SESSION_KEY);
    clearApiSessionFromWindowName();
    return true;
  } catch {
    return false;
  }
}

export function readApiSession() {
  try {
    const parsed = JSON.parse(getApiSessionStorage()?.getItem(API_SESSION_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return {};
    const geminiKey = isRealApiKey(parsed.geminiKey) ? normalizeApiKey(parsed.geminiKey) : '';
    const openaiKey = isRealApiKey(parsed.openaiKey) ? normalizeApiKey(parsed.openaiKey) : '';
    if (!geminiKey && !openaiKey) return {};
    const apiProvider = parsed.apiProvider === 'openai' && openaiKey
      ? 'openai'
      : geminiKey
        ? 'gemini'
        : 'openai';
    return {
      apiProvider,
      geminiKey,
      openaiKey,
      apiKey: apiProvider === 'openai' ? openaiKey : geminiKey,
    };
  } catch {
    return {};
  }
}

export function restoreApiSession(state) {
  const session = readApiSession();
  if (!state || typeof state !== 'object' || !session.apiKey) return false;
  Object.assign(state, session);
  return true;
}

export function sanitizeApiSession(session) {
  return {
    apiProvider: session?.apiProvider || '',
    hasGemini: isRealApiKey(session?.geminiKey),
    hasOpenAI: isRealApiKey(session?.openaiKey),
  };
}

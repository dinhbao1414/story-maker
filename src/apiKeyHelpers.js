import { normalizeApiKey } from './apiSession.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4.1';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export function normalizeKey(value) {
  return normalizeApiKey(value);
}

export function isMaskedApiKey(value) {
  return /^\*{6,}$/.test(normalizeKey(value));
}

export function summarizeApiKey(value, provider) {
  const raw = String(value || '');
  const normalized = normalizeKey(value);
  const inferredProvider = normalized.startsWith('sk-') ? 'openai' : 'gemini';
  const badChars = /[^A-Za-z0-9._-]/.test(normalized);
  return {
    provider: provider || inferredProvider,
    length: normalized.length,
    masked: isMaskedApiKey(normalized),
    short: normalized.length > 0 && normalized.length < 20,
    empty: !normalized,
    badChars,
    sanitizedDelta: raw.length - normalized.length,
  };
}

export function validateApiKey(value, provider) {
  const summary = summarizeApiKey(value, provider);
  if (summary.empty) {
    return { ok: false, message: 'Chưa cấu hình khóa API. Hãy bấm Chỉnh sửa rồi nhập khóa thật.', summary };
  }
  if (summary.masked) {
    return { ok: false, message: 'Khóa API vẫn đang ở dạng che. Hãy bấm Chỉnh sửa rồi nhập lại khóa thật.', summary };
  }
  if (summary.short) {
    return { ok: false, message: `Khóa API quá ngắn (${summary.length} ký tự). Hãy nhập lại khóa thật.`, summary };
  }
  if (summary.badChars) {
    return { ok: false, message: 'Khóa API chứa ký tự không hợp lệ. Hãy xóa ký tự thừa khi sao chép rồi nhập lại.', summary };
  }
  return { ok: true, summary };
}

export function defaultModelForKey(value) {
  return normalizeKey(value).startsWith('sk-') ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;
}

export function providerLabelForKey(value) {
  return normalizeKey(value).startsWith('sk-') ? 'ChatGPT' : 'Gemini';
}

export {
  normalizeKey as Oe,
  isMaskedApiKey as Yf,
  summarizeApiKey as Xf,
  validateApiKey as Lt,
  defaultModelForKey as gn,
  providerLabelForKey as Qf,
};

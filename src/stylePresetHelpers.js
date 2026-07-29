import { MODE_LABELS, PUBLIC_MODE_VALUES } from './modeContracts.js';
import { buildGenerationSettingsExport } from './settingsSnapshotHelpers.js';
import { ya } from './styleAnalyzerHelpers.js';

export const STYLE_PROFILE_STORAGE_KEY = 'story-maker-style-profiles-v1';

const MAX_PROFILES = 20;
const MODE_LABELS_VI = {
  '4koma': 'Truyện tranh 4 khung',
  '4koma_scenario': 'Kịch bản AI 4-koma',
  short_short: 'Truyện cực ngắn',
  novel: 'Truyện ngắn',
  medium: 'Truyện vừa',
  long_10000: 'Truyện dài từ 10.000 ký tự',
  scenario: 'Kịch bản',
  manga: 'Truyện tranh',
  essay: 'Tản văn',
  poem: 'Thơ',
  fairy: 'Truyện cổ tích',
  letter: 'Thư từ',
  diary: 'Nhật ký',
  documentary: 'Tư liệu',
  radio: 'Kịch phát thanh',
};

function cleanText(value, maxLength = 5000) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function sanitizeCharacters(characters) {
  if (!Array.isArray(characters)) return [];
  return characters.slice(0, 4).map(character => ({
    name: cleanText(character?.name, 120),
    sex: cleanText(character?.sex, 80),
    role: cleanText(character?.role, 160),
    personality: cleanText(character?.personality, 160),
    note: cleanText(character?.note, 1200),
  })).filter(character => Object.values(character).some(Boolean));
}

function sanitizeAnalysis(value, depth = 0) {
  if (depth > 6 || value == null) return null;
  if (typeof value === 'string') return cleanText(value, 12000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeAnalysis(item, depth + 1));
  if (typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:api.?key|token|secret)/i.test(key))
    .map(([key, item]) => [key, sanitizeAnalysis(item, depth + 1)]));
}

function axis(customValue) {
  const value = cleanText(customValue, 300);
  return { category: '', value: '', customValue: value, source: value ? 'manual' : '' };
}

function makeId(name, now) {
  const slug = cleanText(name, 80).toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'style';
  return `${now.getTime()}-${slug}`;
}

export function buildStyleProfile(analysis = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const preset = analysis?.generation_preset && typeof analysis.generation_preset === 'object'
    ? analysis.generation_preset
    : {};
  const requestedMode = cleanText(preset.mode, 80);
  const mode = PUBLIC_MODE_VALUES.includes(requestedMode) ? requestedMode : 'novel';
  const axesDetailed = {
    theme: axis(preset.theme || analysis.themes_tendency),
    genre: axis(preset.genre || analysis.tone),
    worldview: axis(preset.worldview),
    target: axis(preset.target || analysis.emotional_architecture?.reader_distance),
    era: axis(preset.era),
    ending: axis(preset.ending || analysis.structure?.closing_style),
    narr: axis(preset.narration || preset.narr || analysis.narrative_voice?.person),
  };
  const reproductionPrompt = cleanText(analysis.reproduction_prompt, 2800);
  const supplement = [
    cleanText(preset.supplement, 2200),
    reproductionPrompt ? `【Hồ sơ phong cách đã phân tích】\n${reproductionPrompt}` : '',
  ].filter(Boolean).join('\n\n');
  const name = cleanText(analysis.style_name || preset.name || 'Hồ sơ phong cách', 120);
  const settingsPayload = buildGenerationSettingsExport({
    mode,
    modeSource: 'style-analysis',
    characters: sanitizeCharacters(preset.characters),
    locked: {},
    universalAssets: [],
  }, {
    version: '',
    modeCustom: MODE_LABELS[mode] || '',
    supplement,
    axesDetailed,
  }, now);

  return {
    id: cleanText(options.id, 160) || makeId(name, now),
    name,
    createdAt: now.toISOString(),
    analysis: sanitizeAnalysis(analysis),
    settingsPayload,
  };
}

export function formatStyleProfilePreview(profile = {}) {
  const settings = profile?.settingsPayload?.settings || {};
  const axes = settings.axes || {};
  const axisValue = key => cleanText(axes[key]?.customValue || axes[key]?.value || axes[key]?.category) || '—';
  const characterNames = Array.isArray(settings.characters)
    ? settings.characters.map(character => cleanText(character?.name)).filter(Boolean)
    : [];
  return [
    `Tên hồ sơ: ${cleanText(profile.name) || 'Hồ sơ phong cách'}`,
    `Chế độ: ${MODE_LABELS_VI[settings.mode] || MODE_LABELS[settings.mode] || settings.mode || '—'}`,
    `Chủ đề: ${axisValue('theme')}`,
    `Thể loại: ${axisValue('genre')}`,
    `Bối cảnh: ${axisValue('worldview')}`,
    `Độc giả: ${axisValue('target')}`,
    `Thời đại: ${axisValue('era')}`,
    `Kết thúc: ${axisValue('ending')}`,
    `Ngôi kể: ${axisValue('narr')}`,
    `Nhân vật: ${characterNames.join(', ') || 'Không đề xuất'}`,
    '',
    'Chỉ dẫn bổ sung:',
    cleanText(settings.supplement, 5000) || '—',
  ].join('\n');
}

export function loadStyleProfiles(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(STYLE_PROFILE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(profile => profile?.id && profile?.settingsPayload?.settings).slice(0, MAX_PROFILES)
      : [];
  } catch {
    return [];
  }
}

export function saveStyleProfile(storage, profile) {
  if (!profile?.id || !profile?.settingsPayload?.settings) throw new Error('Hồ sơ phong cách không hợp lệ.');
  const profiles = loadStyleProfiles(storage);
  const next = [profile, ...profiles.filter(item => item.id !== profile.id)].slice(0, MAX_PROFILES);
  storage?.setItem?.(STYLE_PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteStyleProfile(storage, id) {
  const next = loadStyleProfiles(storage).filter(profile => profile.id !== id);
  storage?.setItem?.(STYLE_PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function parseRequestBody(init = {}) {
  if (typeof init?.body !== 'string') return null;
  try {
    return JSON.parse(init.body);
  } catch {
    return null;
  }
}

function requestText(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const messageText = messages.map(message => {
    if (typeof message?.content === 'string') return message.content;
    if (!Array.isArray(message?.content)) return '';
    return message.content.map(part => part?.text || '').join('\n');
  }).join('\n');
  const geminiText = Array.isArray(body.contents)
    ? body.contents.flatMap(content => content?.parts || []).map(part => part?.text || '').join('\n')
    : '';
  return [messageText, typeof body.input === 'string' ? body.input : '', geminiText].filter(Boolean).join('\n');
}

export function isStyleAnalysisRequest(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!/chat\/completions|generativelanguage\.googleapis\.com/i.test(String(url || ''))) return false;
  const body = parseRequestBody(init);
  if (!body) return false;
  const structured = body.response_format?.type === 'json_object'
    || body.generationConfig?.responseMimeType === 'application/json';
  if (!structured) return false;
  const text = requestText(body);
  return /style_name/.test(text) && /reproduction_prompt/.test(text) && /generation_preset/.test(text);
}

export function extractStyleAnalysisFromPayload(payload = {}) {
  const openAiText = payload?.choices?.[0]?.message?.content || '';
  const geminiText = Array.isArray(payload?.candidates?.[0]?.content?.parts)
    ? payload.candidates[0].content.parts.map(part => part?.text || '').join('')
    : '';
  const text = openAiText || geminiText;
  if (!text) return null;
  const normalized = String(text).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const analysis = ya(normalized);
  return analysis && typeof analysis === 'object' ? analysis : null;
}

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CUSTOM_OPENAI_TEXT_MODELS,
  defaultOpenAiBaseUrl,
  getOpenAiBaseUrl,
  getOpenAiChatCompletionsUrl,
  isLocalLedgerOpenAiBaseUrl,
  LOCAL_LEDGER_OPENAI_TEXT_MODELS,
  LOCAL_OPENAI_BASE_URL,
  mapOpenAiModelForBaseUrl,
  normalizeOpenAiBaseUrl,
  OFFICIAL_OPENAI_BASE_URL,
  OPENAI_BASE_URL_SESSION_KEY,
  OFFICIAL_OPENAI_TEXT_MODELS,
  openAiTextModelsForBaseUrl,
  readStoredOpenAiBaseUrl,
  validateOpenAiBaseUrl,
  writeOpenAiBaseUrl,
} from '../src/openAiEndpointConfig.js';
import { resolveOpenAiResponsesBetaConfig } from '../src/openAiResponsesBeta.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

assert.equal(
  defaultOpenAiBaseUrl({ location: { hostname: 'localhost' } }),
  LOCAL_OPENAI_BASE_URL,
);
assert.equal(
  defaultOpenAiBaseUrl({ location: { hostname: '127.0.0.1' } }),
  LOCAL_OPENAI_BASE_URL,
);
assert.equal(
  defaultOpenAiBaseUrl({ location: { hostname: 'example.com' } }),
  OFFICIAL_OPENAI_BASE_URL,
);

assert.equal(
  normalizeOpenAiBaseUrl(' https://ttmapi.site/v1/ '),
  'https://ttmapi.site/v1',
);
assert.equal(
  normalizeOpenAiBaseUrl('https://ttmapi.site/v1/chat/completions'),
  'https://ttmapi.site/v1',
);
assert.equal(normalizeOpenAiBaseUrl('ftp://ttmapi.site/v1'), '');
assert.equal(normalizeOpenAiBaseUrl('https://user:pass@ttmapi.site/v1'), '');
assert.equal(validateOpenAiBaseUrl('').ok, false);
assert.equal(validateOpenAiBaseUrl('not-a-url').ok, false);
assert.deepEqual(LOCAL_LEDGER_OPENAI_TEXT_MODELS, [
  'cx/gpt-5.5',
  'cx/gpt-5.4',
  'cx/gpt-5.4-mini',
]);
assert.deepEqual(CUSTOM_OPENAI_TEXT_MODELS, [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
]);
assert.deepEqual(
  openAiTextModelsForBaseUrl(OFFICIAL_OPENAI_BASE_URL),
  OFFICIAL_OPENAI_TEXT_MODELS,
);
assert.equal(isLocalLedgerOpenAiBaseUrl(LOCAL_OPENAI_BASE_URL), true);
assert.deepEqual(
  openAiTextModelsForBaseUrl('https://ttmapi.site/v1'),
  CUSTOM_OPENAI_TEXT_MODELS,
);
assert.equal(
  mapOpenAiModelForBaseUrl('cx/gpt-5.5', 'https://ttmapi.site/v1'),
  'gpt-5.5',
);
assert.equal(
  mapOpenAiModelForBaseUrl('gpt-4.1', LOCAL_OPENAI_BASE_URL),
  'cx/gpt-5.5',
);
assert.equal(
  mapOpenAiModelForBaseUrl('gpt-4.1-mini', 'https://ttmapi.site/v1'),
  'gpt-5.4',
);

const sessionStorage = createStorage();
const runtime = {
  location: { hostname: 'localhost' },
  sessionStorage,
  document: {
    getElementById(id) {
      return id === 'openai-base-url'
        ? { value: 'https://ttmapi.site/v1/' }
        : null;
    },
  },
};
assert.equal(writeOpenAiBaseUrl('https://ttmapi.site/v1/', runtime).ok, true);
assert.equal(
  sessionStorage.getItem(OPENAI_BASE_URL_SESSION_KEY),
  'https://ttmapi.site/v1',
);
assert.equal(readStoredOpenAiBaseUrl(runtime), 'https://ttmapi.site/v1');
assert.equal(getOpenAiBaseUrl(runtime), 'https://ttmapi.site/v1');
assert.equal(
  getOpenAiChatCompletionsUrl(runtime),
  'https://ttmapi.site/v1/chat/completions',
);
assert.deepEqual(
  resolveOpenAiResponsesBetaConfig(
    { openAiResponsesBetaAllowed: true },
    {
      location: { hostname: 'story-maker.example', search: '' },
      document: runtime.document,
    },
  ),
  { enabled: false, source: 'local-chat-only', models: [] },
);

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styleCss = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
assert.match(indexHtml, /<label for="openai-base-url">OpenAI Base URL<\/label>/);
assert.match(indexHtml, /id="openai-base-url"/);
assert.match(indexHtml, /cx\/gpt-5\.5/);
assert.match(indexHtml, /gpt-5\.5/);
assert.match(styleCss, /#openai-base-url:focus/);
assert.match(styleCss, /\.openai-endpoint-help/);

console.log('openAiEndpointConfig tests passed');

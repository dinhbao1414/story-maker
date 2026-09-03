import assert from 'node:assert/strict';

const previousDocument = globalThis.document;
const previousLocation = globalThis.location;
const endpointInput = { value: 'https://ttmapi.site/v1/' };
const calls = [];

globalThis.location = { hostname: 'localhost' };
globalThis.document = {
  getElementById(id) {
    return id === 'openai-base-url' ? endpointInput : null;
  },
};
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), body: JSON.parse(init.body || '{}') });
  return new Response(JSON.stringify({
    choices: [{ message: { content: 'editorial result' } }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const { callGenerativeAI } = await import(`../src/api.js?custom=${Date.now()}`);

try {
  const result = await callGenerativeAI(
    'sk-unit-test-key-000000000000',
    'cx/gpt-5.5',
    'Give an editorial review.',
    null,
    { disableFallback: true },
  );
  assert.equal(result.text, 'editorial result');
  assert.equal(result.usedModel, 'gpt-5.5');
  assert.equal(calls[0].url, 'https://ttmapi.site/v1/chat/completions');
  assert.equal(calls[0].body.model, 'gpt-5.5');
} finally {
  delete globalThis.fetch;
  globalThis.document = previousDocument;
  globalThis.location = previousLocation;
}

console.log('api custom endpoint tests passed');

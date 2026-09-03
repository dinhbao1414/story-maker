import assert from 'node:assert/strict';

const calls = [];
const endpointInput = { value: 'https://ttmapi.site/v1/' };

globalThis.location = { hostname: 'story-maker.example' };
globalThis.document = {
  documentElement: { dataset: {} },
  querySelector() {
    return null;
  },
  getElementById(id) {
    return id === 'openai-base-url' ? endpointInput : null;
  },
};
globalThis.window = {
  fetch: async (input, init = {}) => {
    calls.push({
      input: String(input),
      body: JSON.parse(init.body || '{}'),
    });
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
};

await import(`../src/qualityBoost.js?custom-endpoint=${Date.now()}`);

const response = await window.fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4.1',
    stream: false,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: 'Return JSON.' }],
  }),
});
await response.text();

assert.equal(calls.length, 1);
assert.equal(calls[0].input, 'https://ttmapi.site/v1/chat/completions');
assert.equal(calls[0].body.model, 'gpt-5.5');
assert.equal(calls[0].body.stream, false);
assert.equal(document.documentElement.dataset.smkQualityBoost, 'ready');

delete globalThis.window;
delete globalThis.document;
delete globalThis.location;

console.log('openAiCustomEndpointRuntime tests passed');

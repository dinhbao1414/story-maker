import assert from 'node:assert/strict';
import {
  createStoryProjectGenerationBridge,
  runSequentialStoryBatch,
  waitForExistingGeneration,
} from '../src/storyProjectGenerationBridge.js';

const output = { textContent: '', classList: { contains: () => false } };
const button = { disabled: false };
const timers = {
  setInterval(callback) { this.callback = callback; return 1; },
  clearInterval() {},
  setTimeout(callback) { this.timeout = callback; return 2; },
  clearTimeout() {},
};

const pending = waitForExistingGeneration({ button, output, timers, timeoutMs: 1000 });
button.disabled = true;
timers.callback();
button.disabled = false;
output.textContent = 'Truyện hoàn chỉnh';
timers.callback();
assert.equal((await pending).text, 'Truyện hoàn chỉnh');

const elements = new Map([
  ['btn-all-random', { clickCount: 0, click() { this.clickCount += 1; } }],
  ['btn-generate', { disabled: false, clickCount: 0, click() { this.clickCount += 1; } }],
  ['output', { textContent: '', classList: { contains: () => false } }],
]);
const applied = [];
const bridge = createStoryProjectGenerationBridge({
  doc: { getElementById: id => elements.get(id) || null },
  applySettings: async payload => applied.push(payload),
  captureSettings: () => ({ settings: { theme: 'randomized' } }),
  buildVariationSettings: payload => ({ ...payload, controlled: true }),
});
const preview = await bridge.prepareVariation({ settingsPayload: { settings: { genre: 'locked' } } });
assert.equal(elements.get('btn-all-random').clickCount, 1);
assert.equal(applied[0].controlled, true);
assert.equal(preview.settings.theme, 'randomized');

const saved = [];
const failures = [];
const result = await runSequentialStoryBatch({
  count: 3,
  prepare: async index => ({ index }),
  generate: async prepared => {
    if (prepared.index === 1) throw new Error('429');
    return { text: `story-${prepared.index}` };
  },
  saveSuccess: async item => saved.push(item.text),
  saveFailure: async error => failures.push(error.message),
  shouldPause: () => false,
});
assert.deepEqual(saved, ['story-0', 'story-2']);
assert.deepEqual(failures, ['429']);
assert.equal(result.successCount, 2);
assert.equal(result.failureCount, 1);
assert.equal(result.paused, false);

let preparedCount = 0;
const paused = await runSequentialStoryBatch({
  count: 3,
  prepare: async () => { preparedCount += 1; },
  generate: async () => ({ text: 'unused' }),
  saveSuccess: async () => {},
  saveFailure: async () => {},
  shouldPause: () => preparedCount === 1,
});
assert.equal(preparedCount, 1);
assert.equal(paused.paused, true);

console.log('storyProjectGenerationBridge tests passed');

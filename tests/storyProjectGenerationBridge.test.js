import assert from 'node:assert/strict';
import {
  createStoryProjectGenerationBridge,
  runSequentialStoryBatch,
  STORY_PROJECT_GENERATION_TIMEOUT_MS,
  waitForExistingGeneration,
} from '../src/storyProjectGenerationBridge.js';

const output = { textContent: '', classList: { contains: () => false } };
const button = { disabled: false };
const timers = {
  setInterval(callback) { this.callback = callback; return 1; },
  clearInterval() {},
  setTimeout(callback, delay) { this.timeout = callback; this.timeoutDelay = delay; this.timeoutSchedules = (this.timeoutSchedules || 0) + 1; return 2; },
  clearTimeout() {},
};

const pending = waitForExistingGeneration({ button, output, timers, timeoutMs: 1000 });
button.disabled = true;
timers.callback();
button.disabled = false;
output.textContent = 'Truyện hoàn chỉnh';
timers.callback();
assert.equal((await pending).text, 'Truyện hoàn chỉnh');

assert.equal(STORY_PROJECT_GENERATION_TIMEOUT_MS, 30 * 60 * 1000);
assert.equal(timers.timeoutDelay, 1000);
assert.equal(timers.timeoutSchedules >= 3, true);

const timeoutTimers = {
  setInterval(callback) { this.callback = callback; return 1; },
  clearInterval() {},
  setTimeout(callback, delay) { this.timeout = callback; this.timeoutDelay = delay; return 2; },
  clearTimeout() {},
};
const timedOut = waitForExistingGeneration({
  button: { disabled: true },
  output: { textContent: '', classList: { contains: () => true } },
  timers: timeoutTimers,
});
assert.equal(timeoutTimers.timeoutDelay, STORY_PROJECT_GENERATION_TIMEOUT_MS);
timeoutTimers.timeout();
await assert.rejects(timedOut, error => (
  error.code === 'STORY_PROJECT_GENERATION_TIMEOUT'
  && error.stopBatch === true
));

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

let fatalAttempts = 0;
const fatalResult = await runSequentialStoryBatch({
  count: 3,
  prepare: async () => { fatalAttempts += 1; return {}; },
  generate: async () => { throw Object.assign(new Error('timeout'), { stopBatch: true }); },
  saveSuccess: async () => {},
  saveFailure: async () => {},
  shouldPause: () => false,
});
assert.equal(fatalAttempts, 1);
assert.equal(fatalResult.failureCount, 1);
assert.equal(fatalResult.stopped, true);

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

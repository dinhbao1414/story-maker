export const STORY_PROJECT_GENERATION_TIMEOUT_MS = 30 * 60 * 1000;

export function waitForExistingGeneration({
  button,
  output,
  activityElements = [],
  timers = globalThis,
  timeoutMs = STORY_PROJECT_GENERATION_TIMEOUT_MS,
}) {
  if (!button || !output) return Promise.reject(new Error('Không tìm thấy giao diện tạo truyện.'));
  return new Promise((resolve, reject) => {
    let sawBusy = Boolean(button.disabled);
    let settled = false;
    let timeoutId;
    let lastActivity = readActivity(button, output, activityElements);
    const cleanup = () => {
      timers.clearInterval(intervalId);
      timers.clearTimeout(timeoutId);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const armTimeout = () => {
      timers.clearTimeout(timeoutId);
      timeoutId = timers.setTimeout(() => {
        const error = new Error('Tạo truyện quá thời gian chờ.');
        error.code = 'STORY_PROJECT_GENERATION_TIMEOUT';
        error.stopBatch = true;
        finish(reject, error);
      }, timeoutMs);
    };
    const poll = () => {
      const activity = readActivity(button, output, activityElements);
      if (activity !== lastActivity) {
        lastActivity = activity;
        armTimeout();
      }
      if (button.disabled) {
        sawBusy = true;
        return;
      }
      if (!sawBusy) return;
      const text = String(output.textContent || '').trim();
      if (/^Lỗi\s*:/i.test(text)) {
        finish(reject, new Error(text));
        return;
      }
      if (!text || output.classList?.contains?.('empty')) {
        finish(reject, new Error('Không nhận được nội dung truyện.'));
        return;
      }
      finish(resolve, { text });
    };
    const intervalId = timers.setInterval(poll, 200);
    armTimeout();
  });
}

function readActivity(button, output, activityElements) {
  return [button?.disabled ? '1' : '0', output?.textContent || '', ...activityElements.map(element => element?.textContent || '')].join('\n');
}

export function createStoryProjectGenerationBridge({
  doc = globalThis.document,
  applySettings,
  captureSettings,
  buildVariationSettings,
  timers = globalThis,
  timeoutMs = STORY_PROJECT_GENERATION_TIMEOUT_MS,
} = {}) {
  const getRequiredElement = id => {
    const element = doc?.getElementById?.(id);
    if (!element) throw new Error(`Không tìm thấy #${id}.`);
    return element;
  };

  return {
    async prepareVariation(project) {
      const controlledSettings = buildVariationSettings(project?.settingsPayload || {});
      await applySettings(controlledSettings, { announce: false });
      getRequiredElement('btn-all-random').click();
      return captureSettings();
    },
    async generate(previewPayload) {
      await applySettings(previewPayload, { announce: false });
      const button = getRequiredElement('btn-generate');
      const output = getRequiredElement('output');
      const activityElements = ['progress-log', 'progress-title-text', 'char-counter', 'global-alert']
        .map(id => doc?.getElementById?.(id))
        .filter(Boolean);
      const pending = waitForExistingGeneration({ button, output, activityElements, timers, timeoutMs });
      button.click();
      return pending;
    },
  };
}

export async function runSequentialStoryBatch({
  count,
  prepare,
  generate,
  saveSuccess,
  saveFailure,
  shouldPause = () => false,
}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  let successCount = 0;
  let failureCount = 0;
  for (let index = 0; index < total; index += 1) {
    if (shouldPause()) return { successCount, failureCount, paused: true };
    let prepared;
    try {
      prepared = await prepare(index);
      const generated = await generate(prepared, index);
      await saveSuccess(generated, prepared, index);
      successCount += 1;
    } catch (error) {
      await saveFailure(error, index, prepared);
      failureCount += 1;
      if (error?.stopBatch) return { successCount, failureCount, paused: false, stopped: true };
    }
  }
  return { successCount, failureCount, paused: false };
}

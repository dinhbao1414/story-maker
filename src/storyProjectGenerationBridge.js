export function waitForExistingGeneration({
  button,
  output,
  timers = globalThis,
  timeoutMs = 600000,
}) {
  if (!button || !output) return Promise.reject(new Error('Không tìm thấy giao diện tạo truyện.'));
  return new Promise((resolve, reject) => {
    let sawBusy = Boolean(button.disabled);
    const cleanup = () => {
      timers.clearInterval(intervalId);
      timers.clearTimeout(timeoutId);
    };
    const finish = (callback, value) => {
      cleanup();
      callback(value);
    };
    const poll = () => {
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
    const timeoutId = timers.setTimeout(() => {
      finish(reject, new Error('Tạo truyện quá thời gian chờ.'));
    }, timeoutMs);
  });
}

export function createStoryProjectGenerationBridge({
  doc = globalThis.document,
  applySettings,
  captureSettings,
  buildVariationSettings,
  timers = globalThis,
  timeoutMs = 600000,
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
      const pending = waitForExistingGeneration({ button, output, timers, timeoutMs });
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
    try {
      const prepared = await prepare(index);
      const generated = await generate(prepared, index);
      await saveSuccess(generated, prepared, index);
      successCount += 1;
    } catch (error) {
      await saveFailure(error, index);
      failureCount += 1;
    }
  }
  return { successCount, failureCount, paused: false };
}

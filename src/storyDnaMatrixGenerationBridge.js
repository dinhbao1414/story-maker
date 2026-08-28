import { createStoryDnaMatrixRepository } from './storyDnaMatrixStorage.js';

const DEFAULT_MIN_CHARS = 20000;

function nonWhitespaceLength(value) {
  return Array.from(String(value || '').replace(/\s/gu, '')).length;
}

export async function consumeGeneratedStory({
  outputText = '',
  settings = {},
  repository,
  storyId = null,
  now = () => new Date(),
  minNonWhitespaceChars = DEFAULT_MIN_CHARS,
} = {}) {
  const matrixId = String(settings.matrixId || '').trim();
  const matrixRowId = String(settings.matrixRowId || '').trim();
  if (!matrixId || !matrixRowId || !repository) return { status: 'ignored', reason: 'matrix-metadata-missing' };
  const matrix = await repository.getMatrix(matrixId);
  const row = matrix?.rows?.find(item => item.id === matrixRowId);
  if (!row) return { status: 'ignored', reason: 'matrix-row-missing' };
  if (row.status === 'used') return { status: 'already-used', row };
  const charCount = nonWhitespaceLength(outputText);
  if (!String(outputText || '').trim() || charCount < minNonWhitespaceChars) {
    return { status: 'ignored', reason: 'quality-gate', charCount, row };
  }
  const updated = await repository.updateRow(matrixId, matrixRowId, {
    status: 'used',
    usedAt: now().toISOString(),
    storyId: storyId || null,
  });
  return {
    status: 'used',
    matrix: updated,
    row: updated.rows.find(item => item.id === matrixRowId) || null,
    charCount,
  };
}

export function installStoryDnaMatrixGenerationBridge({
  doc = globalThis.document,
  win = globalThis.window,
  repository = createStoryDnaMatrixRepository(),
  onConsumed = () => {},
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  if (!win?.addEventListener) return { dispose() {} };
  let disposed = false;
  let timer = null;
  let observer = null;
  const notifyConsumed = result => {
    onConsumed(result);
    if (typeof win?.dispatchEvent === 'function' && typeof win?.CustomEvent === 'function') {
      win.dispatchEvent(new win.CustomEvent('story-maker:matrix-updated', {
        detail: {
          matrixId: result.matrix?.id || '',
          matrixRowId: result.row?.id || '',
          status: result.status,
        },
      }));
    }
  };
  const consumeFromDom = () => {
    if (disposed || !doc) return;
    const settings = doc.getElementById?.('settings');
    const button = doc.getElementById?.('btn-generate');
    const output = doc.getElementById?.('output');
    const matrixId = doc.getElementById?.('cf-selected-matrix-id')?.value;
    const matrixRowId = doc.getElementById?.('cf-selected-matrix-row-id')?.value;
    if (settings?.classList?.contains?.('generating')
      || button?.disabled
      || !matrixId
      || !matrixRowId
      || !output?.textContent) return;
    consumeGeneratedStory({
      outputText: output.textContent,
      settings: { matrixId, matrixRowId },
      repository,
    }).then(result => {
      if (result.status === 'used') notifyConsumed(result);
    }).catch(() => {});
  };
  const scheduleDomConsume = () => {
    if (timer) clearTimeoutFn(timer);
    timer = setTimeoutFn(() => {
      timer = null;
      consumeFromDom();
    }, 400);
  };
  const handler = event => {
    if (disposed) return;
    const detail = event?.detail || {};
    consumeGeneratedStory({
      outputText: detail.outputText,
      settings: detail.settings,
      repository,
      storyId: detail.storyId,
      now: detail.now ? () => new Date(detail.now) : undefined,
      minNonWhitespaceChars: detail.minNonWhitespaceChars || DEFAULT_MIN_CHARS,
    }).then(result => {
      if (result.status === 'used') notifyConsumed(result);
    }).catch(() => {});
  };
  win.addEventListener('story-maker:story-generated', handler);
  win.addEventListener('story-maker:output-updated', scheduleDomConsume);
  if (doc?.defaultView?.MutationObserver && doc.getElementById?.('output')) {
    observer = new doc.defaultView.MutationObserver(scheduleDomConsume);
    observer.observe(doc.getElementById('output'), { childList: true, subtree: true, characterData: true });
    if (doc.getElementById('settings')) {
      observer.observe(doc.getElementById('settings'), { attributes: true, attributeFilter: ['class'] });
    }
    if (doc.getElementById('btn-generate')) {
      observer.observe(doc.getElementById('btn-generate'), { attributes: true, attributeFilter: ['disabled', 'class'] });
    }
  }
  scheduleDomConsume();
  return {
    dispose() {
      disposed = true;
      if (timer) clearTimeoutFn(timer);
      observer?.disconnect?.();
      win.removeEventListener?.('story-maker:story-generated', handler);
      win.removeEventListener?.('story-maker:output-updated', scheduleDomConsume);
    },
  };
}

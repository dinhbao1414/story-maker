import { createStoryDnaMatrixRepository } from './storyDnaMatrixStorage.js';
import { randomizeAndApplyFormulaSettings } from './channelFormulaRuntime.js';
import { consumeGeneratedStory } from './storyDnaMatrixGenerationBridge.js';
import { isChannelFormulaAnalysisReady } from './channelFormula.js';

const MAX_BATCH_CONCURRENCY = 10;
const MIN_BATCH_CHARS = 20000;
const MIN_CONTINUATION_CHARS = 10000;
const MAX_BATCH_ATTEMPTS = 4;
const MAX_CONTINUATION_ROUNDS = 3;
const RETRY_BACKOFF_MS = Object.freeze([2000, 5000, 10000]);
const WORKER_QUERY_KEY = 'storyBatchWorker';
const WORKER_SOURCE = 'story-maker-batch-worker';
const PARENT_SOURCE = 'story-maker-batch-parent';

function cleanText(value, max = 500) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);
}

export function countBatchCharacters(value) {
  return Array.from(String(value || '').replace(/\s/gu, '')).length;
}

export function sanitizeBatchFileName(value, fallback = 'story') {
  const safe = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[. ]+$/u, '')
    .slice(0, 120);
  return safe || fallback;
}

export function extractBatchTitle(text, fallback = 'Story') {
  const firstLine = String(text || '')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(Boolean) || '';
  const title = firstLine
    .replace(/^[【「『\[(]+/gu, '')
    .replace(/[】」』\])]+(?=\s*[:：])/gu, '')
    .replace(/^(?:タイトル|title)\s*[:：]\s*/iu, '')
    .trim();
  return sanitizeBatchFileName(title.slice(0, 100), fallback);
}

export function chooseBatchRows(matrices = [], count = 1, { random = Math.random } = {}) {
  const failed = [];
  const planned = [];
  for (const matrix of Array.isArray(matrices) ? matrices : []) {
    for (const row of Array.isArray(matrix?.rows) ? matrix.rows : []) {
      if (!['planned', 'failed'].includes(row?.status) || row.locked) continue;
      (row.status === 'failed' ? failed : planned).push({ matrix, row });
    }
  }
  for (const candidates of [failed, planned]) {
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const source = Number(random());
      const offset = Number.isFinite(source) ? Math.max(0, Math.min(0.999999999, source)) : 0;
      const swap = Math.floor(offset * (index + 1));
      [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
    }
  }
  return [...failed, ...planned].slice(0, Math.max(0, Math.floor(Number(count) || 0)));
}

export function recoverInterruptedBatchRows(matrix = {}) {
  const rows = Array.isArray(matrix.rows) ? matrix.rows : [];
  let recoveredCount = 0;
  const nextRows = rows.map(row => {
    if (!['queued', 'generating'].includes(row?.status)) return row;
    recoveredCount += 1;
    return {
      ...row,
      status: 'planned',
      usedAt: null,
      storyId: null,
    };
  });
  return {
    matrix: recoveredCount ? { ...matrix, rows: nextRows } : matrix,
    recoveredCount,
  };
}

function availableBatchRows(matrix) {
  return (Array.isArray(matrix?.rows) ? matrix.rows : [])
    .filter(row => ['planned', 'failed'].includes(row?.status) && !row.locked);
}

export async function runConcurrentBatch({
  jobs = [],
  concurrency = MAX_BATCH_CONCURRENCY,
  runJob,
  signal,
  onUpdate = () => {},
} = {}) {
  if (typeof runJob !== 'function') throw new TypeError('Batch runJob callback is required.');
  const items = Array.isArray(jobs) ? jobs : [];
  const limit = Math.max(1, Math.min(MAX_BATCH_CONCURRENCY, Math.floor(Number(concurrency) || 1)));
  let nextIndex = 0;
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const job = items[index];
      job.status = 'running';
      onUpdate({ job, index, status: 'running' });
      try {
        const result = await runJob(job, index, signal);
        if (signal?.aborted) {
          job.status = 'cancelled';
          onUpdate({ job, index, status: 'cancelled' });
          continue;
        }
        job.status = 'completed';
        job.result = result;
        onUpdate({ job, index, status: 'completed', result });
      } catch (error) {
        job.status = signal?.aborted ? 'cancelled' : 'failed';
        job.error = String(error?.message || error);
        onUpdate({ job, index, status: job.status, error });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return {
    jobs: items,
    completed: items.filter(job => job.status === 'completed').length,
    failed: items.filter(job => job.status === 'failed').length,
    cancelled: items.filter(job => job.status === 'cancelled').length,
  };
}

function waitWithAbort(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Batch đã bị hủy.'));
      return;
    }
    let timeoutId = null;
    const onAbort = () => {
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener?.('abort', onAbort);
      reject(new Error('Batch đã bị hủy.'));
    };
    timeoutId = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, Math.max(0, Number(delayMs) || 0));
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

export async function runBatchJobWithRetry({
  runAttempt,
  maxAttempts = MAX_BATCH_ATTEMPTS,
  backoffMs = RETRY_BACKOFF_MS,
  wait = waitWithAbort,
  signal = null,
  onAttempt = () => {},
} = {}) {
  if (typeof runAttempt !== 'function') throw new TypeError('Batch retry runAttempt callback is required.');
  const limit = Math.max(1, Math.floor(Number(maxAttempts) || MAX_BATCH_ATTEMPTS));
  let lastError = null;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    if (signal?.aborted) throw new Error('Batch đã bị hủy.');
    onAttempt({ phase: 'start', attempt, maxAttempts: limit, error: lastError });
    try {
      const result = await runAttempt({ attempt, maxAttempts: limit, signal });
      onAttempt({ phase: 'success', attempt, maxAttempts: limit, result });
      return result;
    } catch (cause) {
      lastError = cause instanceof Error ? cause : new Error(String(cause));
      if (signal?.aborted) throw lastError;
      if (attempt >= limit) {
        lastError.attempt = attempt;
        lastError.maxAttempts = limit;
        onAttempt({ phase: 'failed', attempt, maxAttempts: limit, error: lastError });
        throw lastError;
      }
      const delayMs = Number(backoffMs?.[attempt - 1] ?? backoffMs?.at?.(-1) ?? 0) || 0;
      onAttempt({
        phase: 'backoff',
        attempt,
        maxAttempts: limit,
        error: lastError,
        delayMs,
      });
      await wait(delayMs, signal);
    }
  }
  throw lastError || new Error('Batch retry failed.');
}

export async function completeBatchStoryText({
  runInitial,
  continueStory,
  minChars = MIN_BATCH_CHARS,
  continuationThreshold = MIN_CONTINUATION_CHARS,
  maxContinuationRounds = MAX_CONTINUATION_ROUNDS,
  onProgress = () => {},
} = {}) {
  if (typeof runInitial !== 'function') throw new TypeError('Initial story callback is required.');
  let text = String(await runInitial() || '').trim();
  let chars = countBatchCharacters(text);
  onProgress({ phase: 'initial', text, chars, continuationRound: 0 });
  if (chars >= minChars) return text;
  if (chars < continuationThreshold || typeof continueStory !== 'function') {
    throw new Error(`Chưa đạt quality gate 20.000 ký tự (${chars.toLocaleString('vi-VN')}).`);
  }
  const rounds = Math.max(1, Math.floor(Number(maxContinuationRounds) || 1));
  for (let continuationRound = 1; continuationRound <= rounds && chars < minChars; continuationRound += 1) {
    const previousChars = chars;
    text = String(await continueStory({
      text,
      chars,
      deficit: Math.max(0, minChars - chars),
      targetChars: minChars,
      continuationRound,
      maxContinuationRounds: rounds,
    }) || '').trim();
    chars = countBatchCharacters(text);
    onProgress({ phase: 'continuation', text, chars, continuationRound });
    if (chars >= minChars) return text;
    if (chars <= previousChars) {
      throw new Error(`AI viết tiếp nhưng số ký tự không tăng (${chars.toLocaleString('vi-VN')}).`);
    }
  }
  throw new Error(`Đã viết tiếp nhưng vẫn chưa đạt 20.000 ký tự (${chars.toLocaleString('vi-VN')}).`);
}

function getSelectedFormula(doc) {
  try {
    return JSON.parse(doc?.getElementById?.('cf-selected-formula')?.value || 'null');
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/gu, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function getWorkerUrl(win) {
  const url = new URL(win.location.href);
  url.searchParams.set(WORKER_QUERY_KEY, '1');
  url.searchParams.set('batchWorkerId', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return url.href;
}

function createWorkerFrame(doc, win) {
  const frame = doc.createElement('iframe');
  frame.title = 'Story Maker batch worker';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
  frame.src = getWorkerUrl(win);
  return frame;
}

function waitForWorkerReady(frame, win, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let timeoutId = null;
    const cleanup = () => {
      win.removeEventListener('message', onMessage);
      if (timeoutId) win.clearTimeout(timeoutId);
    };
    const finish = (callback, value) => {
      cleanup();
      callback(value);
    };
    const onMessage = event => {
      if (event.source !== frame.contentWindow || event.data?.source !== WORKER_SOURCE) return;
      if (event.data.type === 'ready') finish(resolve);
      if (event.data.type === 'failed') finish(reject, new Error(event.data.error || 'Worker khởi động thất bại.'));
    };
    win.addEventListener('message', onMessage);
    timeoutId = win.setTimeout(() => finish(reject, new Error('Worker khởi động quá thời gian chờ.')), timeoutMs);
    frame.addEventListener('load', () => {
      // The worker posts ready after its own DOMContentLoaded; this listener only
      // ensures a failed document load does not leave the batch waiting forever.
      if (!frame.contentDocument) finish(reject, new Error('Không tải được worker tạo truyện.'));
    }, { once: true });
  });
}

function waitForWorkerOutput(frame, win, {
  onProgress = () => {},
  timeoutMs = 35 * 60 * 1000,
  signal = null,
} = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let sawBusy = false;
    let lastText = '';
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onMessage = event => {
      if (event.source !== frame.contentWindow || event.data?.source !== WORKER_SOURCE) return;
      if (event.data.type === 'failed') {
        finish(reject, new Error(event.data.error || 'Worker tạo truyện thất bại.'));
      }
    };
    const onAbort = () => {
      finish(reject, new Error('Batch đã bị hủy.'));
    };
    const poll = () => {
      if (settled) return;
      const doc = frame.contentDocument;
      const button = doc?.getElementById?.('btn-generate');
      const output = doc?.getElementById?.('output');
      const text = String(output?.textContent || '');
      const chars = countBatchCharacters(text);
      if (text !== lastText) {
        lastText = text;
        onProgress({ chars, text });
      }
      if (button?.disabled) sawBusy = true;
      if (Date.now() - startedAt > timeoutMs) {
        finish(reject, new Error('Story quá thời gian chờ.'));
        return;
      }
      if (sawBusy && button && !button.disabled) {
        if (/^\s*(?:Lỗi|Error)\s*:/iu.test(text) || output?.querySelector?.('.error-msg')) {
          finish(reject, new Error(cleanText(text, 1000) || 'Worker tạo truyện thất bại.'));
          return;
        }
        if (text.trim() && !output?.classList?.contains?.('empty') && chars >= 1) {
          finish(resolve, text.trim());
          return;
        }
      }
    };
    const intervalId = win.setInterval(poll, 250);
    const cleanup = () => {
      win.clearInterval(intervalId);
      win.removeEventListener('message', onMessage);
      signal?.removeEventListener?.('abort', onAbort);
    };
    win.addEventListener('message', onMessage);
    signal?.addEventListener?.('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    poll();
  });
}

function waitForWorkerContinuation(frame, win, {
  timeoutMs = 10 * 60 * 1000,
  signal = null,
} = {}) {
  return new Promise((resolve, reject) => {
    let timeoutId = null;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onMessage = event => {
      if (event.source !== frame.contentWindow || event.data?.source !== WORKER_SOURCE) return;
      if (event.data.type === 'continued') {
        finish(resolve, String(event.data.text || ''));
      } else if (event.data.type === 'failed') {
        finish(reject, new Error(event.data.error || 'Worker viết tiếp thất bại.'));
      }
    };
    const onAbort = () => finish(reject, new Error('Batch đã bị hủy.'));
    const cleanup = () => {
      if (timeoutId) win.clearTimeout(timeoutId);
      win.removeEventListener('message', onMessage);
      signal?.removeEventListener?.('abort', onAbort);
    };
    win.addEventListener('message', onMessage);
    signal?.addEventListener?.('abort', onAbort, { once: true });
    timeoutId = win.setTimeout(
      () => finish(reject, new Error('AI viết tiếp quá thời gian chờ.')),
      timeoutMs,
    );
    if (signal?.aborted) onAbort();
  });
}

async function runWorkerStory({
  doc,
  win,
  payload,
  onProgress,
  signal,
} = {}) {
  if (signal?.aborted) throw new Error('Batch đã bị hủy.');
  const frame = createWorkerFrame(doc, win);
  try {
    const ready = waitForWorkerReady(frame, win);
    doc.body.appendChild(frame);
    await ready;
    if (signal?.aborted) throw new Error('Batch đã bị hủy.');
    frame.contentWindow.postMessage({
      source: PARENT_SOURCE,
      type: 'start',
      payload,
    }, win.location.origin);
    const abort = () => frame.contentWindow.postMessage({ source: PARENT_SOURCE, type: 'abort' }, win.location.origin);
    signal?.addEventListener?.('abort', abort, { once: true });
    try {
      return await completeBatchStoryText({
        runInitial: () => waitForWorkerOutput(frame, win, { onProgress, signal }),
        continueStory: async continuation => {
          frame.contentWindow.postMessage({
            source: PARENT_SOURCE,
            type: 'continue',
            payload: continuation,
          }, win.location.origin);
          return waitForWorkerContinuation(frame, win, { signal });
        },
        onProgress,
      });
    } finally {
      signal?.removeEventListener?.('abort', abort);
    }
  } finally {
    frame.remove();
  }
}

async function createDirectoryWriter(directoryHandle) {
  if (!directoryHandle?.getFileHandle) throw new Error('Thư mục lưu không hợp lệ.');
  return async (filename, text) => {
    const handle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(text);
    } finally {
      await writable.close();
    }
    return filename;
  };
}

function renderJobList(element, jobs) {
  if (!element) return;
  element.innerHTML = jobs.map((job, index) => `
    <div class="cf-batch-job cf-batch-job-${escapeHtml(job.status)}">
      <span class="cf-batch-job-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="cf-batch-job-name">${escapeHtml(job.matrixName)} / ${escapeHtml(job.row.id)}</span>
      <span class="cf-batch-job-status">
        ${escapeHtml(job.statusLabel || job.status)}
        ${job.error ? `<br><span class="cf-batch-job-error">${escapeHtml(job.error)}</span>` : ''}
      </span>
      <span class="cf-batch-job-chars">${job.chars ? `${job.chars.toLocaleString('vi-VN')} ký tự` : ''}</span>
    </div>
  `).join('');
}

function statusLabel(status) {
  return ({
    queued: 'Đang chờ',
    running: 'Đang tạo',
    completed: 'Hoàn tất',
    failed: 'Lỗi',
    cancelled: 'Đã hủy',
  }[status] || status);
}

export function dispatchBatchState(win = globalThis.window, {
  running = false,
  jobCount = 0,
} = {}) {
  if (typeof win?.dispatchEvent !== 'function' || typeof win?.CustomEvent !== 'function') return false;
  win.dispatchEvent(new win.CustomEvent('story-maker:batch-state', {
    detail: {
      source: 'batch-story-runtime',
      running: running === true,
      jobCount: Math.max(0, Math.floor(Number(jobCount) || 0)),
    },
  }));
  return true;
}

export function installBatchStoryRuntime({
  doc = globalThis.document,
  win = globalThis.window,
  repository = null,
} = {}) {
  if (!doc || !win || new URLSearchParams(win.location.search).get(WORKER_QUERY_KEY) === '1') return null;
  const root = doc.getElementById('cf-batch-root');
  if (!root || root.dataset.batchStoryReady) return null;
  root.dataset.batchStoryReady = 'true';
  const matrixRepository = repository || createStoryDnaMatrixRepository();
  let directoryHandle = null;
  let matrices = [];
  let running = false;
  let abortController = null;
  const listElement = doc.getElementById('cf-batch-matrix-list');
  const statusElement = doc.getElementById('cf-batch-status');
  const jobsElement = doc.getElementById('cf-batch-jobs');
  const startButton = doc.getElementById('cf-batch-start');
  const stopButton = doc.getElementById('cf-batch-stop');
  const folderButton = doc.getElementById('cf-batch-folder');
  const folderName = doc.getElementById('cf-batch-folder-name');
  const error = message => {
    const element = doc.getElementById('cf-batch-error');
    if (element) {
      element.textContent = cleanText(message, 1200);
      element.classList.remove('hidden');
    }
  };
  const setStatus = message => {
    if (statusElement) statusElement.textContent = message;
  };
  const renderMatrices = () => {
    if (!listElement) return;
    if (!matrices.length) {
      listElement.innerHTML = '<span class="cf-batch-empty">Chưa có Matrix cho công thức này.</span>';
      if (startButton) startButton.disabled = true;
      return;
    }
    listElement.innerHTML = matrices.map((matrix, index) => `
      <label class="cf-batch-matrix-option">
        <input type="checkbox" data-batch-matrix-id="${escapeHtml(matrix.id)}" ${index === 0 ? 'checked' : ''}>
        <span>${escapeHtml(matrix.name)} (${availableBatchRows(matrix).length} story khả dụng)</span>
      </label>
    `).join('');
    if (startButton) startButton.disabled = !matrices.some(matrix => availableBatchRows(matrix).length > 0);
  };
  const loadMatrices = async () => {
    const formula = getSelectedFormula(doc);
    matrices = formula?.id && isChannelFormulaAnalysisReady(formula)
      ? await matrixRepository.listMatrices(formula.id)
      : [];
    if (formula?.id && !isChannelFormulaAnalysisReady(formula)) {
      setStatus('Công thức chưa đạt quality gate; batch bị khóa cho tới khi phân tích folder hoàn tất.');
    }
    if (!running) {
      const recovered = [];
      for (const matrix of matrices) {
        const result = recoverInterruptedBatchRows(matrix);
        if (!result.recoveredCount) {
          recovered.push(matrix);
          continue;
        }
        recovered.push(await matrixRepository.saveMatrix(result.matrix));
      }
      matrices = recovered;
    }
    renderMatrices();
  };
  const selectedMatrices = () => {
    const ids = [...(listElement?.querySelectorAll?.('input[data-batch-matrix-id]:checked') || [])]
      .map(input => input.dataset.batchMatrixId);
    return matrices.filter(matrix => ids.includes(matrix.id));
  };
  const setBusy = busy => {
    running = busy;
    if (startButton) startButton.disabled = busy;
    if (stopButton) stopButton.disabled = !busy;
    if (folderButton) folderButton.disabled = busy;
    root.classList.toggle('is-running', busy);
  };
  const chooseFolder = async () => {
    if (typeof win.showDirectoryPicker !== 'function') {
      throw new Error('Trình duyệt này không hỗ trợ chọn thư mục ghi file. Hãy dùng Chrome hoặc Edge mới.');
    }
    directoryHandle = await win.showDirectoryPicker({ mode: 'readwrite' });
    if (directoryHandle.queryPermission) {
      const permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const requested = await directoryHandle.requestPermission({ mode: 'readwrite' });
        if (requested !== 'granted') throw new Error('Chưa được cấp quyền ghi vào thư mục.');
      }
    }
    if (folderName) folderName.textContent = directoryHandle.name || 'Đã chọn thư mục';
    if (startButton) startButton.disabled = false;
  };
  const start = async () => {
    if (running) return;
    const formula = getSelectedFormula(doc);
    if (!formula?.id) return error('Hãy chọn công thức kênh trước.');
    if (!isChannelFormulaAnalysisReady(formula)) {
      return error('Công thức chưa đạt quality gate hoặc là bản fallback cũ. Hãy phân tích folder thành công trước.');
    }
    const selected = selectedMatrices();
    if (!selected.length) return error('Hãy chọn ít nhất một DNA Matrix.');
    if (!directoryHandle) return error('Hãy chọn thư mục lưu TXT trước.');
    const count = Math.max(1, Math.min(100, Math.floor(Number(doc.getElementById('cf-batch-count')?.value) || 1)));
    const concurrency = Math.max(1, Math.min(MAX_BATCH_CONCURRENCY, Math.floor(Number(doc.getElementById('cf-batch-concurrency')?.value) || MAX_BATCH_CONCURRENCY)));
    const available = chooseBatchRows(selected, count);
    if (available.length < count) return error(`Chỉ còn ${available.length} story card khả dụng trong các Matrix đã chọn.`);
    const writer = await createDirectoryWriter(directoryHandle);
    const jobs = [];
    try {
      for (const [index, candidate] of available.entries()) {
        const { matrix, row } = candidate;
        await matrixRepository.updateRow(matrix.id, row.id, { status: 'generating' });
        const result = await randomizeAndApplyFormulaSettings({
          formula,
          matrix: { id: matrix.id, rows: [{ ...row, status: 'planned' }] },
          applySettings: async () => {},
          dispatchDashboardOpen: () => {},
        });
        jobs.push({
          id: `batch-${Date.now()}-${index}`,
          matrixId: matrix.id,
          matrixName: matrix.name,
          row,
          payload: result.payload,
          status: 'queued',
          statusLabel: statusLabel('queued'),
          chars: 0,
          attempt: 0,
          maxAttempts: MAX_BATCH_ATTEMPTS,
          error: '',
        });
      }
    } catch (cause) {
      await Promise.all(jobs.map(job => matrixRepository.updateRow(
        job.matrixId,
        job.row.id,
        { status: 'planned', usedAt: null, storyId: null },
      ).catch(() => {})));
      throw cause;
    }
    renderJobList(jobsElement, jobs);
    setBusy(true);
    dispatchBatchState(win, { running: true, jobCount: jobs.length });
    abortController = new AbortController();
    setStatus(`Đang tạo ${jobs.length} story với ${concurrency} luồng...`);
    try {
      const result = await runConcurrentBatch({
        jobs,
        concurrency,
        signal: abortController.signal,
        onUpdate: update => {
          if (update.status === 'completed') {
            update.job.statusLabel = `${statusLabel('completed')} · Lần ${update.job.attempt}/${update.job.maxAttempts}`;
          } else if (update.status === 'failed') {
            update.job.statusLabel = `${statusLabel('failed')} · Đã thử ${update.job.attempt}/${update.job.maxAttempts}`;
          } else if (update.status === 'cancelled') {
            update.job.statusLabel = `${statusLabel('cancelled')} · Lần ${update.job.attempt}/${update.job.maxAttempts}`;
          } else if (update.status !== 'running' || !update.job.statusLabel) {
            update.job.statusLabel = statusLabel(update.status);
          }
          if (update.result?.chars) update.job.chars = update.result.chars;
          if (update.error) update.job.error = String(update.error.message || update.error);
          renderJobList(jobsElement, jobs);
          const done = jobs.filter(job => job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled').length;
          setStatus(`${done}/${jobs.length} hoàn tất xử lý · Thành công ${jobs.filter(job => job.status === 'completed').length} · Đang chạy ${jobs.filter(job => job.status === 'running').length}`);
        },
        runJob: async (job, index, signal) => {
          try {
            const text = await runBatchJobWithRetry({
              signal,
              maxAttempts: MAX_BATCH_ATTEMPTS,
              onAttempt: update => {
                job.attempt = update.attempt;
                job.maxAttempts = update.maxAttempts;
                if (update.error) job.error = String(update.error.message || update.error);
                if (update.phase === 'start') {
                  job.error = '';
                  job.statusLabel = `${statusLabel('running')} · Lần ${update.attempt}/${update.maxAttempts}`;
                } else if (update.phase === 'backoff') {
                  job.statusLabel = `Chờ thử lại ${Math.ceil(update.delayMs / 1000)} giây · Lần ${update.attempt}/${update.maxAttempts}`;
                } else if (update.phase === 'failed') {
                  job.statusLabel = `${statusLabel('failed')} · Đã thử ${update.attempt}/${update.maxAttempts}`;
                }
                renderJobList(jobsElement, jobs);
              },
              runAttempt: async () => runWorkerStory({
                doc,
                win,
                payload: job.payload,
                signal,
                onProgress: progress => {
                  job.chars = progress.chars;
                  if (progress.phase === 'continuation') {
                    job.statusLabel = `AI đã viết tiếp ${progress.continuationRound}/${MAX_CONTINUATION_ROUNDS} · Lần ${job.attempt}/${job.maxAttempts}`;
                  } else if (progress.chars >= MIN_CONTINUATION_CHARS && progress.chars < MIN_BATCH_CHARS) {
                    job.statusLabel = `Đang yêu cầu AI viết tiếp · Lần ${job.attempt}/${job.maxAttempts}`;
                  } else {
                    job.statusLabel = `${statusLabel('running')} · Lần ${job.attempt}/${job.maxAttempts}`;
                  }
                  renderJobList(jobsElement, jobs);
                },
              }),
            });
            const chars = countBatchCharacters(text);
            if (chars < MIN_BATCH_CHARS) {
              throw new Error(`Chưa đạt quality gate 20.000 ký tự (${chars.toLocaleString('vi-VN')}).`);
            }
            const filename = `${String(index + 1).padStart(3, '0')}_${sanitizeBatchFileName(job.matrixName, 'Matrix')}_${sanitizeBatchFileName(job.row.id, 'story')}_${extractBatchTitle(text)}.txt`;
            await writer(filename, text);
            await consumeGeneratedStory({
              outputText: text,
              settings: job.payload.settings,
              repository: matrixRepository,
              storyId: job.id,
              minNonWhitespaceChars: MIN_BATCH_CHARS,
            });
            return { filename, chars };
          } catch (cause) {
            const cancelled = signal?.aborted;
            await matrixRepository.updateRow(job.matrixId, job.row.id, {
              status: cancelled ? 'planned' : 'failed',
              usedAt: null,
              storyId: null,
            }).catch(() => {});
            throw cause;
          }
        },
      });
      setStatus(`Batch hoàn tất: ${result.completed} thành công, ${result.failed} lỗi, ${result.cancelled} đã hủy.`);
    } catch (cause) {
      error(cause?.message || cause);
      setStatus('Batch kết thúc với lỗi.');
    } finally {
      abortController = null;
      setBusy(false);
      dispatchBatchState(win, { running: false, jobCount: jobs.length });
      await loadMatrices().catch(() => {});
    }
  };
  folderButton?.addEventListener('click', () => chooseFolder().catch(cause => error(cause.message || cause)));
  startButton?.addEventListener('click', () => start().catch(cause => error(cause.message || cause)));
  stopButton?.addEventListener('click', () => {
    abortController?.abort();
    setStatus('Đang hủy các worker đang chạy...');
  });
  doc.addEventListener('change', event => {
    if (event.target?.id === 'cf-formula-select') loadMatrices().catch(cause => error(cause.message || cause));
  });
  win.addEventListener('story-maker:open-formulas', () => loadMatrices().catch(cause => error(cause.message || cause)));
  win.addEventListener('story-maker:channel-formula-imported', () => loadMatrices().catch(cause => error(cause.message || cause)));
  win.addEventListener('story-maker:matrix-updated', () => {
    if (!running) loadMatrices().catch(cause => error(cause.message || cause));
  });
  loadMatrices().catch(cause => error(cause.message || cause));
  return {
    loadMatrices,
    chooseFolder,
    start,
    stop: () => abortController?.abort(),
    getMatrices: () => matrices,
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installBatchStoryRuntime());
  } else {
    installBatchStoryRuntime();
  }
}

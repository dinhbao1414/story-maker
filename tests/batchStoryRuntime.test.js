import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseBatchRows,
  completeBatchStoryText,
  countBatchCharacters,
  dispatchBatchState,
  extractBatchTitle,
  recoverInterruptedBatchRows,
  runBatchJobWithRetry,
  runConcurrentBatch,
  sanitizeBatchFileName,
} from '../src/batchStoryRuntime.js';
import {
  buildBatchContinuationPrompt,
  disableBatchAutomaticBrushup,
} from '../src/batchStoryWorkerRuntime.js';

function row(id, status = 'planned', locked = false) {
  return { id, status, locked };
}

test('batch row selection draws only planned and unlocked rows across matrices', () => {
  const matrices = [
    { id: 'm1', rows: [row('a'), row('used', 'used'), row('locked', 'planned', true)] },
    { id: 'm2', rows: [row('b'), row('c'), row('retry', 'failed')] },
  ];
  const selected = chooseBatchRows(matrices, 4, { random: () => 0 });
  assert.deepEqual(selected.map(item => item.row.id).sort(), ['a', 'b', 'c', 'retry']);
});

test('batch row selection prioritizes failed rows before planned rows', () => {
  const matrices = [{
    id: 'm1',
    rows: [
      row('planned-a'),
      row('failed-a', 'failed'),
      row('planned-b'),
      row('failed-b', 'failed'),
    ],
  }];
  const selected = chooseBatchRows(matrices, 3, { random: () => 0.5 });
  assert.deepEqual(selected.slice(0, 2).map(item => item.row.status), ['failed', 'failed']);
  assert.equal(selected[2].row.status, 'planned');
});

test('interrupted queued/generating rows recover to planned without changing used rows', () => {
  const result = recoverInterruptedBatchRows({
    id: 'm1',
    rows: [
      row('queued', 'queued'),
      { ...row('generating', 'generating'), usedAt: 'old', storyId: 'batch-1' },
      row('failed', 'failed'),
      row('used', 'used'),
    ],
  });
  assert.equal(result.recoveredCount, 2);
  assert.deepEqual(result.matrix.rows.map(item => item.status), ['planned', 'planned', 'failed', 'used']);
  assert.equal(result.matrix.rows[1].usedAt, null);
  assert.equal(result.matrix.rows[1].storyId, null);
});

test('batch scheduler never exceeds requested concurrency and reports results', async () => {
  const jobs = Array.from({ length: 12 }, (_, index) => ({ id: index, status: 'queued' }));
  let active = 0;
  let peak = 0;
  const result = await runConcurrentBatch({
    jobs,
    concurrency: 10,
    runJob: async job => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 3));
      active -= 1;
      return { id: job.id };
    },
  });
  assert.equal(peak, 10);
  assert.equal(result.completed, 12);
  assert.equal(result.failed, 0);
});

test('batch scheduler stops starting new jobs after cancellation', async () => {
  const jobs = Array.from({ length: 8 }, (_, index) => ({ id: index, status: 'queued' }));
  const controller = new AbortController();
  let started = 0;
  const result = await runConcurrentBatch({
    jobs,
    concurrency: 2,
    signal: controller.signal,
    runJob: async () => {
      started += 1;
      controller.abort();
      await new Promise(resolve => setTimeout(resolve, 2));
    },
  });
  assert.equal(started, 1);
  assert.equal(result.cancelled, 1);
  assert.equal(jobs.filter(job => job.status === 'queued').length, 7);
});

test('batch filename and title helpers remove unsafe characters', () => {
  assert.equal(sanitizeBatchFileName('A:/bad?name*'), 'A bad name');
  assert.equal(extractBatchTitle('【タイトル】: 家族の秘密\n本文'), '家族の秘密');
  assert.equal(countBatchCharacters(' A\nB\tC '), 3);
});

test('batch retry runs at most four attempts and exposes backoff errors', async () => {
  const events = [];
  let attempts = 0;
  const result = await runBatchJobWithRetry({
    maxAttempts: 4,
    backoffMs: [1, 2, 3],
    wait: async () => {},
    onAttempt: event => events.push(event),
    runAttempt: async () => {
      attempts += 1;
      if (attempts < 4) throw new Error(`transient-${attempts}`);
      return 'ok';
    },
  });
  assert.equal(result, 'ok');
  assert.equal(attempts, 4);
  assert.deepEqual(
    events.filter(event => event.phase === 'backoff').map(event => event.error.message),
    ['transient-1', 'transient-2', 'transient-3'],
  );
});

test('continuation prompt forbids restarting the existing manuscript', () => {
  const prompt = buildBatchContinuationPrompt({
    text: `${'既存本文'.repeat(2000)}\n【完】`,
    deficit: 5800,
    targetChars: 20000,
  });
  assert.match(prompt, /最初から書き直さず/u);
  assert.match(prompt, /追加する新しい本文だけ/u);
  assert.match(prompt, /章タイトル・章番号/u);
  assert.doesNotMatch(prompt, /【完】\s*=== 既存本文ここまで/u);
});

test('batch worker disables automatic three-pass brush-up without changing the Dashboard default', () => {
  const checkbox = { checked: true };
  const doc = {
    getElementById(id) {
      return id === 'longify-auto-brushup-until-pass' ? checkbox : null;
    },
  };
  assert.equal(disableBatchAutomaticBrushup(doc), true);
  assert.equal(checkbox.checked, false);
  assert.equal(disableBatchAutomaticBrushup({ getElementById: () => null }), false);
});

test('batch runtime announces running state so workspace navigation stays on the user tab', () => {
  const events = [];
  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  const win = {
    CustomEvent,
    dispatchEvent(event) {
      events.push(event);
    },
  };
  assert.equal(dispatchBatchState(win, { running: true, jobCount: 10 }), true);
  assert.equal(dispatchBatchState(win, { running: false, jobCount: 10 }), true);
  assert.deepEqual(events.map(event => ({
    type: event.type,
    running: event.detail.running,
    jobCount: event.detail.jobCount,
  })), [
    { type: 'story-maker:batch-state', running: true, jobCount: 10 },
    { type: 'story-maker:batch-state', running: false, jobCount: 10 },
  ]);
});

test('10-story / 2-worker end-to-end batch retries transient failures and continues 10K drafts', async () => {
  const jobs = Array.from({ length: 10 }, (_, index) => ({
    id: `job-${index + 1}`,
    status: 'queued',
    attempts: 0,
    continuationCalls: 0,
  }));
  let active = 0;
  let peak = 0;
  const markedFailed = [];
  const result = await runConcurrentBatch({
    jobs,
    concurrency: 2,
    runJob: async job => {
      active += 1;
      peak = Math.max(peak, active);
      try {
        return await runBatchJobWithRetry({
          maxAttempts: 4,
          backoffMs: [0, 0, 0],
          wait: async () => {},
          runAttempt: async () => {
            job.attempts += 1;
            if (Number(job.id.split('-')[1]) % 3 === 0 && job.attempts === 1) {
              throw new Error('429 transient');
            }
            return completeBatchStoryText({
              runInitial: async () => (
                Number(job.id.split('-')[1]) % 2 === 0
                  ? '初'.repeat(14200)
                  : '完'.repeat(20500)
              ),
              continueStory: async ({ text }) => {
                job.continuationCalls += 1;
                return `${text}${'続'.repeat(7000)}`;
              },
            });
          },
        });
      } catch (error) {
        markedFailed.push(job.id);
        throw error;
      } finally {
        active -= 1;
      }
    },
  });
  assert.equal(peak, 2);
  assert.equal(result.completed, 10);
  assert.equal(result.failed, 0);
  assert.deepEqual(markedFailed, []);
  assert.equal(jobs.filter(job => job.continuationCalls > 0).length, 5);
  assert.equal(jobs.filter(job => job.attempts === 2).length, 3);
  assert.ok(jobs.every(job => countBatchCharacters(job.result) >= 20000));
});

console.log('batchStoryRuntime tests passed');

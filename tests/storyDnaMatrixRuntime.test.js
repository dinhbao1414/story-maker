import test from 'node:test';
import assert from 'node:assert/strict';

import { createChannelFormula } from '../src/channelFormula.js';
import {
  buildStoryDnaMatrixPrompt,
  generateStoryDnaMatrix,
  parseStoryDnaMatrixResponse,
} from '../src/storyDnaMatrixRuntime.js';

const formula = createChannelFormula({
  id: 'formula-dna',
  name: 'Daily Scat – Drama gia đình Nhật',
  reproductionPrompt: 'Japanese family drama rules',
  analysis: {
    storyArchitecture: {
      canonicalBeatMap: [
        { progressPercent: 0, function: 'cold open' },
        { progressPercent: 50, function: 'midpoint reversal' },
      ],
    },
    audienceGrowthSystem: {
      ctrPromise: 'family injustice with a hidden proof',
      hook30s: 'controlled anger after a public accusation',
      curiosityLadder: [
        { question: 'A', answer: 'A1', nextQuestion: 'B' },
        { question: 'B', answer: 'B1', nextQuestion: 'C' },
        { question: 'C', answer: 'C1', nextQuestion: 'D' },
      ],
      retentionBeats: [
        { window: '0–30s', goal: 'stop exit', beat: 'shock' },
        { window: '30s–3m', goal: 'curiosity', beat: 'withhold cause' },
        { window: '3–8m', goal: 'retention', beat: 'first proof' },
        { window: '8–15m', goal: 'anger', beat: 'antagonist wins' },
        { window: '15–20m', goal: 'twist', beat: 'belief reverses' },
      ],
      commentPayoff: 'resolved plot with a debatable family choice',
      antiDropRules: ['answer before fatigue', 'open a larger question', 'escalate consequences'],
    },
  },
});

test('builds a JSON-only Matrix prompt with all DNA fields and diversity quotas', () => {
  const prompt = buildStoryDnaMatrixPrompt({
    formula,
    targetCount: 40,
  });
  assert.match(prompt, /JSON/i);
  assert.match(prompt, /titlePromise/);
  assert.match(prompt, /midpointTwist/);
  assert.match(prompt, /villainConsequence/);
  assert.match(prompt, /moralDilemma/);
  assert.match(prompt, /40/);
  assert.match(prompt, /8.*12|6.*5/);
  assert.match(prompt, /exact quote|raw source|copy/i);
  assert.match(prompt, /Japanese family drama rules/);
  assert.match(prompt, /controlled anger/);
  assert.match(prompt, /canonicalBeatMap/);
  assert.match(prompt, /audienceGrowthSystem/);
  assert.match(prompt, /\{"rows":\[/u);
});

test('parses a fenced JSON array and reports malformed rows', () => {
  const result = parseStoryDnaMatrixResponse(
    '```json\n[{"id":"story-001","hook":"hook","location":"place","evidence":"evidence","midpointTwist":"twist"},{"id":3}]\n```',
    { formulaId: 'formula-dna', targetCount: 2 },
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].formulaId, 'formula-dna');
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /row/i);
});

test('parses wrapped or explanatory AI responses without requiring a bare top-level array', () => {
  const wrapped = parseStoryDnaMatrixResponse(
    'Kết quả:\n```json\n{"storyCards":[{"id":"story-001","hook":"hook","location":"place","evidence":"evidence","midpointTwist":"twist"}]}\n```',
    { formulaId: 'formula-dna', targetCount: 1 },
  );
  assert.equal(wrapped.rows.length, 1);
  assert.equal(wrapped.errors.length, 0);
});

test('parses a single card object, keyed card objects, and snake_case DNA fields', () => {
  const single = parseStoryDnaMatrixResponse(JSON.stringify({
    id: 'single-card',
    opening_hook: 'single hook',
    setting: 'single place',
    proof: 'single proof',
    midpoint_twist: 'single twist',
  }), { formulaId: 'formula-dna', targetCount: 1 });
  assert.equal(single.rows.length, 1);
  assert.equal(single.rows[0].hook, 'single hook');
  assert.equal(single.rows[0].location, 'single place');
  assert.equal(single.rows[0].evidence, 'single proof');
  assert.equal(single.rows[0].midpointTwist, 'single twist');

  const keyed = parseStoryDnaMatrixResponse(JSON.stringify({
    story_001: {
      hook: 'keyed hook 1',
      location: 'keyed place 1',
      evidence: 'keyed proof 1',
      midpointTwist: 'keyed twist 1',
    },
    story_002: {
      hook: 'keyed hook 2',
      location: 'keyed place 2',
      evidence: 'keyed proof 2',
      midpointTwist: 'keyed twist 2',
    },
  }), { formulaId: 'formula-dna', targetCount: 2 });
  assert.equal(keyed.rows.length, 2);
});

test('requests large AI Matrices in bounded five-card batches', async () => {
  const requestedCounts = [];
  let nextIndex = 1;
  const result = await generateStoryDnaMatrix({
    formula,
    targetCount: 25,
    callStructuredAi: async prompt => {
      const requested = Number(prompt.match(/作成数:\s*(\d+)/u)?.[1] || 0);
      requestedCounts.push(requested);
      const rows = Array.from({ length: requested }, () => {
        const index = nextIndex;
        nextIndex += 1;
        return {
          id: `story-${String(index).padStart(3, '0')}`,
          hook: `unique hook ${index}`,
          location: `unique location ${index}`,
          evidence: `unique evidence ${index}`,
          midpointTwist: `unique midpoint ${index}`,
        };
      });
      return JSON.stringify(rows);
    },
  });
  assert.deepEqual(requestedCounts, [5, 5, 5, 5, 5]);
  assert.equal(result.rows.length, 25);
  assert.equal(result.usedFallback, false);
  assert.deepEqual(result.errors, []);
});

test('assigns globally unique sequential IDs when every five-card AI batch restarts IDs', async () => {
  let batch = 0;
  const result = await generateStoryDnaMatrix({
    formula,
    targetCount: 30,
    callStructuredAi: async prompt => {
      const requested = Number(prompt.match(/作成数:\s*(\d+)/u)?.[1] || 0);
      const batchNumber = batch;
      batch += 1;
      return JSON.stringify({
        rows: Array.from({ length: requested }, (_, index) => ({
          id: `story-${String(index + 1).padStart(3, '0')}`,
          hook: `batch ${batchNumber} hook ${index}`,
          location: `batch ${batchNumber} location ${index}`,
          evidence: `batch ${batchNumber} evidence ${index}`,
          midpointTwist: `batch ${batchNumber} midpoint ${index}`,
        })),
      });
    },
  });
  assert.equal(batch, 6);
  assert.deepEqual(
    result.rows.map(row => row.id),
    Array.from({ length: 30 }, (_, index) => `story-${String(index + 1).padStart(3, '0')}`),
  );
  assert.equal(new Set(result.rows.map(row => row.id)).size, 30);
});

test('repairs an invalid Matrix JSON response instead of using local fallback', async () => {
  const prompts = [];
  const result = await generateStoryDnaMatrix({
    formula,
    targetCount: 2,
    callStructuredAi: async prompt => {
      prompts.push(prompt);
      if (prompts.length === 1) return 'not a JSON array';
      return JSON.stringify({
        rows: [
          { id: 'story-001', hook: 'hook 1', location: 'place 1', evidence: 'evidence 1', midpointTwist: 'twist 1' },
          { id: 'story-002', hook: 'hook 2', location: 'place 2', evidence: 'evidence 2', midpointTwist: 'twist 2' },
        ],
      });
    },
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /前回の回答は無効|invalid/iu);
  assert.match(prompts[1], /not a JSON array/);
  assert.equal(result.rows.length, 2);
  assert.equal(result.usedFallback, false);
});

test('generates a Matrix, removes duplicate rows, and supplements only missing rows', async () => {
  const calls = [];
  const responses = [
    JSON.stringify([
      { id: 'story-001', hook: 'same hook', location: 'place 1', evidence: 'evidence 1', midpointTwist: 'twist 1' },
      { id: 'story-002', hook: 'same hook', location: 'place 1', evidence: 'evidence 1', midpointTwist: 'twist 1' },
    ]),
    JSON.stringify([
      { id: 'story-003', hook: 'new hook', location: 'place 2', evidence: 'evidence 2', midpointTwist: 'twist 2' },
    ]),
  ];
  const result = await generateStoryDnaMatrix({
    formula,
    targetCount: 2,
    callStructuredAi: async prompt => {
      calls.push(prompt);
      return responses[calls.length - 1];
    },
  });
  assert.equal(result.rows.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(result.usedFallback, false);
  assert.equal(new Set(result.rows.map(row => row.id)).size, 2);
});

test('fails without saving local fallback when structured AI is unavailable', async () => {
  let calls = 0;
  await assert.rejects(
    () => generateStoryDnaMatrix({
      formula,
      targetCount: 4,
      callStructuredAi: async () => {
        calls += 1;
        throw new Error('429');
      },
    }),
    /429.*Không có fallback local|Không có fallback local.*429/u,
  );
  assert.equal(calls, 3);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { createChannelFormula } from '../src/channelFormula.js';
import {
  buildFallbackStoryDnaRows,
  buildStoryDnaMatrixPrompt,
  generateStoryDnaMatrix,
  parseStoryDnaMatrixResponse,
} from '../src/storyDnaMatrixRuntime.js';

const formula = createChannelFormula({
  id: 'formula-dna',
  name: 'Daily Scat – Drama gia đình Nhật',
  reproductionPrompt: 'Japanese family drama rules',
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

test('fallback rows have bounded unique hook/evidence/twist combinations', () => {
  const rows = buildFallbackStoryDnaRows(formula, 6, { random: () => 0 });
  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map(row => `${row.hook}|${row.evidence}|${row.midpointTwist}`)).size, 6);
  assert.equal(rows.every(row => row.formulaId === formula.id), true);
  assert.equal(JSON.stringify(rows).includes('rawSourceText'), false);
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
    random: () => 0,
  });
  assert.equal(result.rows.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(result.usedFallback, false);
  assert.equal(new Set(result.rows.map(row => row.id)).size, 2);
});

test('uses fallback rows when structured AI is unavailable', async () => {
  const result = await generateStoryDnaMatrix({
    formula,
    targetCount: 4,
    callStructuredAi: async () => { throw new Error('429'); },
    random: () => 0,
  });
  assert.equal(result.usedFallback, true);
  assert.equal(result.rows.length, 4);
});

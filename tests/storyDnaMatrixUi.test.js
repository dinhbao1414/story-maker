import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  renderStoryDnaMatrixPanel,
} from '../src/storyDnaMatrixRuntime.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('formula workspace includes Story DNA Matrix controls', () => {
  assert.match(html, /id="cf-matrix-count"/);
  assert.match(html, /id="cf-matrix-create"/);
  assert.match(html, /id="cf-matrix-select"/);
  assert.match(html, /id="cf-matrix-table"/);
});

test('renders Matrix summary, row status, novelty score, and row actions', () => {
  const output = renderStoryDnaMatrixPanel({
    id: 'matrix-1',
    targetCount: 30,
    rows: [{
      id: 'story-001',
      status: 'planned',
      hook: 'hook',
      evidence: 'evidence',
      midpointTwist: 'midpoint',
      noveltyFingerprint: 'fnv1a-test',
    }],
  });
  assert.match(output, /matrix-1/);
  assert.match(output, /story-001/);
  assert.match(output, /planned/i);
  assert.match(output, /fnv1a-test/);
  assert.match(output, /lock|skip|regenerate|export/i);
});

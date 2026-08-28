import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  renderStoryDnaMatrixPanel,
} from '../src/storyDnaMatrixRuntime.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('formula workspace includes Story DNA Matrix controls', () => {
  assert.match(html, /id="cf-matrix-count"/);
  assert.match(html, /<option value="30">30 story<\/option>/);
  assert.match(html, /<option value="40">40 story<\/option>/);
  assert.match(html, /<option value="50">50 story<\/option>/);
  assert.match(html, /id="cf-matrix-create"/);
  assert.match(html, /id="cf-matrix-select"/);
  assert.match(html, /id="cf-matrix-table"/);
});

test('places the series-size selector before the preview so it is visible in the formula workflow', () => {
  const matrixPosition = html.indexOf('id="cf-matrix-root"');
  const previewPosition = html.indexOf('id="cf-preview"');
  assert.ok(matrixPosition >= 0);
  assert.ok(previewPosition >= 0);
  assert.ok(matrixPosition < previewPosition);
  assert.match(html, /Số story cho series/u);
});

test('places the AI motif button inside Matrix and hides it until Matrix is ready', () => {
  const matrixPosition = html.indexOf('id="cf-matrix-root"');
  const generatePosition = html.indexOf('id="cf-generate"');
  const tablePosition = html.indexOf('id="cf-matrix-table"');
  assert.ok(matrixPosition < generatePosition);
  assert.ok(generatePosition < tablePosition);
  assert.match(html.slice(matrixPosition, tablePosition), /class="btn-generate hidden"[^>]*id="cf-generate"/u);
});

test('formula workspace owns a vertical scroll area for long Matrix content', () => {
  const formulaRule = css.match(/\.channel-formula-panel\{[^}]+\}/u)?.[0] || '';
  assert.match(formulaRule, /min-height:0/u);
  assert.match(formulaRule, /height:100%/u);
  assert.match(formulaRule, /overflow-y:auto/u);
});

test('Matrix runtime reloads when a generated story marks a row used', () => {
  const runtime = fs.readFileSync(new URL('../src/storyDnaMatrixRuntime.js', import.meta.url), 'utf8');
  assert.match(runtime, /story-maker:matrix-updated/u);
  assert.match(runtime, /load\(\)\.catch/u);
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
  assert.match(output, /lock|skip|regenerate|export|delete|xóa/i);
});

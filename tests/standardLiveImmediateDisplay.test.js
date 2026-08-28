import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/legacyMain.js', import.meta.url), 'utf8');

test('standard live story displays the complete received target without typewriter pacing', () => {
  assert.doesNotMatch(source, /liveDisplayed/);
  assert.doesNotMatch(source, /liveTimer/);
  assert.doesNotMatch(source, /setInterval\(\(\)=>renderStandardLivePreview\(!1\),35\)/);
  assert.match(source, /a\.textContent=liveTarget/);
  assert.match(source, /Array\.from\(liveTarget\)\.length\.toLocaleString\(\)/);
});

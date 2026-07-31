import assert from 'node:assert/strict';
import fs from 'node:fs';

const settingsIo = fs.readFileSync(new URL('../src/generationSettingsIo.js', import.meta.url), 'utf8');
const analyzer = fs.readFileSync(new URL('../src/styleAnalyzer.js', import.meta.url), 'utf8');
const presetRuntime = fs.readFileSync(new URL('../src/stylePresetRuntime.js', import.meta.url), 'utf8');

assert.match(settingsIo, /export function captureCurrentGenerationSettings/);
assert.match(settingsIo, /typeof document !== 'undefined'/);
assert.match(analyzer, /export async function replaceStyleAnalyzerFiles/);
assert.match(analyzer, /export function startStyleAnalysis/);
assert.match(presetRuntime, /export function waitForStyleAnalysis/);
assert.equal((presetRuntime.match(/__storyMakerStylePresetFetch/g) || []).length >= 1, true);

console.log('storyProject integration API tests passed');

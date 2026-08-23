import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHANNEL_FORMULA_DEFAULT_POLICY,
  buildFileAnalysisPrompt,
  buildFormulaGenerationPrompt,
  buildFormulaSynthesisPrompt,
  buildRepresentativeSlices,
  createChannelFormula,
  sanitizeChannelFormula,
  validateChannelFormulaStory,
} from '../src/channelFormula.js';

test('creates the Japanese 20k formula defaults', () => {
  const formula = createChannelFormula({
    name: 'Daily Scat – Drama gia đình Nhật',
    sourceCount: 40,
    analysis: { tone: '家族因果応報ドラマ' },
  });

  assert.equal(formula.name, 'Daily Scat – Drama gia đình Nhật');
  assert.equal(formula.language, 'ja');
  assert.equal(formula.sourceCount, 40);
  assert.equal(formula.analysis.tone, '家族因果応報ドラマ');
  assert.deepEqual(formula.generationPolicy, CHANNEL_FORMULA_DEFAULT_POLICY);
});

test('sanitizes secrets and raw source fields recursively', () => {
  const sanitized = sanitizeChannelFormula({
    name: 'safe',
    reproductionPrompt: 'abstract rules',
    apiKey: 'remove-me',
    rawSourceText: 'remove-me',
    nested: {
      authorization: 'remove-me',
      token: 'remove-me',
      safe: 'keep-me',
    },
  });

  assert.equal('apiKey' in sanitized, false);
  assert.equal('rawSourceText' in sanitized, false);
  assert.equal('authorization' in sanitized.nested, false);
  assert.equal('token' in sanitized.nested, false);
  assert.equal(sanitized.nested.safe, 'keep-me');
});

test('builds bounded opening, middle, and ending representative slices', () => {
  const source = Array.from({ length: 200 }, (_, index) => `line-${index}-${'あ'.repeat(40)}`).join('\n');
  const slices = buildRepresentativeSlices(source, {
    openingChars: 180,
    middleChars: 180,
    endingChars: 180,
    maxTotalChars: 520,
  });

  assert.equal(slices.opening.length <= 180, true);
  assert.equal(slices.middle.length <= 180, true);
  assert.equal(slices.ending.length <= 180, true);
  assert.equal(
    slices.opening.length + slices.middle.length + slices.ending.length <= 520,
    true,
  );
  assert.match(slices.opening, /line-0/);
  assert.match(slices.ending, /line-199/);
});

test('builds structured analysis and synthesis prompts without raw-source copying instructions', () => {
  const analysisPrompt = buildFileAnalysisPrompt({
    fileName: 'story-01.txt',
    sourceCount: 40,
    stats: { chars: 40000, nonWhitespaceChars: 38000, lines: 2000 },
    slices: {
      opening: 'hook excerpt',
      middle: 'conflict excerpt',
      ending: 'ending excerpt',
    },
    markers: ['毎日スカット', 'チャンネル登録'],
  });
  assert.match(analysisPrompt, /story-01\.txt/);
  assert.match(analysisPrompt, /opening_hook/);
  assert.match(analysisPrompt, /do not reproduce|not reproduce/i);
  assert.match(analysisPrompt, /毎日スカット/);

  const synthesisPrompt = buildFormulaSynthesisPrompt({
    formulaName: 'Daily Scat – Drama gia đình Nhật',
    sourceCount: 40,
    intermediateSummaries: [
      { sourceCount: 8, recurringRules: ['first-person Japanese family drama'] },
    ],
  });
  assert.match(synthesisPrompt, /Daily Scat/);
  assert.match(synthesisPrompt, /reproductionPrompt/);
  assert.match(synthesisPrompt, /exact names|exact quotes/i);
});

test('builds a Japanese generation prompt with the 20k contract', () => {
  const prompt = buildFormulaGenerationPrompt({
    formula: {
      name: 'Daily Scat – Drama gia đình Nhật',
      language: 'ja',
      reproductionPrompt: '家族の不公平が証拠で反転し、主人公が自分の人生を取り戻す。',
      generationPolicy: CHANNEL_FORMULA_DEFAULT_POLICY,
    },
    randomizedPremise: '海外出張から早く帰った主人公が家族の隠し事を知る。',
    includeYoutubeCta: false,
  });

  assert.match(prompt, /日本語/);
  assert.match(prompt, /20,?000/);
  assert.match(prompt, /第1章|4章/);
  assert.match(prompt, /コピー|copy/i);
  assert.doesNotMatch(prompt, /毎日スカットをご覧いただきありがとうございます/);
});

test('validates the 20k minimum and complete ending', () => {
  assert.equal(validateChannelFormulaStory(`${'あ'.repeat(20000)}。`).ok, true);
  assert.equal(validateChannelFormulaStory(`${'あ'.repeat(19998)}。`).ok, false);
  assert.match(validateChannelFormulaStory(`${'あ'.repeat(20000)}`).issues.join(','), /unclosed_ending/);
  assert.match(validateChannelFormulaStory('').issues.join(','), /empty_output/);
});

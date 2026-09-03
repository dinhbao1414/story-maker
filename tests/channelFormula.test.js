import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHANNEL_FORMULA_DEFAULT_POLICY,
  buildFileAnalysisPrompt,
  buildFormulaGenerationPrompt,
  buildFormulaSynthesisPrompt,
  buildRepresentativeSegments,
  buildRepresentativeSlices,
  createChannelFormula,
  isChannelFormulaAnalysisReady,
  sanitizeChannelFormula,
  validateChannelFormulaStory,
} from '../src/channelFormula.js';
import { BUILTIN_CHANNEL_FORMULAS } from '../src/channelFormulaCatalog.js';

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

test('preserves the continuous audio narration policy', () => {
  const formula = sanitizeChannelFormula({
    name: 'continuous narration',
    generationPolicy: {
      stripChapterHeaders: true,
      flowFormat: 'continuous_audio_narration',
    },
  });

  assert.equal(formula.generationPolicy.stripChapterHeaders, true);
  assert.equal(formula.generationPolicy.flowFormat, 'continuous_audio_narration');
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

test('samples chronological segments across the whole story', () => {
  const source = Array.from({ length: 1200 }, (_, index) => `beat-${index}`).join('\n');
  const segments = buildRepresentativeSegments(source, {
    segmentCount: 12,
    charsPerSegment: 120,
    maxTotalChars: 1440,
  });
  assert.equal(segments.length, 12);
  assert.equal(segments[0].progressPercent, 0);
  assert.equal(segments.at(-1).progressPercent, 100);
  assert.match(segments[0].text, /beat-0/);
  assert.match(segments.at(-1).text, /beat-1199/);
  assert.equal(segments.reduce((sum, item) => sum + item.text.length, 0) <= 1440, true);
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
  assert.match(analysisPrompt, /audienceGrowthSystem/);
  assert.match(analysisPrompt, /ctrPromise/);
  assert.match(analysisPrompt, /hook30s/);
  assert.match(analysisPrompt, /curiosityLadder/);
  assert.match(analysisPrompt, /retentionBeats/);
  assert.match(analysisPrompt, /commentPayoff/);
  assert.match(analysisPrompt, /opening_hook/);
  assert.match(analysisPrompt, /storyBlueprint/);
  assert.match(analysisPrompt, /beatMap/);
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
  assert.match(synthesisPrompt, /audienceGrowthSystem/);
  assert.match(synthesisPrompt, /question.*answer|answer.*question/i);
  assert.match(synthesisPrompt, /formulaPatterns/);
  assert.match(synthesisPrompt, /storyArchitecture/);
  assert.match(synthesisPrompt, /exact names|exact quotes/i);
});

test('accepts only validated dynamic formulas for Matrix production', () => {
  const growth = {
    ctrPromise: 'promise',
    hook30s: 'hook',
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
    commentPayoff: 'debate',
    antiDropRules: ['a', 'b', 'c'],
  };
  const incomplete = createChannelFormula({
    name: 'fallback',
    reproductionPrompt: 'short',
    analysis: { audienceGrowthSystem: growth },
  });
  assert.equal(isChannelFormulaAnalysisReady(incomplete), false);

  const validated = createChannelFormula({
    name: 'validated',
    reproductionPrompt: '詳細な制作規則。'.repeat(100),
    analysis: { audienceGrowthSystem: growth },
    analysisQuality: { validated: true, sourceCoverage: 1 },
  });
  assert.equal(isChannelFormulaAnalysisReady(validated), true);
});

test('preserves up to 50 per-story analysis summaries in a channel formula', () => {
  const stories = Array.from({ length: 40 }, (_, index) => ({
    fileName: `story-${index + 1}.txt`,
    storyBlueprint: { beatMap: [`beat-${index + 1}`] },
  }));
  const formula = sanitizeChannelFormula({
    name: '40-story formula',
    analysisReport: { stories },
  });
  assert.equal(formula.analysisReport.stories.length, 40);
  assert.equal(formula.analysisReport.stories.at(-1).fileName, 'story-40.txt');
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
  assert.match(prompt, /30.*秒|30s/);
  assert.match(prompt, /Question A|question.*answer|質問.*答え/iu);
  assert.match(prompt, /30s-3m|3-8m|8-15m|15-20m|20-25m/);
  assert.match(prompt, /commentDilemma|道徳|議論|コメント/iu);
  assert.match(prompt, /CTA.*hook|hook.*CTA/iu);
  assert.match(prompt, /第1章|4章/);
  assert.match(prompt, /コピー|copy/i);
  assert.doesNotMatch(prompt, /毎日スカットをご覧いただきありがとうございます/);
});

test('builds a continuous audio narration prompt without visible chapter labels', () => {
  const prompt = buildFormulaGenerationPrompt({
    formula: {
      name: 'okokok',
      reproductionPrompt: '全4章の内部構造で因果応報を描く。',
      generationPolicy: {
        ...CHANNEL_FORMULA_DEFAULT_POLICY,
        stripChapterHeaders: true,
        flowFormat: 'continuous_audio_narration',
      },
    },
    randomizedPremise: '公開の場で証拠が反転する。',
  });

  assert.match(prompt, /一続き.*音声ナレーション/);
  assert.match(prompt, /第一章.*第1章.*Chapter 1.*CHAPTER 1/);
  assert.match(prompt, /翌日.*二日後の説明会当日.*それから半年後/);
  assert.match(prompt, /章番号|章立てタイトル|章見出し/);
  assert.doesNotMatch(prompt, /全4章で構成し、各章に固有/);
});

test('validates the 20k minimum and complete ending', () => {
  assert.equal(validateChannelFormulaStory(`${'あ'.repeat(20000)}。`).ok, true);
  assert.equal(validateChannelFormulaStory(`${'あ'.repeat(19998)}。`).ok, false);
  assert.match(validateChannelFormulaStory(`${'あ'.repeat(20000)}`).issues.join(','), /unclosed_ending/);
  assert.match(validateChannelFormulaStory('').issues.join(','), /empty_output/);
  assert.match(validateChannelFormulaStory(
    `第一章\n${'あ'.repeat(20000)}。`,
    { ...CHANNEL_FORMULA_DEFAULT_POLICY, stripChapterHeaders: true },
  ).issues.join(','), /chapter_headers/);
});

test('ships one sanitized built-in Daily Scat formula', () => {
  assert.equal(BUILTIN_CHANNEL_FORMULAS.length, 1);
  const formula = BUILTIN_CHANNEL_FORMULAS[0];
  assert.equal(formula.name, 'Daily Scat – Drama gia đình Nhật');
  assert.equal(formula.language, 'ja');
  assert.equal(formula.sourceCount, 40);
  assert.equal(formula.builtIn, true);
  assert.equal(formula.generationPolicy.minNonWhitespaceChars, 20000);
  assert.equal(formula.analysis.audienceGrowthSystem.ctrPromise.length > 0, true);
  assert.equal(formula.analysis.audienceGrowthSystem.hook30s.length > 0, true);
  assert.equal(formula.analysis.audienceGrowthSystem.curiosityLadder.length >= 3, true);
  assert.equal(formula.analysis.audienceGrowthSystem.retentionBeats.length >= 5, true);
  assert.equal(formula.analysis.audienceGrowthSystem.commentPayoff.length > 0, true);
  assert.equal(JSON.stringify(formula).includes('ja.auto.txt'), false);
  assert.equal(JSON.stringify(formula).includes('apiKey'), false);
});

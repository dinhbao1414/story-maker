import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChannelFormulaGenerationCaller,
  createChannelFormulaRuntimeController,
  filterChannelFormulaTextFiles,
  buildFallbackFormulaSettings,
  buildFormulaSettingsRandomizationPrompt,
  generateFormulaStory,
  normalizeRandomizedFormulaSettings,
  parseStructuredFormulaAnalysis,
  randomizeAndApplyFormulaSettings,
  setFormulaGenerationBusyUi,
} from '../src/channelFormulaRuntime.js';
import { createChannelFormula } from '../src/channelFormula.js';

function makeFile(name, text) {
  return {
    name,
    async text() {
      return text;
    },
  };
}

function createRepository() {
  const checkpoints = new Map();
  const formulas = [];
  return {
    checkpoints,
    formulas,
    async listAnalysisCheckpoints(formulaId) {
      return [...checkpoints.values()].filter(item => item.formulaId === formulaId);
    },
    async saveAnalysisCheckpoint(checkpoint) {
      checkpoints.set(`${checkpoint.formulaId}:${checkpoint.fileFingerprint}`, checkpoint);
      return checkpoint;
    },
    async saveFormula(formula) {
      formulas.push(formula);
      return formula;
    },
  };
}

test('filters directory selections to TXT files in stable filename order', () => {
  const files = filterChannelFormulaTextFiles([
    makeFile('b.txt', 'b'),
    makeFile('cover.png', 'ignore'),
    makeFile('a.TXT', 'a'),
    makeFile('notes.md', 'ignore'),
  ]);
  assert.deepEqual(files.map(file => file.name), ['a.TXT', 'b.txt']);
});

test('parses fenced or noisy structured analysis without retaining secrets', () => {
  const parsed = parseStructuredFormulaAnalysis(
    '```json\n{"tone":"quiet","apiKey":"remove","recurringRules":["rule"]}\n```',
  );
  assert.equal(parsed.tone, 'quiet');
  assert.deepEqual(parsed.recurringRules, ['rule']);
  assert.equal('apiKey' in parsed, false);
});

test('analyzes files sequentially, resumes checkpoints, and synthesizes a named formula', async () => {
  const repository = createRepository();
  const events = [];
  let active = 0;
  let maxActive = 0;
  const controller = createChannelFormulaRuntimeController({
    repository,
    now: () => new Date('2026-08-23T00:00:00.000Z'),
    callStructuredAi: async prompt => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push(prompt.includes('synthesizing') ? 'synthesis' : prompt.match(/File: ([^\n]+)/)?.[1]);
      await Promise.resolve();
      active -= 1;
      if (prompt.includes('File: bad.txt')) return 'not json';
      if (prompt.includes('synthesizing')) {
        return JSON.stringify({
          name: 'Named Formula',
          language: 'ja',
          sourceCount: 2,
          analysis: { tone: 'quiet' },
          reproductionPrompt: 'Japanese-only abstract rules',
        });
      }
      return JSON.stringify({ tone: 'family drama', recurringRules: ['rule'] });
    },
  });

  const files = [
    makeFile('bad.txt', 'bad story'),
    makeFile('good.txt', 'good story'),
    makeFile('skip.md', 'ignore'),
  ];
  const result = await controller.startAnalysis(files, { formulaName: 'Named Formula' });

  assert.equal(maxActive, 1);
  assert.deepEqual(events, ['bad.txt', 'good.txt', 'synthesis']);
  assert.equal(result.formula.name, 'Named Formula');
  assert.equal(result.formula.language, 'ja');
  assert.equal(result.errors.length, 1);
  assert.equal(repository.formulas.length, 1);
  assert.equal(JSON.stringify(result.formula).includes('apiKey'), false);

  const resumed = await controller.startAnalysis(files, { formulaName: 'Named Formula' });
  assert.equal(resumed.processedCount, 2);
  assert.equal(resumed.resumedCount, 1);
});

test('builds one randomized 20k generation request and validates the returned story', async () => {
  const formula = createChannelFormula({
    id: 'formula-1',
    name: 'Daily Scat – Drama gia đình Nhật',
    reproductionPrompt: '抽象ルール。コピー禁止。',
  });
  let request = null;
  const result = await generateFormulaStory({
    formula,
    random: () => 0,
    callGeneration: async payload => {
      request = payload;
      return `${'あ'.repeat(20000)}。`;
    },
  });
  assert.equal(result.validation.ok, true);
  assert.equal(request.chapterCount, 4);
  assert.ok(request.targetTotalNumber >= 22000);
  assert.match(request.prompt, /コピー禁止/);
  assert.doesNotMatch(request.prompt, /ご視聴ありがとうございました|チャンネル登録お願いします/);
});

test('formula longify caller supplies a non-streaming provider bridge for ledger and chapters', async () => {
  const providerCalls = [];
  const longifyCalls = [];
  const caller = createChannelFormulaGenerationCaller({
    getApiSession: () => ({ apiKey: 'test-key' }),
    getModel: () => 'test-model',
    callProvider: async (apiKey, model, prompt, options) => {
      providerCalls.push({ apiKey, model, prompt, options });
      return { text: 'seed '.repeat(80) };
    },
    runLongify: async options => {
      longifyCalls.push(options);
      return { text: `${'あ'.repeat(20000)}。` };
    },
  });
  const formula = createChannelFormula({ name: 'Formula', reproductionPrompt: 'rules' });
  await caller({
    formula,
    prompt: 'seed prompt',
    randomizedPremise: 'premise',
    targetTotalNumber: 22000,
    chapterCount: 4,
  });

  assert.equal(longifyCalls.length, 1);
  assert.equal(typeof longifyCalls[0].callText, 'function');
  const response = await longifyCalls[0].callText('ledger prompt', {
    options: { maxTokens: 1234, timeoutMs: 45000 },
  });
  assert.equal(response.text, 'seed '.repeat(80));
  assert.equal(providerCalls.length, 2);
  assert.equal(providerCalls[1].options.maxTokens, 1234);
  assert.equal(providerCalls[1].options.timeoutMs, 45000);
});

test('generation UI immediately exposes busy state and restores the action label', () => {
  const classes = new Set(['hidden']);
  const button = {
    disabled: false,
    textContent: 'Random và tạo truyện 20K',
    dataset: {},
    setAttribute(name, value) { this[name] = value; },
    classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
    },
  };
  const progress = { textContent: '' };
  const error = { classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); } } };
  const doc = {
    getElementById(id) {
      return {
        'cf-generate': button,
        'cf-progress': progress,
        'cf-error': error,
      }[id] || null;
    },
  };

  setFormulaGenerationBusyUi({ doc, busy: true });
  assert.equal(button.disabled, true);
  assert.equal(button['aria-busy'], 'true');
  assert.match(progress.textContent, /Đang tạo/);
  assert.match(button.textContent, /Đang tạo/);

  setFormulaGenerationBusyUi({ doc, busy: false });
  assert.equal(button.disabled, false);
  assert.equal(button['aria-busy'], 'false');
  assert.equal(button.textContent, 'Random và tạo truyện 20K');
});

const motifFormula = createChannelFormula({
  id: 'formula-motif-1',
  name: 'Daily Scat – Drama gia đình Nhật',
  reproductionPrompt: '抽象化された家族ドラマ。原文の固有名詞と事件は禁止。',
});

test('builds a JSON-only motif prompt without source copying', () => {
  const prompt = buildFormulaSettingsRandomizationPrompt({
    formula: motifFormula,
    randomSeed: 'seed-1',
  });
  assert.match(prompt, /JSON/i);
  assert.match(prompt, /日本語/);
  assert.match(prompt, /固有名詞|exact names/i);
  assert.match(prompt, /theme|characters|ending/i);
  assert.match(prompt, /titlePromise|thumbnailConcept/);
  assert.match(prompt, /hook30s|30.*秒/iu);
  assert.match(prompt, /questionLadder|question.*answer/iu);
  assert.match(prompt, /retentionBeats|30s-3m/iu);
  assert.match(prompt, /twist/iu);
  assert.match(prompt, /commentDilemma|道徳/iu);
});

test('normalizes motif settings and keeps the channel formula locked', () => {
  const settings = normalizeRandomizedFormulaSettings({
    theme: 'hidden inheritance',
    characters: [{ name: 'Mio', role: 'daughter' }],
    titlePromise: 'A public accusation hides a family secret',
    thumbnailConcept: 'shocked daughter beside an open envelope',
    hook30s: 'The family orders her to apologize before she can speak.',
    questionLadder: [
      { question: 'A', answer: 'A answer', nextQuestion: 'B' },
      { question: 'B', answer: 'B answer', nextQuestion: 'C' },
      { question: 'C', answer: 'C answer', nextQuestion: '' },
    ],
    retentionBeats: [{ window: '30s-3m', goal: 'curiosity', beat: 'evidence appears' }],
    twist: 'The witness changed the record.',
    commentDilemma: 'Should the truth be public if it breaks the family?',
  }, motifFormula);
  assert.equal(settings.mode, 'novel');
  assert.equal(settings.channelFormula.id, motifFormula.id);
  assert.equal(settings.locked.channelFormula, true);
  assert.equal(settings.characters[0].name, 'Mio');
  assert.match(settings.supplement, /titlePromise|CTR/iu);
  assert.match(settings.supplement, /hook30s|30.*秒/iu);
  assert.match(settings.supplement, /questionLadder|A answer/iu);
  assert.match(settings.supplement, /retentionBeats|30s-3m/iu);
  assert.match(settings.supplement, /twist/iu);
  assert.match(settings.supplement, /commentDilemma|道徳/iu);
  assert.equal(JSON.stringify(settings).includes('rawSourceText'), false);
});

test('fallback motif settings are bounded and retain the selected formula', () => {
  const settings = buildFallbackFormulaSettings(motifFormula, { random: () => 0 });
  assert.equal(settings.mode, 'novel');
  assert.equal(settings.channelFormula.name, motifFormula.name);
  assert.ok(settings.theme);
  assert.ok(settings.characters.length >= 2);
  assert.ok(settings.supplement.match(/質問/g)?.length >= 3);
  assert.match(settings.supplement, /道徳|コメント/iu);
  assert.equal(settings.locked.channelFormula, true);
});

test('randomizes settings with AI, applies them, and opens Dashboard without generating a story', async () => {
  const applied = [];
  const events = [];
  const result = await randomizeAndApplyFormulaSettings({
    formula: motifFormula,
    callStructuredAi: async () => JSON.stringify({
      theme: '記録を隠した家族会議',
      characters: [{ name: 'Mio', role: '主人公' }],
      ending: '自分の生活を選び直す',
    }),
    applySettings: async payload => applied.push(payload),
    dispatchDashboardOpen: () => events.push('dashboard'),
  });
  assert.equal(result.usedFallback, false);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].settings.channelFormula.id, motifFormula.id);
  assert.equal(applied[0].settings.theme, '記録を隠した家族会議');
  assert.deepEqual(events, ['dashboard']);
});

test('falls back to local motif settings when structured AI fails', async () => {
  const result = await randomizeAndApplyFormulaSettings({
    formula: motifFormula,
    callStructuredAi: async () => { throw new Error('429'); },
    random: () => 0,
  });
  assert.equal(result.usedFallback, true);
  assert.equal(result.settings.channelFormula.id, motifFormula.id);
  assert.ok(result.settings.characters.length >= 2);
});

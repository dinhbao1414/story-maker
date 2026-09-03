import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChannelFormulaGenerationCaller,
  createChannelFormulaRuntimeController,
  filterChannelFormulaTextFiles,
  buildFallbackFormulaSettings,
  buildFormulaSettingsRandomizationPrompt,
  generateFormulaStory,
  normalizeChannelFormulaFileAnalysis,
  normalizeRandomizedFormulaSettings,
  parseStructuredFormulaAnalysis,
  randomizeAndApplyFormulaSettings,
  setFormulaGenerationBusyUi,
  validateChannelFormulaFileAnalysis,
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

function validFileAnalysis(label = 'story') {
  return {
    analysisVersion: 2,
    file_role: `${label} role`,
    point_of_view: 'close third person',
    tone: 'family drama',
    opening_hook: `${label} opening pressure`,
    protagonist_pattern: 'patient protagonist',
    antagonist_pattern: 'status-driven antagonist',
    escalation_beats: ['pressure', 'isolation', 'proof', 'counterattack'],
    reveal_pattern: 'proof changes meaning in stages',
    justice_payoff: 'public evidence-based payoff',
    epilogue_pattern: 'concrete recovery',
    pacing_rules: ['new fact per beat', 'answer before larger question'],
    recurring_motifs: ['family status', 'paper evidence'],
    storyBlueprint: {
      beatMap: Array.from({ length: 6 }, (_, index) => ({
        progressPercent: (index + 1) * 15,
        function: `beat ${index + 1}`,
        answerDelivered: `answer ${index + 1}`,
        nextQuestion: `question ${index + 2}`,
      })),
      midpointReversal: 'the ally changes meaning',
      climaxMechanism: 'proof and choice converge',
      endingRecovery: 'new daily life',
      moralDebate: 'truth versus family stability',
    },
    audienceGrowthSystem: {
      ctrPromise: 'public injustice hides proof',
      hook30s: 'an accusation interrupts an important family event',
      curiosityLadder: Array.from({ length: 3 }, (_, index) => ({
        question: `question ${index + 1}`,
        answer: `answer ${index + 1}`,
        nextQuestion: `question ${index + 2}`,
      })),
      retentionBeats: ['30s-3m', '3-8m', '8-15m', '15-20m', '20-25m']
        .map(window => ({ window, goal: 'retain', beat: `${label} ${window}` })),
      commentPayoff: 'resolved conflict with a moral choice',
      antiDropRules: ['answer promptly', 'new evidence', 'change pressure'],
    },
    styleFingerprint: {
      sentenceRhythm: 'short pressure then reflective release',
      dialoguePattern: 'conflict through dialogue',
    },
    variationSlots: ['location', 'evidence', 'relationship'],
    confidence: 0.9,
  };
}

function validSynthesis() {
  return {
    name: 'Named Formula',
    language: 'ja',
    analysis: {
      genre: 'family drama',
      audience: 'viewers seeking justice payoff',
      pointOfView: 'close third person',
      tone: 'controlled anger and recovery',
      openingHook: 'public injustice in progress',
      protagonistPattern: 'patient protagonist gathers proof',
      antagonistPattern: 'status-driven relative',
      escalationPattern: ['pressure', 'isolation', 'proof', 'counterattack'],
      revealPattern: 'proof changes meaning in stages',
      evidenceMotifs: ['paper record', 'witness'],
      justicePayoff: 'evidence-based reversal',
      epiloguePattern: 'concrete recovery',
      narrationRules: ['Japanese only', 'show action'],
      pacingRules: ['answer before larger question'],
      forbiddenPatterns: ['copying source incidents'],
      storyArchitecture: {
        canonicalBeatMap: [
          { stage: 'hook' },
          { stage: 'first answer' },
          { stage: 'midpoint reversal' },
          { stage: 'payoff' },
        ],
        midpointRules: ['reverse belief'],
        climaxRules: ['proof plus choice'],
        endingRules: ['concrete recovery'],
      },
      formulaPatterns: {
        mandatory: ['public pressure', 'proof chain', 'complete recovery'],
        frequent: ['family status', 'temporary antagonist victory', 'witness'],
        optional: ['inheritance', 'caregiving'],
        forbidden: ['copied incidents'],
      },
      audienceGrowthSystem: {
        ctrPromise: 'injustice, secret, and reversal',
        hook30s: 'start inside an accusation',
        curiosityLadder: Array.from({ length: 3 }, (_, index) => ({
          question: `question ${index + 1}`,
          answer: `answer ${index + 1}`,
          nextQuestion: `question ${index + 2}`,
        })),
        retentionBeats: ['30s-3m', '3-8m', '8-15m', '15-20m', '20-25m']
          .map(window => ({ window, goal: 'retain', beat: `beat ${window}` })),
        commentPayoff: 'truth versus family stability',
        antiDropRules: ['answer promptly', 'new evidence', 'change pressure'],
      },
    },
    reproductionPrompt: '日本語のみで、抽象化されたチャンネルDNAを守る。'.repeat(80),
    confidence: 0.9,
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

test('recovers an incomplete or aliased story beat map from the same detailed analysis', () => {
  const input = validFileAnalysis('recovery');
  input.storyBlueprint = {
    beats: input.storyBlueprint.beatMap.slice(0, 5).map(item => ({
      progress: item.progressPercent,
      stage: item.function,
      answer: item.answerDelivered,
      question: item.nextQuestion,
    })),
    midpointReversal: 'the witness changes sides',
    climaxMechanism: 'the proof chain becomes public',
    endingRecovery: 'the protagonist establishes a new boundary',
  };

  const normalized = normalizeChannelFormulaFileAnalysis(input);
  const validation = validateChannelFormulaFileAnalysis(input);

  assert.equal(normalized.storyBlueprint.beatMap.length >= 6, true);
  assert.equal(normalized.storyBlueprint.beatMap.some(item => item.function === 'beat 1'), true);
  assert.equal(normalized.storyBlueprint.beatMap.some(item => /proof changes meaning/i.test(item.function)), true);
  assert.equal(validation.ok, true);
  assert.equal(validation.analysis.storyBlueprint.beatMap.length >= 6, true);
});

test('does not let blueprint recovery hide missing core analysis fields', () => {
  const input = validFileAnalysis('invalid');
  delete input.opening_hook;
  delete input.reveal_pattern;
  input.escalation_beats = [];
  const validation = validateChannelFormulaFileAnalysis(input);

  assert.equal(validation.ok, false);
  assert.equal(validation.issues.includes('opening_hook_missing'), true);
  assert.equal(validation.issues.includes('reveal_pattern_missing'), true);
  assert.equal(validation.issues.includes('escalation_beats_incomplete'), true);
});

test('fails closed on a file error, then resumes valid checkpoints and synthesizes', async () => {
  const repository = createRepository();
  const events = [];
  let active = 0;
  let maxActive = 0;
  let repairBadFile = false;
  const controller = createChannelFormulaRuntimeController({
    repository,
    now: () => new Date('2026-08-23T00:00:00.000Z'),
    callStructuredAi: async prompt => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push(prompt.includes('synthesizing') ? 'synthesis' : prompt.match(/File: ([^\n]+)/)?.[1]);
      await Promise.resolve();
      active -= 1;
      if (prompt.includes('File: bad.txt') && !repairBadFile) return 'not json';
      if (prompt.includes('synthesizing')) return JSON.stringify(validSynthesis());
      return JSON.stringify(validFileAnalysis(prompt.includes('bad.txt') ? 'bad' : 'good'));
    },
  });

  const files = [
    makeFile('bad.txt', 'bad story'),
    makeFile('good.txt', 'good story'),
    makeFile('skip.md', 'ignore'),
  ];
  const failed = await controller.startAnalysis(files, { formulaName: 'Named Formula' });

  assert.equal(maxActive, 1);
  assert.deepEqual(events, ['bad.txt', 'bad.txt', 'good.txt']);
  assert.equal(failed.formula, null);
  assert.equal(failed.errors.length, 1);
  assert.equal(repository.formulas.length, 0);

  repairBadFile = true;
  events.length = 0;
  const resumed = await controller.startAnalysis(files, { formulaName: 'Named Formula' });
  assert.equal(resumed.processedCount, 2);
  assert.equal(resumed.resumedCount, 1);
  assert.deepEqual(events, ['bad.txt', 'synthesis']);
  assert.equal(resumed.formula.name, 'Named Formula');
  assert.equal(resumed.formula.language, 'ja');
  assert.equal(resumed.formula.analysisQuality.validated, true);
  assert.equal(resumed.formula.analysisReport.stories.length, 2);
  assert.equal(repository.formulas.length, 1);
  assert.equal(JSON.stringify(resumed.formula).includes('apiKey'), false);
});

test('accepts and checkpoints a five-beat AI response after deterministic blueprint recovery', async () => {
  const repository = createRepository();
  let fileCalls = 0;
  const controller = createChannelFormulaRuntimeController({
    repository,
    now: () => new Date('2026-08-31T00:00:00.000Z'),
    callStructuredAi: async prompt => {
      if (prompt.includes('synthesizing')) return JSON.stringify(validSynthesis());
      fileCalls += 1;
      const analysis = validFileAnalysis('five-beat');
      analysis.storyBlueprint.beatMap = analysis.storyBlueprint.beatMap.slice(0, 5);
      return JSON.stringify(analysis);
    },
  });

  const result = await controller.startAnalysis(
    [makeFile('5WRRhDm1y4E.txt', 'source story')],
    { formulaName: 'Recovered Formula' },
  );

  assert.equal(fileCalls, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.formula.analysisQuality.validated, true);
  const checkpoint = [...repository.checkpoints.values()][0];
  assert.equal(checkpoint.status, 'complete');
  assert.equal(checkpoint.analysis.storyBlueprint.beatMap.length >= 6, true);
});

test('preserves complete source coverage for a 40-story channel formula', async () => {
  const repository = createRepository();
  let synthesisCalls = 0;
  let synthesisPrompt = '';
  const controller = createChannelFormulaRuntimeController({
    repository,
    now: () => new Date('2026-08-30T00:00:00.000Z'),
    callStructuredAi: async prompt => {
      if (prompt.includes('synthesizing')) {
        synthesisCalls += 1;
        synthesisPrompt = prompt;
        return JSON.stringify(validSynthesis());
      }
      const fileName = prompt.match(/File: ([^\n]+)/)?.[1] || 'story';
      return JSON.stringify(validFileAnalysis(fileName));
    },
  });
  const files = Array.from(
    { length: 40 },
    (_, index) => makeFile(`story-${String(index + 1).padStart(2, '0')}.txt`, `story body ${index + 1}`),
  );

  const result = await controller.startAnalysis(files, { formulaName: 'Forty Story Formula' });

  assert.equal(synthesisCalls, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.formula.analysisQuality.expectedSourceCount, 40);
  assert.equal(result.formula.analysisQuality.completedSourceCount, 40);
  assert.equal(result.formula.analysisReport.sourceCoverage.completed, 40);
  assert.equal(result.formula.analysisReport.stories.length, 40);
  assert.match(synthesisPrompt, /story-40\.txt/);
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

function makeMatrixRow(id, token) {
  return {
    id,
    formulaId: motifFormula.id,
    status: 'planned',
    titlePromise: `promise ${token}`,
    hook: `hook ${token}`,
    victim: `victim ${token}`,
    antagonist: `antagonist ${token}`,
    falseAccusation: `accusation ${token}`,
    location: `location ${token}`,
    evidence: `evidence ${token}`,
    secret: `secret ${token}`,
    midpointTwist: `midpoint ${token}`,
    finalTwist: `final ${token}`,
    villainConsequence: `consequence ${token}`,
    ending: `ending ${token}`,
    moralDilemma: `dilemma ${token}`,
  };
}

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
  assert.equal(settings.channelFormula.id, motifFormula.id);
  assert.equal(settings.locked.channelFormula, true);
  assert.equal(settings.characters[0].name, 'Mio');
  assert.match(settings.supplement, /titlePromise|CTR/iu);
  assert.match(settings.supplement, /hook30s|30.*秒/iu);
  assert.match(settings.supplement, /questionLadder|A answer/iu);
  assert.match(settings.supplement, /retentionBeats|30s-3m/iu);
  assert.match(settings.supplement, /twist/iu);
  assert.match(settings.supplement, /commentDilemma|道徳/iu);
  assert.equal(settings.mode, 'long_10000');
  assert.equal(settings.modeCustom, '長編（10000字～）');
  assert.equal(JSON.stringify(settings).includes('rawSourceText'), false);
});

test('adds the continuous audio narration contract to Dashboard settings', () => {
  const formula = createChannelFormula({
    id: 'formula-continuous-1',
    name: 'okokok',
    reproductionPrompt: '全4章の内部構造で因果応報を描く。',
    generationPolicy: {
      stripChapterHeaders: true,
      flowFormat: 'continuous_audio_narration',
    },
  });
  const settings = normalizeRandomizedFormulaSettings({
    theme: 'public evidence reversal',
  }, formula);

  assert.equal(settings.channelFormula.generationPolicy.stripChapterHeaders, true);
  assert.equal(settings.channelFormula.generationPolicy.flowFormat, 'continuous_audio_narration');
  assert.match(settings.supplement, /一続き.*音声ナレーション/);
  assert.match(settings.supplement, /第一章.*第1章.*Chapter 1.*CHAPTER 1/);
  assert.match(settings.supplement, /翌日.*二日後の説明会当日.*それから半年後/);
});

test('fallback motif settings are bounded and retain the selected formula', () => {
  const settings = buildFallbackFormulaSettings(motifFormula, { random: () => 0 });
  assert.equal(settings.mode, 'long_10000');
  assert.equal(settings.modeCustom, '長編（10000字～）');
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

test('random settings selects an unused safe Matrix row and carries its DNA metadata', async () => {
  const applied = [];
  const matrix = {
    id: 'matrix-1',
    formulaId: motifFormula.id,
    rows: [
      {
        id: 'story-used',
        formulaId: motifFormula.id,
        status: 'used',
        titlePromise: 'old promise',
        hook: 'old hook',
        victim: 'old victim',
        antagonist: 'old antagonist',
        falseAccusation: 'old accusation',
        location: 'old location',
        evidence: 'old evidence',
        secret: 'old secret',
        midpointTwist: 'old midpoint',
        finalTwist: 'old final',
        villainConsequence: 'old consequence',
        ending: 'old ending',
        moralDilemma: 'old dilemma',
      },
      {
        id: 'story-safe',
        formulaId: motifFormula.id,
        status: 'planned',
        titlePromise: 'A public accusation hides a railway secret',
        hook: 'A daughter is ordered to apologize before a train arrives.',
        victim: 'an exhausted daughter',
        antagonist: 'a respected station manager',
        falseAccusation: 'a missing donation box',
        location: 'a remote railway station',
        evidence: 'a station camera file',
        secret: 'the timetable was changed',
        midpointTwist: 'the witness protected a stranger',
        finalTwist: 'the stranger was the true victim',
        villainConsequence: 'the manager loses public authority',
        ending: 'the daughter opens a new community office',
        moralDilemma: 'Should the truth be public if it closes the station?',
      },
    ],
  };
  const result = await randomizeAndApplyFormulaSettings({
    formula: motifFormula,
    matrix,
    callStructuredAi: async () => JSON.stringify({
      titlePromise: 'should not replace Matrix row',
    }),
    applySettings: async payload => applied.push(payload),
  });
  assert.equal(result.usedFallback, false);
  assert.equal(result.matrixRow.id, 'story-safe');
  assert.equal(result.settings.matrixId, 'matrix-1');
  assert.equal(result.settings.matrixRowId, 'story-safe');
  assert.equal(result.settings.storyDna.id, 'story-safe');
  assert.equal(applied[0].settings.matrixRowId, 'story-safe');
  assert.match(applied[0].settings.supplement, /railway|station camera|midpoint/iu);
});

test('repeated Matrix randomization avoids the previous preview without consuming it', async () => {
  const lastMatrixSelections = new Map();
  const matrix = {
    id: 'matrix-random',
    formulaId: motifFormula.id,
    rows: [
      makeMatrixRow('story-a', 'alpha'),
      makeMatrixRow('story-b', 'bravo'),
    ],
  };
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const first = await randomizeAndApplyFormulaSettings({
      formula: motifFormula,
      matrix,
      random: () => 0,
      lastMatrixSelections,
    });
    const second = await randomizeAndApplyFormulaSettings({
      formula: motifFormula,
      matrix,
      random: () => 0,
      lastMatrixSelections,
    });
    assert.equal(first.matrixRow.id, 'story-a');
    assert.equal(second.matrixRow.id, 'story-b');
    assert.equal(matrix.rows.every(row => row.status === 'planned'), true);
  } finally {
    Math.random = originalRandom;
  }
});

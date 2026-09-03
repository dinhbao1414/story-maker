export const CHANNEL_FORMULA_SCHEMA = 'story-maker-channel-formula-v1';
export const CHANNEL_FORMULA_ANALYSIS_VERSION = 2;

export const CHANNEL_FORMULA_DEFAULT_POLICY = Object.freeze({
  minNonWhitespaceChars: 20000,
  targetNonWhitespaceChars: 22000,
  chapterCount: 4,
  stripChapterHeaders: false,
  flowFormat: 'chaptered',
  requireCompleteEnding: true,
  randomizeTheme: true,
  randomizeCharacters: true,
  includeYoutubeCtaByDefault: false,
});

const SECRET_KEY_PATTERN = /(?:api.?key|authorization|token|secret)/i;
const RAW_SOURCE_KEY_PATTERN = /(?:raw.?source|source.?text|full.?text|source.?content)/i;
const MAX_ANALYSIS_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

function cleanText(value, maxLength = 12000) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function nonWhitespaceLength(value) {
  return Array.from(String(value || '').replace(/\s/gu, '')).length;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sanitizeValue(value, depth = 0) {
  if (depth > MAX_ANALYSIS_DEPTH || value == null) return value == null ? null : undefined;
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => sanitizeValue(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY_PATTERN.test(key) && !RAW_SOURCE_KEY_PATTERN.test(key))
      .map(([key, item]) => [key, sanitizeValue(item, depth + 1)])
      .filter(([, item]) => item !== undefined),
  );
}

function normalizePolicy(policy = {}) {
  return Object.freeze({
    ...CHANNEL_FORMULA_DEFAULT_POLICY,
    minNonWhitespaceChars: Math.max(
      20000,
      Number(policy.minNonWhitespaceChars || CHANNEL_FORMULA_DEFAULT_POLICY.minNonWhitespaceChars),
    ),
    targetNonWhitespaceChars: Math.max(
      22000,
      Number(policy.targetNonWhitespaceChars || CHANNEL_FORMULA_DEFAULT_POLICY.targetNonWhitespaceChars),
    ),
    chapterCount: Math.max(
      4,
      Math.min(10, Math.floor(Number(policy.chapterCount || CHANNEL_FORMULA_DEFAULT_POLICY.chapterCount))),
    ),
    stripChapterHeaders: policy.stripChapterHeaders === true,
    flowFormat: policy.flowFormat === 'continuous_audio_narration'
      ? 'continuous_audio_narration'
      : CHANNEL_FORMULA_DEFAULT_POLICY.flowFormat,
    requireCompleteEnding: policy.requireCompleteEnding !== false,
    randomizeTheme: policy.randomizeTheme !== false,
    randomizeCharacters: policy.randomizeCharacters !== false,
    includeYoutubeCtaByDefault: policy.includeYoutubeCtaByDefault === true,
  });
}

function normalizeAudienceGrowthSystem(value = {}) {
  const source = sanitizeValue(value) || {};
  const normalizeTextList = (items, maxItems = 8, maxLength = 500) => (
    Array.isArray(items)
      ? items.slice(0, maxItems).map(item => cleanText(item, maxLength)).filter(Boolean)
      : []
  );
  const curiosityLadder = Array.isArray(source.curiosityLadder)
    ? source.curiosityLadder.slice(0, 5).map(item => ({
      question: cleanText(item?.question, 600),
      answer: cleanText(item?.answer, 900),
      nextQuestion: cleanText(item?.nextQuestion, 600),
    })).filter(item => item.question || item.answer || item.nextQuestion)
    : [];
  const retentionBeats = Array.isArray(source.retentionBeats)
    ? source.retentionBeats.slice(0, 5).map(item => ({
      window: cleanText(item?.window, 80),
      goal: cleanText(item?.goal, 500),
      beat: cleanText(item?.beat, 900),
    })).filter(item => item.window || item.goal || item.beat)
    : [];
  return {
    ctrPromise: cleanText(source.ctrPromise, 1200),
    hook30s: cleanText(source.hook30s, 1200),
    curiosityLadder,
    retentionBeats,
    commentPayoff: cleanText(source.commentPayoff, 1200),
    antiDropRules: normalizeTextList(source.antiDropRules, 8, 500),
  };
}

export function sanitizeChannelFormula(value = {}) {
  const sanitized = sanitizeValue(value) || {};
  const policy = normalizePolicy(sanitized.generationPolicy || {});
  const analysis = sanitizeValue(sanitized.analysis || {}) || {};
  const audienceGrowthSystem = normalizeAudienceGrowthSystem(
    sanitized.audienceGrowthSystem || analysis.audienceGrowthSystem,
  );
  return {
    ...sanitized,
    schema: CHANNEL_FORMULA_SCHEMA,
    id: cleanText(sanitized.id, 160),
    name: cleanText(sanitized.name, 120) || 'Channel Formula',
    language: 'ja',
    sourceCount: Math.max(0, Math.floor(Number(sanitized.sourceCount || 0))),
    sourceFingerprint: cleanText(sanitized.sourceFingerprint, 160),
    analysis: { ...analysis, audienceGrowthSystem },
    reproductionPrompt: cleanText(sanitized.reproductionPrompt, 12000),
    generationPolicy: policy,
    createdAt: cleanText(sanitized.createdAt, 80),
    updatedAt: cleanText(sanitized.updatedAt, 80),
  };
}

export function isChannelFormulaAnalysisReady(value = {}) {
  const formula = sanitizeChannelFormula(value);
  const growth = formula.analysis?.audienceGrowthSystem || {};
  const hasGrowthSystem = Boolean(
    growth.ctrPromise
    && growth.hook30s
    && growth.commentPayoff
    && Array.isArray(growth.curiosityLadder)
    && growth.curiosityLadder.length >= 3
    && Array.isArray(growth.retentionBeats)
    && growth.retentionBeats.length >= 5
  );
  if (formula.builtIn) return hasGrowthSystem;
  return Boolean(
    formula.analysisQuality?.validated === true
    && Number(formula.analysisQuality?.sourceCoverage || 0) >= 1
    && hasGrowthSystem
    && cleanText(formula.reproductionPrompt, 12000).replace(/\s/gu, '').length >= 600
  );
}

export function createChannelFormula(input = {}, { now = new Date(), makeId } = {}) {
  const timestamp = now instanceof Date ? now.toISOString() : new Date().toISOString();
  const name = cleanText(input.name, 120) || 'Channel Formula';
  const formula = sanitizeChannelFormula({
    ...input,
    id: cleanText(input.id, 160) || (makeId ? makeId() : `${Date.now()}-${stableHash(name)}`),
    name,
    language: 'ja',
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  });
  return formula;
}

export function fingerprintSource(text) {
  return stableHash(cleanText(text, 1000000));
}

export function buildRepresentativeSlices(
  text,
  {
    openingChars = 3600,
    middleChars = 3600,
    endingChars = 3600,
    maxTotalChars = 10000,
  } = {},
) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  const totalBudget = Math.max(3, Math.floor(Number(maxTotalChars) || 10000));
  const requested = [openingChars, middleChars, endingChars].map(value => Math.max(1, Math.floor(Number(value) || 1)));
  const scale = Math.min(1, totalBudget / requested.reduce((sum, value) => sum + value, 0));
  const lengths = requested.map(value => Math.max(1, Math.floor(value * scale)));
  const middleStart = Math.max(0, Math.floor((source.length - lengths[1]) / 2));
  return {
    opening: source.slice(0, lengths[0]),
    middle: source.slice(middleStart, middleStart + lengths[1]),
    ending: source.slice(Math.max(0, source.length - lengths[2])),
  };
}

export function buildRepresentativeSegments(
  value,
  {
    segmentCount = 12,
    charsPerSegment = 2500,
    maxTotalChars = 30000,
  } = {},
) {
  const source = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const count = Math.max(3, Math.min(12, Math.floor(Number(segmentCount) || 12)));
  const totalBudget = Math.max(count, Math.min(
    source.length,
    Math.floor(Number(maxTotalChars) || 30000),
  ));
  const length = Math.max(1, Math.min(
    Math.floor(Number(charsPerSegment) || 2500),
    Math.floor(totalBudget / count),
  ));
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);
    const start = Math.max(0, Math.min(
      source.length - length,
      Math.floor((source.length - length) * progress),
    ));
    return {
      index: index + 1,
      progressPercent: Math.round(progress * 100),
      start,
      text: source.slice(start, start + length),
    };
  });
}

function stringifyForPrompt(value) {
  return JSON.stringify(value, null, 2);
}

export function buildFileAnalysisPrompt({
  fileName = '',
  sourceCount = 0,
  stats = {},
  slices = {},
  segments = [],
  markers = [],
} = {}) {
  const structuralSegments = Array.isArray(segments) && segments.length
    ? segments.slice(0, 12).map(segment => ({
      segment: Number(segment.index || 0),
      progressPercent: Number(segment.progressPercent || 0),
      text: cleanText(segment.text, 3000),
    }))
    : [
      { segment: 1, progressPercent: 0, text: cleanText(slices.opening, 3600) },
      { segment: 2, progressPercent: 50, text: cleanText(slices.middle, 3600) },
      { segment: 3, progressPercent: 100, text: cleanText(slices.ending, 3600) },
    ];
  return [
    'You are analyzing one Japanese YouTube story transcript as part of a channel-formula study.',
    `Analysis contract version: ${CHANNEL_FORMULA_ANALYSIS_VERSION}.`,
    'Return JSON only. Analyze abstract construction, story engineering, and audience-retention mechanics, not wording.',
    'Do not reproduce source prose, exact names, exact quotes, or unique plot details.',
    `File: ${cleanText(fileName, 240)}`,
    `Source set size: ${Math.max(0, Number(sourceCount) || 0)}`,
    'Statistics:',
    stringifyForPrompt({
      chars: Number(stats.chars || 0),
      nonWhitespaceChars: Number(stats.nonWhitespaceChars || 0),
      lines: Number(stats.lines || 0),
    }),
    'Detected channel markers:',
    stringifyForPrompt(Array.isArray(markers) ? markers.slice(0, 20) : []),
    'Chronological structural segments sampled across the complete transcript:',
    stringifyForPrompt(structuralSegments),
    'Reconstruct the progression across all supplied segments. Do not treat only the opening segment as representative of the whole story.',
    'Return this JSON shape:',
    stringifyForPrompt({
      analysisVersion: CHANNEL_FORMULA_ANALYSIS_VERSION,
      file_role: 'one-sentence abstract role',
      language: 'ja',
      point_of_view: 'abstract narrator pattern',
      tone: 'abstract tone',
      opening_hook: 'opening tension pattern',
      protagonist_pattern: 'abstract protagonist pattern',
      antagonist_pattern: 'abstract opposing pattern',
      escalation_beats: ['beat 1', 'beat 2', 'beat 3'],
      reveal_pattern: 'abstract reveal/evidence pattern',
      justice_payoff: 'abstract payoff pattern',
      epilogue_pattern: 'abstract recovery pattern',
      pacing_rules: ['rule 1', 'rule 2'],
      recurring_motifs: ['motif 1'],
      character_system: {
        victimRole: 'abstract victim role',
        antagonistRole: 'abstract antagonist role',
        allyRole: 'abstract ally role',
        relationshipPressure: 'how status or family ties create pressure',
      },
      evidence_system: {
        firstClue: 'function of first clue',
        proofChain: ['proof stage 1', 'proof stage 2', 'proof stage 3'],
        revealTiming: 'when proof changes meaning',
        payoffUse: 'how proof enables the counterattack',
      },
      storyBlueprint: {
        hookMechanism: 'what prevents exit in the first 30 seconds',
        incitingIncident: 'irreversible event',
        beatMap: [
          {
            progressPercent: 10,
            function: 'story function',
            answerDelivered: 'question answered here',
            nextQuestion: 'larger question opened here',
            emotionalEffect: 'viewer emotion',
          },
        ],
        midpointReversal: 'belief or relationship reversed near the midpoint',
        climaxMechanism: 'how evidence, choice, and public pressure converge',
        consequenceChain: ['consequence 1', 'consequence 2'],
        endingRecovery: 'concrete recovery and final state',
        moralDebate: 'resolved plot with a debatable choice',
      },
      forbidden_copying: ['exact names', 'exact quotes', 'unique plot details'],
      audienceGrowthSystem: {
        ctrPromise: 'abstract title and thumbnail promise',
        hook30s: 'shock scene or dialogue that starts immediately',
        curiosityLadder: [
          { question: 'question A', answer: 'answer A', nextQuestion: 'larger question B' },
        ],
        retentionBeats: [
          { window: '30s-3m', goal: 'curiosity', beat: 'new concrete pressure' },
        ],
        commentPayoff: 'resolved conflict with a debatable moral choice',
        antiDropRules: ['answer active questions promptly'],
      },
      styleFingerprint: {
        sentenceRhythm: 'abstract rhythm',
        dialoguePattern: 'how dialogue carries conflict',
        expositionPattern: 'how context is revealed without stopping the story',
        emotionalCadence: 'anger, relief, reversal, and recovery cadence',
        transitionPattern: 'how scenes hand off unresolved pressure',
      },
      variationSlots: ['elements that can change without breaking the channel DNA'],
      coverageNotes: ['uncertainty caused by sampled transcript regions'],
      confidence: 0.0,
    }),
    'storyBlueprint.beatMap must contain 6 to 10 chronological beat objects spanning hook, escalation, midpoint, evidence reveal, climax/payoff, and concrete ending.',
  ].join('\n\n');
}

export function buildFormulaSynthesisPrompt({
  formulaName = '',
  sourceCount = 0,
  intermediateSummaries = [],
} = {}) {
  const summaries = Array.isArray(intermediateSummaries)
    ? intermediateSummaries.slice(0, 50).map(summary => sanitizeValue(summary) || {})
    : [];
  return [
    'You are synthesizing a reusable Japanese YouTube channel formula from abstract file analyses.',
    'Return JSON only. Never copy source prose, exact names, exact quotes, or one-off plot incidents.',
    `Formula name: ${cleanText(formulaName, 120)}`,
    `Analyzed source count: ${Math.max(0, Number(sourceCount) || 0)}`,
    'Intermediate summaries:',
    stringifyForPrompt(summaries),
    'Return a canonical formula with these keys:',
    stringifyForPrompt({
      name: formulaName,
      language: 'ja',
      analysis: {
        genre: '',
        audience: '',
        pointOfView: '',
        tone: '',
        openingHook: '',
        protagonistPattern: '',
        antagonistPattern: '',
        escalationPattern: [],
        revealPattern: '',
        evidenceMotifs: [],
        justicePayoff: '',
        epiloguePattern: '',
        narrationRules: [],
        pacingRules: [],
        forbiddenPatterns: [],
        characterSystem: {
          victimRoles: [],
          antagonistRoles: [],
          allyRoles: [],
          relationshipPressureRules: [],
        },
        evidenceSystem: {
          evidenceFamilies: [],
          proofChainRules: [],
          revealTimingRules: [],
          payoffRules: [],
        },
        storyArchitecture: {
          canonicalBeatMap: [],
          midpointRules: [],
          climaxRules: [],
          endingRules: [],
        },
        audienceGrowthSystem: {
          ctrPromise: '',
          hook30s: '',
          curiosityLadder: [],
          retentionBeats: [],
          commentPayoff: '',
          antiDropRules: [],
        },
        styleFingerprint: {
          sentenceRhythm: [],
          dialogueRules: [],
          expositionRules: [],
          emotionalCadence: [],
          transitionRules: [],
        },
        formulaPatterns: {
          mandatory: [],
          frequent: [],
          optional: [],
          forbidden: [],
        },
        variationSystem: {
          safeVariationSlots: [],
          combinationsToAvoid: [],
        },
      },
      reproductionPrompt: 'detailed abstract production rulebook only',
      confidence: 0,
    }),
    'The reproductionPrompt must be a detailed production rulebook, not a three-line summary. It must instruct Japanese-only output, four progressive chapters, a complete ending, a minimum of 20,000 non-whitespace characters, and no source copying.',
    'The audienceGrowthSystem must enforce a 30-second hook, answer each active question before creating a larger one, cover the five retention windows, and leave a natural moral dilemma for comments.',
    'Separate mandatory channel DNA from frequent patterns and optional variations. Do not let one unusual source dominate the final formula.',
  ].join('\n\n');
}

export function buildFormulaGenerationPrompt({
  formula = {},
  randomizedPremise = '',
  includeYoutubeCta = false,
} = {}) {
  const safeFormula = sanitizeChannelFormula(formula);
  const policy = safeFormula.generationPolicy;
  const continuousAudioNarration = policy.stripChapterHeaders
    || policy.flowFormat === 'continuous_audio_narration';
  const structureRule = continuousAudioNarration
    ? [
      `全${policy.chapterCount}段階の内部構成で、各段階に固有の事件、選択、発見、代償、関係変化を置く。ただし、この内部構成名を本文へ表示しない。`,
      '最終出力は、冒頭から結末まで一続きで自然に読める音声ナレーション本文だけにする。',
      '「第一章」「第1章」「Chapter 1」「CHAPTER 1」などの章立てタイトル、章番号、章見出し、Markdown見出しを本文内に一切記載しない。',
      '章の区切りは見出しを使わず、時間経過や場面転換の接続文（「翌日」「二日後の説明会当日」「それから半年後」等）で自然に繋ぐ。',
    ].join('\n')
    : `全${policy.chapterCount}章で構成し、各章に固有の事件、選択、発見、代償、関係変化、章末状態を置く。`;
  const ctaRule = includeYoutubeCta
    ? 'A short generic Japanese channel greeting may appear once after the hook; do not use the source channel name or exact source CTA.'
    : 'Do not include a YouTube greeting, channel name, subscribe request, or CTA.';
  return [
    'あなたは日本語の長編人間ドラマ作家です。',
    `チャンネル公式: ${safeFormula.name}`,
    '以下は文章の模倣ではなく、抽象化された構成規則です。',
    cleanText(safeFormula.reproductionPrompt, 12000),
    `新しいランダムな着想: ${cleanText(randomizedPremise, 2400)}`,
    structureRule,
    'CTR promiseを序盤の具体的な不公平・秘密・関係や地位の衝突で提示し、タイトル/サムネイルが約束した反転を必ず本文で回収する。',
    'hook30s / 30秒以内は、説明や挨拶ではなく、進行中の侮辱・異常な要求・裏切りの台詞または行動から始める。CTAはhookの後にだけ置く。',
    'Question A → Answer A → Question B → Answer B → Question C の順で進める。各質問は同じ章または次章で答え、その答えからより大きく危険な次の質問を生む。一つの疑問を長時間放置しない。',
    'Retention beats: 30s-3m=問題と好奇心、3-8m=最初の証拠、8-15m=反対者の一時的勝利、15-20m=意味の反転、20-25m=証拠による反撃と余韻。',
    'twistは序盤の思い込みを反転させるが、title/thumbnail promiseから外れない。commentDilemmaは主な不正を解決した後に残る自然な道徳的選択として描き、機械的なCTAにしない。',
    `空白と改行を除く本文を最低${policy.minNonWhitespaceChars.toLocaleString('ja-JP')}字、理想${policy.targetNonWhitespaceChars.toLocaleString('ja-JP')}字以上にする。`,
    '同じ出来事、同じ心理説明、同じ慰め、同じ誓いを言い換えて水増ししない。',
    '本文は日本語だけで書き、プロンプト、分析、チェックリスト、文字数報告、Markdownコードフェンスを出力しない。',
    '既存ソースの人物名、固有名詞、台詞、文章、固有の事件展開を再利用しない。コピー禁止。',
    '最後は未完・続く・説明だけの結末にせず、具体的な行動と状態変化で完結させる。',
    ctaRule,
  ].join('\n');
}

function hasNaturalEnding(text) {
  return /[。．！？!?」』）)]\s*$/u.test(String(text || '').trim());
}

export function validateChannelFormulaStory(text, policy = CHANNEL_FORMULA_DEFAULT_POLICY) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  const normalizedPolicy = normalizePolicy(policy);
  const issues = [];
  const charCount = nonWhitespaceLength(source);
  if (!source) issues.push('empty_output');
  if (charCount < normalizedPolicy.minNonWhitespaceChars) issues.push('target_length');
  if (normalizedPolicy.requireCompleteEnding && !hasNaturalEnding(source)) issues.push('unclosed_ending');
  if (
    normalizedPolicy.stripChapterHeaders
    && /(?:^|\n)\s*(?:#{1,6}\s*)?(?:第\s*(?:[0-9０-９]+|[一二三四五六七八九十百]+)\s*章(?:\s|　|[:：\-—]|$)|Chapter\s*[0-9０-９]+(?:\s|[:：\-—]|$))/imu.test(source)
  ) {
    issues.push('chapter_headers');
  }
  if (/\b(?:analysis|prompt|checklist|TODO|JSON only)\b/i.test(source)) issues.push('prompt_leakage');
  return {
    ok: issues.length === 0,
    charCount,
    issues,
  };
}

export {
  cleanText,
  nonWhitespaceLength,
  normalizePolicy,
};

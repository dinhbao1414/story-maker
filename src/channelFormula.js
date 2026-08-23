export const CHANNEL_FORMULA_SCHEMA = 'story-maker-channel-formula-v1';

export const CHANNEL_FORMULA_DEFAULT_POLICY = Object.freeze({
  minNonWhitespaceChars: 20000,
  targetNonWhitespaceChars: 22000,
  chapterCount: 4,
  requireCompleteEnding: true,
  randomizeTheme: true,
  randomizeCharacters: true,
  includeYoutubeCtaByDefault: false,
});

const SECRET_KEY_PATTERN = /(?:api.?key|authorization|token|secret)/i;
const RAW_SOURCE_KEY_PATTERN = /(?:raw.?source|source.?text|full.?text|source.?content)/i;
const MAX_ANALYSIS_DEPTH = 6;
const MAX_ARRAY_ITEMS = 30;

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

function stringifyForPrompt(value) {
  return JSON.stringify(value, null, 2);
}

export function buildFileAnalysisPrompt({
  fileName = '',
  sourceCount = 0,
  stats = {},
  slices = {},
  markers = [],
} = {}) {
  return [
    'You are analyzing one Japanese YouTube story transcript as part of a channel-formula study.',
    'Return JSON only. Analyze abstract construction, not wording.',
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
    'Representative excerpts (for structure only):',
    `OPENING:\n${cleanText(slices.opening, 3600)}`,
    `MIDDLE:\n${cleanText(slices.middle, 3600)}`,
    `ENDING:\n${cleanText(slices.ending, 3600)}`,
    'Return this JSON shape:',
    stringifyForPrompt({
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
      confidence: 0.0,
    }),
  ].join('\n\n');
}

export function buildFormulaSynthesisPrompt({
  formulaName = '',
  sourceCount = 0,
  intermediateSummaries = [],
} = {}) {
  const summaries = Array.isArray(intermediateSummaries)
    ? intermediateSummaries.slice(0, 30).map(summary => sanitizeValue(summary) || {})
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
        audienceGrowthSystem: {
          ctrPromise: '',
          hook30s: '',
          curiosityLadder: [],
          retentionBeats: [],
          commentPayoff: '',
          antiDropRules: [],
        },
      },
      reproductionPrompt: 'abstract reproduction rules only',
      confidence: 0,
    }),
    'The reproductionPrompt must instruct Japanese-only output, four progressive chapters, a complete ending, a minimum of 20,000 non-whitespace characters, and no source copying.',
    'The audienceGrowthSystem must enforce a 30-second hook, answer each active question before creating a larger one, cover the five retention windows, and leave a natural moral dilemma for comments.',
  ].join('\n\n');
}

export function buildFormulaGenerationPrompt({
  formula = {},
  randomizedPremise = '',
  includeYoutubeCta = false,
} = {}) {
  const safeFormula = sanitizeChannelFormula(formula);
  const policy = safeFormula.generationPolicy;
  const ctaRule = includeYoutubeCta
    ? 'A short generic Japanese channel greeting may appear once after the hook; do not use the source channel name or exact source CTA.'
    : 'Do not include a YouTube greeting, channel name, subscribe request, or CTA.';
  return [
    'あなたは日本語の長編人間ドラマ作家です。',
    `チャンネル公式: ${safeFormula.name}`,
    '以下は文章の模倣ではなく、抽象化された構成規則です。',
    cleanText(safeFormula.reproductionPrompt, 12000),
    `新しいランダムな着想: ${cleanText(randomizedPremise, 2400)}`,
    `全${policy.chapterCount}章で構成し、各章に固有の事件、選択、発見、代償、関係変化、章末状態を置く。`,
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

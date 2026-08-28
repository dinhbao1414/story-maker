import {
  buildFileAnalysisPrompt,
  buildFormulaGenerationPrompt,
  buildFormulaSynthesisPrompt,
  buildRepresentativeSlices,
  createChannelFormula,
  fingerprintSource,
  sanitizeChannelFormula,
  validateChannelFormulaStory,
} from './channelFormula.js';
import {
  createChannelFormulaRepository,
  parseChannelFormulaImport,
} from './channelFormulaStorage.js';
import { createStoryDnaMatrixRepository } from './storyDnaMatrixStorage.js';
import { BUILTIN_CHANNEL_FORMULAS } from './channelFormulaCatalog.js';
import { Gt } from './providerClients.js';
import { readApiSession } from './apiSession.js';
import { applyGenerationSettings } from './generationSettingsIo.js';
import {
  chooseUnusedStoryDnaRow,
  normalizeStoryDnaRow,
} from './storyDnaMatrix.js';

const MAX_FILE_CHARS = 1_200_000;
const MAX_ANALYSIS_SUMMARIES = 30;

const PREMISE_THEMES = Object.freeze([
  '相続と家族の境界線',
  '介護をめぐる責任の押し付け',
  '再婚家庭の秘密',
  '小さな店を守るための決断',
  '失われた記録が示す過去',
]);
const PREMISE_SETTINGS = Object.freeze([
  '雨の続く地方都市',
  '駅前の古い商店街',
  '海辺の住宅地',
  '郊外の集合住宅',
  '雪解け前の山間の町',
]);
const FALLBACK_MOTIF_SETTINGS = Object.freeze([
  {
    theme: '相続をめぐる家族内の責任転嫁',
    genre: '家族因果応報ドラマ',
    worldview: '雨の続く地方都市の古い住宅街',
    target: '秘密と証拠を軸にした長編人間ドラマ',
    era: '現代日本',
    ending: '主人公が自分の境界線を選び直し、生活を再建する結末',
    narr: '主人公に寄り添う近接三人称',
    antagonist: '家族内の評判を利用して責任を押し付ける親族',
    evidence: '契約書、メッセージ記録、第三者の証言',
    titlePromise: '家族全員に責任を押し付けられた娘が、一枚の記録で立場を逆転させる',
    thumbnailConcept: '公開の場で頭を下げる主人公と、開かれた封筒を指す手',
    hook30s: '「あなたが全部払えばいい」と言われた直後、主人公の足元に見覚えのない封筒が落ちる。',
    questionLadder: [
      { question: 'なぜ主人公だけが責任を負うのか', answer: '家族会議の記録に不自然な欠落がある', nextQuestion: '誰がその記録を消したのか' },
      { question: '誰がその記録を消したのか', answer: '味方のふりをした親族が鍵を持っていた', nextQuestion: 'その親族は何を守ろうとしているのか' },
      { question: 'その親族は何を守ろうとしているのか', answer: '過去の決断で得た利益が明らかになる', nextQuestion: '主人公は真実を公開するのか' },
    ],
    retentionBeats: [
      { window: '30s-3m', goal: '問題と約束', beat: '公開の侮辱と封筒を同時に提示し、原因は隠す' },
      { window: '3-8m', goal: '最初の答え', beat: '記録の欠落と協力者の違和感を示す' },
      { window: '8-15m', goal: '怒りと孤立', beat: '反対者が先に証人を囲い、主人公を追い出す' },
      { window: '15-20m', goal: '大きな反転', beat: '封筒の意味が逆転し、協力者の秘密が出る' },
      { window: '20-25m', goal: '反撃と余韻', beat: '証拠を公開し、関係を切るか救うかを選ばせる' },
    ],
    twist: '主人公を守っていたと思われた記録が、実は別の被害者を隠していた。',
    commentDilemma: '真実を公開して家族を壊すべきか、それとも被害者だけを守るべきか。',
  },
  {
    theme: '介護を押し付けられた姉が家族の嘘を見抜く',
    genre: '社会派家族ドラマ',
    worldview: '駅前商店街と郊外の集合住宅',
    target: '静かな違和感が公開の場で反転する物語',
    era: '現代日本',
    ending: '証拠を公開し、無理な関係を終えて新しい日常へ進む結末',
    narr: '主人公の一人称回想',
    antagonist: '善意を装いながら周囲を味方につける家族',
    evidence: '領収書、録音、古い写真',
    titlePromise: '介護を押し付けられた姉が、善人の仮面を一つずつ剥がす',
    thumbnailConcept: '笑顔の親族と、画面に残る録音波形を見つめる姉',
    hook30s: '「家族なら当然でしょ」と笑われた瞬間、姉の携帯に録音終了の通知が出る。',
    questionLadder: [
      { question: 'なぜ全員が同じ嘘をつくのか', answer: '介護費の領収書が一枚だけ別名義になっている', nextQuestion: '別名義は誰のためのものか' },
      { question: '別名義は誰のためのものか', answer: '家族の人気者が費用を流用していた', nextQuestion: 'なぜ母親はそれを黙っていたのか' },
      { question: 'なぜ母親はそれを黙っていたのか', answer: '昔の約束が今の支配を作っていた', nextQuestion: '姉は約束を破って告発するのか' },
    ],
    retentionBeats: [
      { window: '30s-3m', goal: '不公平の提示', beat: '介護の押し付けと録音の存在を同時に見せる' },
      { window: '3-8m', goal: '証拠の拡大', beat: '領収書の名義違いから別の利害を開く' },
      { window: '8-15m', goal: '反対者の勝利', beat: '家族が主人公の信用を先に奪う' },
      { window: '15-20m', goal: '過去の反転', beat: '母親の沈黙の理由を明かす' },
      { window: '20-25m', goal: '選択の余韻', beat: '告発の代償と新しい境界線を示す' },
    ],
    twist: '沈黙していた人物は共犯ではなく、別の被害を止めようとしていた。',
    commentDilemma: '家族の罪を公にすることは正義か、それとも新しい加害か。',
  },
  {
    theme: '再婚家庭に隠された身分と約束',
    genre: '家族ミステリー・ドラマ',
    worldview: '海辺の町の小さな店と共同住宅',
    target: '過去の記録が現在の関係を反転させる物語',
    era: '平成末期から現代',
    ending: '過去を認めたうえで、主人公が自分の居場所を決める結末',
    narr: '主人公に近い三人称',
    antagonist: '過去を隠して家族の選択を支配する人物',
    evidence: '手紙、写真、時系列の食い違い',
    titlePromise: '再婚家庭で身分を隠された妻が、古い写真の裏側から真実に近づく',
    thumbnailConcept: '幸せそうな家族写真と、裏返された日付の違う一枚',
    hook30s: '「その人の名前を口にしないで」と言われた直後、写真立ての裏から別の家族写真が落ちる。',
    questionLadder: [
      { question: 'なぜ家族は一人の名前を禁じるのか', answer: '写真の日付が公式の記録と合わない', nextQuestion: '誰が日付を書き換えたのか' },
      { question: '誰が日付を書き換えたのか', answer: '再婚前の約束を隠すためだった', nextQuestion: 'その約束は誰を守ったのか' },
      { question: 'その約束は誰を守ったのか', answer: '守られた人物が現在の争いを始めていた', nextQuestion: '真実を知った主人公は家族を選ぶのか' },
    ],
    retentionBeats: [
      { window: '30s-3m', goal: '禁じられた秘密', beat: '名前の禁止と写真を同時に出す' },
      { window: '3-8m', goal: '最初の記録', beat: '日付の食い違いで過去を開く' },
      { window: '8-15m', goal: '孤立', beat: '主人公が疑いを向けられ居場所を失う' },
      { window: '15-20m', goal: '身分の反転', beat: '約束の本当の受益者を明かす' },
      { window: '20-25m', goal: '選び直し', beat: '主人公が自分の居場所を自分で決める' },
    ],
    twist: '隠されていた身分は悪意ではなく、別の人物を守るための犠牲だった。',
    commentDilemma: '過去の嘘を許すことと、今の被害を止めることをどう両立するか。',
  },
]);

function text(value, maxLength = 12000) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return text(value, 2000).replace(/[&<>"']/gu, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

export function setFormulaGenerationBusyUi({
  doc = globalThis.document,
  busy = false,
  message = '',
  busyLabel = '⏳ Đang tạo truyện 20K…',
} = {}) {
  const button = doc?.getElementById?.('cf-generate');
  const progress = doc?.getElementById?.('cf-progress');
  const error = doc?.getElementById?.('cf-error');
  if (button) {
    if (!button.dataset.formulaIdleLabel) {
      button.dataset.formulaIdleLabel = button.textContent || 'Random và tạo truyện 20K';
    }
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.classList?.toggle?.('is-busy', Boolean(busy));
    button.textContent = busy
      ? busyLabel
      : button.dataset.formulaIdleLabel;
  }
  if (progress && (message || busy)) {
    progress.textContent = message || '⏳ Đang tạo seed → ledger → 4 chương…';
  }
  if (busy) error?.classList?.add?.('hidden');
  return { busy: Boolean(busy), message: progress?.textContent || '' };
}

function nonWhitespaceLength(value) {
  return Array.from(String(value || '').replace(/\s/gu, '')).length;
}

function sanitizeAnalysis(value, depth = 0) {
  if (depth > 6 || value == null) return value == null ? null : undefined;
  if (typeof value === 'string') return text(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map(item => sanitizeAnalysis(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:api.?key|authorization|token|secret|raw.?source|source.?text|full.?text)/i.test(key))
    .map(([key, item]) => [key, sanitizeAnalysis(item, depth + 1)])
    .filter(([, item]) => item !== undefined));
}

function extractJsonCandidate(value) {
  const source = text(value, 50000)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(source.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function parseStructuredFormulaAnalysis(value) {
  const parsed = typeof value === 'object' && value !== null ? value : extractJsonCandidate(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI analysis JSON is invalid.');
  }
  return sanitizeAnalysis(parsed) || {};
}

export function filterChannelFormulaTextFiles(files = []) {
  return Array.from(files || [])
    .filter(file => file && /\.txt$/iu.test(String(file.name || '')))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), undefined, { numeric: true }));
}

function collectMarkers(source) {
  const markers = [];
  for (const pattern of [
    /(?:チャンネル登録|高評価|ご視聴|お聞き|最後まで)/gu,
    /(?:毎日|スカット|ざまあ|因果応報|家族|嫁|姑|義母|復讐)/gu,
  ]) {
    for (const match of source.matchAll(pattern)) {
      if (!markers.includes(match[0])) markers.push(match[0]);
      if (markers.length >= 20) return markers;
    }
  }
  return markers;
}

async function readFileSnapshot(file) {
  const raw = text(await file.text(), MAX_FILE_CHARS);
  const slices = buildRepresentativeSlices(raw);
  return {
    fileName: text(file.name, 240),
    source: raw,
    sourceFingerprint: fingerprintSource(raw),
    stats: {
      chars: Array.from(raw).length,
      nonWhitespaceChars: nonWhitespaceLength(raw),
      lines: raw ? raw.split('\n').length : 0,
    },
    slices,
    markers: collectMarkers(raw),
  };
}

function compactAnalysis(analysis, fileName) {
  const safe = sanitizeAnalysis(analysis) || {};
  return {
    fileName: text(fileName, 160),
    tone: text(safe.tone, 500),
    openingHook: text(safe.opening_hook || safe.openingHook, 700),
    protagonistPattern: text(safe.protagonist_pattern || safe.protagonistPattern, 700),
    antagonistPattern: text(safe.antagonist_pattern || safe.antagonistPattern, 700),
    escalationBeats: Array.isArray(safe.escalation_beats)
      ? safe.escalation_beats.slice(0, 8).map(item => text(item, 300))
      : [],
    revealPattern: text(safe.reveal_pattern || safe.revealPattern, 700),
    justicePayoff: text(safe.justice_payoff || safe.justicePayoff, 700),
    epiloguePattern: text(safe.epilogue_pattern || safe.epiloguePattern, 700),
    pacingRules: Array.isArray(safe.pacing_rules)
      ? safe.pacing_rules.slice(0, 8).map(item => text(item, 300))
      : [],
  };
}

function resolveSessionKey(session) {
  if (typeof session === 'string') return session;
  return session?.apiKey || session?.key || session?.geminiKey || session?.openaiKey || '';
}

function createDefaultStructuredCaller({ getApiSession, getModel } = {}) {
  return async prompt => {
    const key = resolveSessionKey(await getApiSession?.());
    if (!key) throw new Error('APIキーを入力してから分析を開始してください。');
    const result = await Gt(key, getModel?.(key) || 'gemini-3.5-flash', prompt, {
      responseMimeType: 'application/json',
      maxTokens: 5000,
      disableGoogleSearch: true,
    });
    return result?.text ?? result;
  };
}

export function createChannelFormulaGenerationCaller({
  getApiSession,
  getModel,
  callProvider = Gt,
  runLongify = null,
} = {}) {
  return async ({ formula, prompt, randomizedPremise, targetTotalNumber, chapterCount }) => {
    const session = await getApiSession?.();
    const key = resolveSessionKey(session);
    if (!key) throw new Error('APIキーを入力してから生成を開始してください。');
    const model = getModel?.(key) || 'gemini-3.5-flash';
    const seedResult = await callProvider(key, model, [
      prompt,
      'まず長編化の土台になる、固有名詞を新規に作った短い日本語の種文を800〜1,200字で出力する。',
      '種文だけを出力し、分析・JSON・見出し・CTAは出力しない。',
    ].join('\n\n'), {
      maxTokens: 3000,
      disableGoogleSearch: true,
    });
    const longify = runLongify || (await import('./longifyBeta.js')).runLongifyBeta;
    const callText = async (longifyPrompt, context = {}) => callProvider(
      key,
      model,
      longifyPrompt,
      {
        ...(context.options || {}),
        disableGoogleSearch: true,
      },
    );
    return longify({
      storyText: seedResult?.text || seedResult,
      apiKey: key,
      model,
      targetTotalChars: targetTotalNumber,
      chapterCount,
      channelFormulaName: formula.name,
      channelFormulaPrompt: formula.reproductionPrompt,
      channelFormulaPolicy: formula.generationPolicy,
      callText,
    });
  };
}

const createDefaultGenerationCaller = createChannelFormulaGenerationCaller;

function makeFormulaId(name) {
  return `formula-analysis-${fingerprintSource(text(name, 120))}`;
}

export function buildRandomizedFormulaPremise({ random = Math.random } = {}) {
  const pick = list => list[Math.min(list.length - 1, Math.max(0, Math.floor(Number(random()) * list.length)))];
  return `${pick(PREMISE_SETTINGS)}で、${pick(PREMISE_THEMES)}を抱えた主人公が、隠されていた記録と一人の協力者を手がかりに、家族内の力関係を問い直す。`;
}

export function buildFormulaSettingsRandomizationPrompt({
  formula,
  randomSeed = '',
} = {}) {
  const safeFormula = sanitizeChannelFormula(formula);
  return [
    'あなたは日本語の家族ドラマ用の設定編集者です。',
    'チャンネル公式の抽象ルールだけを使い、新しい設定を1組だけ作ってください。',
    'JSONのみを返し、説明文・Markdown・分析メモは返さないでください。',
    `公式名: ${safeFormula.name}`,
    `乱数シード: ${text(randomSeed, 120) || 'local-random'}`,
    '原文の固有名詞、台詞、固有事件、人物関係、チャンネル名、CTAを再利用しないでください。',
    '人物名、職業、地域、証拠物、敵対者の詳細は新規に作ってください。',
    'CTR用のタイトル約束、サムネイル構図、最初の30秒のフック、3〜5段階の質問と回答、5つの保持ビート、中央の反転、最後の道徳的ジレンマも新規に作ってください。',
    '次のJSON形状を守ってください:',
    JSON.stringify({
      theme: 'new Japanese motif',
      genre: 'genre',
      worldview: 'setting',
      target: 'story target',
      era: 'era',
      ending: 'complete ending direction',
      narr: 'narration',
      characters: [
        { name: 'new name', sex: '女性', role: '主人公', personality: 'personality', note: 'secret or want' },
        { name: 'new name', sex: '男性', role: 'opponent', personality: 'personality', note: 'pressure method' },
      ],
      antagonist: 'abstract opponent detail',
      evidence: 'new evidence objects',
      escalation: ['beat 1', 'beat 2', 'beat 3'],
      titlePromise: 'title and thumbnail promise for CTR',
      thumbnailConcept: 'visual contrast and emotional focus',
      hook30s: 'opening shock scene or dialogue within 30 seconds',
      questionLadder: [
        { question: 'question A', answer: 'answer A', nextQuestion: 'larger question B' },
        { question: 'question B', answer: 'answer B', nextQuestion: 'dangerous question C' },
        { question: 'question C', answer: 'answer C', nextQuestion: '' },
      ],
      retentionBeats: [
        { window: '30s-3m', goal: 'curiosity', beat: 'concrete pressure' },
        { window: '3-8m', goal: 'first reveal', beat: 'new evidence' },
        { window: '8-15m', goal: 'anger', beat: 'opponent wins' },
        { window: '15-20m', goal: 'twist', beat: 'meaning reverses' },
        { window: '20-25m', goal: 'payoff', beat: 'evidence-based counterattack' },
      ],
      twist: 'central reversal and mistaken belief',
      commentDilemma: 'natural moral question for viewers to debate',
    }, null, 2),
    'questionLadderは質問を長時間放置せず、各回答の直後により大きな質問を作ってください。retentionBeatsは5つの時間窓をすべて埋めてください。',
    '4章の長編化に使える具体的な対立・証拠・選択を含め、元ソースの文章を引用しないでください。',
  ].join('\n\n');
}

function normalizeAxisSetting(value) {
  if (value && typeof value === 'object') {
    return {
      category: text(value.category, 160),
      value: text(value.value, 240),
      customValue: text(value.customValue || value.text || value.label, 500),
      source: text(value.source, 80) || 'formula-random',
    };
  }
  return {
    category: '',
    value: '',
    customValue: text(value, 500),
    source: text(value, 500) ? 'formula-random' : '',
  };
}

function normalizeQuestionLadder(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 5)
    .map(item => ({
      question: text(item?.question, 600),
      answer: text(item?.answer, 900),
      nextQuestion: text(item?.nextQuestion, 600),
    }))
    .filter(item => item.question || item.answer || item.nextQuestion);
}

function normalizeRetentionBeats(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 5)
    .map(item => ({
      window: text(item?.window, 80),
      goal: text(item?.goal, 500),
      beat: text(item?.beat, 900),
    }))
    .filter(item => item.window || item.goal || item.beat);
}

function formatAudienceGrowthSupplement({
  titlePromise = '',
  thumbnailConcept = '',
  hook30s = '',
  questionLadder = [],
  retentionBeats = [],
  twist = '',
  commentDilemma = '',
} = {}) {
  const lines = [
    titlePromise ? `CTR promise / title: ${titlePromise}` : '',
    thumbnailConcept ? `Thumbnail concept: ${thumbnailConcept}` : '',
    hook30s ? `hook30s / Hook 30s: ${hook30s}` : '',
    questionLadder.length
      ? `質問の連鎖 / Question ladder:\n${questionLadder.map((item, index) => (
        `質問${index + 1} / Q: ${item.question}\n   A: ${item.answer}${item.nextQuestion ? `\n   Next Q: ${item.nextQuestion}` : ''}`
      )).join('\n')}`
      : '',
    retentionBeats.length
      ? `Retention beats:\n${retentionBeats.map(item => (
        `- ${item.window}: ${item.goal} — ${item.beat}`
      )).join('\n')}`
      : '',
    twist ? `Twist: ${twist}` : '',
    commentDilemma ? `コメント用の道徳的ジレンマ / Comment dilemma: ${commentDilemma}` : '',
  ];
  return lines.filter(Boolean).join('\n\n');
}

export function normalizeRandomizedFormulaSettings(value = {}, formula = {}) {
  const safeFormula = sanitizeChannelFormula(formula);
  const source = sanitizeAnalysis(value) || {};
  const rawAxes = source.axes && typeof source.axes === 'object' ? source.axes : {};
  const axisValue = key => normalizeAxisSetting(source[key] ?? rawAxes[key]);
  const characters = (Array.isArray(source.characters) ? source.characters : [])
    .slice(0, 8)
    .map((character, index) => ({
      name: text(character?.name, 120) || `登場人物${index + 1}`,
      sex: text(character?.sex, 80),
      role: text(character?.role, 160),
      personality: text(character?.personality, 220),
      note: text(character?.note, 500),
    }));
  const axes = {
    theme: axisValue('theme'),
    genre: axisValue('genre'),
    worldview: axisValue('worldview'),
    target: axisValue('target'),
    era: axisValue('era'),
    ending: axisValue('ending'),
    narr: axisValue('narr'),
  };
  const growthSource = source.audienceGrowthSystem || {};
  const titlePromise = text(source.titlePromise || growthSource.titlePromise, 1200);
  const thumbnailConcept = text(source.thumbnailConcept || growthSource.thumbnailConcept, 1200);
  const hook30s = text(source.hook30s || growthSource.hook30s, 1200);
  const questionLadder = normalizeQuestionLadder(
    source.questionLadder || growthSource.curiosityLadder,
  );
  const retentionBeats = normalizeRetentionBeats(
    source.retentionBeats || growthSource.retentionBeats,
  );
  const twist = text(source.twist || growthSource.twist, 1200);
  const commentDilemma = text(source.commentDilemma || growthSource.commentDilemma, 1200);
  const motifNotes = [
    source.antagonist ? `対立者: ${text(source.antagonist, 700)}` : '',
    source.evidence ? `証拠: ${text(source.evidence, 700)}` : '',
    Array.isArray(source.escalation) && source.escalation.length
      ? `段階: ${source.escalation.slice(0, 6).map(item => text(item, 300)).join(' → ')}`
      : '',
  ].filter(Boolean).join('\n');
  const growthNotes = formatAudienceGrowthSupplement({
    titlePromise,
    thumbnailConcept,
    hook30s,
    questionLadder,
    retentionBeats,
    twist,
    commentDilemma,
  });
  const supplement = [
    `チャンネル公式「${safeFormula.name}」の抽象ルールを守る。`,
    safeFormula.reproductionPrompt,
    motifNotes,
    growthNotes,
    'この設定の人物名・事件・証拠を新規に展開し、原文をコピーしない。',
  ].filter(Boolean).join('\n\n').slice(0, 5000);
  return {
    mode: 'long_10000',
    modeCustom: '長編（10000字～）',
    theme: axes.theme.customValue || axes.theme.value || axes.theme.category,
    genre: axes.genre.customValue || axes.genre.value || axes.genre.category,
    worldview: axes.worldview.customValue || axes.worldview.value || axes.worldview.category,
    target: axes.target.customValue || axes.target.value || axes.target.category,
    era: axes.era.customValue || axes.era.value || axes.era.category,
    ending: axes.ending.customValue || axes.ending.value || axes.ending.category,
    narration: axes.narr.customValue || axes.narr.value || axes.narr.category,
    axes,
    characters,
    supplement,
    channelFormula: safeFormula,
    locked: { channelFormula: true },
    universalAssets: [],
  };
}

export function buildFallbackFormulaSettings(formula, { random = Math.random } = {}) {
  const pick = list => list[Math.min(list.length - 1, Math.max(0, Math.floor(Number(random()) * list.length)))];
  const motif = pick(FALLBACK_MOTIF_SETTINGS);
  const names = Number(random()) < 0.5
    ? [['美緒', '女性', '主人公'], ['直人', '男性', '対立者'], ['澄江', '女性', '協力者']]
    : [['紗季', '女性', '主人公'], ['和也', '男性', '対立者'], ['千鶴', '女性', '協力者']];
  return normalizeRandomizedFormulaSettings({
    ...motif,
    characters: names.map(([name, sex, role]) => ({ name, sex, role, personality: '言葉にできない願いを抱えている', note: '新しい選択を迫られる' })),
    escalation: ['小さな違和感', '否認と孤立', '証拠の反転', '公開の決断'],
  }, formula);
}

function buildMatrixSettingsSeed(row, formula) {
  const safeRow = normalizeStoryDnaRow(row, { formulaId: formula.id });
  return {
    theme: safeRow.titlePromise || safeRow.falseAccusation,
    genre: formula.analysis?.genre || '家族因果応報ドラマ',
    worldview: safeRow.location,
    target: `${safeRow.hook}から始まり、${safeRow.moralDilemma}へ着地する長編人間ドラマ`,
    era: '現代日本',
    ending: safeRow.ending,
    narr: '主人公に寄り添う近接三人称',
    characters: [
      { name: '主人公', sex: '女性', role: safeRow.victim, personality: '耐えてきたが記録を集める', note: safeRow.secret },
      { name: '対立者', sex: '男性', role: safeRow.antagonist, personality: '評判と立場で責任を押し付ける', note: safeRow.falseAccusation },
    ],
    antagonist: safeRow.antagonist,
    evidence: safeRow.evidence,
    escalation: [
      safeRow.falseAccusation,
      safeRow.secret,
      safeRow.midpointTwist,
      safeRow.finalTwist,
    ],
    titlePromise: safeRow.titlePromise,
    thumbnailConcept: `${safeRow.victim}と${safeRow.evidence}を対比する`,
    hook30s: safeRow.hook,
    questionLadder: [
      { question: `なぜ${safeRow.victim}は${safeRow.falseAccusation}を負わされたのか`, answer: safeRow.secret, nextQuestion: safeRow.midpointTwist },
      { question: safeRow.midpointTwist, answer: safeRow.finalTwist, nextQuestion: safeRow.moralDilemma },
      { question: safeRow.moralDilemma, answer: safeRow.ending, nextQuestion: '' },
    ],
    retentionBeats: [
      { window: '30s-3m', goal: '問題と約束', beat: safeRow.hook },
      { window: '3-8m', goal: '最初の証拠', beat: safeRow.evidence },
      { window: '8-15m', goal: '反対者の勝利', beat: safeRow.falseAccusation },
      { window: '15-20m', goal: '意味の反転', beat: safeRow.midpointTwist },
      { window: '20-25m', goal: '反撃と余韻', beat: safeRow.finalTwist },
    ],
    twist: safeRow.finalTwist,
    commentDilemma: safeRow.moralDilemma,
  };
}

export async function randomizeAndApplyFormulaSettings({
  formula,
  matrix = null,
  callStructuredAi,
  applySettings,
  dispatchDashboardOpen,
  random = Math.random,
  randomSeed = `${Date.now()}-${Math.floor(Number(random()) * 1000000)}`,
  lastMatrixSelections = null,
  onStatus = () => {},
} = {}) {
  const safeFormula = sanitizeChannelFormula(formula);
  let settings;
  let usedFallback = false;
  let matrixRow = null;
  const matrixId = text(matrix?.id, 160);
  const matrixRows = Array.isArray(matrix) ? matrix : matrix?.rows;
  if (Array.isArray(matrixRows) && matrixRows.length) {
    const selected = chooseUnusedStoryDnaRow(matrixRows, {
      random,
      excludeRowId: matrixId ? lastMatrixSelections?.get?.(matrixId) : null,
    });
    if (selected?.row) {
      matrixRow = normalizeStoryDnaRow(selected.row, { formulaId: safeFormula.id });
      if (matrixId) lastMatrixSelections?.set?.(matrixId, matrixRow.id);
      onStatus({ phase: 'matrix', message: `Đã chọn story card ${matrixRow.id} từ Story DNA Matrix.` });
    } else {
      onStatus({ phase: 'matrix-empty', message: 'Matrix không còn story card an toàn; đang dùng fallback motif.' });
    }
  }
  try {
    if (matrixRow) {
      settings = normalizeRandomizedFormulaSettings(buildMatrixSettingsSeed(matrixRow, safeFormula), safeFormula);
    } else {
      if (typeof callStructuredAi !== 'function') throw new Error('structured_ai_unavailable');
    onStatus({ phase: 'ai', message: 'AI đang random mô típ và thiết lập…' });
    const response = await callStructuredAi(buildFormulaSettingsRandomizationPrompt({
      formula: safeFormula,
      randomSeed,
    }));
      settings = normalizeRandomizedFormulaSettings(parseStructuredFormulaAnalysis(response), safeFormula);
    }
  } catch {
    usedFallback = true;
    onStatus({ phase: 'fallback', message: 'AI không phản hồi; đang dùng bộ mô típ dự phòng…' });
    settings = buildFallbackFormulaSettings(safeFormula, { random });
  }
  if (matrixRow) {
    settings = {
      ...settings,
      matrixId: matrixId || null,
      matrixRowId: matrixRow.id,
      storyDna: matrixRow,
    };
  }
  const payload = {
    schema: 'story-maker-generation-settings-v1',
    app: 'Story Maker',
    exportedAt: new Date().toISOString(),
    settings,
  };
  if (typeof applySettings === 'function') {
    await applySettings(payload, { announce: false });
  }
  dispatchDashboardOpen?.();
  onStatus({
    phase: 'applied',
    usedFallback,
    message: usedFallback
      ? 'Đã điền thiết lập bằng mô típ dự phòng. Dashboard đã sẵn sàng.'
      : 'Đã random mô típ và điền thiết lập. Dashboard đã sẵn sàng.',
  });
  return { settings, payload, usedFallback, matrixRow };
}

export async function generateFormulaStory({
  formula,
  callGeneration,
  randomizedPremise = '',
  includeYoutubeCta = false,
  random = Math.random,
  supplement,
} = {}) {
  if (typeof callGeneration !== 'function') throw new TypeError('Formula generation callback is required.');
  const safeFormula = sanitizeChannelFormula(formula);
  const premise = text(randomizedPremise, 2400) || buildRandomizedFormulaPremise({ random });
  const prompt = buildFormulaGenerationPrompt({
    formula: safeFormula,
    randomizedPremise: premise,
    includeYoutubeCta: includeYoutubeCta || safeFormula.generationPolicy.includeYoutubeCtaByDefault,
  });
  const result = await callGeneration({
    formula: safeFormula,
    prompt,
    randomizedPremise: premise,
    targetTotalNumber: safeFormula.generationPolicy.targetNonWhitespaceChars,
    minNonWhitespaceChars: safeFormula.generationPolicy.minNonWhitespaceChars,
    chapterCount: safeFormula.generationPolicy.chapterCount,
  });
  const generatedText = text(result?.text ?? result, 200000);
  let validation = validateChannelFormulaStory(generatedText, safeFormula.generationPolicy);
  if (!validation.ok && typeof supplement === 'function') {
    const repaired = await supplement({
      formula: safeFormula,
      text: generatedText,
      validation,
      deficit: Math.max(0, safeFormula.generationPolicy.minNonWhitespaceChars - validation.charCount),
    });
    const repairedText = text(repaired?.text ?? repaired, 200000);
    if (repairedText) {
      validation = validateChannelFormulaStory(repairedText, safeFormula.generationPolicy);
      return { ...result, text: repairedText, prompt, randomizedPremise: premise, validation };
    }
  }
  return { ...result, text: generatedText, prompt, randomizedPremise: premise, validation };
}

function buildFallbackAnalysisSummaries(summaries) {
  const values = summaries.filter(Boolean);
  const first = values[0] || {};
  return {
    genre: '日本語の家族因果応報ドラマ',
    audience: '日常の不公平が具体的な証拠で反転する物語を好む視聴者',
    pointOfView: '主人公に寄り添う三人称または一人称の近接視点',
    tone: first.tone || '緊張感のある共感的な社会派ドラマ',
    openingHook: first.openingHook || '平穏な日常に侮辱・隠し事・不自然な要求を一つ置く',
    protagonistPattern: first.protagonistPattern || '我慢を重ねてきた普通の家族が、自分の境界線を取り戻す',
    antagonistPattern: first.antagonistPattern || '身近な立場を利用して証拠を隠し、周囲を味方につける人物',
    escalationPattern: ['小さな違和感', '関係者の否認', '証拠の積み上げ', '公開の場での反転'],
    revealPattern: first.revealPattern || '記録・時系列・第三者の証言を組み合わせて事実を反転させる',
    evidenceMotifs: ['メッセージ記録', '領収書・契約書', '写真・録音', '第三者の証言'],
    justicePayoff: first.justicePayoff || '主人公が自分で選んだ行動により、相手の支配が現実的に崩れる',
    epiloguePattern: first.epiloguePattern || '生活の小さな再建と、関係を選び直す余韻',
    narrationRules: ['日本語のみ', '会話と具体的な行動で感情を示す', '説明の重複を避ける'],
    pacingRules: ['各章に新しい事実と不可逆な選択を置く', '中盤で意味を反転させる', '最終章で具体的な後日談を閉じる'],
    forbiddenPatterns: ['原文の固有名詞・台詞・固有事件の再利用', '未完の結末', 'プロンプトや分析メモの出力'],
  };
}

export function createChannelFormulaRuntimeController({
  repository,
  callStructuredAi,
  now = () => new Date(),
  onProgress = () => {},
  makeId = makeFormulaId,
} = {}) {
  if (!repository) throw new TypeError('Channel formula repository is required.');
  const callAi = callStructuredAi || createDefaultStructuredCaller({});
  let cancelled = false;
  let paused = false;
  let state = { status: 'idle', processedCount: 0, resumedCount: 0, errors: [] };

  const pause = () => { paused = true; state = { ...state, status: 'paused' }; };
  const resume = () => { paused = false; state = { ...state, status: 'running' }; };
  const cancel = () => { cancelled = true; state = { ...state, status: 'cancelled' }; };

  async function startAnalysis(inputFiles, { formulaName = 'Channel Formula', formulaId } = {}) {
    cancelled = false;
    paused = false;
    const files = filterChannelFormulaTextFiles(inputFiles);
    const id = text(formulaId, 160) || makeId(formulaName);
    const prior = new Map((await repository.listAnalysisCheckpoints(id)).map(item => [item.fileFingerprint, item]));
    const summaries = [];
    const errors = [];
    let processedCount = 0;
    let resumedCount = 0;
    state = { status: 'running', totalFiles: files.length, processedCount, resumedCount, errors };
    onProgress({ phase: 'start', totalFiles: files.length, processedCount, resumedCount });

    for (let index = 0; index < files.length; index += 1) {
      while (paused && !cancelled) await new Promise(resolve => setTimeout(resolve, 25));
      if (cancelled) break;
      const snapshot = await readFileSnapshot(files[index]);
      const existing = prior.get(snapshot.sourceFingerprint);
      if (existing?.status === 'complete' && existing.analysis) {
        summaries.push(compactAnalysis(existing.analysis, snapshot.fileName));
        processedCount += 1;
        resumedCount += 1;
        onProgress({ phase: 'resume', fileIndex: index + 1, totalFiles: files.length, fileName: snapshot.fileName, processedCount, resumedCount });
        continue;
      }
      try {
        const prompt = buildFileAnalysisPrompt({
          fileName: snapshot.fileName,
          sourceCount: files.length,
          stats: snapshot.stats,
          slices: snapshot.slices,
          markers: snapshot.markers,
        });
        const analysis = parseStructuredFormulaAnalysis(await callAi(prompt));
        await repository.saveAnalysisCheckpoint({
          formulaId: id,
          fileName: snapshot.fileName,
          fileFingerprint: snapshot.sourceFingerprint,
          fileIndex: index,
          totalFiles: files.length,
          status: 'complete',
          analysis,
          updatedAt: now().toISOString(),
        });
        summaries.push(compactAnalysis(analysis, snapshot.fileName));
        processedCount += 1;
        onProgress({ phase: 'file', fileIndex: index + 1, totalFiles: files.length, fileName: snapshot.fileName, processedCount, resumedCount });
      } catch (error) {
        const message = text(error?.message || error, 1000);
        errors.push({ fileName: snapshot.fileName, message });
        processedCount += 1;
        await repository.saveAnalysisCheckpoint({
          formulaId: id,
          fileName: snapshot.fileName,
          fileFingerprint: snapshot.sourceFingerprint,
          fileIndex: index,
          totalFiles: files.length,
          status: 'error',
          error: message,
          updatedAt: now().toISOString(),
        });
        onProgress({ phase: 'error', fileIndex: index + 1, totalFiles: files.length, fileName: snapshot.fileName, processedCount, resumedCount, error: message });
      }
    }

    if (cancelled) {
      state = { status: 'cancelled', totalFiles: files.length, processedCount, resumedCount, errors };
      return { formula: null, summaries, errors, processedCount, resumedCount, cancelled: true };
    }
    const boundedSummaries = summaries.slice(0, MAX_ANALYSIS_SUMMARIES);
    const synthesisPrompt = buildFormulaSynthesisPrompt({
      formulaName,
      sourceCount: files.length,
      intermediateSummaries: boundedSummaries,
    });
    onProgress({ phase: 'synthesis', totalFiles: files.length, processedCount, resumedCount });
    let synthesized;
    try {
      synthesized = parseStructuredFormulaAnalysis(await callAi(`${synthesisPrompt}\n\nsynthesizing`));
    } catch (error) {
      errors.push({ fileName: '__synthesis__', message: text(error?.message || error, 1000) });
      synthesized = {};
    }
    const safe = sanitizeChannelFormula({
      ...synthesized,
      id,
      name: text(formulaName, 120) || 'Channel Formula',
      sourceCount: files.length,
      sourceFingerprint: fingerprintSource(files.map(file => file.name).join('\n')),
      analysis: synthesized.analysis || buildFallbackAnalysisSummaries(boundedSummaries),
      reproductionPrompt: synthesized.reproductionPrompt || [
        '日本語のみで書く。抽象化された構成規則だけを使い、原文の固有名詞・台詞・事件を再利用しない。',
        '4章構成で、各章に新しい事実・選択・代償を置き、最後は具体的な行動と後日談で完結させる。',
        '空白を除く20,000字以上、目標22,000字で、分析メモやプロンプトを本文に出さない。',
      ].join('\n'),
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
    });
    const formula = await repository.saveFormula(safe);
    state = { status: errors.length ? 'completed-with-errors' : 'completed', totalFiles: files.length, processedCount, resumedCount, errors, formula };
    onProgress({ phase: 'complete', totalFiles: files.length, processedCount, resumedCount, formula, errors });
    return { formula, summaries, errors, processedCount, resumedCount, cancelled: false };
  }

  return {
    startAnalysis,
    pauseAnalysis: pause,
    resumeAnalysis: resume,
    cancelAnalysis: cancel,
    getState: () => ({ ...state, errors: [...(state.errors || [])] }),
  };
}

function renderFormulaPreview(element, formula) {
  if (!element) return;
  if (!formula) {
    element.textContent = 'Chọn hoặc phân tích một công thức để xem chi tiết.';
    return;
  }
  const analysis = formula.analysis || {};
  element.textContent = [
    `Tên: ${formula.name}`,
    `Ngôn ngữ: ${formula.language} · Nguồn: ${formula.sourceCount} file`,
    `Góc nhìn: ${analysis.pointOfView || '—'}`,
    `Tông: ${analysis.tone || '—'}`,
    `Móc mở đầu: ${analysis.openingHook || '—'}`,
    `Nhân vật chính: ${analysis.protagonistPattern || '—'}`,
    `Đối trọng: ${analysis.antagonistPattern || '—'}`,
    `Nhịp leo thang: ${(analysis.escalationPattern || []).join(' → ') || '—'}`,
    `Bật mí/chứng cứ: ${analysis.revealPattern || '—'}`,
    `Payoff: ${analysis.justicePayoff || '—'}`,
    `Hậu truyện: ${analysis.epiloguePattern || '—'}`,
    `Chính sách: tối thiểu ${formula.generationPolicy.minNonWhitespaceChars.toLocaleString('vi-VN')} · mục tiêu ${formula.generationPolicy.targetNonWhitespaceChars.toLocaleString('vi-VN')} · ${formula.generationPolicy.chapterCount} chương`,
    `Cấm sao chép: ${(analysis.forbiddenPatterns || []).join('; ') || '—'}`,
  ].join('\n');
}

export function installChannelFormulaRuntime({
  doc = globalThis.document,
  win = globalThis.window,
  repository = null,
  controller = null,
  callStructuredAi,
  callGeneration,
  getApiSession,
} = {}) {
  const panel = doc?.getElementById?.('channel-formula-panel');
  if (!panel || panel.dataset.channelFormulaReady) return null;
  panel.dataset.channelFormulaReady = 'true';
  const activeRepository = repository || createChannelFormulaRepository();
  let matrixRepository = null;
  const lastMatrixSelections = new Map();
  const getMatrixRepository = () => {
    if (matrixRepository) return matrixRepository;
    try {
      matrixRepository = createStoryDnaMatrixRepository();
    } catch {
      matrixRepository = null;
    }
    return matrixRepository;
  };
  const formulas = new Map(BUILTIN_CHANNEL_FORMULAS.map(formula => [formula.id, sanitizeChannelFormula(formula)]));
  let selected = null;
  const getSession = getApiSession || (() => readApiSession());
  let activeController = controller || createChannelFormulaRuntimeController({
    repository: activeRepository,
    callStructuredAi: callStructuredAi || createDefaultStructuredCaller({ getApiSession: getSession }),
    onProgress: progress => {
      const status = doc.getElementById('cf-progress');
      if (!status) return;
      if (progress.phase === 'file' || progress.phase === 'resume' || progress.phase === 'error') {
        status.textContent = `${progress.phase === 'error' ? 'Lỗi' : 'Đã xử lý'} file ${progress.fileIndex}/${progress.totalFiles}: ${progress.fileName || ''}`;
      } else if (progress.phase === 'synthesis') status.textContent = 'Đang tổng hợp công thức…';
      else if (progress.phase === 'complete') status.textContent = `Hoàn tất: ${progress.processedCount}/${progress.totalFiles} file.`;
    },
  });

  const select = doc.getElementById('cf-formula-select');
  const preview = doc.getElementById('cf-preview');
  const hidden = doc.getElementById('cf-selected-formula');
  const generateButton = doc.getElementById('cf-generate');
  const renderSelect = async () => {
    const dynamic = await activeRepository.listFormulas?.() || [];
    for (const formula of dynamic) formulas.set(formula.id, sanitizeChannelFormula(formula));
    if (select) {
      select.innerHTML = [...formulas.values()].map(formula => `<option value="${escapeHtml(formula.id)}">${escapeHtml(formula.name)}</option>`).join('');
      if (selected?.id) select.value = selected.id;
    }
  };
  const choose = formula => {
    selected = formula ? sanitizeChannelFormula(formula) : null;
    if (hidden) hidden.value = selected ? JSON.stringify(selected) : '';
    renderFormulaPreview(preview, selected);
    if (generateButton) generateButton.disabled = !selected;
  };
  const error = message => {
    const element = doc.getElementById('cf-error');
    if (element) { element.textContent = text(message, 1000); element.classList.remove('hidden'); }
  };
  win?.addEventListener?.('story-maker:channel-formula-imported', event => {
    const imported = event.detail;
    if (!imported) return choose(null);
    formulas.set(imported.id, sanitizeChannelFormula(imported));
    choose(imported);
    renderSelect().catch(cause => error(cause?.message || cause));
  });
  win?.addEventListener?.('story-maker:open-formulas', () => {
    renderSelect().catch(cause => error(cause?.message || cause));
  });
  panel.addEventListener('change', async event => {
    if (event.target?.id === 'cf-formula-select') choose(formulas.get(event.target.value));
    if (event.target?.id === 'cf-folder-input') {
      const analyze = doc.getElementById('cf-analyze');
      if (analyze) analyze.disabled = !filterChannelFormulaTextFiles(event.target.files).length;
    }
  });
  panel.addEventListener('click', async event => {
    const actionTarget = event.target?.closest?.('[id]') || event.target;
    const id = actionTarget?.id;
    if (id === 'cf-analyze') {
      const files = filterChannelFormulaTextFiles(doc.getElementById('cf-folder-input')?.files);
      if (!files.length) return error('Hãy chọn folder có file TXT.');
      const name = text(doc.getElementById('cf-formula-name')?.value, 120) || 'Channel Formula';
      const analyzeButton = doc.getElementById('cf-analyze');
      const cancelButton = doc.getElementById('cf-cancel');
      if (analyzeButton) analyzeButton.disabled = true;
      if (cancelButton) cancelButton.disabled = false;
      try {
        const result = await activeController.startAnalysis(files, { formulaName: name });
        if (result.formula) { formulas.set(result.formula.id, result.formula); choose(result.formula); await renderSelect(); }
        if (result.errors?.length) error(`Hoàn tất nhưng có ${result.errors.length} lỗi. Bạn có thể chạy lại để resume.`);
      } catch (cause) { error(cause?.message || cause); }
      finally {
        if (analyzeButton) analyzeButton.disabled = false;
        if (cancelButton) cancelButton.disabled = true;
      }
    }
    if (id === 'cf-cancel') activeController.cancelAnalysis();
    if (id === 'cf-save' && selected) {
      const saved = await activeRepository.saveFormula({ ...selected, name: text(doc.getElementById('cf-formula-name')?.value, 120) || selected.name });
      formulas.set(saved.id, saved); choose(saved); await renderSelect();
    }
    if (id === 'cf-delete' && selected) {
      if (selected.builtIn) return error('Công thức built-in không thể xóa.');
      await activeRepository.deleteDynamicFormula(selected.id);
      formulas.delete(selected.id); choose(null); await renderSelect();
    }
    if (id === 'cf-export' && selected) {
      const blob = new Blob([JSON.stringify(activeRepository.exportFormula(selected), null, 2)], { type: 'application/json' });
      const anchor = doc.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${selected.name}.json`; anchor.click(); URL.revokeObjectURL(anchor.href);
    }
    if (id === 'cf-import') doc.getElementById('cf-import-file')?.click();
    if (id === 'cf-generate' && selected) {
      setFormulaGenerationBusyUi({
        doc,
        busy: true,
        busyLabel: '⏳ AI đang random mô típ…',
        message: 'AI đang random mô típ và điền thiết lập Dashboard…',
      });
      try {
        const matrices = await getMatrixRepository()?.listMatrices(selected.id) || [];
        const result = await randomizeAndApplyFormulaSettings({
          formula: selected,
          matrix: matrices[0] || null,
          callStructuredAi: callStructuredAi || createDefaultStructuredCaller({ getApiSession: getSession }),
          applySettings: applyGenerationSettings,
          dispatchDashboardOpen: () => win?.dispatchEvent?.(new win.CustomEvent('story-maker:open-dashboard')),
          lastMatrixSelections,
          onStatus: status => {
            const progress = doc.getElementById('cf-progress');
            if (progress && status.message) progress.textContent = status.message;
          },
        });
        const resultCard = doc.getElementById('cf-result-card');
        const resultElement = doc.getElementById('cf-result');
        if (resultCard) resultCard.classList.remove('hidden');
        if (resultElement) {
          resultElement.textContent = result.usedFallback
            ? 'Đã điền thiết lập bằng mô típ dự phòng. Hãy kiểm tra Dashboard rồi bấm Tạo truyện.'
            : 'Đã điền thiết lập bằng AI. Hãy kiểm tra Dashboard rồi bấm Tạo truyện.';
        }
        setFormulaGenerationBusyUi({
          doc,
          busy: false,
          message: result.usedFallback
            ? 'Hoàn tất fallback: Dashboard đã sẵn sàng.'
            : 'Hoàn tất: Dashboard đã sẵn sàng.',
        });
      } catch (cause) {
        setFormulaGenerationBusyUi({ doc, busy: false, message: 'Random mô típ thất bại — xem chi tiết lỗi bên dưới.' });
        error(cause?.message || cause);
      }
    }
  });
  doc.getElementById('cf-import-file')?.addEventListener('change', async event => {
    const file = event.target?.files?.[0];
    if (!file) return;
    try {
      const imported = parseChannelFormulaImport(await file.text());
      formulas.set(imported.id, imported); choose(imported); await renderSelect();
    } catch (cause) { error(cause?.message || cause); }
    event.target.value = '';
  });
  const firstBuiltIn = formulas.values().next().value;
  if (firstBuiltIn) choose(firstBuiltIn);
  renderSelect().then(() => {
    if (!selected) {
      const first = formulas.values().next().value;
      if (first) choose(first);
    }
  }).catch(cause => error(cause?.message || cause));
  return {
    controller: activeController,
    listFormulas: () => [...formulas.values()],
    selectFormula: id => choose(formulas.get(id)),
    getSelectedFormula: () => selected,
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installChannelFormulaRuntime());
  else installChannelFormulaRuntime();
}

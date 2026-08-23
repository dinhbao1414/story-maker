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
import { BUILTIN_CHANNEL_FORMULAS } from './channelFormulaCatalog.js';
import { Gt } from './providerClients.js';
import { readApiSession } from './apiSession.js';

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
  const formulas = new Map(BUILTIN_CHANNEL_FORMULAS.map(formula => [formula.id, sanitizeChannelFormula(formula)]));
  let selected = null;
  const getSession = getApiSession || (() => readApiSession());
  const activeGeneration = callGeneration || createDefaultGenerationCaller({ getApiSession: getSession });
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
    const id = event.target?.id;
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
      try {
        win?.dispatchEvent?.(new win.CustomEvent('story-maker:channel-formula-context', { detail: { formula: selected } }));
        const result = await generateFormulaStory({ formula: selected, callGeneration: activeGeneration });
        const resultCard = doc.getElementById('cf-result-card');
        const resultElement = doc.getElementById('cf-result');
        if (resultCard) resultCard.classList.remove('hidden');
        if (resultElement) resultElement.textContent = result?.text ? `Đã tạo ${Array.from(result.text).length.toLocaleString('vi-VN')} ký tự.` : 'Đã gửi yêu cầu tạo truyện.';
      } catch (cause) { error(cause?.message || cause); }
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
  renderSelect().then(() => {
    const first = formulas.values().next().value;
    if (first) choose(first);
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

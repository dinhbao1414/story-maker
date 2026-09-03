import {
  STORY_DNA_FIELDS,
  buildStoryDnaFingerprint,
  compareStoryDnaRows,
  normalizeStoryDnaRow,
  reindexStoryDnaRows,
} from './storyDnaMatrix.js';
import {
  isChannelFormulaAnalysisReady,
  sanitizeChannelFormula,
} from './channelFormula.js';
import { createStoryDnaMatrixRepository } from './storyDnaMatrixStorage.js';
import { Gt } from './providerClients.js';
import { readApiSession } from './apiSession.js';

function text(value, maxLength = 1200) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

const STORY_DNA_FIELD_ALIASES = Object.freeze({
  titlePromise: ['titlePromise', 'title_promise', 'title'],
  hook: ['hook', 'openingHook', 'opening_hook'],
  victim: ['victim', 'protagonist', 'targetVictim', 'target_victim'],
  antagonist: ['antagonist', 'villain', 'opponent'],
  falseAccusation: ['falseAccusation', 'false_accusation', 'accusation'],
  location: ['location', 'setting', 'place'],
  evidence: ['evidence', 'proof', 'clue'],
  secret: ['secret', 'hiddenSecret', 'hidden_secret'],
  midpointTwist: ['midpointTwist', 'midpoint_twist', 'midpoint'],
  finalTwist: ['finalTwist', 'final_twist', 'endingTwist', 'ending_twist'],
  villainConsequence: ['villainConsequence', 'villain_consequence', 'consequence'],
  ending: ['ending', 'resolution', 'epilogue'],
  moralDilemma: ['moralDilemma', 'moral_dilemma', 'commentDilemma', 'comment_dilemma'],
});

function readAliasedField(value, aliases = []) {
  for (const alias of aliases) {
    if (value?.[alias] != null && String(value[alias]).trim()) return value[alias];
  }
  return '';
}

function normalizeMatrixCardShape(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return {
    ...value,
    ...Object.fromEntries(
      Object.entries(STORY_DNA_FIELD_ALIASES)
        .map(([field, aliases]) => [field, readAliasedField(value, aliases)])
        .filter(([, fieldValue]) => fieldValue !== ''),
    ),
  };
}

function isMatrixCardLike(value) {
  const normalized = normalizeMatrixCardShape(value);
  return Boolean(
    normalized
    && typeof normalized === 'object'
    && !Array.isArray(normalized)
    && normalized.hook
    && normalized.location
    && normalized.evidence
    && normalized.midpointTwist
  );
}

function extractJsonArray(value, depth = 0) {
  if (depth > 6 || value == null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    if (isMatrixCardLike(value)) return [value];
    const preferredKeys = [
      'rows',
      'cards',
      'storyCards',
      'story_cards',
      'stories',
      'matrix',
      'data',
      'result',
      'output',
      'output_text',
      'text',
      'content',
    ];
    for (const key of preferredKeys) {
      if (!Object.hasOwn(value, key)) continue;
      const extracted = extractJsonArray(value[key], depth + 1);
      if (Array.isArray(extracted)) return extracted;
    }
    const messageContent = value?.choices?.[0]?.message?.content;
    if (messageContent) {
      const extracted = extractJsonArray(messageContent, depth + 1);
      if (Array.isArray(extracted)) return extracted;
    }
    const keyedCards = Object.values(value).filter(isMatrixCardLike);
    if (keyedCards.length) return keyedCards;
    for (const nested of Object.values(value)) {
      const extracted = extractJsonArray(nested, depth + 1);
      if (Array.isArray(extracted) && extracted.some(item => item && typeof item === 'object')) {
        return extracted;
      }
    }
    return null;
  }
  const source = text(value, 200000)
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/giu, '')
    .trim();
  if (!source) return null;
  const candidates = [source];
  for (const match of source.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)) {
    if (match[1]?.trim()) candidates.push(match[1].trim());
  }
  const arrayStart = source.indexOf('[');
  const arrayEnd = source.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(source.slice(arrayStart, arrayEnd + 1));
  }
  const objectStart = source.indexOf('{');
  const objectEnd = source.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(source.slice(objectStart, objectEnd + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const extracted = extractJsonArray(parsed, depth + 1);
      if (Array.isArray(extracted)) return extracted;
    } catch {
      // Try the next bounded candidate.
    }
  }
  return null;
}

export function buildStoryDnaMatrixPrompt({
  formula = {},
  targetCount = 30,
  existingRows = [],
} = {}) {
  const safeFormula = sanitizeChannelFormula(formula);
  const formulaDigest = {
    name: safeFormula.name,
    reproductionPrompt: safeFormula.reproductionPrompt,
    analysis: {
      genre: safeFormula.analysis?.genre,
      audience: safeFormula.analysis?.audience,
      pointOfView: safeFormula.analysis?.pointOfView,
      tone: safeFormula.analysis?.tone,
      openingHook: safeFormula.analysis?.openingHook,
      protagonistPattern: safeFormula.analysis?.protagonistPattern,
      antagonistPattern: safeFormula.analysis?.antagonistPattern,
      escalationPattern: safeFormula.analysis?.escalationPattern,
      revealPattern: safeFormula.analysis?.revealPattern,
      evidenceMotifs: safeFormula.analysis?.evidenceMotifs,
      justicePayoff: safeFormula.analysis?.justicePayoff,
      epiloguePattern: safeFormula.analysis?.epiloguePattern,
      narrationRules: safeFormula.analysis?.narrationRules,
      pacingRules: safeFormula.analysis?.pacingRules,
      characterSystem: safeFormula.analysis?.characterSystem,
      evidenceSystem: safeFormula.analysis?.evidenceSystem,
      storyArchitecture: safeFormula.analysis?.storyArchitecture,
      audienceGrowthSystem: safeFormula.analysis?.audienceGrowthSystem,
      styleFingerprint: safeFormula.analysis?.styleFingerprint,
      formulaPatterns: safeFormula.analysis?.formulaPatterns,
      variationSystem: safeFormula.analysis?.variationSystem,
      forbiddenPatterns: safeFormula.analysis?.forbiddenPatterns,
    },
  };
  const existing = Array.isArray(existingRows)
    ? existingRows.slice(-20).map(row => ({
      hook: row.hook,
      location: row.location,
      evidence: row.evidence,
      midpointTwist: row.midpointTwist,
      finalTwist: row.finalTwist,
    }))
    : [];
  return [
    'あなたは日本語YouTube家族ドラマのシリーズ企画編集者です。',
    '選択されたチャンネル公式の抽象ルールを守り、独立したstory cardをJSON objectのrows配列に入れて作ってください。',
    'Channel Formula production DNA:',
    text(JSON.stringify(formulaDigest, null, 2), 24000),
    `作成数: ${Math.max(1, Math.min(50, Number(targetCount) || 30))}`,
    '各rowにはtitlePromise, hook, victim, antagonist, falseAccusation, location, evidence, secret, midpointTwist, finalTwist, villainConsequence, ending, moralDilemmaを必ず入れてください。',
    '30〜50件のシリーズではlocationを8〜12種類、evidenceを6種類以上、antagonistを6種類以上、midpointTwistを5種類以上、villainConsequenceを5種類以上に分散してください。',
    '隣り合うrowでevidenceとmidpointTwistを同時に繰り返さないでください。同じ不公平を別の名前に言い換えただけのrowも禁止です。',
    '原文の固有名詞、台詞、正確な引用、raw source、チャンネルCTA、固有事件をコピーしないでください。',
    '次の既存候補とsemanticに重なるhook/evidence/twistを避けてください:',
    JSON.stringify(existing, null, 2),
    '必ず {"rows":[...]} という単一のJSON objectだけを返してください。説明文、Markdown、番号付き解説は返さないでください。',
    JSON.stringify({
      rows: [{
        id: 'story-001',
        titlePromise: 'CTR promise',
        hook: 'opening shock',
        victim: 'victim pattern',
        antagonist: 'opponent pattern',
        falseAccusation: 'false accusation',
        location: 'specific setting',
        evidence: 'concrete evidence',
        secret: 'hidden secret',
        midpointTwist: 'midpoint reversal',
        finalTwist: 'final reversal',
        villainConsequence: 'consequence',
        ending: 'complete ending',
        moralDilemma: 'debatable moral question',
      }],
    }, null, 2),
  ].join('\n\n');
}

export function parseStoryDnaMatrixResponse(value, {
  formulaId = '',
  targetCount = 30,
} = {}) {
  const parsed = extractJsonArray(value);
  if (!Array.isArray(parsed)) {
    return { rows: [], errors: ['Matrix response must contain a rows/cards array or one valid story card object.'] };
  }
  const errors = [];
  const rows = [];
  parsed.slice(0, Math.max(1, Math.min(50, Number(targetCount) || 30))).forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Matrix row ${index + 1} is invalid.`);
      return;
    }
    const row = normalizeStoryDnaRow(normalizeMatrixCardShape(item), { formulaId });
    const required = ['hook', 'location', 'evidence', 'midpointTwist'];
    if (required.some(field => !row[field])) {
      errors.push(`Matrix row ${index + 1} is missing a required DNA field.`);
      return;
    }
    rows.push(row);
  });
  return { rows, errors };
}

const FALLBACK_VALUES = Object.freeze([
  ['公開の場で責任を押し付けられた娘', '雨の地方駅', '改ざんされた領収書', '味方の証言が別の被害者を守っていた'],
  ['介護を押し付けられた姉', '海辺の共同住宅', '録音の消えた携帯電話', '沈黙した母が過去の約束を隠していた'],
  ['相続を奪われた弟', '山間の診療所', '日付の違う契約書', '反対者が守ろうとした人物は別の加害者だった'],
  ['再婚家庭で疑われた妻', '駅前の古い商店街', '裏返された家族写真', '証人の記憶が意図的に入れ替えられていた'],
  ['会社を追われた兄', '雪の降る郊外の工場', '未送信のメッセージ', '敵対者の告発は主人公を試すためだった'],
  ['家族会議で孤立した妹', '夜の市役所ロビー', '二重に発行された整理券', '隠された秘密は家族ではなく地域全体に関係していた'],
  ['店を継がされることになった娘', '港の小さな食堂', '消えた配達伝票', '協力者は利益ではなく約束のために嘘をついていた'],
  ['名誉を失った教師', '古い学校の体育館', '欠けた防犯映像', '最初の被害者が最後の証人だった'],
  ['追い出された妻', '団地の集会室', '封印された手紙', '反撃の証拠が主人公自身の過去を映していた'],
  ['家族に裏切られた祖母', '地方病院の待合室', '取り違えられた診察券', '守られた秘密が別の人の人生を壊していた'],
]);

const FALLBACK_VARIANTS = Object.freeze([
  {
    titleAction: '沈黙を破った',
    hookSituation: '親族全員の前で退席を命じられた直後',
    antagonist: '世間体と根回しで周囲を支配する親族',
    accusation: '家族の資産を故意に失わせた',
    secret: '複数の時刻記録が同じ人物によって書き換えられていた',
    midpointLayer: '告発を始めた人物も別の嘘に利用されていた',
    finalTwist: '主人公への告発は、さらに弱い被害者を隠すための囮だった',
    consequence: '反対者は隠していた利害関係と虚偽の説明を公の場で認める',
    ending: '主人公は家族の許可を求めず、新しい生活の契約を自分で結ぶ',
    dilemma: '真実を公表して、利用されていた告発者まで傷つけるべきなのか。',
  },
  {
    titleAction: '追放から戻った',
    hookSituation: '重要な式典で身に覚えのない謝罪文を読まされそうになった瞬間',
    antagonist: '制度と肩書きを盾に責任を移す年長者',
    accusation: '共同体の信用を壊す情報を流した',
    secret: '保管場所の異なる三つの記録に同じ偽造痕が残っていた',
    midpointLayer: '味方の沈黙は裏切りではなく、証拠を守るための時間稼ぎだった',
    finalTwist: '失われたと思われた原本は、反対者自身が安全な場所へ移していた',
    consequence: '反対者は役職と決定権を失い、被害回復の費用を負担する',
    ending: '主人公は残る人々のための透明な記録制度を作り、静かに町を離れる',
    dilemma: '共同体を立て直すためなら、加害者に最後の協力を求めてもよいのか。',
  },
  {
    titleAction: '一度だけ嘘を選んだ',
    hookSituation: '守るはずだった人物から公開の場で犯人だと指差されたとき',
    antagonist: '被害者のふりをして同情を集める身近な協力者',
    accusation: '弱い家族を利用して自分だけ利益を得た',
    secret: '証言の順番が意図的に入れ替えられ、最初の通報者が消されていた',
    midpointLayer: '主人公が守ろうとした相手こそ、偽証を提案した人物だった',
    finalTwist: '主人公の小さな嘘が、隠されていた本当の被害者を救う唯一の手がかりになる',
    consequence: '反対者は法的責任だけでなく、利用した人々一人ずつに説明を求められる',
    ending: '主人公は完全な和解を拒み、守る相手を自分の意思で選び直す',
    dilemma: '誰かを救った嘘でも、最後にはすべて告白すべきなのか。',
  },
  {
    titleAction: '証拠を捨てたふりをした',
    hookSituation: '唯一の証拠を燃やしたと非難され、鍵を取り上げられた夜',
    antagonist: '金銭管理と情報遮断で家族を分断する管理役',
    accusation: '重要な証拠を消して責任逃れをした',
    secret: '廃棄記録と実際の移動履歴が一致せず、内部に協力者がいた',
    midpointLayer: '消えた証拠は複製されていたが、その複製には主人公の過去の過ちも残っていた',
    finalTwist: '反撃すれば主人公自身も責任を問われる証拠だった',
    consequence: '反対者は管理権を剥奪され、隠した記録を被害者へ返還する',
    ending: '主人公は自分の過ちも認めたうえで、支配されない小さな仕事を始める',
    dilemma: '相手を止めるために、自分の過去まで公表する覚悟は必要なのか。',
  },
  {
    titleAction: '最後の証人を信じた',
    hookSituation: '誰も味方しない調停の席で、知らない番号から一通の連絡が届いた瞬間',
    antagonist: '善意を装い証人同士を接触させない調停役',
    accusation: '争いを作り、家族から金を取ろうとした',
    secret: '別々の証人が同じ言い間違いをしており、証言用の台本が存在した',
    midpointLayer: '最後の証人は事件の目撃者ではなく、台本を書かされた当事者だった',
    finalTwist: '主人公を救う証言は、最も信頼されていなかった人物の記憶から生まれる',
    consequence: '反対者は築いた信用を失い、操作した決定をすべて再審査される',
    ending: '主人公は壊れた関係を元に戻さず、証人と新しい支援の輪を作る',
    dilemma: '過去に嘘をついた証人を、真実を話した一度だけで許せるのか。',
  },
]);

export function buildFallbackStoryDnaRows(formula = {}, targetCount = 30, {
  random = Math.random,
  startIndex = 0,
} = {}) {
  const count = Math.max(1, Math.min(50, Math.floor(Number(targetCount) || 30)));
  const offset = Math.min(FALLBACK_VALUES.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * FALLBACK_VALUES.length));
  return Array.from({ length: count }, (_, index) => {
    const globalIndex = Math.max(0, Math.floor(Number(startIndex) || 0)) + index;
    const baseIndex = (offset + globalIndex) % FALLBACK_VALUES.length;
    const variantIndex = Math.floor(globalIndex / FALLBACK_VALUES.length) % FALLBACK_VARIANTS.length;
    const [victim] = FALLBACK_VALUES[baseIndex];
    const location = FALLBACK_VALUES[(baseIndex + (variantIndex * 2)) % FALLBACK_VALUES.length][1];
    const evidence = FALLBACK_VALUES[(baseIndex + (variantIndex * 3)) % FALLBACK_VALUES.length][2];
    const midpointBase = FALLBACK_VALUES[(baseIndex + (variantIndex * 4)) % FALLBACK_VALUES.length][3];
    const variant = FALLBACK_VARIANTS[variantIndex];
    return normalizeStoryDnaRow({
      id: `fallback-story-${String(globalIndex + 1).padStart(3, '0')}`,
      formulaId: formula.id || '',
      titlePromise: `${variant.titleAction}${victim}が、${evidence}で立場を逆転させる`,
      hook: `${variant.hookSituation}、${evidence}が主人公の前に現れる。`,
      victim,
      antagonist: variant.antagonist,
      falseAccusation: `${victim}が「${variant.accusation}」と決めつけられる`,
      location,
      evidence,
      secret: variant.secret,
      midpointTwist: `${midpointBase}。${variant.midpointLayer}`,
      finalTwist: variant.finalTwist,
      villainConsequence: variant.consequence,
      ending: variant.ending,
      moralDilemma: variant.dilemma,
    });
  });
}

function dedupeRows(rows, existingRows = []) {
  const accepted = [...existingRows];
  for (const row of rows) {
    if (accepted.some(item => item.noveltyFingerprint === row.noveltyFingerprint)) continue;
    const duplicate = accepted.some(item => compareStoryDnaRows(row, item).decision === 'reject');
    if (!duplicate) accepted.push(row);
  }
  return accepted.slice(existingRows.length);
}

export async function generateStoryDnaMatrix({
  formula = {},
  targetCount = 30,
  existingRows = [],
  callStructuredAi,
  onStatus = () => {},
} = {}) {
  const count = Math.max(1, Math.min(50, Math.floor(Number(targetCount) || 30)));
  const aiBatchSize = Math.min(5, count);
  const maxCalls = count * 3;
  let rows = [];
  const errors = [];
  let totalCalls = 0;
  let batchIndex = 0;
  if (typeof callStructuredAi !== 'function') {
    throw new Error('Không có AI provider để tạo Story DNA Matrix. Matrix không sử dụng fallback local.');
  }
  while (rows.length < count && totalCalls < maxCalls) {
    const requested = Math.min(aiBatchSize, count - rows.length);
    const basePrompt = buildStoryDnaMatrixPrompt({
      formula,
      targetCount: requested,
      existingRows: [...existingRows, ...rows],
    });
    let previousResponse = '';
    let acceptedThisBatch = [];
    const batchErrors = [];
    for (let repairAttempt = 0; repairAttempt < 3 && totalCalls < maxCalls; repairAttempt += 1) {
      const prompt = repairAttempt === 0
        ? basePrompt
        : [
          basePrompt,
          '',
          `前回の回答は無効でした: ${batchErrors.at(-1) || 'invalid_json'}`,
          `完全な {"rows":[...]} JSON objectだけを返してください。rows配列には必ず${requested}件を入れてください。`,
          'Markdown、説明文、途中で切れたJSONは禁止です。',
          `修正対象の前回答:\n${text(previousResponse, 30000)}`,
        ].join('\n\n');
      onStatus({
        phase: repairAttempt === 0 ? 'ai' : 'ai-repair',
        message: repairAttempt === 0
          ? `AI đang tạo batch ${batchIndex + 1}: ${requested} card (đã có ${rows.length}/${count})…`
          : `AI đang sửa JSON batch ${batchIndex + 1}, lần ${repairAttempt}/2…`,
      });
      totalCalls += 1;
      try {
        previousResponse = await callStructuredAi(prompt);
        const parsed = parseStoryDnaMatrixResponse(previousResponse, {
          formulaId: formula.id,
          targetCount: requested,
        });
        const accepted = dedupeRows(parsed.rows, [...existingRows, ...rows]);
        if (accepted.length) {
          acceptedThisBatch = accepted;
          if (parsed.errors.length) {
            errors.push(...parsed.errors.map(message => `Batch ${batchIndex + 1}: ${message}`));
          }
          break;
        }
        const detail = parsed.errors.join(', ') || 'AI returned no usable unique rows.';
        const preview = text(
          typeof previousResponse === 'string'
            ? previousResponse
            : JSON.stringify(previousResponse),
          600,
        ).replace(/\s+/gu, ' ');
        batchErrors.push(`${detail}${preview ? ` Response preview: ${preview}` : ''}`);
      } catch (cause) {
        batchErrors.push(text(cause?.message || cause, 1000));
      }
    }
    if (!acceptedThisBatch.length) {
      const detail = batchErrors.at(-1) || 'AI returned no usable rows.';
      throw new Error(
        `AI không tạo được Story DNA Matrix ở batch ${batchIndex + 1} sau 3 lần thử: ${detail} Không có fallback local và chưa lưu Matrix.`,
      );
    }
    rows = [...rows, ...acceptedThisBatch].slice(0, count);
    batchIndex += 1;
  }
  if (rows.length < count) {
    throw new Error(
      `AI chỉ tạo được ${rows.length}/${count} Story DNA card trong giới hạn ${maxCalls} lần gọi. Không có fallback local và chưa lưu Matrix.`,
    );
  }
  return {
    rows: reindexStoryDnaRows(rows.slice(0, count), { formulaId: formula.id }),
    usedFallback: false,
    errors,
    targetCount: count,
  };
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

export function syncStoryDnaMatrixGenerationButton({
  button,
  matrix = null,
  hasFormula = false,
  formulaReady = hasFormula,
} = {}) {
  const ready = Boolean(
    hasFormula
    && formulaReady
    && Array.isArray(matrix?.rows)
    && matrix.rows.length > 0
  );
  if (button) {
    button.classList?.toggle?.('hidden', !ready);
    button.disabled = !ready;
  }
  return ready;
}

export function dispatchStoryDnaMatrixUpdated(win = globalThis.window, detail = {}) {
  if (typeof win?.dispatchEvent !== 'function' || typeof win?.CustomEvent !== 'function') return false;
  win.dispatchEvent(new win.CustomEvent('story-maker:matrix-updated', {
    detail: {
      source: 'story-dna-matrix-runtime',
      ...detail,
    },
  }));
  return true;
}

export async function deleteSelectedStoryDnaMatrix({
  repository,
  matrix = null,
  confirm = globalThis.confirm,
} = {}) {
  if (!repository?.deleteMatrix || !matrix?.id) {
    return { deleted: false, reason: 'missing_matrix' };
  }
  if (typeof confirm === 'function' && !confirm(`Xóa Matrix "${matrix.name || matrix.id}"? Các story card trong Matrix sẽ bị xóa.`)) {
    return { deleted: false, reason: 'cancelled' };
  }
  await repository.deleteMatrix(matrix.id);
  return { deleted: true, id: matrix.id };
}

export function renderStoryDnaMatrixPanel(matrix = null) {
  if (!matrix) {
    return '<div class="cf-matrix-empty">Chưa có Story DNA Matrix. Chọn 30, 40 hoặc 50 story rồi bấm tạo.</div>';
  }
  const rows = Array.isArray(matrix.rows) ? matrix.rows : [];
  const counts = rows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  const rowMarkup = rows.map(row => `
    <tr data-matrix-row-id="${escapeHtml(row.id)}">
      <td>${escapeHtml(row.id)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.hook)}</td>
      <td>${escapeHtml(row.evidence)}</td>
      <td>${escapeHtml(row.midpointTwist)}</td>
      <td><code>${escapeHtml(row.noveltyFingerprint)}</code></td>
      <td class="cf-matrix-row-actions">
        <button type="button" class="btn-secondary" data-matrix-row-action="lock">${row.locked ? 'Mở khóa' : 'Khóa'}</button>
        <button type="button" class="btn-secondary" data-matrix-row-action="skip">Bỏ qua</button>
        <button type="button" class="btn-secondary" data-matrix-row-action="regenerate">Tạo lại</button>
      </td>
    </tr>
  `).join('');
  return `
    <div class="cf-matrix-summary">
      <span>${escapeHtml(matrix.id)}</span>
      <span>Mục tiêu: ${matrix.targetCount}</span>
      <span>Planned: ${counts.planned || 0}</span>
      <span>Used: ${counts.used || 0}</span>
      <span>Skipped: ${counts.skipped || 0}</span>
      <button type="button" class="btn-secondary" data-matrix-row-action="export">Xuất Matrix</button>
      <button type="button" class="btn-secondary" data-matrix-row-action="delete">Xóa Matrix</button>
    </div>
    <div class="cf-matrix-table-wrap">
      <table id="cf-matrix-table-content">
        <thead><tr><th>ID</th><th>Status</th><th>Hook</th><th>Vật chứng</th><th>Midpoint twist</th><th>Fingerprint</th><th>Actions</th></tr></thead>
        <tbody>${rowMarkup}</tbody>
      </table>
    </div>
  `;
}

function resolveSessionKey(session) {
  if (typeof session === 'string') return session;
  return session?.apiKey || session?.key || session?.geminiKey || session?.openaiKey || '';
}

function createDefaultMatrixCaller() {
  return async prompt => {
    const key = resolveSessionKey(readApiSession());
    if (!key) throw new Error('API key chưa được nhập.');
    const result = await Gt(key, 'gemini-3.5-flash', prompt, null, {
      responseMimeType: 'application/json',
      maxTokens: 12000,
      timeoutMs: 300000,
      disableGoogleSearch: true,
    });
    return result?.text ?? result;
  };
}

export function installStoryDnaMatrixRuntime({
  doc = globalThis.document,
  win = globalThis.window,
  repository = null,
  callStructuredAi = null,
} = {}) {
  const root = doc?.getElementById?.('cf-matrix-root');
  if (!root || root.dataset.storyDnaMatrixReady) return null;
  root.dataset.storyDnaMatrixReady = 'true';
  const activeRepository = repository || createStoryDnaMatrixRepository();
  const caller = callStructuredAi || createDefaultMatrixCaller();
  let selectedMatrix = null;
  const getFormula = () => {
    try {
      return JSON.parse(doc.getElementById('cf-selected-formula')?.value || 'null');
    } catch {
      return null;
    }
  };
  const select = doc.getElementById('cf-matrix-select');
  const status = doc.getElementById('cf-matrix-progress');
  const generateButton = doc.getElementById('cf-generate');
  const error = message => {
    const element = doc.getElementById('cf-matrix-error');
    if (element) {
      element.textContent = text(message, 1000);
      element.classList.remove('hidden');
    }
  };
  const render = () => {
    const target = doc.getElementById('cf-matrix-table');
    if (target) target.innerHTML = renderStoryDnaMatrixPanel(selectedMatrix);
  };
  const syncGenerateButton = () => syncStoryDnaMatrixGenerationButton({
    button: generateButton,
    matrix: selectedMatrix,
    hasFormula: Boolean(getFormula()?.id),
    formulaReady: isChannelFormulaAnalysisReady(getFormula() || {}),
  });
  const load = async () => {
    const formula = getFormula();
    if (!formula?.id) {
      selectedMatrix = null;
      if (select) select.innerHTML = '<option value="">Chọn công thức trước</option>';
      syncGenerateButton();
      render();
      return;
    }
    const matrices = await activeRepository.listMatrices(formula.id);
    if (select) {
      select.innerHTML = matrices.length
        ? matrices.map(matrix => `<option value="${escapeHtml(matrix.id)}">${escapeHtml(matrix.name)} (${matrix.rows.length}/${matrix.targetCount})</option>`).join('')
        : '<option value="">Chưa có Matrix</option>';
    }
    selectedMatrix = matrices[0] || null;
    syncGenerateButton();
    render();
  };
  root.addEventListener('change', async event => {
    if (event.target?.id === 'cf-matrix-select' && event.target.value) {
      selectedMatrix = await activeRepository.getMatrix(event.target.value);
      syncGenerateButton();
      render();
    }
  });
  root.addEventListener('click', async event => {
    const target = event.target?.closest?.('[data-matrix-row-action], #cf-matrix-create');
    if (!target) return;
    if (target.id === 'cf-matrix-create') {
      const formula = getFormula();
      if (!formula?.id) return error('Hãy chọn công thức kênh trước.');
      if (!isChannelFormulaAnalysisReady(formula)) {
        return error('Công thức chưa đạt quality gate hoặc là bản fallback cũ. Hãy Phân tích folder thành công trước khi tạo Matrix.');
      }
      const targetCount = Number(doc.getElementById('cf-matrix-count')?.value) || 30;
      target.disabled = true;
      if (status) status.textContent = `Đang tạo Matrix ${targetCount} story card…`;
      try {
        const result = await generateStoryDnaMatrix({
          formula,
          targetCount,
          callStructuredAi: caller,
          onStatus: update => { if (status && update.message) status.textContent = update.message; },
        });
        selectedMatrix = await activeRepository.saveMatrix({
          formulaId: formula.id,
          name: `${formula.name} – Story DNA Matrix`,
          targetCount,
          rows: result.rows,
        });
        await load();
        dispatchStoryDnaMatrixUpdated(win, {
          matrixId: selectedMatrix?.id || '',
          status: 'created',
        });
        if (status) status.textContent = `Đã tạo đủ ${result.rows.length}/${targetCount} Story DNA card hoàn toàn bằng AI.`;
      } catch (cause) {
        if (status) status.textContent = 'Tạo Story DNA Matrix thất bại; không lưu Matrix.';
        error(cause?.message || cause);
      } finally {
        target.disabled = false;
      }
      return;
    }
    if (target.dataset.matrixRowAction === 'delete') {
      if (!selectedMatrix) return;
      const result = await deleteSelectedStoryDnaMatrix({
        repository: activeRepository,
        matrix: selectedMatrix,
        confirm: win?.confirm?.bind?.(win) || globalThis.confirm,
      });
      if (!result.deleted) return;
      selectedMatrix = null;
      await load();
      dispatchStoryDnaMatrixUpdated(win, {
        matrixId: result.id || '',
        status: 'deleted',
      });
      if (status) status.textContent = 'Đã xóa Story DNA Matrix.';
      return;
    }
    const rowElement = target.closest('[data-matrix-row-id]');
    if (!selectedMatrix || !rowElement) {
      if (target.dataset.matrixRowAction === 'export' && selectedMatrix) {
        const blob = new Blob([JSON.stringify(activeRepository.exportMatrix(selectedMatrix), null, 2)], { type: 'application/json' });
        const anchor = doc.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${selectedMatrix.name}.json`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      }
      return;
    }
    const rowId = rowElement.dataset.matrixRowId;
    const row = selectedMatrix.rows.find(item => item.id === rowId);
    if (!row) return;
    if (target.dataset.matrixRowAction === 'lock') {
      selectedMatrix = await activeRepository.updateRow(selectedMatrix.id, rowId, { locked: !row.locked });
    } else if (target.dataset.matrixRowAction === 'skip') {
      selectedMatrix = await activeRepository.updateRow(selectedMatrix.id, rowId, { status: 'skipped' });
    } else if (target.dataset.matrixRowAction === 'regenerate') {
      selectedMatrix = await activeRepository.updateRow(selectedMatrix.id, rowId, {
        status: 'planned',
        usedAt: null,
        storyId: null,
      });
    }
    render();
    dispatchStoryDnaMatrixUpdated(win, {
      matrixId: selectedMatrix?.id || '',
      matrixRowId: rowId,
      status: selectedMatrix?.rows?.find(item => item.id === rowId)?.status || row.status,
    });
  });
  doc.addEventListener('change', event => {
    if (event.target?.id === 'cf-formula-select') load().catch(cause => error(cause?.message || cause));
  });
  win?.addEventListener?.('story-maker:matrix-updated', event => {
    load().then(() => {
      if (status && event?.detail?.status === 'used') {
        status.textContent = `Đã đánh dấu ${event.detail.matrixRowId || 'story card'} là used.`;
      }
    }).catch(cause => error(cause?.message || cause));
  });
  win?.addEventListener?.('story-maker:open-formulas', () => load().catch(cause => error(cause?.message || cause)));
  load().catch(cause => error(cause?.message || cause));
  return {
    load,
    getSelectedMatrix: () => selectedMatrix,
    repository: activeRepository,
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installStoryDnaMatrixRuntime());
  } else {
    installStoryDnaMatrixRuntime();
  }
}

export { text, extractJsonArray };

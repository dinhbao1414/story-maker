import {
  STORY_DNA_FIELDS,
  buildStoryDnaFingerprint,
  compareStoryDnaRows,
  normalizeStoryDnaRow,
} from './storyDnaMatrix.js';

function text(value, maxLength = 1200) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function extractJsonArray(value) {
  if (Array.isArray(value)) return value;
  const source = text(value, 100000)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : parsed?.rows;
  } catch {
    const start = source.indexOf('[');
    const end = source.lastIndexOf(']');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(source.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export function buildStoryDnaMatrixPrompt({
  formula = {},
  targetCount = 30,
  existingRows = [],
} = {}) {
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
    '選択されたチャンネル公式の抽象ルールを守り、独立したstory cardだけをJSON配列で作ってください。',
    `チャンネル公式: ${text(formula.name, 160)}`,
    `作成数: ${Math.max(1, Math.min(50, Number(targetCount) || 30))}`,
    '各rowにはtitlePromise, hook, victim, antagonist, falseAccusation, location, evidence, secret, midpointTwist, finalTwist, villainConsequence, ending, moralDilemmaを必ず入れてください。',
    '30〜50件のシリーズではlocationを8〜12種類、evidenceを6種類以上、antagonistを6種類以上、midpointTwistを5種類以上、villainConsequenceを5種類以上に分散してください。',
    '隣り合うrowでevidenceとmidpointTwistを同時に繰り返さないでください。同じ不公平を別の名前に言い換えただけのrowも禁止です。',
    '原文の固有名詞、台詞、正確な引用、raw source、チャンネルCTA、固有事件をコピーしないでください。',
    '次の既存候補とsemanticに重なるhook/evidence/twistを避けてください:',
    JSON.stringify(existing, null, 2),
    'JSON配列のみを返してください。説明文、Markdown、番号付き解説は返さないでください。',
    JSON.stringify([{
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
    }], null, 2),
  ].join('\n\n');
}

export function parseStoryDnaMatrixResponse(value, {
  formulaId = '',
  targetCount = 30,
} = {}) {
  const parsed = extractJsonArray(value);
  if (!Array.isArray(parsed)) {
    return { rows: [], errors: ['Matrix response must be a JSON array.'] };
  }
  const errors = [];
  const rows = [];
  parsed.slice(0, Math.max(1, Math.min(50, Number(targetCount) || 30))).forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Matrix row ${index + 1} is invalid.`);
      return;
    }
    const row = normalizeStoryDnaRow(item, { formulaId });
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

export function buildFallbackStoryDnaRows(formula = {}, targetCount = 30, {
  random = Math.random,
} = {}) {
  const count = Math.max(1, Math.min(50, Math.floor(Number(targetCount) || 30)));
  const offset = Math.min(FALLBACK_VALUES.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * FALLBACK_VALUES.length));
  return Array.from({ length: count }, (_, index) => {
    const [victim, location, evidence, midpointTwist] = FALLBACK_VALUES[(offset + index) % FALLBACK_VALUES.length];
    return normalizeStoryDnaRow({
      id: `fallback-story-${String(index + 1).padStart(3, '0')}`,
      formulaId: formula.id || '',
      titlePromise: `${victim}が一つの証拠で立場を逆転させる`,
      hook: `「あなたが悪い」と言われた瞬間、${evidence}が主人公の前に現れる。`,
      victim,
      antagonist: `家族内の評判を利用する第${(index % 5) + 1}の反対者`,
      falseAccusation: `${victim}が隠された損失の責任を負わされる`,
      location,
      evidence,
      secret: `過去の記録に${index + 1}つの不自然な空白がある`,
      midpointTwist,
      finalTwist: `主人公が信じた証拠の意味が最後に反転する`,
      villainConsequence: `反対者は公開の場で責任と選択の結果を引き受ける`,
      ending: '主人公が自分の生活と境界線を選び直す',
      moralDilemma: '真実を公開して関係を壊すことは正義なのか。',
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
  random = Math.random,
  onStatus = () => {},
} = {}) {
  const count = Math.max(1, Math.min(50, Math.floor(Number(targetCount) || 30)));
  let rows = [];
  let usedFallback = false;
  const call = async remaining => {
    if (typeof callStructuredAi !== 'function') throw new Error('structured_ai_unavailable');
    onStatus({ phase: 'ai', message: `AI đang tạo ${remaining} story card còn thiếu…` });
    return callStructuredAi(buildStoryDnaMatrixPrompt({
      formula,
      targetCount: remaining,
      existingRows: [...existingRows, ...rows],
    }));
  };
  try {
    const first = parseStoryDnaMatrixResponse(await call(count), {
      formulaId: formula.id,
      targetCount: count,
    });
    rows = dedupeRows(first.rows, existingRows);
    if (rows.length < count) {
      const supplement = parseStoryDnaMatrixResponse(await call(count - rows.length), {
        formulaId: formula.id,
        targetCount: count - rows.length,
      });
      rows = [...rows, ...dedupeRows(supplement.rows, [...existingRows, ...rows])];
    }
  } catch {
    usedFallback = true;
    onStatus({ phase: 'fallback', message: 'AI không phản hồi; đang dùng Matrix fallback…' });
  }
  if (rows.length < count) {
    const fallback = buildFallbackStoryDnaRows(formula, count - rows.length, { random });
    rows = [...rows, ...dedupeRows(fallback, [...existingRows, ...rows])];
    usedFallback = true;
  }
  return {
    rows: rows.slice(0, count),
    usedFallback,
    errors: [],
    targetCount: count,
  };
}

export { text, extractJsonArray };

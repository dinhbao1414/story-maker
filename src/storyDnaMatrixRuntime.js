import {
  STORY_DNA_FIELDS,
  buildStoryDnaFingerprint,
  compareStoryDnaRows,
  normalizeStoryDnaRow,
} from './storyDnaMatrix.js';
import { createStoryDnaMatrixRepository } from './storyDnaMatrixStorage.js';
import { Gt } from './providerClients.js';
import { readApiSession } from './apiSession.js';

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

function escapeHtml(value) {
  return text(value, 2000).replace(/[&<>"']/gu, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
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
    const result = await Gt(key, 'gemini-3.5-flash', prompt, {
      responseMimeType: 'application/json',
      maxTokens: 12000,
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
  const load = async () => {
    const formula = getFormula();
    if (!formula?.id) {
      selectedMatrix = null;
      if (select) select.innerHTML = '<option value="">Chọn công thức trước</option>';
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
    render();
  };
  root.addEventListener('change', async event => {
    if (event.target?.id === 'cf-matrix-select' && event.target.value) {
      selectedMatrix = await activeRepository.getMatrix(event.target.value);
      render();
    }
  });
  root.addEventListener('click', async event => {
    const target = event.target?.closest?.('[data-matrix-row-action], #cf-matrix-create');
    if (!target) return;
    if (target.id === 'cf-matrix-create') {
      const formula = getFormula();
      if (!formula?.id) return error('Hãy chọn công thức kênh trước.');
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
        if (status) status.textContent = result.usedFallback
          ? 'Đã tạo Matrix bằng fallback local.'
          : 'Đã tạo Story DNA Matrix.';
      } catch (cause) {
        error(cause?.message || cause);
      } finally {
        target.disabled = false;
      }
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
  });
  doc.addEventListener('change', event => {
    if (event.target?.id === 'cf-formula-select') load().catch(cause => error(cause?.message || cause));
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

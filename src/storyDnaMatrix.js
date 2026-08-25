export const STORY_DNA_MATRIX_SCHEMA = 'story-maker-story-dna-matrix-v1';

export const STORY_DNA_FIELDS = Object.freeze([
  'titlePromise',
  'hook',
  'victim',
  'antagonist',
  'falseAccusation',
  'location',
  'evidence',
  'secret',
  'midpointTwist',
  'finalTwist',
  'villainConsequence',
  'ending',
  'moralDilemma',
]);

export const STORY_DNA_SIMILARITY_WEIGHTS = Object.freeze({
  hook: 0.18,
  midpointTwist: 0.16,
  finalTwist: 0.13,
  evidence: 0.12,
  falseAccusation: 0.10,
  antagonist: 0.09,
  secret: 0.08,
  location: 0.06,
  ending: 0.05,
  villainConsequence: 0.03,
});

const STATUSES = new Set(['planned', 'used', 'skipped']);
const SECRET_KEY_PATTERN = /(?:api.?key|authorization|token|secret|password|credential)/i;
const RAW_SOURCE_KEY_PATTERN = /(?:raw.?source|source.?text|full.?text|source.?content|transcript)/i;
const MAX_FIELD_LENGTH = 1200;

function cleanText(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function sanitizeValue(value, depth = 0) {
  if (depth > 5 || value == null) return value == null ? null : undefined;
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 80)
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

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeComparable(value) {
  return cleanText(value, MAX_FIELD_LENGTH)
    .toLocaleLowerCase('ja-JP')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeComparable(value);
  if (!normalized) return new Set();
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 1) return new Set(tokens);
  return new Set(Array.from(normalized));
}

function tokenOverlap(left, right) {
  const a = tokenize(left);
  const b = tokenize(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

function normalizeStatus(value) {
  const status = cleanText(value, 20);
  return STATUSES.has(status) ? status : 'planned';
}

export function buildStoryDnaFingerprint(row = {}) {
  const material = STORY_DNA_FIELDS
    .map(field => normalizeComparable(row[field]))
    .join('|');
  return stableHash(material);
}

export function normalizeStoryDnaRow(value = {}, { formulaId = '' } = {}) {
  const safe = sanitizeValue(value) || {};
  const normalized = {
    id: cleanText(safe.id, 120) || `story-${Date.now()}`,
    formulaId: cleanText(safe.formulaId || formulaId, 160),
    status: normalizeStatus(safe.status),
    ...Object.fromEntries(STORY_DNA_FIELDS.map(field => [field, cleanText(safe[field])])),
    noveltyFingerprint: cleanText(safe.noveltyFingerprint, 80),
    usedAt: cleanText(safe.usedAt, 80) || null,
    storyId: cleanText(safe.storyId, 160) || null,
    locked: safe.locked === true,
    createdAt: cleanText(safe.createdAt, 80),
    updatedAt: cleanText(safe.updatedAt, 80),
  };
  normalized.noveltyFingerprint = buildStoryDnaFingerprint(normalized);
  return normalized;
}

export function normalizeStoryDnaMatrix(value = {}, { now = new Date(), makeId } = {}) {
  const safe = sanitizeValue(value) || {};
  const timestamp = now instanceof Date ? now.toISOString() : new Date().toISOString();
  const formulaId = cleanText(safe.formulaId, 160);
  const rows = Array.isArray(safe.rows)
    ? safe.rows.map(row => normalizeStoryDnaRow(row, { formulaId }))
    : [];
  const matrix = {
    ...safe,
    schema: STORY_DNA_MATRIX_SCHEMA,
    id: cleanText(safe.id, 160) || (makeId ? makeId() : `matrix-${Date.now()}-${stableHash(formulaId)}`),
    formulaId,
    name: cleanText(safe.name, 160) || 'Story DNA Matrix',
    targetCount: Math.max(1, Math.min(50, Math.floor(Number(safe.targetCount) || 30))),
    rows,
    createdAt: cleanText(safe.createdAt, 80) || timestamp,
    updatedAt: cleanText(safe.updatedAt, 80) || timestamp,
  };
  delete matrix.apiKey;
  delete matrix.rawSourceText;
  return matrix;
}

function isExactMatch(left, right) {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  return Boolean(a && b && a === b);
}

export function compareStoryDnaRows(candidate = {}, existing = {}, {
  safeThreshold = 0.35,
  warningThreshold = 0.55,
} = {}) {
  const overlappingFields = [];
  let score = 0;
  for (const [field, weight] of Object.entries(STORY_DNA_SIMILARITY_WEIGHTS)) {
    const overlap = tokenOverlap(candidate[field], existing[field]);
    if (overlap >= 0.72) {
      overlappingFields.push(field);
      score += weight * Math.max(overlap, isExactMatch(candidate[field], existing[field]) ? 1 : 0.72);
    }
  }
  const hardDuplicate = (
    ['hook', 'evidence', 'midpointTwist'].every(field => isExactMatch(candidate[field], existing[field]))
    || ['falseAccusation', 'location', 'finalTwist'].every(field => isExactMatch(candidate[field], existing[field]))
  );
  const decision = hardDuplicate || score > warningThreshold
    ? 'reject'
    : score >= safeThreshold
      ? 'warning'
      : 'safe';
  return {
    candidateId: candidate.id || '',
    existingId: existing.id || '',
    score: Number(score.toFixed(4)),
    decision,
    hardDuplicate,
    overlappingFields,
  };
}

export function evaluateStoryDnaCandidate(candidate = {}, rows = [], options = {}) {
  const comparisons = rows
    .filter(row => row && row.id !== candidate.id)
    .map(row => compareStoryDnaRows(candidate, row, options));
  const closest = comparisons.reduce((best, item) => (
    !best || item.score > best.score ? item : best
  ), null);
  const decision = comparisons.some(item => item.decision === 'reject')
    ? 'reject'
    : comparisons.some(item => item.decision === 'warning')
      ? 'warning'
      : 'safe';
  return {
    candidateId: candidate.id || '',
    decision,
    maxScore: closest?.score || 0,
    closestRowId: closest?.existingId || null,
    comparisons,
  };
}

export function chooseUnusedStoryDnaRow(rows = [], options = {}) {
  const candidates = rows.filter(row => row?.status === 'planned' && !row.locked);
  const evaluated = candidates.map(row => ({
    row,
    evaluation: evaluateStoryDnaCandidate(row, rows, options),
  })).filter(item => item.evaluation.decision !== 'reject');
  evaluated.sort((left, right) => (
    left.evaluation.maxScore - right.evaluation.maxScore
    || String(left.row.id).localeCompare(String(right.row.id), undefined, { numeric: true })
  ));
  return evaluated[0] || null;
}

export function validateMatrixDiversity(rows = [], { targetCount = rows.length } = {}) {
  const issues = [];
  const target = Math.max(1, Number(targetCount) || rows.length || 1);
  const expectedLocations = target >= 30 ? 8 : Math.max(3, Math.floor(target / 4));
  const expectedEvidence = target >= 30 ? 6 : Math.max(3, Math.floor(target / 5));
  const expectedAntagonists = target >= 30 ? 6 : Math.max(3, Math.floor(target / 5));
  const expectedTwists = target >= 30 ? 5 : Math.max(3, Math.floor(target / 6));
  for (const [field, minimum, label] of [
    ['location', expectedLocations, 'location'],
    ['evidence', expectedEvidence, 'evidence'],
    ['antagonist', expectedAntagonists, 'antagonist'],
    ['midpointTwist', expectedTwists, 'midpoint twist'],
  ]) {
    const count = new Set(rows.map(row => normalizeComparable(row[field])).filter(Boolean)).size;
    if (count < minimum) issues.push(`Need at least ${minimum} distinct ${label} values; found ${count}.`);
  }
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (isExactMatch(previous.evidence, current.evidence)
      && isExactMatch(previous.midpointTwist, current.midpointTwist)) {
      issues.push(`Adjacent rows ${previous.id} and ${current.id} repeat evidence and midpoint twist.`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export { cleanText, normalizeComparable };

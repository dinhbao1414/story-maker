export const STORY_PROJECT_SCHEMA = 'story-maker-project-v1';
export const STORY_PROJECT_STATUSES = Object.freeze(['ready', 'running', 'paused', 'completed', 'error']);

const LOCKED_DNA_KEYS = ['mode', 'genre', 'target', 'narr', 'supplement', 'universal'];
const RANDOMIZED_KEYS = ['theme', 'worldview', 'era', 'ending', 'chars'];

function cleanText(value, maxLength = 5000) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function stripSecrets(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) return value.map(item => stripSecrets(item, depth + 1));
  if (typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:api.?key|authorization|token|secret)/i.test(key))
    .map(([key, item]) => [key, stripSecrets(item, depth + 1)]));
}

function safeClone(value) {
  return stripSecrets(cloneValue(value ?? null));
}

function normalizeTarget(value) {
  const number = Number.parseInt(value, 10);
  return Math.min(999, Math.max(1, Number.isFinite(number) ? number : 10));
}

function defaultId(now) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `project-${now.getTime()}`;
}

export function deriveProjectStatus(project = {}) {
  if (project.queueRunning) return 'running';
  if (project.queuePaused) return 'paused';
  if (Number(project.successfulStoryCount || 0) >= normalizeTarget(project.targetStoryCount)) return 'completed';
  if (cleanText(project.lastError, 1000)) return 'error';
  return 'ready';
}

export function calculateProjectProgress(project = {}) {
  const target = normalizeTarget(project.targetStoryCount);
  const successful = Math.max(0, Number(project.successfulStoryCount || 0));
  return Math.min(100, Math.max(0, Math.round((successful / target) * 100)));
}

export function createStoryProject(input = {}, { now = new Date(), makeId } = {}) {
  const name = cleanText(input.name, 120);
  if (!name) throw new Error('Tên dự án là bắt buộc.');
  const timestamp = now.toISOString();
  const project = {
    id: cleanText(input.id, 160) || (makeId ? makeId() : defaultId(now)),
    name,
    targetStoryCount: normalizeTarget(input.targetStoryCount),
    successfulStoryCount: Math.max(0, Number(input.successfulStoryCount || 0)),
    failedStoryCount: Math.max(0, Number(input.failedStoryCount || 0)),
    settingsPayload: safeClone(input.settingsPayload || {}),
    styleProfile: safeClone(input.styleProfile || null),
    sourceFileNames: Array.isArray(input.sourceFileNames)
      ? input.sourceFileNames.map(value => cleanText(value, 240)).filter(Boolean).slice(0, 100)
      : [],
    queueRunning: Boolean(input.queueRunning),
    queuePaused: Boolean(input.queuePaused),
    pendingStoryCount: Math.max(0, Number(input.pendingStoryCount || 0)),
    lastError: cleanText(input.lastError, 2000),
    lastFailedSettingsPayload: safeClone(input.lastFailedSettingsPayload || null),
    history: Array.isArray(input.history) ? safeClone(input.history).slice(-500) : [],
    createdAt: cleanText(input.createdAt, 80) || timestamp,
    updatedAt: cleanText(input.updatedAt, 80) || timestamp,
  };
  project.status = deriveProjectStatus(project);
  return project;
}

export function buildControlledVariationSettings(settingsPayload = {}) {
  const payload = safeClone(settingsPayload || {});
  const settings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {};
  const locked = { ...(settings.locked || {}) };
  for (const key of LOCKED_DNA_KEYS) locked[key] = true;
  for (const key of RANDOMIZED_KEYS) locked[key] = false;
  return { ...payload, settings: { ...settings, locked } };
}

export function filterAndSortStoryProjects(projects = [], {
  query = '',
  status = '',
  sort = 'updated-desc',
} = {}) {
  const normalizedQuery = cleanText(query, 240).toLocaleLowerCase('vi');
  const normalizedStatus = STORY_PROJECT_STATUSES.includes(status) ? status : '';
  const indexed = (Array.isArray(projects) ? projects : []).map((project, index) => ({ project, index }));
  const filtered = indexed.filter(({ project }) => {
    const projectStatus = deriveProjectStatus(project);
    if (normalizedStatus && projectStatus !== normalizedStatus) return false;
    if (!normalizedQuery) return true;
    const haystack = [project.name, project.styleProfile?.name, ...(project.sourceFileNames || [])]
      .map(value => cleanText(value).toLocaleLowerCase('vi'))
      .join('\n');
    return haystack.includes(normalizedQuery);
  });
  filtered.sort((left, right) => {
    let result = 0;
    if (sort === 'name-asc') result = cleanText(left.project.name).localeCompare(cleanText(right.project.name), 'vi');
    else if (sort === 'progress-desc') result = calculateProjectProgress(right.project) - calculateProjectProgress(left.project);
    else result = cleanText(right.project.updatedAt).localeCompare(cleanText(left.project.updatedAt));
    return result || left.index - right.index;
  });
  return filtered.map(({ project }) => ({ ...project, status: deriveProjectStatus(project) }));
}

export function buildStoryProjectExport({ project, stories = [] } = {}, date = new Date()) {
  if (!project?.id) throw new Error('Dự án Story không hợp lệ.');
  return stripSecrets({
    schema: STORY_PROJECT_SCHEMA,
    app: 'Story Maker',
    exportedAt: date.toISOString(),
    project: safeClone(project),
    stories: Array.isArray(stories) ? safeClone(stories) : [],
  });
}

export function parseStoryProjectImport(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  if (!payload || payload.schema !== STORY_PROJECT_SCHEMA || !payload.project?.id) {
    throw new Error('Đây không phải file Dự án Story hợp lệ.');
  }
  const safe = stripSecrets(cloneValue(payload));
  return {
    schema: STORY_PROJECT_SCHEMA,
    app: 'Story Maker',
    exportedAt: cleanText(safe.exportedAt, 80),
    project: safe.project,
    stories: Array.isArray(safe.stories) ? safe.stories : [],
  };
}

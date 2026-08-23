import assert from 'node:assert/strict';
import {
  buildControlledVariationSettings,
  buildStoryProjectExport,
  calculateProjectProgress,
  createStoryProject,
  deriveProjectStatus,
  filterAndSortStoryProjects,
  parseStoryProjectImport,
} from '../src/storyProjectHelpers.js';

const now = new Date('2026-07-31T08:00:00.000Z');
const settingsPayload = {
  schema: 'story-maker-generation-settings-v1',
  settings: {
    mode: 'novel',
    axes: {},
    characters: [],
    supplement: 'DNA phong cách',
    channelFormula: {
      id: 'formula-1',
      name: 'Daily Scat – Drama gia đình Nhật',
      reproductionPrompt: 'abstract rules',
      generationPolicy: { minNonWhitespaceChars: 20000, targetNonWhitespaceChars: 22000 },
    },
    locked: {},
    universalAssets: [],
  },
};

const project = createStoryProject({
  id: 'project-1',
  name: 'Tổng tài bị khinh thường',
  targetStoryCount: 20,
  settingsPayload,
  styleProfile: { name: 'Đảo chiều thân phận', analysis: { apiKey: 'remove-me' } },
  sourceFileNames: ['a.txt', 'b.txt'],
}, { now });

assert.equal(project.status, 'ready');
assert.equal(project.successfulStoryCount, 0);
assert.equal(JSON.stringify(project).includes('remove-me'), false);
assert.equal(calculateProjectProgress({ ...project, successfulStoryCount: 7 }), 35);
assert.equal(deriveProjectStatus({ ...project, successfulStoryCount: 20 }), 'completed');
assert.equal(deriveProjectStatus({ ...project, queuePaused: true }), 'paused');
assert.equal(deriveProjectStatus({ ...project, lastError: '429' }), 'error');

const variation = buildControlledVariationSettings(settingsPayload);
assert.equal(variation.settings.locked.mode, true);
assert.equal(variation.settings.locked.genre, true);
assert.equal(variation.settings.locked.target, true);
assert.equal(variation.settings.locked.narr, true);
assert.equal(variation.settings.locked.supplement, true);
assert.equal(variation.settings.locked.channelFormula, true);
assert.equal(variation.settings.channelFormula.name, 'Daily Scat – Drama gia đình Nhật');
assert.equal(variation.settings.locked.theme, false);
assert.equal(variation.settings.locked.worldview, false);
assert.equal(variation.settings.locked.era, false);
assert.equal(variation.settings.locked.ending, false);
assert.equal(variation.settings.locked.chars, false);

const filtered = filterAndSortStoryProjects([
  project,
  { ...project, id: 'project-2', name: 'Gia đình phục thù', updatedAt: '2026-07-31T09:00:00.000Z' },
], { query: 'gia đình', status: 'ready', sort: 'updated-desc' });
assert.deepEqual(filtered.map(item => item.id), ['project-2']);

const exported = buildStoryProjectExport({
  project,
  stories: [{
    id: 'story-1',
    projectId: project.id,
    title: 'Truyện 1',
    text: 'Nội dung',
    metadata: { token: 'remove-token', nested: { authorization: 'remove-auth' } },
  }],
}, now);
const exportedJson = JSON.stringify(exported);
assert.equal(exported.schema, 'story-maker-project-v1');
assert.equal(exportedJson.includes('remove-me'), false);
assert.equal(exportedJson.includes('remove-token'), false);
assert.equal(exportedJson.includes('remove-auth'), false);
assert.equal(exportedJson.includes('apiKey'), false);

const imported = parseStoryProjectImport(JSON.stringify(exported));
assert.equal(imported.project.name, project.name);
assert.equal(imported.stories[0].text, 'Nội dung');
assert.throws(() => parseStoryProjectImport('{"schema":"wrong"}'), /Dự án Story/);
assert.throws(() => createStoryProject({ name: '   ', settingsPayload }), /tên dự án/i);

const unsafeImported = parseStoryProjectImport({
  ...exported,
  project: { ...exported.project, credentials: { apiKey: 'x', token: 'y' } },
  stories: [{ id: 'unsafe', projectId: project.id, secret: 'z', metadata: { authorization: 'a' } }],
});
const unsafeJson = JSON.stringify(unsafeImported);
assert.equal(unsafeJson.includes('apiKey'), false);
assert.equal(unsafeJson.includes('token'), false);
assert.equal(unsafeJson.includes('secret'), false);
assert.equal(unsafeJson.includes('authorization'), false);

console.log('storyProjectHelpers tests passed');

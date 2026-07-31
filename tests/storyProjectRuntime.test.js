import assert from 'node:assert/strict';
import {
  createStoryProjectController,
  renderCreateProjectDialogMarkup,
  renderProjectCardMarkup,
  renderProjectsDashboardMarkup,
} from '../src/storyProjectRuntime.js';

const project = {
  id: 'p1', name: 'Tổng tài bị khinh thường', status: 'running',
  styleProfile: { name: 'Đảo chiều thân phận' }, sourceFileNames: ['a.txt', 'b.txt'],
  targetStoryCount: 20, successfulStoryCount: 7, failedStoryCount: 1,
  updatedAt: '2026-07-31T08:00:00.000Z',
};
const card = renderProjectCardMarkup(project);
assert.match(card, /Tổng tài bị khinh thường/);
assert.match(card, /7\/20/);
assert.match(card, /Đang sản xuất/);
assert.match(card, /data-project-action="generate"/);
assert.match(card, /aria-label="Mở menu dự án/);
assert.match(renderProjectsDashboardMarkup([]), /Tạo dự án đầu tiên/);
assert.match(renderCreateProjectDialogMarkup(), /sp-create-dialog/);
assert.match(renderCreateProjectDialogMarkup(), /multiple/);

const calls = [];
const controller = createStoryProjectController({
  repository: {
    async listProjects() { return []; },
    async getProject() { return null; },
    async saveProject(value) { calls.push(value); return value; },
  },
  captureSettings: () => ({ schema: 'story-maker-generation-settings-v1', settings: {} }),
  now: () => new Date('2026-07-31T08:00:00.000Z'),
});
await controller.createFromDashboard({ name: 'Project', targetStoryCount: 10 });
assert.equal(calls.length, 1);
assert.equal(calls[0].name, 'Project');

const projects = new Map([['p1', {
  ...project,
  status: 'ready',
  successfulStoryCount: 0,
  failedStoryCount: 0,
  queueRunning: false,
  queuePaused: false,
  settingsPayload: { schema: 'story-maker-generation-settings-v1', settings: {} },
}]]);
const stories = [];
const productionRepository = {
  async getProject(id) { return projects.get(id); },
  async saveProject(value) { projects.set(value.id, structuredClone(value)); return value; },
  async listStories(projectId) { return stories.filter(item => item.projectId === projectId); },
  async saveStory(value) { stories.push(structuredClone(value)); return value; },
  async deleteStory(id) { const index = stories.findIndex(item => item.id === id); if (index >= 0) stories.splice(index, 1); },
  async deleteProject(id) { projects.delete(id); },
};
const bridge = {
  async prepareVariation() { return { schema: 'story-maker-generation-settings-v1', settings: {} }; },
  async generate() { return { text: 'Nội dung truyện', charCount: 16 }; },
};
const productionController = createStoryProjectController({
  repository: productionRepository,
  bridge,
  now: () => new Date('2026-07-31T10:00:00.000Z'),
});
await productionController.generateBatch('p1', 2);
assert.equal(stories.length, 2);
assert.equal(projects.get('p1').successfulStoryCount, 2);
await productionController.pause('p1');
assert.equal(projects.get('p1').queuePaused, true);
await productionController.resume('p1');
assert.equal(projects.get('p1').queuePaused, false);

assert.equal((await productionController.listStories('p1')).length, 2);
await productionController.deleteStory('p1', stories[0].id);
assert.equal(stories.length, 1);

console.log('storyProjectRuntime tests passed');

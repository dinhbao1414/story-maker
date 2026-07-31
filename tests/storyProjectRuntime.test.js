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

console.log('storyProjectRuntime tests passed');

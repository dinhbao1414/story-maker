# Story Project Management Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung tab Dự án Story để lưu DNA phong cách, thiết lập, tiến độ và truyện; hỗ trợ tạo đơn lẻ hoặc hàng loạt tuần tự mà không thay đổi logic tạo truyện hiện tại.

**Architecture:** Dữ liệu thuần, export/import và chính sách biến tấu nằm trong một helper nhỏ; IndexedDB nằm trong repository riêng; một generation bridge điều khiển đúng nút `#btn-generate` hiện có và chờ trạng thái hoàn tất; runtime DOM phụ trách Card Grid, Modal và trang chi tiết. Không thêm dependency, không sửa `src/legacyMain.js`, không lưu API key.

**Tech Stack:** Vanilla JavaScript ES modules, HTML, CSS, IndexedDB, Node `assert`, Vite.

**Design:** `docs/superpowers/specs/2026-07-31-story-project-management-dashboard-design.md`

---

## File Map

### Tạo mới

- `src/storyProjectHelpers.js`: model, validation, status/progress, search/sort, variation policy, export/import sanitization.
- `src/storyProjectStorage.js`: IndexedDB schema và CRUD dự án/truyện.
- `src/storyProjectGenerationBridge.js`: áp dụng snapshot, tạo preview biến tấu, chạy một truyện, chạy lô tuần tự.
- `src/storyProjectRuntime.js`: Card Grid, Modal ba bước, trang chi tiết, CRUD và kết nối generation bridge.
- `tests/storyProjectHelpers.test.js`: model, status, filter/sort, export/import, secret stripping.
- `tests/storyProjectStorage.test.js`: repository CRUD và lưu truyện bằng backend giả lập.
- `tests/storyProjectGenerationBridge.test.js`: preview, hoàn tất, lỗi, pause và lưu tuần tự.
- `tests/storyProjectRuntime.test.js`: markup, trạng thái rỗng, thao tác Modal/Card và wiring cơ bản.
- `tests/storyProjectIntegrationApis.test.js`: hợp đồng export cho settings và analyzer hiện tại.

### Chỉnh sửa

- `index.html`: thêm tab Dự án Story và panel rỗng có semantic đúng.
- `src/workspaceTabs.js`: cho phép tab `projects` và sự kiện mở dự án.
- `src/style.css`: Card Grid, toolbar, Modal, detail view, responsive, focus và reduced motion.
- `src/generationSettingsIo.js`: export API chụp snapshot thiết lập hiện tại; thêm guard khi không có DOM.
- `src/styleAnalyzer.js`: export API nạp TXT và bắt đầu phân tích cho Modal; tái dùng state hiện tại.
- `src/stylePresetRuntime.js`: export hàm chờ/capture kết quả phân tích thay vì tạo fetch wrapper thứ hai.
- `src/main.js`: import `storyProjectRuntime.js` sau style preset, trước workspace tabs.
- `tests/workspaceTabs.test.js`: thứ tự ba tab và sự kiện chuyển tab.
- `tests/vietnameseUi.test.js`: tab/panel Dự án Story và nhãn tiếng Việt.

### Không chỉnh sửa

- `src/legacyMain.js`: giữ nguyên đường tạo truyện hiện tại.
- `src/api.js`, `src/providerClients.js`: giữ nguyên API routing, timeout và retry.
- `package.json`: không thêm dependency.
- `dist/**`: chỉ được tạo lại trong bước build xác minh; không deploy.

---

### Task 1: Project model, status, variation policy, export/import

**Files:**
- Create: `src/storyProjectHelpers.js`
- Create: `tests/storyProjectHelpers.test.js`

- [ ] **Step 1: Write the failing model and export tests**

```js
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
  stories: [{ id: 'story-1', projectId: project.id, title: 'Truyện 1', text: 'Nội dung' }],
}, now);
assert.equal(exported.schema, 'story-maker-project-v1');
assert.equal(JSON.stringify(exported).includes('remove-me'), false);
assert.equal(JSON.stringify(exported).includes('apiKey'), false);

const imported = parseStoryProjectImport(JSON.stringify(exported));
assert.equal(imported.project.name, project.name);
assert.equal(imported.stories[0].text, 'Nội dung');
assert.throws(() => parseStoryProjectImport('{"schema":"wrong"}'), /Dự án Story/);

console.log('storyProjectHelpers tests passed');
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node tests/storyProjectHelpers.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/storyProjectHelpers.js`.

- [ ] **Step 3: Implement the minimal pure helper module**

Implement these exact exports:

```js
export const STORY_PROJECT_SCHEMA = 'story-maker-project-v1';
export const STORY_PROJECT_STATUSES = Object.freeze(['ready', 'running', 'paused', 'completed', 'error']);

export function createStoryProject(input, { now = new Date(), makeId = () => crypto.randomUUID() } = {})
export function calculateProjectProgress(project)
export function deriveProjectStatus(project)
export function buildControlledVariationSettings(settingsPayload)
export function filterAndSortStoryProjects(projects, filters)
export function buildStoryProjectExport({ project, stories }, date = new Date())
export function parseStoryProjectImport(input)
```

Rules inside the implementation:

```js
const LOCKED_DNA_KEYS = ['mode', 'genre', 'target', 'narr', 'supplement', 'universal'];
const RANDOMIZED_KEYS = ['theme', 'worldview', 'era', 'ending', 'chars'];

function stripSecrets(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) return value.map(item => stripSecrets(item, depth + 1));
  if (typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:api.?key|authorization|token|secret)/i.test(key))
    .map(([key, item]) => [key, stripSecrets(item, depth + 1)]));
}
```

`createStoryProject` must trim the name, reject empty names, normalize target to an integer from `1` to `999`, copy snapshots defensively with `structuredClone` or JSON fallback, initialize counters/queue, and never preserve secret-looking keys.

`deriveProjectStatus` order: running → paused → completed → error → ready. `filterAndSortStoryProjects` must be case-insensitive and stable.

- [ ] **Step 4: Run focused tests**

Run: `node tests/storyProjectHelpers.test.js`

Expected: `storyProjectHelpers tests passed`.

- [ ] **Step 5: Commit the pure project model**

```bash
git add src/storyProjectHelpers.js tests/storyProjectHelpers.test.js
git commit -m "feat: add Story Project model"
```

---

### Task 2: IndexedDB repository with injectable backend

**Files:**
- Create: `src/storyProjectStorage.js`
- Create: `tests/storyProjectStorage.test.js`

- [ ] **Step 1: Write failing repository CRUD tests**

Use an in-memory backend so Node tests do not need a new IndexedDB dependency:

```js
import assert from 'node:assert/strict';
import { createStoryProjectRepository } from '../src/storyProjectStorage.js';

function createMemoryBackend() {
  const projects = new Map();
  const stories = new Map();
  return {
    async listProjects() { return [...projects.values()]; },
    async getProject(id) { return projects.get(id) || null; },
    async putProject(project) { projects.set(project.id, structuredClone(project)); return project; },
    async deleteProject(id) { projects.delete(id); for (const [key, story] of stories) if (story.projectId === id) stories.delete(key); },
    async listStories(projectId) { return [...stories.values()].filter(story => story.projectId === projectId); },
    async putStory(story) { stories.set(story.id, structuredClone(story)); return story; },
    async deleteStory(id) { stories.delete(id); },
  };
}

const repository = createStoryProjectRepository({ backend: createMemoryBackend() });
await repository.saveProject({ id: 'p1', name: 'Project', updatedAt: '2026-07-31T08:00:00.000Z' });
assert.equal((await repository.listProjects())[0].id, 'p1');
await repository.saveStory({ id: 's1', projectId: 'p1', text: 'Story' });
assert.equal((await repository.listStories('p1'))[0].text, 'Story');
await repository.deleteProject('p1');
assert.deepEqual(await repository.listProjects(), []);
assert.deepEqual(await repository.listStories('p1'), []);

console.log('storyProjectStorage tests passed');
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node tests/storyProjectStorage.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement repository and native IndexedDB backend**

Export:

```js
export const STORY_PROJECT_DB_NAME = 'story-maker-projects';
export const STORY_PROJECT_DB_VERSION = 1;
export function createIndexedDbStoryProjectBackend(indexedDB = globalThis.indexedDB)
export function createStoryProjectRepository({ backend = createIndexedDbStoryProjectBackend() } = {})
```

IndexedDB stores:

```js
projects: { keyPath: 'id', indexes: [['updatedAt', 'updatedAt']] }
stories: { keyPath: 'id', indexes: [['projectId', 'projectId']] }
```

Use one small request wrapper:

```js
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}
```

`deleteProject(id)` must delete the project and all stories with the same `projectId` in one `readwrite` transaction. Throw the Vietnamese error `Trình duyệt không hỗ trợ IndexedDB.` when unavailable.

- [ ] **Step 4: Run focused tests**

Run: `node tests/storyProjectStorage.test.js`

Expected: `storyProjectStorage tests passed`.

- [ ] **Step 5: Commit storage**

```bash
git add src/storyProjectStorage.js tests/storyProjectStorage.test.js
git commit -m "feat: persist Story Projects in IndexedDB"
```

---

### Task 3: Expose existing settings and style-analysis entry points

**Files:**
- Modify: `src/generationSettingsIo.js`
- Modify: `src/styleAnalyzer.js`
- Modify: `src/stylePresetRuntime.js`
- Create: `tests/storyProjectIntegrationApis.test.js`

- [ ] **Step 1: Write failing source/API contract tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const settingsIo = fs.readFileSync(new URL('../src/generationSettingsIo.js', import.meta.url), 'utf8');
const analyzer = fs.readFileSync(new URL('../src/styleAnalyzer.js', import.meta.url), 'utf8');
const presetRuntime = fs.readFileSync(new URL('../src/stylePresetRuntime.js', import.meta.url), 'utf8');

assert.match(settingsIo, /export function captureCurrentGenerationSettings/);
assert.match(settingsIo, /typeof document !== 'undefined'/);
assert.match(analyzer, /export async function replaceStyleAnalyzerFiles/);
assert.match(analyzer, /export function startStyleAnalysis/);
assert.match(presetRuntime, /export function waitForStyleAnalysis/);
assert.equal((presetRuntime.match(/__storyMakerStylePresetFetch/g) || []).length >= 1, true);

console.log('storyProject integration API tests passed');
```

- [ ] **Step 2: Run the contract test and verify failure**

Run: `node tests/storyProjectIntegrationApis.test.js`

Expected: FAIL because the three exports do not exist.

- [ ] **Step 3: Export current settings without duplicating collection logic**

In `src/generationSettingsIo.js`, rename the private function and export it:

```js
export function captureCurrentGenerationSettings() {
  return buildCurrentSettingsExport();
}
```

Make `exportGenerationSettings()` call `captureCurrentGenerationSettings()`. Wrap the bottom boot code:

```js
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installGenerationSettingsIo);
  else installGenerationSettingsIo();
}
```

- [ ] **Step 4: Export the existing analyzer flow**

In `src/styleAnalyzer.js`, add two thin APIs around existing private functions; do not copy parsing or API code:

```js
export async function replaceStyleAnalyzerFiles(fileList) {
  clearAll();
  await handleFiles(fileList);
  return {
    fileNames: droppedTexts.map(item => item.name),
    totalChars: droppedTexts.reduce((sum, item) => sum + item.charCount, 0),
  };
}

export function startStyleAnalysis() {
  return runAnalysis();
}
```

If `clearAll()` shows confirmation, extract its state-reset body into a private `resetStyleAnalyzerState()` and let `clearAll()` and `replaceStyleAnalyzerFiles()` both call it; the programmatic path must not show a confirmation.

- [ ] **Step 5: Export one promise-based capture helper**

In `src/stylePresetRuntime.js`, add:

```js
export function waitForStyleAnalysis(win = globalThis.window, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const timeoutId = win.setTimeout(() => {
      cleanup();
      reject(new Error('Phân tích phong cách quá thời gian chờ.'));
    }, timeoutMs);
    const onReady = event => { cleanup(); resolve(event.detail); };
    const cleanup = () => {
      win.clearTimeout(timeoutId);
      win.removeEventListener('story-maker:style-analysis-ready', onReady);
    };
    win.addEventListener('story-maker:style-analysis-ready', onReady, { once: true });
  });
}
```

Keep the existing fetch capture as the single producer of `story-maker:style-analysis-ready`.

- [ ] **Step 6: Run focused tests and existing analyzer tests**

Run:

```bash
node tests/storyProjectIntegrationApis.test.js
node tests/styleAnalyzerControlState.test.js
node tests/stylePresetHelpers.test.js
node tests/settingsSnapshotHelpers.test.js
```

Expected: all four commands exit `0`.

- [ ] **Step 7: Commit integration APIs**

```bash
git add src/generationSettingsIo.js src/styleAnalyzer.js src/stylePresetRuntime.js tests/storyProjectIntegrationApis.test.js
git commit -m "feat: expose Story Project integration APIs"
```

---

### Task 4: Generation bridge and sequential batch runner

**Files:**
- Create: `src/storyProjectGenerationBridge.js`
- Create: `tests/storyProjectGenerationBridge.test.js`

- [ ] **Step 1: Write failing bridge tests with fake DOM and timers**

Cover these behaviors:

```js
import assert from 'node:assert/strict';
import {
  runSequentialStoryBatch,
  waitForExistingGeneration,
} from '../src/storyProjectGenerationBridge.js';

const output = { textContent: '', classList: { contains: () => false } };
const button = { disabled: false };
let now = 0;
const timers = {
  setInterval(callback) { this.callback = callback; return 1; },
  clearInterval() {},
  setTimeout(callback) { this.timeout = callback; return 2; },
  clearTimeout() {},
};

const pending = waitForExistingGeneration({ button, output, timers, timeoutMs: 1000 });
button.disabled = true;
timers.callback();
button.disabled = false;
output.textContent = 'Truyện hoàn chỉnh';
timers.callback();
assert.equal((await pending).text, 'Truyện hoàn chỉnh');

const saved = [];
const failures = [];
const result = await runSequentialStoryBatch({
  count: 3,
  prepare: async index => ({ index }),
  generate: async prepared => {
    if (prepared.index === 1) throw new Error('429');
    return { text: `story-${prepared.index}` };
  },
  saveSuccess: async item => saved.push(item.text),
  saveFailure: async error => failures.push(error.message),
  shouldPause: () => false,
});
assert.deepEqual(saved, ['story-0', 'story-2']);
assert.deepEqual(failures, ['429']);
assert.equal(result.successCount, 2);
assert.equal(result.failureCount, 1);

console.log('storyProjectGenerationBridge tests passed');
```

- [ ] **Step 2: Run the test and verify module-not-found failure**

Run: `node tests/storyProjectGenerationBridge.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement completion detection around the existing button**

Export:

```js
export function waitForExistingGeneration({ button, output, timers = globalThis, timeoutMs = 600000 })
export function createStoryProjectGenerationBridge(options)
export async function runSequentialStoryBatch(options)
```

Completion rules:

```js
let sawBusy = false;
// Poll every 200 ms.
// Mark sawBusy after button.disabled becomes true.
// Resolve only after sawBusy, button becomes enabled, and output has non-empty text.
// Reject if output text begins with "Lỗi:" or contains only the empty placeholder.
// Reject on timeout; always clear interval and timeout.
```

`createStoryProjectGenerationBridge` dependencies:

```js
{
  doc = globalThis.document,
  applySettings,
  captureSettings,
  buildVariationSettings,
}
```

Its `prepareVariation(project)` must apply controlled-lock settings, click `#btn-all-random`, then return `captureSettings()` for preview. Its `generate(previewPayload)` must apply the preview, click `#btn-generate`, and call `waitForExistingGeneration`.

- [ ] **Step 4: Implement sequential persistence semantics**

`runSequentialStoryBatch` must:

```js
for (let index = 0; index < count; index += 1) {
  if (shouldPause()) return { successCount, failureCount, paused: true };
  try {
    const prepared = await prepare(index);
    const generated = await generate(prepared, index);
    await saveSuccess(generated, prepared, index);
    successCount += 1;
  } catch (error) {
    await saveFailure(error, index);
    failureCount += 1;
  }
}
return { successCount, failureCount, paused: false };
```

Do not use `Promise.all`.

- [ ] **Step 5: Run focused tests**

Run: `node tests/storyProjectGenerationBridge.test.js`

Expected: `storyProjectGenerationBridge tests passed`.

- [ ] **Step 6: Commit the generation bridge**

```bash
git add src/storyProjectGenerationBridge.js tests/storyProjectGenerationBridge.test.js
git commit -m "feat: bridge Story Projects to generation"
```

---

### Task 5: Add the Projects workspace shell and responsive Card Grid

**Files:**
- Modify: `index.html`
- Modify: `src/workspaceTabs.js`
- Modify: `src/style.css`
- Modify: `tests/workspaceTabs.test.js`
- Modify: `tests/vietnameseUi.test.js`

- [ ] **Step 1: Extend failing tab tests**

Add a third fake tab/panel to `tests/workspaceTabs.test.js` and assert:

```js
assert.equal(resolveWorkspaceTab('projects'), 'projects');
projectsTab.listeners.click();
assert.equal(runtime.getActiveTab(), 'projects');
assert.equal(projectsPanel.hidden, false);
win.listeners['story-maker:open-projects']();
assert.equal(runtime.getActiveTab(), 'projects');
```

Add to `tests/vietnameseUi.test.js`:

```js
assert.match(html, /id="workspace-tab-projects"[^>]*aria-selected="false"/);
assert.match(html, /data-workspace-panel="projects"/);
assert.match(html, />Dự án Story</);
assert.equal((html.match(/id="story-projects-panel"/g) || []).length, 1);
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node tests/workspaceTabs.test.js; node tests/vietnameseUi.test.js`

Expected: failure because the Projects tab/panel is absent.

- [ ] **Step 3: Add semantic tab and empty panel markup**

Insert after Dashboard in `index.html`:

```html
<button type="button" class="workspace-tab" id="workspace-tab-projects"
  role="tab" data-workspace-tab="projects" aria-controls="story-projects-panel"
  aria-selected="false" tabindex="-1">
  <span class="workspace-tab-icon" aria-hidden="true">▦</span>
  <span>Dự án Story</span>
</button>
```

Insert between Settings and Output:

```html
<section class="story-projects-panel" id="story-projects-panel"
  data-workspace-panel="projects" role="tabpanel"
  aria-labelledby="workspace-tab-projects" aria-hidden="true" hidden>
  <div id="story-projects-root"></div>
</section>
```

- [ ] **Step 4: Extend workspace tab behavior**

Change the constant and add the event listener in `src/workspaceTabs.js`:

```js
export const WORKSPACE_TABS = Object.freeze(['dashboard', 'projects', 'settings']);
win?.addEventListener?.('story-maker:open-projects', () => setActiveTab('projects'));
```

Do not persist the tab; Dashboard remains first after reload.

- [ ] **Step 5: Add Card Grid CSS using existing tokens**

Add the following selectors to `src/style.css`:

```css
.story-projects-panel{width:100%;min-height:0;overflow:auto;padding:24px;background:var(--bg)}
.sp-header,.sp-toolbar,.sp-card-actions{display:flex;align-items:center;gap:12px}
.sp-header{justify-content:space-between;margin-bottom:16px}
.sp-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.sp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.sp-card{min-width:0;padding:16px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface2)}
.sp-card:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-glow)}
.sp-progress{height:8px;overflow:hidden;border-radius:999px;background:var(--surface3)}
.sp-progress>span{display:block;height:100%;background:var(--accent)}
.sp-dialog{width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text)}
@media(max-width:1100px){.sp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.story-projects-panel{padding:14px}.sp-grid,.sp-summary{grid-template-columns:1fr}.sp-header,.sp-toolbar{align-items:stretch;flex-direction:column}}
@media(prefers-reduced-motion:reduce){.sp-card,.sp-progress>span{transition:none}}
```

All added buttons must have at least `44px` height and a visible `:focus-visible` outline.

- [ ] **Step 6: Run focused tests**

Run: `node tests/workspaceTabs.test.js; node tests/vietnameseUi.test.js`

Expected: both pass.

- [ ] **Step 7: Commit the workspace shell**

```bash
git add index.html src/workspaceTabs.js src/style.css tests/workspaceTabs.test.js tests/vietnameseUi.test.js
git commit -m "feat: add Story Projects workspace"
```

---

### Task 6: Project dashboard, Modal creation flow, search/filter/sort

**Files:**
- Create: `src/storyProjectRuntime.js`
- Create: `tests/storyProjectRuntime.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write failing markup and controller tests**

Create `tests/storyProjectRuntime.test.js`:

```js
import assert from 'node:assert/strict';
import {
  createStoryProjectController,
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

const calls = [];
const controller = createStoryProjectController({
  repository: { async listProjects(){return []}, async saveProject(value){calls.push(value);return value} },
  captureSettings: () => ({ schema: 'story-maker-generation-settings-v1', settings: {} }),
  now: () => new Date('2026-07-31T08:00:00.000Z'),
});
await controller.createFromDashboard({ name: 'Project', targetStoryCount: 10 });
assert.equal(calls.length, 1);
assert.equal(calls[0].name, 'Project');

console.log('storyProjectRuntime tests passed');
```

- [ ] **Step 2: Run test and verify module-not-found failure**

Run: `node tests/storyProjectRuntime.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement pure render helpers and controller constructor**

Export from `src/storyProjectRuntime.js`:

```js
export function renderProjectCardMarkup(project)
export function renderProjectsDashboardMarkup(projects, summary = {})
export function renderCreateProjectDialogMarkup()
export function createStoryProjectController(options)
export function installStoryProjectRuntime(options)
```

Use this exact status map:

```js
const STATUS_LABELS = {
  ready: 'Sẵn sàng', running: 'Đang sản xuất', paused: 'Tạm dừng',
  completed: 'Hoàn thành', error: 'Có lỗi',
};
```

Each Card must include: name, style name, TXT count, successful/target count, failed count when nonzero, update time, progressbar with `aria-valuenow`, primary `Tạo truyện`, and `•••` with accessible label.

- [ ] **Step 4: Implement the two creation paths**

Inject dependencies into `createStoryProjectController`:

```js
{
  repository, captureSettings, replaceAnalyzerFiles, startAnalysis,
  waitForAnalysis, buildStyleProfile, bridge, now = () => new Date(),
}
```

Implement:

```js
async createFromDashboard({ name, targetStoryCount })
async analyzeFiles(files)
async createFromAnalysis({ name, targetStoryCount, analysis, sourceFileNames })
async list({ query = '', status = '', sort = 'updated-desc' } = {})
async get(projectId)
async update(projectId, patch)
async duplicate(projectId)
```

`analyzeFiles(files)` must use one existing analysis event:

```js
const waiter = waitForAnalysis();
const summary = await replaceAnalyzerFiles(files);
await startAnalysis();
const analysis = await waiter;
return { analysis, sourceFileNames: summary.fileNames };
```

Creation from Dashboard calls `captureSettings()`. Creation from TXT calls `buildStyleProfile(analysis)` and saves its `settingsPayload`. Neither path calls the generation API.

- [ ] **Step 5: Implement Modal three-step state and dashboard wiring**

`installStoryProjectRuntime` must:

- Render summary, search, status filter, sort, Card Grid and `＋ Tạo dự án`.
- Insert one native `<dialog class="sp-dialog" id="sp-create-dialog">`.
- Step 1: Dashboard current or TXT new.
- Step 2: name, target `1..999`, multi-file TXT input when needed.
- Step 3: locked DNA, randomizable fields, file names, target and final confirmation.
- Disable Next/Create until required data exists.
- Restore focus to `#sp-create-project` after closing.
- Re-render after save and dispatch `story-maker:open-projects`.
- Use `150ms` search debounce; filters do not mutate stored projects.

- [ ] **Step 6: Import runtime in the required order**

In `src/main.js`:

```js
import './stylePresetRuntime.js';
import './storyProjectRuntime.js';
import './workspaceTabs.js';
```

Do not move earlier imports.

- [ ] **Step 7: Run focused tests**

Run: `node tests/storyProjectRuntime.test.js; node tests/workspaceTabs.test.js; node tests/vietnameseUi.test.js`

Expected: all pass.

- [ ] **Step 8: Commit dashboard and creation flow**

```bash
git add src/storyProjectRuntime.js src/main.js tests/storyProjectRuntime.test.js
git commit -m "feat: create and browse Story Projects"
```

---

### Task 7: Detail view, story queue, pause/retry, import/export, deletion

**Files:**
- Modify: `src/storyProjectRuntime.js`
- Modify: `src/storyProjectHelpers.js`
- Modify: `tests/storyProjectRuntime.test.js`
- Modify: `tests/storyProjectHelpers.test.js`

- [ ] **Step 1: Add failing controller tests for production actions**

Extend `tests/storyProjectRuntime.test.js` with a fake repository and bridge:

```js
const projects = new Map([['p1', { ...project, status: 'ready', successfulStoryCount: 0, failedStoryCount: 0 }]]);
const stories = [];
const repository = {
  async getProject(id){return projects.get(id)},
  async saveProject(value){projects.set(value.id, structuredClone(value));return value},
  async listStories(projectId){return stories.filter(item => item.projectId === projectId)},
  async saveStory(value){stories.push(structuredClone(value));return value},
  async deleteStory(id){const index=stories.findIndex(item=>item.id===id);if(index>=0)stories.splice(index,1)},
  async deleteProject(id){projects.delete(id)},
};
const bridge = {
  async prepareVariation(){return { schema:'story-maker-generation-settings-v1', settings:{} }},
  async generate(){return { text:'Nội dung truyện', charCount:16 }},
};
const controller = createStoryProjectController({ repository, bridge, now: () => new Date('2026-07-31T10:00:00.000Z') });
await controller.generateBatch('p1', 2);
assert.equal(stories.length, 2);
assert.equal(projects.get('p1').successfulStoryCount, 2);
await controller.pause('p1');
assert.equal(projects.get('p1').queuePaused, true);
await controller.resume('p1');
assert.equal(projects.get('p1').queuePaused, false);
```

Extend helper tests so nested `apiKey`, `token`, `secret` and `authorization` fields are absent after export/import.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node tests/storyProjectRuntime.test.js; node tests/storyProjectHelpers.test.js`

Expected: FAIL because queue/detail methods are absent.

- [ ] **Step 3: Implement one controller path for single and batch generation**

Add controller methods:

```js
async previewVariation(projectId)
async generateBatch(projectId, count)
async pause(projectId)
async resume(projectId)
async retryLastFailure(projectId)
async listStories(projectId)
async deleteStory(projectId, storyId)
async deleteProject(projectId)
async exportProject(projectId)
async importProject(payload)
```

`generateBatch` must set `queueRunning=true`, clear `lastError`, then call `runSequentialStoryBatch`. Save each success before starting the next:

```js
{
  id: crypto.randomUUID(),
  projectId,
  title: `Truyện ${String(project.successfulStoryCount + 1).padStart(2, '0')}`,
  text: generated.text,
  charCount: Array.from(generated.text).length,
  createdAt: now().toISOString(),
  settingsPayload: prepared,
}
```

After every success/failure, reload the latest project, update counters, status and timestamps, then save. In `finally`, set `queueRunning=false`; preserve pause state and last error.

- [ ] **Step 4: Implement detail view and event-delegated actions**

Card click opens one detail view inside the Projects panel with:

```text
Tổng quan | Phong cách & Thiết lập | Danh sách truyện | Lịch sử
```

Required actions:

- Tạo 1 truyện.
- Tạo hàng loạt, limited to remaining target.
- Tạo lại biến tấu and editable preview before API call.
- Tạm dừng after the current request.
- Tiếp tục and Thử lại.
- Áp dụng lên Dashboard through `applyGenerationSettings`, then the existing settings-import event.
- View, rename, download TXT and delete story.

Use one event listener on `#story-projects-root`; do not attach listeners to every Card after each render.

- [ ] **Step 5: Implement import/export and destructive confirmations**

Export with `buildStoryProjectExport`, `Blob`, and `downloadBlobWithFileName`. Import with `file.text()` and `parseStoryProjectImport` before repository writes.

Use explicit deletion:

```js
if (!win.confirm(`Xóa dự án “${project.name}” và toàn bộ truyện đã lưu?`)) return false;
await repository.deleteProject(project.id);
```

Offer export before project deletion. Do not implement fake undo. Story deletion is separate and never removes project settings.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node tests/storyProjectRuntime.test.js
node tests/storyProjectHelpers.test.js
node tests/storyProjectGenerationBridge.test.js
node tests/storyProjectStorage.test.js
```

Expected: all pass.

- [ ] **Step 7: Commit production workflow**

```bash
git add src/storyProjectRuntime.js src/storyProjectHelpers.js tests/storyProjectRuntime.test.js tests/storyProjectHelpers.test.js
git commit -m "feat: manage Story Project production"
```

---

### Task 8: Verification and handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run every new Story Project test and the updated tab/UI tests**

```bash
node tests/storyProjectHelpers.test.js
node tests/storyProjectStorage.test.js
node tests/storyProjectIntegrationApis.test.js
node tests/storyProjectGenerationBridge.test.js
node tests/storyProjectRuntime.test.js
node tests/workspaceTabs.test.js
node tests/vietnameseUi.test.js
```
- [ ] **Step 2: Run the full Node suite and all repository static checks**

```bash
node --test "tests/**/*.test.js"
```
- [ ] **Step 3: Run the standard production build without deploy**

```bash
npm run check:generic-rules
npm run check:nano-4koma-contract
npm run lint --if-present
git diff --check
npm run build
```
- [ ] **Step 4: Start the required local server and verify HTTP 200**

```bash
npm run dev -- --host 127.0.0.1 --port 5179 --strictPort
```
- [ ] **Step 5: Browser-check the complete accepted workflow**

Verify reload persistence, both creation sources, preview, single/batch generation, pause/resume/retry, export/import, search/filter/sort and destructive actions.

- [ ] **Step 6: Record and commit verification evidence**

Record commits, exact outputs, browser results and remaining risks in `HANDOFF.md`.

```bash
git add HANDOFF.md
git commit -m "docs: record Story Project verification"
```

## Execution Guardrails

- Preserve `src/legacyMain.js`; call the existing generation button path.
- Keep API retry, fallback, timeout and output formatting unchanged.
- Never store or export API keys.
- Persist each successful story before starting the next request.
- Never run parallel AI requests.
- Do not deploy, tag, release, push, back up or bump version unless separately requested.

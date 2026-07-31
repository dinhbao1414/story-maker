import { captureCurrentGenerationSettings, applyGenerationSettings } from './generationSettingsIo.js';
import { replaceStyleAnalyzerFiles, startStyleAnalysis } from './styleAnalyzer.js';
import { buildStyleProfile } from './stylePresetHelpers.js';
import { waitForStyleAnalysis } from './stylePresetRuntime.js';
import {
  buildControlledVariationSettings,
  calculateProjectProgress,
  createStoryProject,
  deriveProjectStatus,
  filterAndSortStoryProjects,
} from './storyProjectHelpers.js';
import { createStoryProjectGenerationBridge } from './storyProjectGenerationBridge.js';
import { runSequentialStoryBatch } from './storyProjectGenerationBridge.js';
import { createStoryProjectRepository } from './storyProjectStorage.js';
import { buildStoryProjectExport, parseStoryProjectImport } from './storyProjectHelpers.js';

const STATUS_LABELS = {
  ready: 'Sẵn sàng',
  running: 'Đang sản xuất',
  paused: 'Tạm dừng',
  completed: 'Hoàn thành',
  error: 'Có lỗi',
};

function resolveProjectStatus(project) {
  return STATUS_LABELS[project?.status] ? project.status : deriveProjectStatus(project);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN');
}

export function renderProjectCardMarkup(project = {}) {
  const status = resolveProjectStatus(project);
  const progress = calculateProjectProgress(project);
  const successful = Math.max(0, Number(project.successfulStoryCount || 0));
  const failed = Math.max(0, Number(project.failedStoryCount || 0));
  const target = Math.max(1, Number(project.targetStoryCount || 1));
  const name = escapeHtml(project.name || 'Dự án chưa đặt tên');
  return `
    <article class="sp-card" data-project-id="${escapeHtml(project.id)}">
      <div class="sp-card-heading">
        <div><span class="sp-status sp-status-${status}">${STATUS_LABELS[status]}</span><h3>${name}</h3></div>
        <button type="button" class="sp-menu-button" data-project-action="menu" aria-label="Mở menu dự án ${name}">•••</button>
      </div>
      <p class="sp-card-meta">Phong cách: ${escapeHtml(project.styleProfile?.name || 'Thiết lập Dashboard')}</p>
      <p class="sp-card-meta">TXT nguồn: ${(project.sourceFileNames || []).length}</p>
      <div class="sp-progress" role="progressbar" aria-label="Tiến độ ${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>
      <p class="sp-card-count"><strong>${successful}/${target}</strong> truyện hoàn thành${failed ? ` · ${failed} lỗi` : ''}</p>
      <p class="sp-card-meta">Cập nhật: ${escapeHtml(formatUpdatedAt(project.updatedAt))}</p>
      <div class="sp-card-actions">
        <button type="button" class="btn-secondary" data-project-action="open">Mở</button>
        <button type="button" class="btn-generate" data-project-action="generate">Tạo truyện</button>
        <button type="button" class="btn-secondary" data-project-action="edit">Sửa</button>
        <button type="button" class="btn-secondary" data-project-action="delete">Xóa</button>
      </div>
    </article>`;
}

export function renderProjectsDashboardMarkup(projects = [], summary = {}, filters = {}) {
  const statuses = projects.map(resolveProjectStatus);
  const totals = {
    total: summary.total ?? projects.length,
    running: summary.running ?? statuses.filter(status => status === 'running').length,
    completed: summary.completed ?? statuses.filter(status => status === 'completed').length,
    stories: summary.stories ?? projects.reduce((sum, project) => sum + Number(project.successfulStoryCount || 0), 0),
  };
  const content = projects.length
    ? `<div class="sp-grid">${projects.map(renderProjectCardMarkup).join('')}</div>`
    : '<div class="sp-empty"><h3>Chưa có Dự án Story</h3><p>Lưu thiết lập hiện tại hoặc phân tích TXT để bắt đầu.</p><button type="button" class="btn-generate" data-project-action="create">Tạo dự án đầu tiên</button></div>';
  return `
    <header class="sp-header"><div><h2>Dự án Story</h2><p>Lưu DNA phong cách, tạo truyện đơn lẻ hoặc hàng loạt.</p></div><div class="sp-card-actions"><button type="button" class="btn-secondary" data-project-action="import">Nhập dự án</button><input id="sp-project-import" type="file" accept=".json,application/json" hidden><button type="button" class="btn-generate" id="sp-create-project" data-project-action="create">＋ Tạo dự án</button></div></header>
    <div class="sp-summary">
      <div class="sp-summary-card"><strong>${totals.total}</strong><span>Tổng dự án</span></div>
      <div class="sp-summary-card"><strong>${totals.running}</strong><span>Đang chạy</span></div>
      <div class="sp-summary-card"><strong>${totals.completed}</strong><span>Hoàn thành</span></div>
      <div class="sp-summary-card"><strong>${totals.stories}</strong><span>Truyện đã tạo</span></div>
    </div>
    <div class="sp-toolbar">
      <label class="sp-search">Tìm kiếm<input id="sp-search" type="search" value="${escapeHtml(filters.query || '')}" placeholder="Tên dự án hoặc phong cách"></label>
      <label>Trạng thái<select id="sp-status"><option value="">Tất cả</option>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}"${filters.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Sắp xếp<select id="sp-sort"><option value="updated-desc"${filters.sort === 'updated-desc' ? ' selected' : ''}>Mới cập nhật</option><option value="name-asc"${filters.sort === 'name-asc' ? ' selected' : ''}>Tên A–Z</option><option value="progress-desc"${filters.sort === 'progress-desc' ? ' selected' : ''}>Tiến độ cao</option></select></label>
    </div>
    ${content}`;
}

export function renderCreateProjectDialogMarkup() {
  return `
    <dialog class="sp-dialog" id="sp-create-dialog" aria-labelledby="sp-create-title">
      <form method="dialog" id="sp-create-form">
        <header><h2 id="sp-create-title">Tạo Dự án Story</h2><button type="button" data-sp-dialog-action="close" aria-label="Đóng">×</button></header>
        <section data-sp-step="1"><h3>Bước 1 · Chọn nguồn</h3><label><input type="radio" name="sp-source" value="dashboard" checked> Dùng thiết lập Dashboard hiện tại</label><label><input type="radio" name="sp-source" value="txt"> Phân tích một hoặc nhiều TXT mới</label></section>
        <section data-sp-step="2" hidden><h3>Bước 2 · Thông tin dự án</h3><label>Tên dự án<input id="sp-project-name" maxlength="120" required></label><label>Mục tiêu số truyện<input id="sp-project-target" type="number" min="1" max="999" value="10" required></label><label id="sp-files-field" hidden>Tệp TXT<input id="sp-project-files" type="file" accept=".txt,.md,text/plain,text/markdown" multiple></label><p id="sp-analysis-status" role="status"></p></section>
        <section data-sp-step="3" hidden><h3>Bước 3 · Xem trước</h3><div id="sp-project-preview"></div><p><strong>DNA khóa:</strong> chế độ, thể loại, độc giả, ngôi kể, yêu cầu bổ sung, kho tri thức.</p><p><strong>Được biến tấu:</strong> chủ đề, bối cảnh, thời đại, kết thúc, nhân vật.</p></section>
        <footer class="sp-dialog-actions"><button type="button" class="btn-secondary" data-sp-dialog-action="previous" hidden>Quay lại</button><button type="button" class="btn-generate" data-sp-dialog-action="next">Tiếp tục</button><button type="button" class="btn-generate" data-sp-dialog-action="create" hidden disabled>Tạo dự án</button></footer>
      </form>
    </dialog>`;
}

function renderProjectDetailMarkup(project, stories = []) {
  const status = resolveProjectStatus(project);
  const remaining = Math.max(0, Number(project.targetStoryCount || 0) - Number(project.successfulStoryCount || 0));
  const storyMarkup = stories.length ? stories.map(story => `
    <article class="sp-story-item" data-story-id="${escapeHtml(story.id)}">
      <div><h4>${escapeHtml(story.title)}</h4><p>${Number(story.charCount || 0).toLocaleString('vi-VN')} ký tự · ${escapeHtml(formatUpdatedAt(story.createdAt))}</p></div>
      <div class="sp-card-actions"><button type="button" class="btn-secondary" data-project-action="view-story">Xem</button><button type="button" class="btn-secondary" data-project-action="rename-story">Đổi tên</button><button type="button" class="btn-secondary" data-project-action="download-story">Tải TXT</button><button type="button" class="btn-secondary" data-project-action="delete-story">Xóa</button></div>
      <pre class="sp-story-text" hidden>${escapeHtml(story.text)}</pre>
    </article>`).join('') : '<p>Chưa có truyện nào được lưu.</p>';
  const history = (project.history || []).slice().reverse().map(item => `<li>${escapeHtml(item.at || '')} · ${escapeHtml(item.type || '')}${item.message ? ` · ${escapeHtml(item.message)}` : ''}</li>`).join('') || '<li>Chưa có lịch sử.</li>';
  return `
    <header class="sp-header"><div><button type="button" class="btn-secondary" data-project-action="back">← Danh sách dự án</button><h2>${escapeHtml(project.name)}</h2><p><span class="sp-status sp-status-${status}">${STATUS_LABELS[status]}</span> · Còn ${remaining} truyện theo mục tiêu</p></div><div class="sp-card-actions"><button type="button" class="btn-secondary" data-project-action="export">Xuất dự án</button><button type="button" class="btn-secondary" data-project-action="edit">Sửa tên</button><button type="button" class="btn-secondary" data-project-action="delete">Xóa dự án</button></div></header>
    <nav class="sp-detail-tabs" aria-label="Chi tiết dự án"><span>Tổng quan</span><span>Phong cách &amp; Thiết lập</span><span>Danh sách truyện</span><span>Lịch sử</span></nav>
    <section class="sp-detail-section"><h3>Tổng quan</h3><div class="sp-card-actions"><button type="button" class="btn-generate" data-project-action="generate">Tạo 1 truyện</button><label>Số lượng<input id="sp-batch-count" type="number" min="1" max="${remaining || 1}" value="${Math.min(5, remaining || 1)}"></label><button type="button" class="btn-generate" data-project-action="generate-batch"${remaining ? '' : ' disabled'}>Tạo hàng loạt</button><button type="button" class="btn-secondary" data-project-action="pause">Tạm dừng</button><button type="button" class="btn-secondary" data-project-action="resume">Tiếp tục</button><button type="button" class="btn-secondary" data-project-action="retry">Thử lại</button></div></section>
    <section class="sp-detail-section"><h3>Phong cách &amp; Thiết lập</h3><p>${escapeHtml(project.styleProfile?.name || 'Thiết lập Dashboard')}</p><div class="sp-card-actions"><button type="button" class="btn-secondary" data-project-action="apply-settings">Áp dụng lên Dashboard</button><button type="button" class="btn-secondary" data-project-action="preview">Tạo lại biến tấu</button><button type="button" class="btn-generate" data-project-action="generate-preview">Tạo từ bản xem trước</button></div><textarea id="sp-variation-preview" rows="12" placeholder="Bấm Tạo lại biến tấu để xem và chỉnh JSON trước khi gọi AI"></textarea></section>
    <section class="sp-detail-section"><h3>Danh sách truyện</h3><div class="sp-story-list">${storyMarkup}</div></section>
    <section class="sp-detail-section"><h3>Lịch sử</h3><ul>${history}</ul></section>`;
}

export function createStoryProjectController({
  repository,
  captureSettings,
  replaceAnalyzerFiles,
  startAnalysis,
  waitForAnalysis,
  buildStyleProfile: makeStyleProfile,
  bridge,
  now = () => new Date(),
}) {
  if (!repository) throw new TypeError('Story Project repository is required.');
  const pauseFlags = new Map();
  const makeId = () => globalThis.crypto?.randomUUID?.() || `story-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const saveNew = input => repository.saveProject(createStoryProject(input, { now: now() }));
  return {
    bridge,
    async createFromDashboard({ name, targetStoryCount }) {
      return saveNew({ name, targetStoryCount, settingsPayload: captureSettings() });
    },
    async analyzeFiles(files) {
      const waiter = waitForAnalysis();
      const summary = await replaceAnalyzerFiles(files);
      await startAnalysis();
      const analysis = await waiter;
      return { analysis, sourceFileNames: summary.fileNames };
    },
    async createFromAnalysis({ name, targetStoryCount, analysis, sourceFileNames }) {
      const styleProfile = makeStyleProfile(analysis);
      return saveNew({ name, targetStoryCount, styleProfile, settingsPayload: styleProfile.settingsPayload, sourceFileNames });
    },
    async list(filters = {}) {
      return filterAndSortStoryProjects(await repository.listProjects(), filters);
    },
    get(projectId) {
      return repository.getProject(projectId);
    },
    async update(projectId, patch) {
      const current = await repository.getProject(projectId);
      if (!current) throw new Error('Không tìm thấy Dự án Story.');
      return repository.saveProject(createStoryProject({ ...current, ...patch, id: projectId, createdAt: current.createdAt, updatedAt: now().toISOString() }, { now: now() }));
    },
    async duplicate(projectId) {
      const current = await repository.getProject(projectId);
      if (!current) throw new Error('Không tìm thấy Dự án Story.');
      return saveNew({ ...current, id: '', name: `${current.name} (bản sao)`, successfulStoryCount: 0, failedStoryCount: 0, queueRunning: false, queuePaused: false, history: [], createdAt: '', updatedAt: '' });
    },
    async previewVariation(projectId) {
      const project = await repository.getProject(projectId);
      if (!project || !bridge) throw new Error('Không thể tạo bản xem trước biến tấu.');
      return bridge.prepareVariation(project);
    },
    async generateBatch(projectId, count = 1) {
      if (!bridge) throw new Error('Chưa kết nối bộ tạo truyện.');
      const initial = await repository.getProject(projectId);
      if (!initial) throw new Error('Không tìm thấy Dự án Story.');
      const remaining = Math.max(0, Number(initial.targetStoryCount || 0) - Number(initial.successfulStoryCount || 0));
      const total = Math.min(Math.max(0, Math.floor(Number(count) || 0)), remaining);
      pauseFlags.set(projectId, false);
      await repository.saveProject(createStoryProject({ ...initial, queueRunning: true, queuePaused: false, lastError: '', updatedAt: now().toISOString() }, { now: now() }));
      const updateProject = async (mutate, prepared = null) => {
        const latest = await repository.getProject(projectId);
        if (!latest) throw new Error('Dự án Story đã bị xóa.');
        const next = mutate({ ...latest, ...(prepared ? { lastFailedSettingsPayload: prepared } : {}) });
        return repository.saveProject(createStoryProject({ ...next, updatedAt: now().toISOString() }, { now: now() }));
      };
      try {
        const result = await runSequentialStoryBatch({
          count: total,
          prepare: () => bridge.prepareVariation(initial),
          generate: prepared => bridge.generate(prepared),
          shouldPause: () => pauseFlags.get(projectId) === true,
          saveSuccess: async (generated, prepared) => {
            const latest = await repository.getProject(projectId);
            const index = Number(latest.successfulStoryCount || 0) + 1;
            await repository.saveStory({ id: makeId(), projectId, title: `Truyện ${String(index).padStart(2, '0')}`, text: String(generated.text || ''), charCount: Array.from(String(generated.text || '')).length, createdAt: now().toISOString(), settingsPayload: prepared });
            await updateProject(value => ({ ...value, successfulStoryCount: index, pendingStoryCount: Math.max(0, Number(value.pendingStoryCount || 0) - 1), lastError: '', lastFailedSettingsPayload: null, history: [...(value.history || []), { type: 'success', at: now().toISOString() }] }));
          },
          saveFailure: async (error, index, prepared) => {
            await updateProject(value => ({ ...value, failedStoryCount: Number(value.failedStoryCount || 0) + 1, lastError: String(error?.message || error), lastFailedSettingsPayload: prepared || value.lastFailedSettingsPayload, history: [...(value.history || []), { type: 'error', index, at: now().toISOString(), message: String(error?.message || error) }] }));
          },
        });
        return result;
      } finally {
        const latest = await repository.getProject(projectId);
        if (latest) await repository.saveProject(createStoryProject({ ...latest, queueRunning: false, queuePaused: Boolean(pauseFlags.get(projectId)), updatedAt: now().toISOString() }, { now: now() }));
        pauseFlags.delete(projectId);
      }
    },
    async pause(projectId) {
      pauseFlags.set(projectId, true);
      const project = await repository.getProject(projectId);
      if (!project) return null;
      return repository.saveProject(createStoryProject({ ...project, queuePaused: true, updatedAt: now().toISOString() }, { now: now() }));
    },
    async resume(projectId) {
      pauseFlags.set(projectId, false);
      const project = await repository.getProject(projectId);
      if (!project) return null;
      return repository.saveProject(createStoryProject({ ...project, queuePaused: false, updatedAt: now().toISOString() }, { now: now() }));
    },
    async retryLastFailure(projectId) {
      const project = await repository.getProject(projectId);
      if (!project?.lastFailedSettingsPayload || !bridge) throw new Error('Không có lượt lỗi để thử lại.');
      try {
        const generated = await bridge.generate(project.lastFailedSettingsPayload);
        const index = Number(project.successfulStoryCount || 0) + 1;
        await repository.saveStory({ id: makeId(), projectId, title: `Truyện ${String(index).padStart(2, '0')}`, text: String(generated.text || ''), charCount: Array.from(String(generated.text || '')).length, createdAt: now().toISOString(), settingsPayload: project.lastFailedSettingsPayload });
        return repository.saveProject(createStoryProject({ ...project, successfulStoryCount: index, lastFailedSettingsPayload: null, lastError: '', updatedAt: now().toISOString() }, { now: now() }));
      } catch (error) {
        return repository.saveProject(createStoryProject({ ...project, lastError: String(error?.message || error), updatedAt: now().toISOString() }, { now: now() }));
      }
    },
    async generatePrepared(projectId, prepared) {
      const project = await repository.getProject(projectId);
      if (!project || !bridge) throw new Error('Không thể tạo truyện từ bản xem trước.');
      const generated = await bridge.generate(prepared);
      const index = Number(project.successfulStoryCount || 0) + 1;
      const story = { id: makeId(), projectId, title: `Truyện ${String(index).padStart(2, '0')}`, text: String(generated.text || ''), charCount: Array.from(String(generated.text || '')).length, createdAt: now().toISOString(), settingsPayload: prepared };
      await repository.saveStory(story);
      await repository.saveProject(createStoryProject({ ...project, successfulStoryCount: index, lastError: '', updatedAt: now().toISOString() }, { now: now() }));
      return story;
    },
    listStories(projectId) {
      return repository.listStories(projectId);
    },
    async deleteStory(projectId, storyId) {
      await repository.deleteStory(storyId);
      const project = await repository.getProject(projectId);
      if (project) {
        const stories = await repository.listStories(projectId);
        await repository.saveProject(createStoryProject({ ...project, successfulStoryCount: stories.length, updatedAt: now().toISOString() }, { now: now() }));
      }
      return true;
    },
    async renameStory(projectId, storyId, title) {
      const stories = await repository.listStories(projectId);
      const story = stories.find(item => item.id === storyId);
      if (!story) throw new Error('Không tìm thấy truyện.');
      return repository.saveStory({ ...story, title: String(title || '').trim() || story.title });
    },
    async deleteProject(projectId) {
      const project = await repository.getProject(projectId);
      if (!project) return false;
      await repository.deleteProject(projectId);
      return true;
    },
    async exportProject(projectId) {
      const project = await repository.getProject(projectId);
      const stories = await repository.listStories(projectId);
      return buildStoryProjectExport({ project, stories }, now());
    },
    async importProject(payload) {
      const imported = parseStoryProjectImport(payload);
      await repository.saveProject(imported.project);
      for (const story of imported.stories) await repository.saveStory(story);
      return imported.project;
    },
  };
}

export function installStoryProjectRuntime({
  doc = globalThis.document,
  win = globalThis.window,
  controller,
} = {}) {
  const root = doc?.getElementById?.('story-projects-root');
  if (!root || root.dataset.storyProjectsReady) return null;
  root.dataset.storyProjectsReady = 'true';
  const repository = controller ? null : createStoryProjectRepository();
  const activeController = controller || createStoryProjectController({
    repository,
    captureSettings: captureCurrentGenerationSettings,
    replaceAnalyzerFiles: replaceStyleAnalyzerFiles,
    startAnalysis: startStyleAnalysis,
    waitForAnalysis: () => waitForStyleAnalysis(win),
    buildStyleProfile,
    bridge: createStoryProjectGenerationBridge({
      doc,
      applySettings: applyGenerationSettings,
      captureSettings: captureCurrentGenerationSettings,
      buildVariationSettings: buildControlledVariationSettings,
    }),
  });
  const filters = { query: '', status: '', sort: 'updated-desc' };
  const dialogState = { step: 1, source: 'dashboard', analysis: null, sourceFileNames: [] };
  let selectedProjectId = '';
  let searchTimer;

  const render = async () => {
    if (selectedProjectId) {
      const project = await activeController.get(selectedProjectId);
      if (project) {
        root.innerHTML = renderProjectDetailMarkup(project, await activeController.listStories(selectedProjectId));
        return [project];
      }
      selectedProjectId = '';
    }
    const projects = await activeController.list(filters);
    root.innerHTML = renderProjectsDashboardMarkup(projects, {}, filters) + renderCreateProjectDialogMarkup();
    return projects;
  };
  const dialog = () => root.querySelector('#sp-create-dialog');
  const syncDialog = () => {
    const current = dialog();
    if (!current) return;
    current.querySelectorAll('[data-sp-step]').forEach(section => { section.hidden = Number(section.dataset.spStep) !== dialogState.step; });
    current.querySelector('#sp-files-field').hidden = dialogState.source !== 'txt';
    const previous = current.querySelector('[data-sp-dialog-action="previous"]');
    const next = current.querySelector('[data-sp-dialog-action="next"]');
    const create = current.querySelector('[data-sp-dialog-action="create"]');
    previous.hidden = dialogState.step === 1;
    next.hidden = dialogState.step === 3;
    create.hidden = dialogState.step !== 3;
    create.disabled = dialogState.step !== 3;
    if (dialogState.step === 3) {
      const name = current.querySelector('#sp-project-name').value.trim();
      const target = current.querySelector('#sp-project-target').value;
      const files = dialogState.sourceFileNames.length ? dialogState.sourceFileNames.join(', ') : 'Thiết lập Dashboard hiện tại';
      current.querySelector('#sp-project-preview').innerHTML = `<p><strong>${escapeHtml(name)}</strong></p><p>Mục tiêu: ${escapeHtml(target)} truyện</p><p>Nguồn: ${escapeHtml(files)}</p>`;
    }
  };
  const openDialog = () => {
    dialogState.step = 1;
    dialogState.source = 'dashboard';
    dialogState.analysis = null;
    dialogState.sourceFileNames = [];
    const current = dialog();
    syncDialog();
    current?.showModal?.();
    if (current && !current.open) current.setAttribute('open', '');
  };
  const closeDialog = () => {
    const current = dialog();
    current?.close?.();
    current?.removeAttribute?.('open');
    root.querySelector('#sp-create-project')?.focus?.();
  };

  root.addEventListener('input', event => {
    if (event.target.id === 'sp-search') {
      win.clearTimeout(searchTimer);
      searchTimer = win.setTimeout(() => { filters.query = event.target.value; render(); }, 150);
    }
  });
  root.addEventListener('change', event => {
    if (event.target.id === 'sp-status') { filters.status = event.target.value; render(); }
    if (event.target.id === 'sp-sort') { filters.sort = event.target.value; render(); }
    if (event.target.name === 'sp-source') { dialogState.source = event.target.value; syncDialog(); }
    if (event.target.id === 'sp-project-import') {
      const file = event.target.files?.[0];
      if (file) file.text().then(text => activeController.importProject(text)).then(() => render()).catch(error => win.alert(`Không thể nhập dự án: ${error.message || error}`));
    }
  });
  root.addEventListener('click', async event => {
    const projectAction = event.target.closest?.('[data-project-action]');
    if (projectAction?.dataset.projectAction === 'create') { openDialog(); return; }
    if (projectAction?.dataset.projectAction === 'import') { root.querySelector('#sp-project-import')?.click(); return; }
    if (projectAction?.dataset.projectAction === 'open') { selectedProjectId = projectAction.closest('[data-project-id]')?.dataset.projectId || ''; await render(); return; }
    if (projectAction?.dataset.projectAction === 'generate') {
      const projectId = selectedProjectId || projectAction.closest('[data-project-id]')?.dataset.projectId;
      if (!selectedProjectId) selectedProjectId = projectId;
      await activeController.generateBatch(projectId, 1);
      await render();
      return;
    }
    if (projectAction?.dataset.projectAction === 'back') { selectedProjectId = ''; await render(); return; }
    if (projectAction?.dataset.projectAction === 'generate-batch') { await activeController.generateBatch(selectedProjectId, root.querySelector('#sp-batch-count')?.value || 1); await render(); return; }
    if (projectAction?.dataset.projectAction === 'pause') { await activeController.pause(selectedProjectId); await render(); return; }
    if (projectAction?.dataset.projectAction === 'resume') { await activeController.resume(selectedProjectId); const project = await activeController.get(selectedProjectId); await activeController.generateBatch(selectedProjectId, Math.max(0, Number(project.targetStoryCount || 0) - Number(project.successfulStoryCount || 0))); await render(); return; }
    if (projectAction?.dataset.projectAction === 'retry') { await activeController.retryLastFailure(selectedProjectId); await render(); return; }
    if (projectAction?.dataset.projectAction === 'apply-settings') { const project = await activeController.get(selectedProjectId); await applyGenerationSettings(project.settingsPayload); return; }
    if (projectAction?.dataset.projectAction === 'preview') { const preview = await activeController.previewVariation(selectedProjectId); root.querySelector('#sp-variation-preview').value = JSON.stringify(preview, null, 2); return; }
    if (projectAction?.dataset.projectAction === 'generate-preview') { const preview = JSON.parse(root.querySelector('#sp-variation-preview').value); await activeController.generatePrepared(selectedProjectId, preview); await render(); return; }
    if (projectAction?.dataset.projectAction === 'edit') { const projectId = selectedProjectId || projectAction.closest('[data-project-id]')?.dataset.projectId; const project = await activeController.get(projectId); const name = win.prompt('Tên dự án', project.name); if (name?.trim()) await activeController.update(projectId, { name }); await render(); return; }
    if (projectAction?.dataset.projectAction === 'export') { const payload = await activeController.exportProject(selectedProjectId); downloadJson(payload, `${projectAction.closest('.story-projects-panel') ? 'StoryProject' : 'StoryProject'}.json`, doc); return; }
    if (projectAction?.dataset.projectAction === 'delete') { const projectId = selectedProjectId || projectAction.closest('[data-project-id]')?.dataset.projectId; const project = await activeController.get(projectId); if (!win.confirm(`Xóa dự án “${project.name}” và toàn bộ truyện đã lưu?`)) return; if (win.confirm('Xuất bản sao JSON trước khi xóa?')) downloadJson(await activeController.exportProject(projectId), 'StoryProject.json', doc); await activeController.deleteProject(projectId); selectedProjectId = ''; await render(); return; }
    if (projectAction?.dataset.projectAction === 'view-story') { const text = projectAction.closest('[data-story-id]')?.querySelector('.sp-story-text'); if (text) text.hidden = !text.hidden; return; }
    if (projectAction?.dataset.projectAction === 'rename-story') { const item = projectAction.closest('[data-story-id]'); const current = item.querySelector('h4')?.textContent || ''; const title = win.prompt('Tên truyện', current); if (title?.trim()) { await activeController.renameStory(selectedProjectId, item.dataset.storyId, title); await render(); } return; }
    if (projectAction?.dataset.projectAction === 'download-story') { const item = projectAction.closest('[data-story-id]'); downloadText(item.querySelector('.sp-story-text')?.textContent || '', `${item.querySelector('h4')?.textContent || 'Story'}.txt`, doc); return; }
    if (projectAction?.dataset.projectAction === 'delete-story') { const item = projectAction.closest('[data-story-id]'); if (win.confirm('Xóa truyện đã chọn?')) { await activeController.deleteStory(selectedProjectId, item.dataset.storyId); await render(); } return; }
    const action = event.target.closest?.('[data-sp-dialog-action]')?.dataset.spDialogAction;
    if (!action) return;
    if (action === 'close') { closeDialog(); return; }
    if (action === 'previous') { dialogState.step = Math.max(1, dialogState.step - 1); syncDialog(); return; }
    if (action === 'next' && dialogState.step === 1) { dialogState.step = 2; syncDialog(); return; }
    if (action === 'next' && dialogState.step === 2) {
      const current = dialog();
      const name = current.querySelector('#sp-project-name');
      const target = current.querySelector('#sp-project-target');
      if (!name.value.trim() || !target.checkValidity()) { current.querySelector('#sp-create-form').reportValidity?.(); return; }
      if (dialogState.source === 'txt') {
        const files = current.querySelector('#sp-project-files').files;
        if (!files?.length) { current.querySelector('#sp-analysis-status').textContent = 'Hãy chọn ít nhất một tệp TXT.'; return; }
        current.querySelector('#sp-analysis-status').textContent = 'Đang phân tích phong cách…';
        try {
          const result = await activeController.analyzeFiles(files);
          dialogState.analysis = result.analysis;
          dialogState.sourceFileNames = result.sourceFileNames;
        } catch (error) {
          current.querySelector('#sp-analysis-status').textContent = `Lỗi phân tích: ${error.message || error}`;
          return;
        }
      }
      dialogState.step = 3;
      syncDialog();
      return;
    }
    if (action === 'create') {
      const current = dialog();
      const input = { name: current.querySelector('#sp-project-name').value, targetStoryCount: current.querySelector('#sp-project-target').value };
      if (dialogState.source === 'txt') await activeController.createFromAnalysis({ ...input, analysis: dialogState.analysis, sourceFileNames: dialogState.sourceFileNames });
      else await activeController.createFromDashboard(input);
      closeDialog();
      await render();
      win.dispatchEvent(new win.CustomEvent('story-maker:open-projects'));
    }
  });

  render().catch(error => { root.innerHTML = `<p class="sp-error">Không thể tải Dự án Story: ${escapeHtml(error.message || error)}</p>`; });
  return { controller: activeController, render, filters };
}

function downloadJson(value, filename, doc) {
  downloadBlob(JSON.stringify(value, null, 2), filename, 'application/json;charset=utf-8', doc);
}

function downloadText(value, filename, doc) {
  downloadBlob(value, filename, 'text/plain;charset=utf-8', doc);
}

function downloadBlob(value, filename, type, doc) {
  const anchor = doc.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([value], { type }));
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installStoryProjectRuntime());
  else installStoryProjectRuntime();
}

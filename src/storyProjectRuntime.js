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
import { createStoryProjectRepository } from './storyProjectStorage.js';

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
    <header class="sp-header"><div><h2>Dự án Story</h2><p>Lưu DNA phong cách, tạo truyện đơn lẻ hoặc hàng loạt.</p></div><button type="button" class="btn-generate" id="sp-create-project" data-project-action="create">＋ Tạo dự án</button></header>
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
  let searchTimer;

  const render = async () => {
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
  });
  root.addEventListener('click', async event => {
    const projectAction = event.target.closest?.('[data-project-action]');
    if (projectAction?.dataset.projectAction === 'create') { openDialog(); return; }
    if (projectAction?.dataset.projectAction === 'generate') {
      win.dispatchEvent(new win.CustomEvent('story-maker:story-project-generate', { detail: { projectId: projectAction.closest('[data-project-id]')?.dataset.projectId } }));
      return;
    }
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

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installStoryProjectRuntime());
  else installStoryProjectRuntime();
}

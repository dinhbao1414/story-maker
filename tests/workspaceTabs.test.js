import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  installWorkspaceTabs,
  isProgressActive,
  resolveWorkspaceTab,
} from '../src/workspaceTabs.js';

function createElement(dataset = {}) {
  const attributes = new Map();
  const classes = new Set();
  const listeners = {};
  return {
    dataset: { ...dataset },
    hidden: false,
    open: false,
    tabIndex: 0,
    textContent: '',
    listeners,
    classList: {
      contains(value) { return classes.has(value); },
      toggle(value, force) {
        if (force) classes.add(value);
        else classes.delete(value);
      },
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    addEventListener(name, listener) { listeners[name] = listener; },
    focus() { this.focused = true; },
  };
}

assert.equal(resolveWorkspaceTab('dashboard'), 'dashboard');
assert.equal(resolveWorkspaceTab('projects'), 'projects');
assert.equal(resolveWorkspaceTab('formulas'), 'formulas');
assert.equal(resolveWorkspaceTab('settings'), 'settings');
assert.equal(resolveWorkspaceTab('unknown'), 'dashboard');
assert.equal(resolveWorkspaceTab(''), 'dashboard');
assert.equal(isProgressActive('Tiến độ và nhật ký AI: Đang chờ'), false);
assert.equal(isProgressActive('Tiến độ và nhật ký AI: Đang tạo truyện'), true);

const dashboardTab = createElement({ workspaceTab: 'dashboard' });
const projectsTab = createElement({ workspaceTab: 'projects' });
const formulasTab = createElement({ workspaceTab: 'formulas' });
const settingsTab = createElement({ workspaceTab: 'settings' });
const dashboardPanel = createElement({ workspacePanel: 'dashboard' });
const projectsPanel = createElement({ workspacePanel: 'projects' });
const formulasPanel = createElement({ workspacePanel: 'formulas' });
const settingsPanel = createElement({ workspacePanel: 'settings' });
const dashboardAction = createElement({ workspaceAction: 'dashboard' });
const progressDisclosure = createElement();
const progressTitle = createElement();
progressDisclosure.open = true;
progressTitle.textContent = 'Tiến độ và nhật ký AI: Đang chờ';

const elementsById = new Map([
  ['progress-window', progressDisclosure],
  ['progress-title-text', progressTitle],
]);
const doc = {
  documentElement: { dataset: {} },
  querySelectorAll(selector) {
    if (selector === '[data-workspace-tab]') return [dashboardTab, projectsTab, formulasTab, settingsTab];
    if (selector === '[data-workspace-panel]') return [dashboardPanel, projectsPanel, formulasPanel, settingsPanel];
    if (selector === '[data-workspace-action]') return [dashboardAction];
    return [];
  },
  getElementById(id) { return elementsById.get(id) || null; },
};
const win = {
  listeners: {},
  addEventListener(name, listener) { this.listeners[name] = listener; },
  MutationObserver: class {
    constructor(callback) {
      this.callback = callback;
      win.progressObserver = this;
    }
    observe(target, options) {
      this.target = target;
      this.options = options;
    }
  },
};

const runtime = installWorkspaceTabs({ doc, win });
assert.equal(runtime.getActiveTab(), 'dashboard');
assert.equal(dashboardPanel.hidden, false);
assert.equal(projectsPanel.hidden, true);
assert.equal(settingsPanel.hidden, true);
assert.equal(dashboardTab.getAttribute('aria-selected'), 'true');
assert.equal(settingsTab.getAttribute('aria-selected'), 'false');
assert.equal(dashboardTab.classList.contains('is-active'), true);
assert.equal(progressDisclosure.open, false);

settingsTab.listeners.click();
assert.equal(runtime.getActiveTab(), 'settings');
assert.equal(dashboardPanel.hidden, true);
assert.equal(settingsPanel.hidden, false);

projectsTab.listeners.click();
assert.equal(runtime.getActiveTab(), 'projects');
assert.equal(projectsPanel.hidden, false);
assert.equal(settingsPanel.hidden, true);

formulasTab.listeners.click();
assert.equal(runtime.getActiveTab(), 'formulas');
assert.equal(formulasPanel.hidden, false);
assert.equal(projectsPanel.hidden, true);

let prevented = false;
settingsTab.listeners.keydown({
  key: 'Home',
  preventDefault() { prevented = true; },
});
assert.equal(prevented, true);
assert.equal(runtime.getActiveTab(), 'dashboard');
assert.equal(dashboardTab.focused, true);

dashboardAction.listeners.click();
assert.equal(runtime.getActiveTab(), 'dashboard');

win.listeners['story-maker:settings-imported']();
assert.equal(runtime.getActiveTab(), 'settings');

win.listeners['story-maker:open-projects']();
assert.equal(runtime.getActiveTab(), 'projects');

win.listeners['story-maker:open-dashboard']();
assert.equal(runtime.getActiveTab(), 'dashboard');
assert.equal(dashboardPanel.hidden, false);

progressTitle.textContent = 'Tiến độ và nhật ký AI: Đang phân tích';
win.progressObserver.callback();
assert.equal(progressDisclosure.open, true);

const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(css, /\.workspace-tabs\s*\{/);
assert.match(css, /\.workspace-tab\s*\{/);
assert.match(css, /\[data-workspace-panel\]\[hidden\]/);
assert.match(css, /\.settings-panel\.disabled-panel \.workspace-back-dashboard\s*\{[^}]*pointer-events:\s*auto/);
assert.match(html, /data-workspace-tab="formulas"/);
assert.match(html, /data-workspace-panel="formulas"/);
assert.match(html, /id="cf-folder-input"[^>]*webkitdirectory/);
assert.match(html, /id="cf-formula-name"/);
assert.match(html, /id="cf-analyze"/);
assert.match(html, /id="cf-generate"/);
assert.match(html, /id="cf-selected-formula"/);
assert.match(html, /AI Random mô típ &amp; điền thiết lập|AI Random mô típ & điền thiết lập/);

console.log('workspaceTabs tests passed');

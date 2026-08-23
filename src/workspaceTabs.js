export const WORKSPACE_TABS = Object.freeze(['dashboard', 'projects', 'formulas', 'settings']);

export function resolveWorkspaceTab(value) {
  return WORKSPACE_TABS.includes(value) ? value : 'dashboard';
}

export function isProgressActive(value) {
  const text = String(value || '').trim();
  return Boolean(text) && !/(?:Đang chờ|waiting|待機中)/i.test(text);
}

function installProgressDisclosure(doc, win) {
  const disclosure = doc.getElementById?.('progress-window');
  const title = doc.getElementById?.('progress-title-text');
  if (!disclosure || !title || !('open' in disclosure)) return null;

  const sync = () => {
    disclosure.open = isProgressActive(title.textContent);
  };
  sync();

  const Observer = win?.MutationObserver;
  if (typeof Observer !== 'function') return { sync, observer: null };
  const observer = new Observer(sync);
  observer.observe(title, { childList: true, characterData: true, subtree: true });
  return { sync, observer };
}

export function installWorkspaceTabs({
  doc = globalThis.document,
  win = globalThis.window,
} = {}) {
  if (!doc) return null;
  const tabs = [...doc.querySelectorAll('[data-workspace-tab]')];
  const panels = [...doc.querySelectorAll('[data-workspace-panel]')];
  const actions = [...doc.querySelectorAll('[data-workspace-action]')];
  if (!tabs.length || !panels.length) return null;

  let activeTab = 'dashboard';
  const setActiveTab = value => {
    activeTab = resolveWorkspaceTab(value);
    doc.documentElement.dataset.workspaceTab = activeTab;
    tabs.forEach(tab => {
      const selected = tab.dataset.workspaceTab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList?.toggle?.('is-active', selected);
    });
    panels.forEach(panel => {
      const selected = panel.dataset.workspacePanel === activeTab;
      panel.hidden = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
    });
    return activeTab;
  };
  const getActiveTab = () => activeTab;

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.workspaceTab));
    tab.addEventListener('keydown', event => {
      const key = event.key;
      let nextIndex = index;
      if (key === 'ArrowRight' || key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      else if (key === 'ArrowLeft' || key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (key === 'Home') nextIndex = 0;
      else if (key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      const nextTab = tabs[nextIndex];
      setActiveTab(nextTab.dataset.workspaceTab);
      nextTab.focus?.();
    });
  });

  actions.forEach(action => {
    action.addEventListener('click', () => setActiveTab(action.dataset.workspaceAction));
  });
  win?.addEventListener?.('story-maker:settings-imported', () => setActiveTab('settings'));
  win?.addEventListener?.('story-maker:open-projects', () => setActiveTab('projects'));
  win?.addEventListener?.('story-maker:open-formulas', () => setActiveTab('formulas'));
  win?.addEventListener?.('story-maker:open-dashboard', () => setActiveTab('dashboard'));
  installProgressDisclosure(doc, win);
  setActiveTab(doc.documentElement.dataset.workspaceTab);
  return { setActiveTab, getActiveTab };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installWorkspaceTabs());
  } else {
    installWorkspaceTabs();
  }
}

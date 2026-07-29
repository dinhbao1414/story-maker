// Story Maker v5.0.2 public runtime guards.
// Keep public UI safety outside the legacy bundled main.js.

import {
  MODE_LABELS,
  PUBLIC_MODE_VALUES,
  isLongModeText,
} from './modeContracts.js';
import {
  apiKeyProvider as keyProvider,
  isRealApiKey,
  normalizeApiKey,
  readApiSession,
  writeApiSession,
} from './apiSession.js';
import { installAlphapolisAssist } from './alphapolisAssist.js';
import { installKakuyomuAssist } from './kakuyomuAssist.js';
import { Gt } from './providerClients.js';
import { editorialCallOptions, installEditorialBrushupRuntime } from './editorialBrushupRuntime.js';
import { installPublicOutputCleanup } from './outputCleanup.js';
import { installStandardTypewriterCursor } from './standardTypewriterRenderer.js';
import { getVietnameseLabel } from './vietnameseLabels.js';

const LONG_MODE_ENABLED = false;
const FALLBACK_MODE = 'novel';
let editorialBrushupInstalled = false;
const SA_STANDARD_LOCKED_ATTR = 'data-sa-standard-generating-locked';

const OUTPUT_GUIDE_HTML = `
        <div class="guide">
          <h3>Bắt đầu</h3>
          <ol>
            <li>Nhập rồi lưu khóa Gemini hoặc OpenAI ở phía trên</li>
            <li>Chọn chế độ đầu ra, chủ đề và các thiết lập bên trái</li>
            <li>Bấm “Tạo truyện”</li>
            <li>Có thể dùng “🎲 Ngẫu nhiên tất cả” để thiết lập nhanh</li>
            <li>Có thể dán hoặc nhập tệp TXT/MD vào Kết quả để AI nhận xét và tinh chỉnh truyện có sẵn</li>
          </ol>
        </div>
`;

function preserveApiSession(previous) {
  const current = readApiSession();
  writeApiSession({
    apiProvider: current.apiProvider || previous?.apiProvider || 'gemini',
    geminiKey: current.geminiKey || previous?.geminiKey,
    openaiKey: current.openaiKey || previous?.openaiKey,
  });
}

function rememberVisibleApiKey() {
  const input = document.getElementById('apikey');
  if (!input || !isRealApiKey(input.value)) return false;
  const provider = keyProvider(input.value);
  const current = readApiSession();
  writeApiSession({
    ...current,
    apiProvider: provider,
    [provider === 'openai' ? 'openaiKey' : 'geminiKey']: normalizeApiKey(input.value),
  });
  return true;
}

function restoreVisibleApiKeyIfMainMissed() {
  const input = document.getElementById('apikey');
  const save = document.getElementById('key-save');
  const edit = document.getElementById('key-edit');
  if (!input || !save) return;
  const current = readApiSession();
  const provider = current.apiProvider === 'openai' ? 'openai' : 'gemini';
  const key = normalizeApiKey(provider === 'openai' ? current.openaiKey : current.geminiKey);
  if (!isRealApiKey(key)) return;
  if (input.readOnly) {
    document.getElementById('banner')?.classList.add('locked');
    save.classList.add('hidden');
    edit?.classList.remove('hidden');
    return;
  }
  if (input.value) return;
  input.value = key;
  save.click();
}

function publicModeButtons() {
  return [...document.querySelectorAll('#mode-chips button[data-v]')]
    .filter(button => PUBLIC_MODE_VALUES.includes(button.dataset.v));
}

function longModeButtons() {
  return [...document.querySelectorAll('#mode-chips button[data-v="long"]')];
}

function isVisible(element) {
  return !!(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
}

function isModeLocked() {
  const lockButton = document.querySelector('.btn-lock[data-section="mode"]');
  const section = document.getElementById('section-mode');
  return !!(
    section?.classList.contains('is-locked')
    || /🔒/.test(lockButton?.textContent || '')
  );
}

function fireClick(element) {
  element?.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}

function hideLongMode() {
  document.documentElement.dataset.longNovelSealed = LONG_MODE_ENABLED ? 'active' : 'true';
  for (const button of longModeButtons()) {
    if (LONG_MODE_ENABLED) {
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
      button.classList.remove('is-disabled');
      button.style.display = '';
      button.title = 'Có thể sử dụng chế độ tiểu thuyết dài.';
    } else {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.classList.remove('active');
      button.classList.add('is-disabled');
      button.style.display = 'none';
      button.title = 'Chế độ tiểu thuyết dài bị ẩn khỏi giao diện công khai.';
    }
  }
}

function selectFallbackMode() {
  const fallback = document.querySelector(`#mode-chips button[data-v="${FALLBACK_MODE}"]`);
  if (fallback) {
    fireClick(fallback);
  }
  const custom = document.getElementById('mode-custom');
  if (custom && isLongModeText(custom.value)) {
    custom.value = getVietnameseLabel(MODE_LABELS[FALLBACK_MODE] || '短編小説');
  }
  document.getElementById('long-novel-panel')?.classList.add('hidden');
}

function activeModeText() {
  const active = document.querySelector('#mode-chips button.active');
  const custom = document.getElementById('mode-custom');
  return [
    active?.dataset.v,
    active?.textContent,
    custom?.value,
  ].filter(Boolean).join(' ');
}

function currentModeIsLong() {
  return !LONG_MODE_ENABLED && isLongModeText(activeModeText());
}

function pickRandomPublicMode() {
  if (isModeLocked()) return false;
  const candidates = publicModeButtons().filter(button => !button.disabled && isVisible(button));
  if (!candidates.length) return false;
  const active = document.querySelector('#mode-chips button.active');
  const pool = candidates.filter(button => button !== active);
  const choices = pool.length ? pool : candidates;
  const next = choices[Math.floor(Math.random() * choices.length)];
  fireClick(next);
  return true;
}

function installClickGuards() {
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button || LONG_MODE_ENABLED) return;

    if (button.id === 'btn-rand-mode') {
      if (pickRandomPublicMode()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (button.dataset?.v === 'long') {
      event.preventDefault();
      event.stopImmediatePropagation();
      hideLongMode();
      selectFallbackMode();
      alert('Chế độ tiểu thuyết dài hiện đang tạm dừng. Hãy chọn truyện ngắn, truyện vừa hoặc chế độ công khai khác.');
      return;
    }

    if ((button.id === 'btn-generate' || button.classList.contains('btn-generate')) && currentModeIsLong()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      hideLongMode();
      selectFallbackMode();
      alert('Chế độ tiểu thuyết dài hiện đang tạm dừng. Hãy chọn truyện ngắn, truyện vừa hoặc chế độ công khai khác.');
    }
  }, true);
}

function installDomGuard() {
  const observer = new MutationObserver(hideLongMode);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  hideLongMode();
  setTimeout(hideLongMode, 0);
  setTimeout(hideLongMode, 80);
  setTimeout(hideLongMode, 250);
}

function installApiSessionGuard() {
  const input = document.getElementById('apikey');
  if (!input) return;
  input.addEventListener('input', rememberVisibleApiKey);
  input.addEventListener('change', rememberVisibleApiKey);
  document.getElementById('key-save')?.addEventListener('click', () => {
    rememberVisibleApiKey();
    setTimeout(rememberVisibleApiKey, 250);
  }, true);
  document.getElementById('btn-switch-api')?.addEventListener('click', () => {
    const previous = readApiSession();
    rememberVisibleApiKey();
    setTimeout(() => {
      preserveApiSession(previous);
      restoreVisibleApiKeyIfMainMissed();
    }, 250);
  }, true);
  setTimeout(restoreVisibleApiKeyIfMainMissed, 50);
  setTimeout(restoreVisibleApiKeyIfMainMissed, 250);
}

function normalizedManualOutputText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function updateOutputCounter(text) {
  const counter = document.querySelector('.char-counter');
  if (counter) counter.textContent = `${String(text || '').length.toLocaleString()} ký tự`;
}

function revealOutputCopyActions(visible) {
  for (const id of ['btn-copy', 'btn-download']) {
    document.getElementById(id)?.classList.toggle('hidden', !visible);
  }
}

function refreshOutputDependentPanels() {
  window.dispatchEvent(new CustomEvent('story-maker:kakuyomu-refresh'));
  window.dispatchEvent(new CustomEvent('story-maker:alphapolis-refresh'));
  window.dispatchEvent(new CustomEvent('story-maker:output-manual-change'));
}

function setStyleAnalyzerGenerationLocked(locked) {
  const section = document.getElementById('sa-section');
  if (!section) return;
  section.classList.toggle('generating', locked);
  section.setAttribute('aria-disabled', locked ? 'true' : 'false');
  section.querySelectorAll('button, input, textarea, select').forEach(control => {
    if (locked) {
      if (!control.hasAttribute(SA_STANDARD_LOCKED_ATTR)) {
        control.setAttribute(SA_STANDARD_LOCKED_ATTR, control.disabled ? 'true' : 'false');
      }
      control.disabled = true;
      return;
    }
    const wasDisabled = control.getAttribute(SA_STANDARD_LOCKED_ATTR);
    if (wasDisabled === null) return;
    control.disabled = wasDisabled === 'true';
    control.removeAttribute(SA_STANDARD_LOCKED_ATTR);
  });
}

function isGenerationUiBusy() {
  const settings = document.getElementById('settings');
  const generateButton = document.getElementById('btn-generate');
  if (settings?.classList.contains('generating')) return true;
  if (!generateButton?.disabled) return false;
  return /思考|生成|構築|受信|通信|検査|矛盾|品質|フォールバック|API|thinking|generating/i
    .test(generateButton.textContent || '');
}

function installStyleAnalyzerGenerationLockSync() {
  const section = document.getElementById('sa-section');
  const settings = document.getElementById('settings');
  const generateButton = document.getElementById('btn-generate');
  if (!section || (!settings && !generateButton)) return;
  let lastState = null;
  const sync = () => {
    const nextState = isGenerationUiBusy();
    if (nextState === lastState) return;
    lastState = nextState;
    setStyleAnalyzerGenerationLocked(nextState);
  };
  const observer = new MutationObserver(sync);
  if (settings) observer.observe(settings, { attributes: true, attributeFilter: ['class'] });
  if (generateButton) {
    observer.observe(generateButton, {
      attributes: true,
      attributeFilter: ['disabled', 'class'],
      childList: true,
      subtree: true,
    });
  }
  sync();
  setTimeout(sync, 0);
}

function setManualOutput(text, sourceLabel = 'Văn bản bên ngoài') {
  const output = document.getElementById('output');
  const tagRow = document.getElementById('tag-row');
  if (!output) return false;
  const nextText = normalizedManualOutputText(text);
  if (!nextText) {
    alert('Nội dung đưa vào Kết quả đang trống.');
    return false;
  }
  output.dataset.manualOutput = 'true';
  delete output.dataset.longifyOutput;
  output.className = 'output-box text-selectable';
  output.textContent = nextText;
  updateOutputCounter(nextText);
  if (tagRow) tagRow.innerHTML = `<span class="tag">${sourceLabel}</span>`;
  revealOutputCopyActions(true);
  output.scrollTop = 0;
  refreshOutputDependentPanels();
  return true;
}

function resetManualOutput() {
  const output = document.getElementById('output');
  const tagRow = document.getElementById('tag-row');
  if (!output) return;
  delete output.dataset.manualOutput;
  delete output.dataset.longifyOutput;
  output.className = 'output-box empty text-selectable';
  output.innerHTML = OUTPUT_GUIDE_HTML;
  updateOutputCounter('');
  if (tagRow) tagRow.innerHTML = '';
  revealOutputCopyActions(false);
  refreshOutputDependentPanels();
}

function installOutputIntakeControls() {
  const output = document.getElementById('output');
  if (!output) return;
  const fileInput = document.getElementById('output-import-file');
  const outputPanel = document.getElementById('output-panel');
  output.setAttribute('tabindex', '0');
  output.title = 'Bấm vào đây rồi nhấn Ctrl+V để dán nội dung';

  const isEditableTarget = target => {
    const element = target?.closest?.('input, textarea, select, [contenteditable="true"]');
    return Boolean(element && element !== output);
  };

  const isOutputPasteTarget = target => {
    return target === output
      || output.contains(target)
      || target === outputPanel
      || outputPanel?.contains?.(target);
  };

  const handleOutputPaste = event => {
    if (isEditableTarget(event.target) || !isOutputPasteTarget(event.target)) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!normalizedManualOutputText(text)) return;
    event.preventDefault();
    setManualOutput(text, 'Nội dung đã dán');
  };

  output.addEventListener('click', () => {
    try {
      output.focus({ preventScroll: true });
    } catch {
      output.focus();
    }
  });
  output.addEventListener('paste', handleOutputPaste);
  outputPanel?.addEventListener('paste', handleOutputPaste);

  document.getElementById('btn-output-paste')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      setManualOutput(text, 'Nội dung đã dán');
    } catch {
      alert('Không thể đọc bộ nhớ tạm. Hãy kiểm tra quyền của trình duyệt.');
    }
  });

  document.getElementById('btn-output-import')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      setManualOutput(await file.text(), file.name || 'Nội dung đã nhập');
    } catch {
      alert('Không thể đọc tệp TXT/MD.');
    }
  });

  document.getElementById('btn-output-clear')?.addEventListener('click', resetManualOutput);
  document.getElementById('btn-generate')?.addEventListener('click', () => {
    delete output.dataset.manualOutput;
  }, true);

  installLocalQaOutputLoader();
}

function isLocalQaOrigin() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

function qaOutputPathFromUrl() {
  if (!isLocalQaOrigin()) return '';
  const raw = new URLSearchParams(window.location.search).get('qaOutputFile') || '';
  if (!raw || /^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return '';
    return url.pathname.startsWith('/scratch/') ? `${url.pathname}${url.search}` : '';
  } catch {
    return '';
  }
}

async function installLocalQaOutputLoader() {
  const qaPath = qaOutputPathFromUrl();
  if (!qaPath) return;
  try {
    const response = await fetch(qaPath, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setManualOutput(await response.text(), 'Nội dung QA đã nhập');
  } catch (error) {
    console.warn('QA output import failed:', error);
  }
}

function outputHasPotentialStory(output) {
  if (!output || output.classList.contains('empty')) return false;
  if (output.querySelector?.('.guide')) return false;
  const text = output.innerText || output.textContent || '';
  return text.trim().length >= 40;
}

function generationIsActive() {
  return Boolean(
    document.getElementById('btn-generate')?.disabled
    || document.getElementById('settings')?.classList.contains('generating')
  );
}

async function callEditorialAi(prompt, context = {}) {
  const session = readApiSession();
  const provider = session.apiProvider === 'openai' ? 'openai' : 'gemini';
  const key = normalizeApiKey(provider === 'openai' ? session.openaiKey : session.geminiKey);
  if (!isRealApiKey(key)) throw new Error('Không xác nhận được khóa API đang chọn');
  const model = provider === 'openai' ? 'gpt-5.5' : 'gemini-3.5-flash';
  return Gt(key, model, prompt, null, {
    ...editorialCallOptions(context),
    openAiResponsesBetaAllowed: true,
  });
}

function installEditorialBrushupOnce() {
  if (editorialBrushupInstalled) return;
  installEditorialBrushupRuntime({ doc: document, timers: window, callAi: callEditorialAi });
  editorialBrushupInstalled = true;
}

function installOutputAssistLauncher() {
  const output = document.getElementById('output');
  const generateButton = document.getElementById('btn-generate');
  if (!output) return;

  let installed = false;
  let queued = false;
  const installAssistModules = () => {
    if (installed) return;
    installed = true;
    observer.disconnect();
    installEditorialBrushupOnce();
    installKakuyomuAssist();
    installAlphapolisAssist();
  };
  const tryInstall = () => {
    queued = false;
    if (installed) return;
    const manualOutput = output.dataset.manualOutput === 'true';
    if (generationIsActive() && !manualOutput) return;
    if (outputHasPotentialStory(output) || manualOutput) {
      installAssistModules();
    }
  };
  const scheduleTryInstall = () => {
    if (queued || installed) return;
    queued = true;
    const schedule = window.requestAnimationFrame || (callback => setTimeout(callback, 0));
    schedule(tryInstall);
  };
  const observer = new MutationObserver(scheduleTryInstall);
  observer.observe(output, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-manual-output'],
  });
  generateButton && observer.observe(generateButton, {
    attributes: true,
    attributeFilter: ['disabled', 'class'],
  });
  scheduleTryInstall();
  setTimeout(scheduleTryInstall, 250);
  setTimeout(scheduleTryInstall, 1000);
  setTimeout(scheduleTryInstall, 2500);
  setTimeout(() => {
    if (!installed) installAssistModules();
  }, 3500);
}

function installPublicRuntime() {
  document.documentElement.dataset.smkPublicRuntime = 'active';
  installClickGuards();
  installDomGuard();
  installApiSessionGuard();
  installOutputIntakeControls();
  installStyleAnalyzerGenerationLockSync();
  installStandardTypewriterCursor({
    outputEl: document.getElementById('output'),
    outputPanel: document.getElementById('output-panel'),
    generateButton: document.getElementById('btn-generate'),
    longNovelPanel: document.getElementById('long-novel-panel'),
  });
  installEditorialBrushupOnce();
  installPublicOutputCleanup();
  installOutputAssistLauncher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installPublicRuntime, { once: true });
} else {
  installPublicRuntime();
}

import { applyGenerationSettings } from './generationSettingsIo.js';
import {
  buildStyleProfile,
  deleteStyleProfile,
  extractStyleAnalysisFromPayload,
  formatStyleProfilePreview,
  isStyleAnalysisRequest,
  loadStyleProfiles,
  saveStyleProfile,
} from './stylePresetHelpers.js';

function installStyleAnalysisCapture(win) {
  if (typeof win.fetch !== 'function' || win.__storyMakerStylePresetFetch) return;
  const originalFetch = win.fetch.bind(win);
  win.fetch = async (input, init = {}) => {
    const capture = isStyleAnalysisRequest(input, init);
    const response = await originalFetch(input, init);
    if (capture && response.ok) {
      response.clone().json()
        .then(extractStyleAnalysisFromPayload)
        .then(analysis => {
          if (analysis) win.dispatchEvent(new win.CustomEvent('story-maker:style-analysis-ready', { detail: analysis }));
        })
        .catch(error => console.warn('Style preset capture failed:', error));
    }
    return response;
  };
  win.__storyMakerStylePresetFetch = true;
}

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

export function installStylePresetRuntime({
  doc = globalThis.document,
  win = globalThis.window,
  storage = globalThis.localStorage,
} = {}) {
  if (!doc || !win || doc.getElementById('style-preset-panel')) return null;
  installStyleAnalysisCapture(win);
  const analysisResult = doc.getElementById('sa-result-wrap');
  if (!analysisResult) return null;

  const panel = doc.createElement('div');
  panel.id = 'style-preset-panel';
  panel.className = 'sa-result-wrap hidden';
  panel.innerHTML = `
    <div class="sa-block-header">
      <span class="sa-block-title">🧩 Thiết lập tạo truyện đề xuất</span>
    </div>
    <p class="sa-desc">AI đã chọn toàn bộ thiết lập từ tài liệu tham chiếu. Hãy xem trước, chỉnh tên hồ sơ, rồi mới áp dụng.</p>
    <label class="sa-desc" for="style-profile-name">Tên hồ sơ</label>
    <input id="style-profile-name" type="text" maxlength="120" placeholder="Ví dụ: Kịch tính đảo ngược">
    <label class="sa-desc" for="style-profile-select">Hồ sơ đã lưu</label>
    <select id="style-profile-select"></select>
    <div class="output-actions" style="margin: 10px 0; flex-wrap: wrap;">
      <button class="btn-secondary" id="btn-style-profile-save">💾 Lưu hồ sơ</button>
      <button class="btn-secondary" id="btn-style-profile-delete">🗑️ Xóa hồ sơ đã chọn</button>
    </div>
    <div class="sa-result-box text-selectable" id="style-preset-preview"></div>
    <button class="sa-btn-action" id="btn-style-preset-apply" disabled>✅ Áp dụng thiết lập đã xem trước</button>
    <p class="sa-desc-hint" id="style-preset-status"></p>
  `;
  analysisResult.insertAdjacentElement('afterend', panel);

  const nameInput = doc.getElementById('style-profile-name');
  const profileSelect = doc.getElementById('style-profile-select');
  const preview = doc.getElementById('style-preset-preview');
  const applyButton = doc.getElementById('btn-style-preset-apply');
  const saveButton = doc.getElementById('btn-style-profile-save');
  const deleteButton = doc.getElementById('btn-style-profile-delete');
  const status = doc.getElementById('style-preset-status');
  let currentProfile = null;
  let profiles = [];

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.style.color = error ? '#fca5a5' : '#6ee7b7';
  };

  const refreshSelect = selectedId => {
    profiles = loadStyleProfiles(storage);
    profileSelect.replaceChildren();
    const placeholder = doc.createElement('option');
    placeholder.value = '';
    placeholder.textContent = profiles.length ? 'Chọn hồ sơ đã lưu…' : 'Chưa có hồ sơ đã lưu';
    profileSelect.appendChild(placeholder);
    for (const profile of profiles) {
      const option = doc.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      profileSelect.appendChild(option);
    }
    profileSelect.value = profiles.some(profile => profile.id === selectedId) ? selectedId : '';
    deleteButton.disabled = !profileSelect.value;
  };

  const showProfile = profile => {
    currentProfile = profile;
    panel.classList.remove('hidden');
    nameInput.value = profile.name;
    preview.textContent = formatStyleProfilePreview(profile);
    applyButton.disabled = false;
    saveButton.disabled = false;
    refreshSelect(profiles.some(item => item.id === profile.id) ? profile.id : '');
  };

  win.addEventListener('story-maker:style-analysis-ready', event => {
    showProfile(buildStyleProfile(event.detail || {}));
    setStatus('Đã tạo bản xem trước. Chưa thay đổi thiết lập hiện tại.');
  });

  profileSelect.addEventListener('change', () => {
    const profile = profiles.find(item => item.id === profileSelect.value);
    deleteButton.disabled = !profile;
    if (!profile) return;
    showProfile(profile);
    setStatus('Đã tải hồ sơ để xem trước. Chưa áp dụng.');
  });

  saveButton.addEventListener('click', () => {
    if (!currentProfile) return;
    const name = nameInput.value.trim();
    if (!name) {
      setStatus('Hãy nhập tên hồ sơ trước khi lưu.', true);
      return;
    }
    try {
      currentProfile = { ...currentProfile, name };
      saveStyleProfile(storage, currentProfile);
      preview.textContent = formatStyleProfilePreview(currentProfile);
      refreshSelect(currentProfile.id);
      setStatus(`Đã lưu hồ sơ “${name}” trong trình duyệt.`);
    } catch (error) {
      setStatus(`Không thể lưu hồ sơ: ${error.message || error}`, true);
    }
  });

  deleteButton.addEventListener('click', () => {
    const id = profileSelect.value;
    const profile = profiles.find(item => item.id === id);
    if (!profile || !win.confirm(`Xóa hồ sơ “${profile.name}”?`)) return;
    deleteStyleProfile(storage, id);
    currentProfile = null;
    preview.textContent = '';
    nameInput.value = '';
    applyButton.disabled = true;
    refreshSelect('');
    if (!profiles.length) panel.classList.add('hidden');
    setStatus('Đã xóa hồ sơ.');
  });

  applyButton.addEventListener('click', async () => {
    if (!currentProfile) return;
    applyButton.disabled = true;
    try {
      await applyGenerationSettings(currentProfile.settingsPayload, { announce: false });
      setStatus('Đã áp dụng toàn bộ thiết lập và nhân vật. Bạn có thể kiểm tra rồi bấm Tạo truyện.');
      doc.getElementById('settings')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setStatus(`Không thể áp dụng hồ sơ: ${error.message || error}`, true);
    } finally {
      applyButton.disabled = false;
    }
  });

  refreshSelect('');
  if (profiles[0]) {
    showProfile(profiles[0]);
    setStatus('Đã tải hồ sơ gần nhất để xem trước. Chưa áp dụng.');
  }
  return panel;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installStylePresetRuntime());
  } else {
    installStylePresetRuntime();
  }
}

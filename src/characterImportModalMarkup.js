import { At, Et } from './legacyOptionData.js';
import { getVietnameseLabel } from './vietnameseLabels.js';

function Cf(characters, images) {
  const roles = At.map(value => `<option value="${value}">${getVietnameseLabel(value)}</option>`).join('');
  const personalities = Et.map(value => `<option value="${value}">${getVietnameseLabel(value)}</option>`).join('');
  const cards = characters.map((character, index) => `
    <div class="ci-char-card">
      <div class="ci-char-header">
        <label class="ci-check-label">
          <input type="checkbox" class="ci-check" data-idx="${index}" checked>
          <span class="ci-char-name-display">${character.name || `Nhân vật ${index + 1}`}</span>
        </label>
        <span class="ci-char-badge">${character.role.includes('(推定') ? '🤖 AI suy luận' : '📖 Đọc từ văn bản'}</span>
      </div>
      <div class="ci-char-fields">
        <div class="ci-field">
          <label class="ci-field-label">Tên</label>
          <input type="text" class="ci-input ci-name" data-idx="${index}" value="${(character.name || '').replace(/"/g, '&quot;')}">
        </div>
        <div class="ci-field">
          <label class="ci-field-label">Giới tính</label>
          <input type="text" class="ci-input ci-sex" data-idx="${index}" value="${(character.sex || '').replace(/"/g, '&quot;')}">
        </div>
        <div class="ci-field">
          <label class="ci-field-label">Vai trò</label>
          <div class="ci-select-wrap">
            <select class="ci-select ci-role-select" data-idx="${index}">
              <option value="">-- Chuyển sang nhập tự do --</option>
              ${roles}
            </select>
            <input type="text" class="ci-input ci-role-input" data-idx="${index}" value="${(character.role || '').replace(/\(推定\)/g, '').trim().replace(/"/g, '&quot;')}" placeholder="Nhập tự do...">
          </div>
        </div>
        <div class="ci-field">
          <label class="ci-field-label">Tính cách</label>
          <div class="ci-select-wrap">
            <select class="ci-select ci-personality-select" data-idx="${index}">
              <option value="">-- Chuyển sang nhập tự do --</option>
              ${personalities}
            </select>
            <input type="text" class="ci-input ci-personality-input" data-idx="${index}" value="${(character.personality || '').replace(/\(推定\)/g, '').trim().replace(/"/g, '&quot;')}" placeholder="Nhập tự do...">
          </div>
        </div>
        <div class="ci-field ci-field-full">
          <label class="ci-field-label">Ghi chú chi tiết</label>
          <textarea class="ci-textarea ci-note" data-idx="${index}" rows="3">${(character.note || '').replace(/</g, '&lt;')}</textarea>
        </div>
      </div>
    </div>
  `).join('');
  const imageList = Array.isArray(images) && images.length
    ? `<div class="ci-thumbnail-wrap">${images.map((image, index) => `<img src="${image}" class="ci-thumbnail" alt="Ảnh nguồn ${index + 1}">`).join('')}</div>`
    : '';
  return `
    <div class="ci-modal-overlay" id="ci-modal">
      <div class="ci-modal">
        <div class="ci-modal-header">
          <h3 class="ci-modal-title">📷 Kết quả nhận diện nhân vật</h3>
          <span class="ci-modal-count">Đã phát hiện ${characters.length} nhân vật</span>
          <button class="ci-modal-close" id="ci-modal-close">✕</button>
        </div>
        ${imageList}
        <div class="ci-char-list">
          ${cards}
        </div>
        <div class="ci-modal-actions">
          <button class="ci-btn ci-btn-primary" id="ci-btn-register">✅ Đăng ký nhân vật đã chọn</button>
          <button class="ci-btn ci-btn-secondary" id="ci-btn-cancel">Hủy</button>
        </div>
      </div>
    </div>
  `;
}

export {
  Cf,
};

import { getVietnameseLabel } from './vietnameseLabels.js';

function defaultEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createSubChipMarkup(values, escapeHtml = defaultEscape) {
  return (Array.isArray(values) ? values : []).map((value) => {
    const escapedValue = escapeHtml(value);
    const escapedLabel = escapeHtml(getVietnameseLabel(value));
    return `<button class="chip sub-chip" data-v="${escapedValue}">${escapedLabel}</button>`;
  }).join('');
}

function createCategoryChipMarkup(categories, escapeHtml = defaultEscape) {
  return Object.keys(categories || {}).map((category) => {
    const escapedValue = escapeHtml(category);
    const escapedLabel = escapeHtml(getVietnameseLabel(category));
    return `<button class="chip cat-chip" data-cat="${escapedValue}">${escapedLabel}</button>`;
  }).join('');
}

export { createCategoryChipMarkup, createSubChipMarkup };

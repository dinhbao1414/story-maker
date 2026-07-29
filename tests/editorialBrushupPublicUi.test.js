import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/publicRuntime.js', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

assert.match(html, /Tinh chỉnh truyện này/);
assert.match(html, /Tự động tinh chỉnh để đạt điểm cao \(tối đa 3 lần\)/);
assert.match(html, /Mục tiêu 100 điểm; tiếp tục cải thiện tối đa 3 lần/);
assert.match(html, /85–89: có thể xuất bản; từ 90: đạt chuẩn biên tập/);
assert.doesNotMatch(html, /id="longify-target-chars"/);
assert.doesNotMatch(html, />この小説を長編化</);
assert.match(runtime, /installEditorialBrushupRuntime/);
assert.doesNotMatch(runtime, /installLongifyBetaOnce\(\)/);
assert.match(style, /\.editorial-review-detail/);
assert.match(style, /\.editorial-review-problems/);
assert.match(style, /\.editorial-review-revision-plan/);

console.log('editorial brushup public UI tests passed');

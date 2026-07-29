import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODES } from '../src/data.js';
import { getVietnameseLabel } from '../src/vietnameseLabels.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, '');
const legacySource = fs.readFileSync(new URL('../src/legacyMain.js', import.meta.url), 'utf8');
const runtimeSources = [
  legacySource,
  '../src/editorialBrushupRuntime.js',
].map(source => source.startsWith('../')
  ? fs.readFileSync(new URL(source, import.meta.url), 'utf8')
  : source).join('\n');

assert.match(html, /<html lang="vi">/);

for (const expected of [
  'Trình tạo truyện AI',
  'Chưa cấu hình API',
  'Nhập khóa API Gemini hoặc OpenAI',
  'Đổi API',
  'Tạo truyện',
  'Chế độ đầu ra',
  'Chủ đề / Ý tưởng',
  'Nhân vật',
  'Thể loại',
  'Bối cảnh thế giới',
  'Đối tượng độc giả',
  'Thời đại',
  'Kiểu kết thúc',
  'Ngôi kể',
  'Yêu cầu bổ sung',
]) {
  assert.match(html, new RegExp(expected));
}

for (const forbidden of [
  'API未設定',
  'ストーリー生成',
  '出力モード',
  'テーマ / シード',
  '登場人物',
  'ジャンル',
  '世界観',
  '読者層',
  '時代',
  '結末',
  '語り口',
  '補足',
]) {
  assert.doesNotMatch(visibleHtml, new RegExp(forbidden));
}

assert.equal(MODES.every(mode => !/[ぁ-んァ-ヶ一-龯]/u.test(getVietnameseLabel(mode.label))), true);
for (const forbidden of [
  /alert\("APIキーを先に保存してください"\)/,
  /textContent="作風解析の開始を待っています/,
  /textContent="ストーリー生成"/,
  /textContent="出力結果がここに表示されます/,
  /ニュース取得中:<\/strong>/,
  /title="万能インプット全体がロック/,
]) {
  assert.doesNotMatch(legacySource, forbidden);
}

assert.match(legacySource, /function localizeSelectedAxisInputs/);
assert.match(legacySource, /setLocalizedInputValue\(input,raw\)/);
assert.match(runtimeSources, /Đang tạo truyện/);
assert.match(runtimeSources, /Đang tinh chỉnh/);
assert.match(runtimeSources, /lỗi phân tích phong cách/i);
assert.match(runtimeSources, /Đã sao chép/);

console.log('Vietnamese UI tests passed');

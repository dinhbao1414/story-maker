import assert from 'node:assert/strict';
import { translateLegacyUiText } from '../src/legacyUiVietnamese.js';

assert.equal(
  translateLegacyUiText('対応する画像ファイルがありません。\nPNG/JPG/WEBP/GIF のみ対応しています。'),
  'Không có tệp ảnh được hỗ trợ.\nChỉ hỗ trợ PNG/JPG/WEBP/GIF.',
);
assert.equal(translateLegacyUiText('🎨 この作風でリライト実行'), '🎨 Viết lại theo phong cách này');
assert.equal(translateLegacyUiText('リライトエラー: timeout'), 'Lỗi viết lại: timeout');
assert.equal(
  translateLegacyUiText('[検査] 第2章の設定整合性チェックを実行中...', { id: 'progress-log' }),
  '[Kiểm tra] Đang kiểm tra tính nhất quán của Chương 2...',
);
assert.equal(
  translateLegacyUiText('第2章の物語本文', { id: 'output' }),
  '第2章の物語本文',
);

console.log('Legacy Vietnamese UI translation tests passed');

import assert from 'node:assert/strict';

import {
  Hs,
  Js,
  Vd,
  fo,
  ia,
  xr,
} from '../src/apiErrorHelpers.js';

assert.equal(Hs('Blocked by Safety Filter'), true);
assert.equal(Js('429 resource exhausted'), true);
assert.equal(fo('API key not valid'), true);
assert.equal(Vd('Available Models: gemini-2.5-flash'), true);
assert.equal(ia('thinking_config invalid_argument'), true);

assert.equal(
  xr('Gemini text failure', 'Blocked by Safety Filter', [], { safety: true }),
  '【Hạn chế nội dung】Bộ lọc an toàn đã chặn yêu cầu. Hãy thay đổi cách diễn đạt.',
);

assert.equal(
  xr('Gemini vision failure', 'Blocked by Safety Filter', [], { safety: true, vision: true }),
  '【Hạn chế nội dung】Bộ lọc an toàn đã chặn ảnh. Hãy thử ảnh khác.',
);

assert.equal(
  xr('Gemini text failure', 'Diagnostic Failed: API key not valid', [], { auth: true }),
  '【Lỗi xác thực】Khóa API không hợp lệ. Hãy nhập đúng khóa.',
);

assert.match(
  xr('Gemini text failure', 'Available Models: gemini-2.5-flash', ['gemini-pro: 404 not found']),
  /model khả dụng hoặc định dạng yêu cầu không được chấp nhận/,
);

console.log('api error helper tests passed');

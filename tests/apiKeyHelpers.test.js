import assert from 'node:assert/strict';
import {
  Lt,
  Oe,
  Qf,
  Xf,
  Yf,
  gn,
} from '../src/apiKeyHelpers.js';

const fakeOpenAiKey = 'sk-' + 'abcdefghijklmnopqrstuvwxyz';
const fakeGeminiKey = 'AIza' + 'abcdefghijklmnopqrstuvwxyz';

assert.equal(Oe('  sk-test_key\n'), 'sk-test_key');
assert.equal(Yf('********'), true);
assert.equal(Yf('sk-test_key'), false);

assert.deepEqual(Xf(`  ${fakeOpenAiKey}  `, 'openai'), {
  provider: 'openai',
  length: 29,
  masked: false,
  short: false,
  empty: false,
  badChars: false,
  sanitizedDelta: 4,
});

assert.equal(Lt('', 'gemini').ok, false);
assert.equal(Lt('********', 'gemini').message, 'Khóa API vẫn đang ở dạng che. Hãy bấm Chỉnh sửa rồi nhập lại khóa thật.');
assert.equal(Lt('abc', 'gemini').message, 'Khóa API quá ngắn (3 ký tự). Hãy nhập lại khóa thật.');
assert.equal(Lt('abc$defghijklmnopqrst', 'gemini').message, 'Khóa API chứa ký tự không hợp lệ. Hãy xóa ký tự thừa khi sao chép rồi nhập lại.');
assert.equal(Lt(fakeGeminiKey, 'gemini').ok, true);

assert.equal(gn(fakeOpenAiKey), 'gpt-4.1');
assert.equal(gn(fakeGeminiKey), 'gemini-3.5-flash');
assert.equal(Qf(fakeOpenAiKey), 'ChatGPT');
assert.equal(Qf(fakeGeminiKey), 'Gemini');

console.log('apiKeyHelpers tests passed');

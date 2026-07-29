import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ANALYZE_READY_LABEL,
  OPENAI_LIMIT_LABEL,
  OPENAI_LIMIT_TITLE,
  countStyleAnalyzerTextChars,
  getAddDirectTextState,
  getAnalyzeButtonState,
  getReflectButtonState,
  hasDirectStyleText,
} from '../src/styleAnalyzerControlState.js';

const styleCss = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
assert.doesNotMatch(styleCss, /sa-beta-section\.sa-inactive[^{]*\{[^}]*opacity:\s*\.25/);
assert.doesNotMatch(styleCss, /sa-beta-section\.sa-inactive[^{]*\{[^}]*pointer-events:\s*none/);

assert.equal(hasDirectStyleText('  memo  '), true);
assert.equal(hasDirectStyleText('   '), false);
assert.equal(ANALYZE_READY_LABEL, '🔬 Phân tích và tự điền thiết lập');
assert.equal(OPENAI_LIMIT_LABEL, '⚠ Vượt giới hạn ký tự (OpenAI)');
assert.match(OPENAI_LIMIT_TITLE, /Hãy rút ngắn văn bản hoặc dùng Gemini/);

assert.deepEqual(getAddDirectTextState('body'), { disabled: false });
assert.deepEqual(getAddDirectTextState('  '), { disabled: true });

assert.equal(
  countStyleAnalyzerTextChars([{ content: 'abc' }, { text: 'ignored' }, { content: 'de' }], 'XYZ'),
  8,
);

assert.deepEqual(getAnalyzeButtonState({ apiKey: '', textFiles: [], imageFiles: [], directText: '' }), {
  disabled: true,
  text: ANALYZE_READY_LABEL,
  title: '',
});

assert.deepEqual(getAnalyzeButtonState({ apiKey: 'key', textFiles: [], imageFiles: [], directText: 'input' }), {
  disabled: false,
  text: ANALYZE_READY_LABEL,
  title: '',
});

assert.deepEqual(getAnalyzeButtonState({ apiKey: 'key', textFiles: [{ content: 'a' }], imageFiles: [], directText: '' }), {
  disabled: false,
  text: ANALYZE_READY_LABEL,
  title: '',
});

assert.deepEqual(getAnalyzeButtonState({ apiKey: 'key', textFiles: [], imageFiles: [{}], directText: '' }), {
  disabled: false,
  text: ANALYZE_READY_LABEL,
  title: '',
});

assert.deepEqual(
  getAnalyzeButtonState({
    apiKey: 'key',
    provider: 'openai',
    textFiles: [{ content: '123456' }],
    directText: '',
    openAiLimit: 5,
  }),
  {
    disabled: true,
    text: OPENAI_LIMIT_LABEL,
    title: OPENAI_LIMIT_TITLE,
  },
);

assert.deepEqual(getReflectButtonState({ storyText: '1234567890', outputIsEmpty: false, hasAnalysis: true }), {
  disabled: false,
});
assert.deepEqual(getReflectButtonState({ storyText: 'short', outputIsEmpty: false, hasAnalysis: true }), {
  disabled: true,
});
assert.deepEqual(getReflectButtonState({ storyText: '1234567890', outputIsEmpty: true, hasAnalysis: true }), {
  disabled: true,
});
assert.deepEqual(getReflectButtonState({ storyText: '1234567890', outputIsEmpty: false, hasAnalysis: false }), {
  disabled: true,
});

console.log('styleAnalyzerControlState tests passed');

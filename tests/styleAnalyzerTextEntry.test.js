import assert from 'node:assert/strict';
import {
  countStyleAnalyzerTextFileChars,
  createDirectStyleTextEntry,
  createStyleAnalyzerFileCountLabel,
} from '../src/styleAnalyzerTextEntry.js';

assert.equal(createDirectStyleTextEntry('   ', 0), null);

assert.deepEqual(createDirectStyleTextEntry('  本文メモ  ', 0), {
  name: 'Văn bản nhập trực tiếp_1',
  text: '本文メモ',
  charCount: 4,
});

assert.deepEqual(createDirectStyleTextEntry('\n雨の匂い\n', 2), {
  name: 'Văn bản nhập trực tiếp_3',
  text: '雨の匂い',
  charCount: 4,
});

assert.equal(countStyleAnalyzerTextFileChars([{ charCount: 1200 }, { charCount: 34 }]), 1234);
assert.equal(createStyleAnalyzerFileCountLabel([{ charCount: 1200 }, { charCount: 34 }]), '2 mục / 1,234 ký tự');
assert.equal(createStyleAnalyzerFileCountLabel([]), '0 mục / 0 ký tự');
assert.equal(createStyleAnalyzerFileCountLabel(null), '0 mục / 0 ký tự');

console.log('styleAnalyzerTextEntry tests passed');

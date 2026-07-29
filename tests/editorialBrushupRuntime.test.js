import assert from 'node:assert/strict';
import {
  buildEditorialBrushupPrompt,
  buildEditorialFormatRepairPrompt,
  createEditorialReviewMarkup,
  isEditorialBrushupReady,
  runEditorialReview,
  runEditorialBrushup,
  createEditorialTypewriterFrames,
  prepareEditorialReveal,
  editorialTextFingerprint,
  prepareEditorialReviewText,
  formatEditorialProgress,
  formatEditorialElapsedProgress,
  updateEditorialProgressSurface,
  updateEditorialAuxiliaryUi,
  setEditorialBrushupRunningState,
  resetEditorialBrushupForNewGeneration,
  shouldStartAutomaticBrushup,
  formatEditorialCompletion,
} from '../src/editorialBrushupRuntime.js';
import { STORY_MAKER_FOOTER } from '../src/version.js';

const structuredReviewText = (score, commentary = '改善点を具体的に確認した。') => [
  `AI総合点: ${score}点`,
  'AI講評:', commentary,
  '良い点:', '主題が明確。',
  '問題点:', '対立の展開を強める必要がある。',
  '改稿方針:', '対立を行動と場面で具体化する。',
  'モード契約適合: 適合',
].join('\n');

const original = '彼女は古い駅で手紙を拾った。\n\n返事を書き、朝の列車を見送った。';
const improved = '彼女は古い駅で手紙を拾った。差出人の震えた筆跡に、昨日の後悔が残っていた。\n\n彼女は返事を書き、自分の言葉で別れを告げて朝の列車を見送った。';
assert.equal(isEditorialBrushupReady({ textContent: original, classList: { contains: () => false } }), true);
assert.equal(isEditorialBrushupReady({ textContent: original, classList: { contains: value => value === 'empty' } }), false);

const progressButton = { disabled: false, textContent: 'この小説をブラッシュアップ' };
const progressStatus = { textContent: 'AI講評: 要ブラッシュアップ' };
setEditorialBrushupRunningState({ button: progressButton, statusElement: progressStatus, running: true });
assert.equal(progressButton.disabled, true);
assert.equal(progressButton.textContent, 'Đang tinh chỉnh...');
assert.equal(progressStatus.textContent, 'Đã bắt đầu tinh chỉnh. Vui lòng chờ...');
setEditorialBrushupRunningState({ button: progressButton, statusElement: progressStatus, running: false });
assert.equal(progressButton.textContent, 'Tinh chỉnh truyện này');
const resetButton = { disabled: false, textContent: '古い完了表示' };
const resetSection = { attributes: {}, classList: { added: [], add(value) { this.added.push(value); } }, setAttribute(name, value) { this.attributes[name] = value; } };
const resetReview = { innerHTML: '<div>古い講評</div>', classList: { added: [], add(value) { this.added.push(value); } } };
const resetStatus = { textContent: 'ブラッシュアップ完了（91点）' };
const resetAutoCheckbox = { disabled: false };
const resetDoc = { documentElement: { dataset: {
  editorialReviewResult: 'completed',
  editorialReviewScore: '91',
  editorialBrushupResult: 'completed',
  editorialBrushupAttempts: '3',
} } };
resetEditorialBrushupForNewGeneration({ doc: resetDoc, sectionElement: resetSection, button: resetButton, reviewElement: resetReview, statusElement: resetStatus, autoCheckbox: resetAutoCheckbox });
assert.deepEqual(resetSection.classList.added, ['is-waiting']);
assert.equal(resetSection.attributes['aria-disabled'], 'true');
assert.equal(resetButton.disabled, true);
assert.equal(resetAutoCheckbox.disabled, true);
assert.equal(resetButton.textContent, 'Tinh chỉnh truyện này');
assert.equal(resetReview.innerHTML, '');
assert.deepEqual(resetReview.classList.added, ['hidden']);
assert.equal(resetStatus.textContent, 'Đang chờ nội dung mới và nhận xét AI...');
assert.deepEqual(resetDoc.documentElement.dataset, {});
assert.equal(formatEditorialProgress({ phase: 'review', attempt: 0, maxAttempts: 3 }), 'API đang hoạt động: Đang nhận xét bản gốc...');
assert.equal(formatEditorialProgress({ phase: 'brushup', attempt: 2, maxAttempts: 3 }), 'API đang hoạt động: Đang tạo bản sửa (2/3 lần · mục tiêu 100 điểm)...');
assert.equal(formatEditorialProgress({ phase: 'review', attempt: 2, maxAttempts: 3 }), 'API đang hoạt động: Đang chấm lại sau sửa (2/3 lần · mục tiêu 100 điểm)...');
assert.equal(
  formatEditorialProgress({ phase: 'decision', attempt: 1, maxAttempts: 3, decision: { adopt: false, currentScore: 89, candidateScore: 87, issues: ['score_not_improved'] } }),
  'Kết quả chấm điểm (1/3 lần): trước 89 điểm → bản đề xuất 87 điểm (Không áp dụng: Điểm không tăng)',
);
assert.equal(
  formatEditorialProgress({ phase: 'decision', attempt: 2, maxAttempts: 3, decision: { adopt: true, currentScore: 89, candidateScore: 92, issues: [] } }),
  'Kết quả chấm điểm (2/3 lần): trước 89 điểm → bản đề xuất 92 điểm (Đã áp dụng)',
);
assert.equal(formatEditorialElapsedProgress('API đang hoạt động: Đang tạo bản sửa (1/3 lần · mục tiêu 100 điểm)...', 12.9), 'API đang hoạt động: Đang tạo bản sửa (1/3 lần · mục tiêu 100 điểm)... (đã trôi qua 12 giây)');
assert.deepEqual(createEditorialTypewriterFrames('abcdefg', { chunkSize: 3 }), ['abc', 'abcdef', 'abcdefg']);
assert.equal(createEditorialTypewriterFrames('あ'.repeat(1200)).length, 600);
const editorialReveal = prepareEditorialReveal(`本文\n\n${STORY_MAKER_FOOTER}.`);
assert.equal(editorialReveal.bodyText, '本文');
assert.equal(editorialReveal.finalText, `本文\n\n${STORY_MAKER_FOOTER}`);
assert.equal(editorialTextFingerprint(`本文\r\n\r\n${STORY_MAKER_FOOTER}.`), '本文');
assert.equal(editorialTextFingerprint(`本文\n\n${STORY_MAKER_FOOTER}`), '本文');
assert.equal(shouldStartAutomaticBrushup({ checked: true, review: { valid: true, score: 84 }, running: false }), true);
assert.equal(shouldStartAutomaticBrushup({ checked: true, review: { valid: true, score: 85 }, running: false }), true);
assert.equal(shouldStartAutomaticBrushup({ checked: true, review: { valid: true, score: 89 }, running: false }), true);
assert.equal(shouldStartAutomaticBrushup({ checked: true, review: { valid: true, score: 100 }, running: false }), false);
assert.equal(shouldStartAutomaticBrushup({ checked: false, review: { valid: true, score: 70 }, running: false }), false);
assert.equal(shouldStartAutomaticBrushup({ checked: true, review: { valid: true, score: 70 }, running: true }), false);
assert.equal(formatEditorialCompletion({ score: 84, attempts: 3, maxAttempts: 3 }), 'Đã kết thúc tối đa 3 lần · cần tinh chỉnh (84 điểm / có thể xuất bản từ 85 điểm)');
assert.equal(formatEditorialCompletion({ score: 89, attempts: 1, maxAttempts: 3 }), 'Tinh chỉnh hoàn tất · có thể xuất bản (89 điểm / đạt chuẩn 90 điểm)');
assert.equal(formatEditorialCompletion({ score: 92, attempts: 3, maxAttempts: 3 }), 'Tinh chỉnh hoàn tất · đạt chuẩn biên tập (92 điểm)');
assert.equal(formatEditorialCompletion({ score: 100, attempts: 2, maxAttempts: 3 }), 'Tinh chỉnh hoàn tất · đạt chuẩn biên tập (100 điểm)');
assert.equal(
  prepareEditorialReviewText(`本文\n\n${STORY_MAKER_FOOTER}.`, 'novel', text => `${text}\n\n`),
  `本文\n\n${STORY_MAKER_FOOTER}`,
);

const structuredBrushupPrompt = buildEditorialBrushupPrompt({
  text: original,
  review: { score: 86, commentary: '総評', problems: '中盤が弱い', revisionPlan: '対立を行動で強める' },
  modeLabel: 'ショート',
});
assert.match(structuredBrushupPrompt, /未解消の問題点: 中盤が弱い/);
assert.match(structuredBrushupPrompt, /必須の改稿方針: 対立を行動で強める/);
assert.match(structuredBrushupPrompt, /本文の出来事・観察・判断を更新しないメタ進行文/);
assert.match(structuredBrushupPrompt, /新しい事実、人物、出来事、設定を足さず/);
const highScoreBrushupPrompt = buildEditorialBrushupPrompt({
  text: original,
  review: { score: 89, commentary: '完成度は高い。', problems: '終盤の決断が弱い。', revisionPlan: '決断の代償を場面で示す。' },
  mode: 'short',
  modeLabel: '短編',
});
assert.match(highScoreBrushupPrompt, /高得点向け精密改稿/);
assert.match(highScoreBrushupPrompt, /修正対象を最大3箇所/);
assert.match(highScoreBrushupPrompt, /それ以外の場面/);
const formatRepairPrompt = buildEditorialFormatRepairPrompt({
  mode: '4koma',
  modeLabel: '4コマ漫画風',
  text: `1コマ目（起）:\n絵/状況: 店内\nセリフ: 客「はい」\n${STORY_MAKER_FOOTER}`,
});
assert.match(formatRepairPrompt, /1コマ目、2コマ目、3コマ目、4コマ目/);
assert.match(formatRepairPrompt, /「絵\/状況:」「セリフ:」「狙い:」/);
assert.doesNotMatch(formatRepairPrompt, /Created By AI Story Maker/);
const progressTitle = { textContent: '' };
const progressLog = { textContent: '' };
updateEditorialProgressSurface({ titleElement: progressTitle, logElement: progressLog, message: 'API đang hoạt động: Đang nhận xét bản gốc...', reset: true });
updateEditorialProgressSurface({ titleElement: progressTitle, logElement: progressLog, message: 'API đang hoạt động: Đang tạo bản sửa (1/3 lần · mục tiêu 100 điểm)...' });
assert.equal(progressTitle.textContent, 'Tiến độ và nhật ký AI: API đang hoạt động: Đang tạo bản sửa (1/3 lần · mục tiêu 100 điểm)...');
assert.equal(progressLog.textContent, '【Tiến độ tinh chỉnh】\nAPI đang hoạt động: Đang nhận xét bản gốc...\nAPI đang hoạt động: Đang tạo bản sửa (1/3 lần · mục tiêu 100 điểm)...');

const reviewMarkup = createEditorialReviewMarkup({
  score: 86,
  valid: true,
  commentary: '全体講評。',
  problems: '1. 【中盤】対立が会話だけで解消し、主人公の選択が弱いため4点減点。',
  revisionPlan: '1. 中盤の会話を、主人公が損失を引き受ける行動へ置き換える。',
}, { attempts: 1 });
assert.match(reviewMarkup, /editorial-review-score-value[^>]*>86/);
assert.match(reviewMarkup, /editorial-review-score-bar-fill/);
assert.match(reviewMarkup, /<h4>Tổng quan<\/h4>/);
assert.match(reviewMarkup, /<pre class="editorial-review-commentary">全体講評。<\/pre>/);
assert.match(reviewMarkup, /<h4>Điểm cần cải thiện<\/h4>/);
assert.match(reviewMarkup, /主人公の選択が弱いため4点減点/);
assert.match(reviewMarkup, /<h4>Việc cần làm ở lần sửa tiếp theo<\/h4>/);
assert.match(reviewMarkup, /損失を引き受ける行動/);
assert.match(reviewMarkup, /Số lần tinh chỉnh: 1/);
assert.match(reviewMarkup, /Có thể xuất bản · tinh chỉnh tùy chọn/);

const apiAlert = { textContent: '', style: { display: 'none' } };
const generationScores = { innerHTML: 'old graph', style: { display: 'grid' } };
updateEditorialAuxiliaryUi({ alertElement: apiAlert, scoreBoard: generationScores, message: 'Đang tạo bản sửa (1/3 lần)', active: true });
assert.equal(apiAlert.textContent, '⚠️ API đang hoạt động: Đang tạo bản sửa (1/3 lần)');
assert.equal(apiAlert.style.display, 'flex');
updateEditorialAuxiliaryUi({ alertElement: apiAlert, scoreBoard: generationScores, message: 'API đang hoạt động: Đang chấm lại', active: true });
assert.equal(apiAlert.textContent, '⚠️ API đang hoạt động: Đang chấm lại');
assert.equal(generationScores.innerHTML, '');
assert.equal(generationScores.style.display, 'none');
updateEditorialAuxiliaryUi({ alertElement: apiAlert, scoreBoard: generationScores, active: false });
assert.equal(apiAlert.style.display, 'none');

let reviewCalls = 0;
const repairedReview = await runEditorialReview({ text: original, mode: 'novel', modeLabel: '短編', callAi: async (_prompt, context) => {
  reviewCalls += 1;
  return context.stage === 'review' ? { text: '形式外' } : { text: 'AI総合点: 80点\nAI講評:\n結末を強めたい。\n良い点:\n導入' };
} });
assert.equal(reviewCalls, 2);
assert.equal(repairedReview.score, 80);

let brushupCalls = 0;
const brushupProgress = [];
const brushedReviewScores = [78, 85, 92, 100];
const brushed = await runEditorialBrushup({ text: original, mode: 'novel', modeLabel: '短編', autoUntilPass: true, onProgress: progress => brushupProgress.push(progress), callAi: async (_prompt, context) => {
  brushupCalls += 1;
  if (context.stage === 'review') {
    const score = brushedReviewScores.shift();
    return { text: structuredReviewText(score, score === 78 ? '感情を強める。' : '改善した。') };
  }
  if (context.stage === 'brushup') return { text: improved };
  throw new Error(`unexpected ${context.stage}`);
} });
assert.equal(brushed.text, improved);
assert.equal(brushed.review.score, 100);
assert.equal(brushed.attempts, 3);
assert.deepEqual(brushupProgress.map(progress => [progress.phase, progress.attempt]), [
  ['review', 0],
  ['brushup', 1],
  ['review', 1],
  ['decision', 1],
  ['brushup', 2],
  ['review', 2],
  ['decision', 2],
  ['brushup', 3],
  ['review', 3],
  ['decision', 3],
]);

let reusedReviewCalls = 0;
const reused = await runEditorialBrushup({
  text: original,
  mode: 'novel',
  modeLabel: '短編',
  initialReview: { score: 88, commentary: '初回講評', problems: '中盤', revisionPlan: '対立を強める', modeFit: '適合', structuredValid: true, valid: true },
  callAi: async (_prompt, context) => {
    if (context.stage === 'review') { reusedReviewCalls += 1; return { text: structuredReviewText(91) }; }
    if (context.stage === 'brushup') return { text: improved };
    throw new Error(`unexpected ${context.stage}`);
  },
});
assert.equal(reusedReviewCalls, 1);
assert.equal(reused.attempts, 1);

let requiredRewriteCalls = 0;
const requiredBrushup = await runEditorialBrushup({ text: original, mode: 'novel', modeLabel: '短編', autoUntilPass: true, callAi: async (_prompt, context) => {
  if (context.stage === 'review') return { text: structuredReviewText([84, 90, 96, 100][requiredRewriteCalls]) };
  if (context.stage === 'brushup') { requiredRewriteCalls += 1; return { text: improved }; }
  throw new Error(`unexpected ${context.stage}`);
} });
assert.equal(requiredRewriteCalls, 3);
assert.equal(requiredBrushup.attempts, 3);
assert.equal(requiredBrushup.review.score, 100);

let optionalRewriteCalls = 0;
const optionalBrushup = await runEditorialBrushup({ text: original, mode: 'novel', modeLabel: '短編', autoUntilPass: true, callAi: async (_prompt, context) => {
  if (context.stage === 'review') return { text: structuredReviewText([86, 90, 95, 100][optionalRewriteCalls]) };
  if (context.stage === 'brushup') { optionalRewriteCalls += 1; return { text: improved }; }
  throw new Error(`unexpected ${context.stage}`);
} });
assert.equal(optionalRewriteCalls, 3);
assert.equal(optionalBrushup.attempts, 3);
assert.equal(optionalBrushup.review.score, 100);

let alignedAttempt = 0;
const alignedPrompts = [];
await runEditorialBrushup({
  text: original,
  mode: 'novel',
  modeLabel: '短編',
  autoUntilPass: true,
  initialReview: {
    score: 89,
    commentary: '受理済み原稿の講評',
    problems: '受理済み原稿の問題',
    revisionPlan: '受理済み原稿の改稿方針',
    modeFit: '適合',
    structuredValid: true,
    valid: true,
  },
  callAi: async (prompt, context) => {
    if (context.stage === 'brushup') {
      alignedPrompts.push(prompt);
      alignedAttempt += 1;
      return { text: `${improved}\n\n候補${alignedAttempt}。` };
    }
    if (context.stage === 'review') return { text: structuredReviewText(87, '前回候補だけにある問題') };
    throw new Error(`unexpected ${context.stage}`);
  },
});
assert.equal(alignedPrompts.length, 3);
assert.match(alignedPrompts[1], /未解消の問題点: 受理済み原稿の問題/);
assert.match(alignedPrompts[1], /前回候補は不採用/);
assert.match(alignedPrompts[1], /前回候補だけにある問題/);

let failedAttempts = 0;
const failedGuidancePrompts = [];
const preserved = await runEditorialBrushup({ text: original, mode: 'novel', modeLabel: '短編', autoUntilPass: true, callAi: async (_prompt, context) => {
  if (context.stage === 'review') return { text: structuredReviewText(70 - failedAttempts, `直近講評${failedAttempts}`) };
  if (context.stage === 'brushup') { failedGuidancePrompts.push(_prompt); failedAttempts += 1; return { text: '途中で扉を開け' }; }
  throw new Error(`unexpected ${context.stage}`);
} });
assert.equal(preserved.text, original);
assert.equal(preserved.attempts, 3);
assert.equal(failedAttempts, 3);
assert.match(failedGuidancePrompts[1], /前回候補は不採用/);
assert.match(failedGuidancePrompts[2], /前回候補は不採用/);

console.log('editorial brushup runtime tests passed');

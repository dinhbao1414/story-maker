# Opening Hook Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bắt buộc hook tại câu đầu thân truyện hoặc khung đầu cho mọi mode kể chuyện, thích nghi theo style TXT, được AI review chấm riêng và được brush-up hiện có sửa an toàn trong tối đa 200 ký tự đầu.

**Architecture:** Một helper thuần ánh xạ mode sang hợp đồng hook và hướng dẫn review. Prompt production, prompt modular và hợp đồng `long_10000` dùng helper này; style preset đưa `opening_style` trực tiếp vào supplement. Trục review `opening_hook` được chuẩn hóa thành property JS `openingHook` cùng `revisionScope`; một helper splice thuần thay đúng vùng mở đầu, sau đó luồng brush-up hiện có chấm và quyết định nhận bản sửa mà không thêm API call.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js `assert`, Node test runner, Vite.

**Design:** `docs/superpowers/specs/2026-08-01-opening-hook-contract-design.md`

---

## File Map

### Tạo mới

- `src/openingHookContracts.js`: danh sách mode, nhóm hook, prompt tạo truyện, hướng dẫn review.
- `src/openingHookPatch.js`: xác định vùng mở đầu Unicode, tạo prompt sửa riêng hook, splice và validation an toàn.
- `tests/openingHookContracts.test.js`: khóa ánh xạ mode, mode loại trừ, quy tắc cấm, style adaptation.
- `tests/openingHookPatch.test.js`: khóa ranh giới 200 ký tự, giữ tiêu đề/thân sau, từ chối patch lỗi.

### Chỉnh sửa

- `src/promptBuilder.js`: inject hợp đồng hook vào prompt production trước yêu cầu bắt đầu thân truyện.
- `src/prompt.js`: inject cùng hợp đồng vào prompt modular; tránh lặp với `long_10000`.
- `src/directLong10000.js`: đưa hợp đồng hook vào direct-long contract.
- `src/stylePresetHelpers.js`: đưa `analysis.structure.opening_style` vào supplement có nhãn riêng.
- `src/editorialReviewContracts.js`: thêm rubric, output schema, parser `openingHook` và `revisionScope`.
- `src/editorialBrushupRuntime.js`: truyền mode vào parser; chọn sửa mở đầu hoặc sửa toàn văn trong cùng lượt brush-up.
- `tests/promptBuilder.test.js`: khóa prompt production cho story/non-story/4koma.
- `tests/directLong10000.test.js`: khóa hook trong direct-long contract và prompt modular.
- `tests/stylePresetHelpers.test.js`: khóa `opening_style` được truyền trực tiếp.
- `tests/editorialReviewContracts.test.js`: khóa review schema và parser theo mode.
- `tests/editorialBrushupRuntime.test.js`: khóa hook-only path, fallback an toàn, số API call.
- `HANDOFF.md`: ghi trạng thái triển khai và bằng chứng xác minh.

Không sửa UI, endpoint, provider, model, timeout, schema export, API-key storage hoặc `dist/` bằng tay. Không version bump/deploy vì kế hoạch này chỉ triển khai và kiểm tra local.

---

### Task 1: Tạo hợp đồng hook theo mode

**Files:**
- Create: `tests/openingHookContracts.test.js`
- Create: `src/openingHookContracts.js`

- [ ] **Step 1: Viết test đỏ cho mode và hợp đồng**

Tạo `tests/openingHookContracts.test.js`:

```js
import assert from 'node:assert/strict';
import {
  OPENING_HOOK_MAX_CHARS,
  buildOpeningHookContract,
  buildOpeningHookReviewGuidance,
  getOpeningHookFamily,
  isOpeningHookMode,
} from '../src/openingHookContracts.js';

const storyModes = [
  'short_short', 'novel', 'medium', 'long_10000',
  'scenario', 'manga', 'fairy', 'documentary', 'radio',
  '4koma', '4koma_scenario',
];
const excludedModes = ['essay', 'poem', 'letter', 'diary'];

assert.equal(OPENING_HOOK_MAX_CHARS, 200);
for (const mode of storyModes) assert.equal(isOpeningHookMode(mode), true, mode);
for (const mode of excludedModes) assert.equal(isOpeningHookMode(mode), false, mode);

assert.equal(getOpeningHookFamily('novel'), 'prose');
assert.equal(getOpeningHookFamily('scenario'), 'script');
assert.equal(getOpeningHookFamily('radio'), 'script');
assert.equal(getOpeningHookFamily('manga'), 'manga');
assert.equal(getOpeningHookFamily('4koma'), 'manga');
assert.equal(getOpeningHookFamily('fairy'), 'fairy');
assert.equal(getOpeningHookFamily('documentary'), 'documentary');
assert.equal(getOpeningHookFamily('essay'), '');

const prose = buildOpeningHookContract({ mode: 'novel' });
assert.match(prose, /【冒頭フック契約】/);
assert.match(prose, /本文の最初の一文/);
assert.match(prose, /冒頭200字/);
assert.match(prose, /天気の一般描写/);
assert.match(prose, /起床/);
assert.match(prose, /これは.*物語/);
assert.match(prose, /行動|台詞|損失|危機|逆説/);

const fourKoma = buildOpeningHookContract({ mode: '4koma_scenario' });
assert.match(fourKoma, /第1コマ|1コマ目/);
assert.match(fourKoma, /視覚|台詞|状況/);

const fairy = buildOpeningHookContract({ mode: 'fairy' });
assert.match(fairy, /対象年齢/);
assert.doesNotMatch(fairy, /暴力を強める/);

const documentary = buildOpeningHookContract({ mode: 'documentary' });
assert.match(documentary, /発見|矛盾|調査/);
assert.match(documentary, /未提供の事実/);

const styled = buildOpeningHookContract({
  mode: 'novel',
  openingStyle: '短い台詞から始め、直後に静かな違和感を置く。',
});
assert.match(styled, /TXT分析済み冒頭スタイル/);
assert.match(styled, /短い台詞から始め/);

for (const mode of excludedModes) {
  assert.equal(buildOpeningHookContract({ mode }), '', mode);
  assert.equal(buildOpeningHookReviewGuidance({ mode }), '', mode);
}

assert.match(buildOpeningHookReviewGuidance({ mode: 'radio' }), /冒頭フック判定/);
assert.match(buildOpeningHookReviewGuidance({ mode: 'radio' }), /改稿範囲/);

console.log('opening hook contract tests passed');
```

- [ ] **Step 2: Chạy test để xác nhận đỏ**

Run:

```powershell
node tests/openingHookContracts.test.js
```

Expected: FAIL với `ERR_MODULE_NOT_FOUND` cho `src/openingHookContracts.js`.

- [ ] **Step 3: Viết helper tối thiểu**

Tạo `src/openingHookContracts.js`:

```js
export const OPENING_HOOK_MAX_CHARS = 200;

const PROSE_MODES = new Set(['short_short', 'novel', 'medium', 'long_10000']);
const SCRIPT_MODES = new Set(['scenario', 'radio']);
const MANGA_MODES = new Set(['manga', '4koma', '4koma_scenario']);
const FAIRY_MODES = new Set(['fairy']);
const DOCUMENTARY_MODES = new Set(['documentary']);

const FAMILY_RULES = Object.freeze({
  prose: '行動、台詞、具体的な損失・危機、主人公に関わる逆説、状況の意味を反転させる情報のいずれかで始める。',
  script: '最初の台詞、舞台上の行動、または事件を知らせる音から始め、長い説明を先行させない。',
  manga: '第1コマまたは1コマ目に、読者が問いを持つ視覚、行動、台詞、状況を置く。中立的な背景紹介だけで始めない。',
  fairy: '対象年齢に合う異常、明確な願い、または危機から始める。刺激や暴力を不必要に強めない。',
  documentary: '具体的な発見、矛盾、結果、または調査上の問いから始める。未提供の事実を真実として断定しない。',
});

export function getOpeningHookFamily(mode = '') {
  const normalized = String(mode || '').trim().toLowerCase();
  if (PROSE_MODES.has(normalized)) return 'prose';
  if (SCRIPT_MODES.has(normalized)) return 'script';
  if (MANGA_MODES.has(normalized)) return 'manga';
  if (FAIRY_MODES.has(normalized)) return 'fairy';
  if (DOCUMENTARY_MODES.has(normalized)) return 'documentary';
  return '';
}

export function isOpeningHookMode(mode = '') {
  return Boolean(getOpeningHookFamily(mode));
}

export function buildOpeningHookContract({ mode = '', openingStyle = '' } = {}) {
  const family = getOpeningHookFamily(mode);
  if (!family) return '';
  const style = String(openingStyle || '').trim().slice(0, 1200);
  return [
    '【冒頭フック契約】',
    family === 'manga'
      ? '第1コマまたは1コマ目を冒頭フックとして機能させる。'
      : 'タイトル行ではなく、本文の最初の一文を冒頭フックとして機能させる。',
    `冒頭${OPENING_HOOK_MAX_CHARS}字は、対立、違和感、危機、損失、または具体的な問いをさらに広げ、説明だけへ後退しない。`,
    '天気の一般描写、起床、人物の経歴紹介、長い世界説明、抽象的な哲学、「これは〜の物語」の要約から始めることを禁止する。',
    '禁止要素が冒頭で直接事件を起こす、危険を示す、または状況の意味を反転させる場合だけ例外とする。',
    FAMILY_RULES[family],
    style
      ? `TXT分析済み冒頭スタイル: ${style}\n機能上のフックを維持したまま、語調、速度、直接性をこのスタイルへ適応する。`
      : '追加指示に「TXT分析済み冒頭スタイル」がある場合、機能上のフックを維持したままその語調、速度、直接性へ適応する。',
  ].join('\n');
}

export function buildOpeningHookReviewGuidance({ mode = '' } = {}) {
  if (!isOpeningHookMode(mode)) return '';
  return [
    '【冒頭フック評価】',
    'タイトルを除いた本文最初の一文と冒頭200字を個別に確認する。',
    '最初の一文が対立、違和感、危機、損失、または具体的な問いを作り、続く200字がその力を広げているかを判定する。',
    'TXT分析済み冒頭スタイルがある場合は適合度も確認する。ただしスタイルを理由に弱い導入を合格にしない。',
    '出力に「冒頭フック判定」「冒頭フック理由」「改稿範囲」を必ず含める。',
  ].join('\n');
}
```

- [ ] **Step 4: Test xanh và syntax check**

Run:

```powershell
node tests/openingHookContracts.test.js
node --check src/openingHookContracts.js
```

Expected: cả hai PASS; log `opening hook contract tests passed`.

- [ ] **Step 5: Commit helper**

```powershell
git add src/openingHookContracts.js tests/openingHookContracts.test.js
git commit -m "feat: add opening hook contracts"
```

### Task 2: Inject hook vào prompt và style TXT

**Files:**
- Modify: `tests/promptBuilder.test.js`
- Modify: `tests/directLong10000.test.js`
- Modify: `tests/stylePresetHelpers.test.js`
- Modify: `src/promptBuilder.js:1`
- Modify: `src/promptBuilder.js:487`
- Modify: `src/prompt.js:10`
- Modify: `src/prompt.js:104`
- Modify: `src/directLong10000.js:1`
- Modify: `src/stylePresetHelpers.js:81`

- [ ] **Step 1: Viết test đỏ cho ba đường prompt**

Trong `tests/promptBuilder.test.js`, thêm sau assertion của `short`:

```js
assert.match(short.prompt, /【冒頭フック契約】/);
assert.match(short.prompt, /本文の最初の一文/);
assert.match(short.prompt, /冒頭200字/);
```

Thêm sau assertion của `letter`:

```js
assert.doesNotMatch(letter.prompt, /【冒頭フック契約】/);
```

Thêm sau assertion của `fourKomaScenario`:

```js
assert.match(fourKomaScenario.prompt, /【冒頭フック契約】/);
assert.match(fourKomaScenario.prompt, /第1コマ|1コマ目/);
```

Trong `tests/directLong10000.test.js`, đặt hai assertion `contract` ngay sau khi tạo `contract`; đặt assertion `directPrompt` và `runtimePrompt` sau khi hai biến tương ứng đã được khai báo; sau đó thêm hai prompt modular:

```js
assert.match(contract, /【冒頭フック契約】/);
assert.match(contract, /冒頭200字/);
assert.equal((directPrompt.match(/【冒頭フック契約】/g) || []).length, 1);
assert.equal((runtimePrompt.prompt.match(/【冒頭フック契約】/g) || []).length, 1);

const modularNovelPrompt = buildPrompt({
  mode: 'novel',
  modeCustom: '短編小説',
  themeCustom: '消えた相続書類',
});
assert.match(modularNovelPrompt, /【冒頭フック契約】/);

const modularLetterPrompt = buildPrompt({ mode: 'letter', modeCustom: '手紙' });
assert.doesNotMatch(modularLetterPrompt, /【冒頭フック契約】/);
```

Trong fixture `analysis` của `tests/stylePresetHelpers.test.js`, thêm:

```js
structure: {
  opening_style: '短い台詞から始め、静かな違和感を直後に置く。',
},
```

Thêm assertion sau supplement hiện có:

```js
assert.match(profile.settingsPayload.settings.supplement, /【TXT分析済み冒頭スタイル】/);
assert.match(profile.settingsPayload.settings.supplement, /短い台詞から始め/);
```

- [ ] **Step 2: Chạy test để xác nhận đỏ**

Run:

```powershell
node tests/promptBuilder.test.js
node tests/directLong10000.test.js
node tests/stylePresetHelpers.test.js
```

Expected: cả ba FAIL vì prompt/supplement chưa chứa hợp đồng mới.

- [ ] **Step 3: Inject hook vào direct-long contract**

Trong `src/directLong10000.js`, thêm import:

```js
import { buildOpeningHookContract } from './openingHookContracts.js';
```

Trong `buildDirectLong10000Contract()`, thêm ngay sau dòng marker:

```js
buildOpeningHookContract({ mode: DIRECT_LONG_10000_MODE }),
```

Giữ nguyên toàn bộ kiểm tra độ dài, lặp và kết thúc.

- [ ] **Step 4: Inject hook vào prompt modular**

Trong `src/prompt.js`, thêm import:

```js
import { buildOpeningHookContract } from './openingHookContracts.js';
```

Trong mảng trả về của `buildPrompt()`, thêm ngay sau `出力契約`:

```js
!isDirectLong10000Mode(settings.mode)
  ? buildOpeningHookContract({ mode: settings.mode })
  : '',
```

`long_10000` đã nhận hook từ `buildDirectLong10000Contract()`, nên nhánh trên phải tránh lặp marker.

- [ ] **Step 5: Inject hook vào prompt production**

Trong `src/promptBuilder.js`, thêm import:

```js
import { buildOpeningHookContract } from './openingHookContracts.js';
```

Trong template output cuối, giữa:

```js
3行目から本文を開始してください。
```

và:

```js
物語が完全に終了した際は、
```

chèn:

```js
${isDirectLong10000Mode(t) ? '' : buildOpeningHookContract({ mode: t })}
```

Không chỉnh cấu trúc minified khác của `Jo`; `long_10000` tiếp tục nhận hook từ supplement direct-long hiện có.

- [ ] **Step 6: Đưa `opening_style` trực tiếp vào supplement**

Trong `src/stylePresetHelpers.js`, ngay sau `reproductionPrompt`, thêm:

```js
const openingStyle = cleanText(analysis?.structure?.opening_style, 1200);
```

Đổi mảng `supplement` thành:

```js
const supplement = [
  cleanText(preset.supplement, 2200),
  openingStyle ? `【TXT分析済み冒頭スタイル】\n${openingStyle}` : '',
  reproductionPrompt ? `【Hồ sơ phong cách đã phân tích】\n${reproductionPrompt}` : '',
].filter(Boolean).join('\n\n');
```

Không thêm field mới vào schema `story-maker-generation-settings-v1`; dữ liệu đi qua `supplement` đã được export/import và áp dụng sẵn.

- [ ] **Step 7: Test xanh và syntax check**

Run:

```powershell
node tests/promptBuilder.test.js
node tests/directLong10000.test.js
node tests/stylePresetHelpers.test.js
node --check src/promptBuilder.js
node --check src/prompt.js
node --check src/directLong10000.js
node --check src/stylePresetHelpers.js
```

Expected: tất cả PASS; mỗi prompt story chứa đúng một marker hook; mode loại trừ không chứa marker.

- [ ] **Step 8: Commit prompt và style integration**

```powershell
git add src/promptBuilder.js src/prompt.js src/directLong10000.js src/stylePresetHelpers.js tests/promptBuilder.test.js tests/directLong10000.test.js tests/stylePresetHelpers.test.js
git commit -m "feat: require hooks in story prompts"
```

### Task 3: Mở rộng editorial review schema

**Files:**
- Modify: `tests/editorialReviewContracts.test.js`
- Modify: `tests/editorialBrushupRuntime.test.js:14`
- Modify: `src/editorialReviewContracts.js:1`
- Modify: `src/editorialReviewContracts.js:60`
- Modify: `src/editorialReviewContracts.js:90`
- Modify: `src/editorialBrushupRuntime.js:178`

- [ ] **Step 1: Viết test đỏ cho review prompt và parser**

Trong import của `tests/editorialReviewContracts.test.js`, giữ các export cũ. Thêm các assertion:

```js
const novelHookReviewPrompt = buildEditorialReviewPrompt({
  mode: 'novel',
  modeLabel: '短編',
  text: 'タイトル: 遺言\n\nその印鑑は、父の葬儀が終わる前に消えた。',
});
assert.match(novelHookReviewPrompt, /【冒頭フック評価】/);
assert.match(novelHookReviewPrompt, /冒頭フック判定: 合格 または 弱い/);
assert.match(novelHookReviewPrompt, /冒頭フック理由:/);
assert.match(novelHookReviewPrompt, /改稿範囲: なし、冒頭200字のみ、全文局所修正/);

const letterHookReviewPrompt = buildEditorialReviewPrompt({ mode: 'letter', text: '本文' });
assert.doesNotMatch(letterHookReviewPrompt, /【冒頭フック評価】/);
assert.doesNotMatch(letterHookReviewPrompt, /冒頭フック判定/);

const weakHookReview = parseEditorialReview([
  'AI総合点: 82点',
  'AI講評:', '全体は成立している。',
  '良い点:', '結末は明確。',
  '問題点:', '冒頭が人物紹介だけで始まる。',
  '改稿方針:', '冒頭200字だけを具体的な対立へ置き換える。',
  '冒頭フック判定: 弱い',
  '冒頭フック理由: 最初の一文が経歴説明で、危機や問いがない。',
  '改稿範囲: 冒頭200字のみ',
  'モード契約適合: 適合',
].join('\n'), { mode: 'novel' });
assert.equal(weakHookReview.valid, true);
assert.equal(weakHookReview.structuredValid, true);
assert.deepEqual(weakHookReview.openingHook, {
  status: 'weak',
  reason: '最初の一文が経歴説明で、危機や問いがない。',
});
assert.equal(weakHookReview.revisionScope, 'opening_only');

const missingHookReview = parseEditorialReview([
  'AI総合点: 82点',
  'AI講評:', '全体は成立している。',
  '良い点:', '結末は明確。',
  '問題点:', '冒頭が弱い。',
  '改稿方針:', '冒頭を直す。',
  'モード契約適合: 適合',
].join('\n'), { mode: 'novel' });
assert.equal(missingHookReview.structuredValid, false);

const nonStoryReview = parseEditorialReview([
  'AI総合点: 88点',
  'AI講評:', '目的に合う。',
  '良い点:', '語調が明瞭。',
  '問題点:', '結びが長い。',
  '改稿方針:', '結びを短くする。',
  'モード契約適合: 適合',
].join('\n'), { mode: 'letter' });
assert.equal(nonStoryReview.structuredValid, true);
assert.equal(nonStoryReview.openingHook, undefined);
```

Trong helper `structuredReviewText` của `tests/editorialBrushupRuntime.test.js`, thêm trước `モード契約適合`:

```js
'冒頭フック判定: 合格',
'冒頭フック理由: 最初の一文が具体的な発見から始まる。',
'改稿範囲: 全文局所修正',
```

- [ ] **Step 2: Chạy test để xác nhận đỏ**

Run:

```powershell
node tests/editorialReviewContracts.test.js
```

Expected: FAIL vì prompt/parser chưa có `冒頭フック判定` và `revisionScope`.

- [ ] **Step 3: Thêm review guidance và schema output**

Trong `src/editorialReviewContracts.js`, thêm import:

```js
import {
  buildOpeningHookReviewGuidance,
  isOpeningHookMode,
} from './openingHookContracts.js';
```

Trong `buildEditorialReviewPrompt()`, thêm:

```js
const openingHookGuidance = buildOpeningHookReviewGuidance({ mode });
const openingHookFields = isOpeningHookMode(mode)
  ? [
      '冒頭フック判定: 合格 または 弱い',
      '冒頭フック理由:',
      '改稿範囲: なし、冒頭200字のみ、全文局所修正 のいずれか',
    ]
  : [];
```

Đặt `openingHookGuidance` sau `rhythmGuidance`. Đặt `...openingHookFields` sau `改稿方針:` và trước `モード契約適合:`.

- [ ] **Step 4: Thay parser bằng phiên bản nhận mode**

Thêm helper nội bộ trước `parseEditorialReview()`:

```js
function normalizeOpeningHookStatus(value = '') {
  const source = String(value || '').trim();
  if (/^(?:合格|達成|良好)$/u.test(source)) return 'pass';
  if (/弱い|不合格|要改善/u.test(source)) return 'weak';
  return '';
}

function normalizeRevisionScope(value = '') {
  const source = String(value || '').trim();
  if (/冒頭200字のみ/u.test(source)) return 'opening_only';
  if (/全文局所修正/u.test(source)) return 'full';
  if (/なし/u.test(source)) return 'none';
  return '';
}
```

Đổi chữ ký và phần parse thành:

```js
export function parseEditorialReview(text = '', { mode = '' } = {}) {
  const source = String(text || '').trim();
  const scoreMatch = source.match(/AI総合点\s*[:：]\s*(\d{1,3})\s*点?/);
  const commentaryMatch = source.match(/AI講評\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:良い点|問題点|改稿方針|冒頭フック判定|モード契約適合)\s*[:：]|$)/);
  const score = scoreMatch ? Number(scoreMatch[1]) : Number.NaN;
  const commentary = commentaryMatch?.[1]?.trim() || '';
  const modeFitLabel = '(?:モード契約適合|モード適合度)';
  const problems = source.match(new RegExp(`問題点\\s*[:：]?\\s*([\\s\\S]*?)(?=\\n\\s*(?:改稿方針|冒頭フック判定|${modeFitLabel})\\s*[:：]|$)`))?.[1]?.trim() || '';
  const revisionPlan = source.match(new RegExp(`改稿方針\\s*[:：]?\\s*([\\s\\S]*?)(?=\\n\\s*(?:冒頭フック判定|${modeFitLabel})\\s*[:：]|$)`))?.[1]?.trim() || '';
  const modeFit = source.match(new RegExp(`${modeFitLabel}\\s*[:：]?\\s*([^\\n]*)`))?.[1]?.trim() || '';
  const hookStatusText = source.match(/冒頭フック判定\s*[:：]\s*([^\n]*)/u)?.[1]?.trim() || '';
  const hookReason = source.match(/冒頭フック理由\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:改稿範囲|モード契約適合|モード適合度)\s*[:：]|$)/u)?.[1]?.trim() || '';
  const revisionScopeText = source.match(/改稿範囲\s*[:：]\s*([^\n]*)/u)?.[1]?.trim() || '';
  const hookStatus = normalizeOpeningHookStatus(hookStatusText);
  const revisionScope = normalizeRevisionScope(revisionScopeText);
  const hookRequired = isOpeningHookMode(mode);
  const hookStructured = !hookRequired || Boolean(hookStatus && hookReason && revisionScope);
  const structuredValid = Boolean(problems && revisionPlan && modeFit && hookStructured);
  return {
    score,
    commentary,
    ...(problems ? { problems } : {}),
    ...(revisionPlan ? { revisionPlan } : {}),
    ...(modeFit ? { modeFit } : {}),
    ...(hookRequired && hookStatus && hookReason
      ? { openingHook: { status: hookStatus, reason: hookReason } }
      : {}),
    ...(hookRequired && revisionScope ? { revisionScope } : {}),
    structuredValid,
    valid: Number.isFinite(score) && score >= 0 && score <= 100 && commentary.length > 0,
  };
}
```

- [ ] **Step 5: Truyền mode vào parser và retry contract**

Trong `runEditorialReview()` của `src/editorialBrushupRuntime.js`, đổi cả hai lần parse:

```js
let parsed = parseEditorialReview(response?.text || response || '', { mode });
```

và:

```js
parsed = parseEditorialReview(response?.text || response || '', { mode });
```

Trước retry call, tạo danh sách heading:

```js
const openingHookHeadings = isOpeningHookMode(mode)
  ? '、冒頭フック判定、冒頭フック理由、改稿範囲'
  : '';
```

Đổi retry suffix thành:

```js
`前回は形式不正でした。AI総合点、AI講評、良い点、問題点、改稿方針${openingHookHeadings}、モード契約適合の全見出しを省略せず、指定形式だけで再回答してください。`
```

Thêm `isOpeningHookMode` vào import từ `openingHookContracts.js` tại đầu runtime.

- [ ] **Step 6: Test xanh và regression brush-up**

Run:

```powershell
node tests/editorialReviewContracts.test.js
node tests/editorialBrushupRuntime.test.js
node --check src/editorialReviewContracts.js
node --check src/editorialBrushupRuntime.js
```

Expected: tất cả PASS; review mode kể chuyện bắt buộc đủ ba field hook; non-story giữ schema cũ.

- [ ] **Step 7: Commit review schema**

```powershell
git add src/editorialReviewContracts.js src/editorialBrushupRuntime.js tests/editorialReviewContracts.test.js tests/editorialBrushupRuntime.test.js
git commit -m "feat: score opening hooks in editorial review"
```

### Task 4: Tạo bản vá mở đầu an toàn

**Files:**
- Create: `tests/openingHookPatch.test.js`
- Create: `src/openingHookPatch.js`

- [ ] **Step 1: Viết test đỏ cho boundary và splice**

Tạo `tests/openingHookPatch.test.js`:

```js
import assert from 'node:assert/strict';
import {
  applyOpeningHookPatch,
  buildOpeningHookPatchPrompt,
  splitOpeningHookRegion,
} from '../src/openingHookPatch.js';

const original = [
  'タイトル: 父の印鑑',
  '',
  '私は地方都市で生まれ、長いあいだ普通に暮らしてきた。父の葬儀の朝、義母は工房の鍵を机に置いた。',
  '',
  'その鍵は、相続登記が終わるまで誰にも渡せないはずだった。',
].join('\n');

const region = splitOpeningHookRegion(original);
assert.equal(region.ok, true);
assert.equal(region.before, 'タイトル: 父の印鑑\n\n');
assert.ok(Array.from(region.opening).length <= 200);
assert.match(region.opening, /普通に暮らしてきた。/);
assert.match(region.after, /その鍵は/);

const replacement = '「その鍵を渡しなさい」父の葬儀が終わる前に、義母は工房の所有者を名乗った。';
const applied = applyOpeningHookPatch({ originalText: original, replacement });
assert.equal(applied.ok, true);
assert.equal(applied.text.startsWith(`タイトル: 父の印鑑\n\n${replacement}`), true);
assert.equal(applied.text.endsWith(region.after), true);
assert.equal(applied.text.includes('私は地方都市で生まれ'), false);

const tooLong = applyOpeningHookPatch({
  originalText: original,
  replacement: 'あ'.repeat(201),
});
assert.deepEqual(tooLong, {
  ok: false,
  text: original,
  issue: 'opening_patch_too_long',
});

const empty = applyOpeningHookPatch({ originalText: original, replacement: '   ' });
assert.deepEqual(empty, {
  ok: false,
  text: original,
  issue: 'opening_patch_empty',
});

const fenced = applyOpeningHookPatch({
  originalText: original,
  replacement: '```\n新しい冒頭。\n```',
});
assert.equal(fenced.ok, false);
assert.equal(fenced.issue, 'opening_patch_format');
assert.equal(fenced.text, original);

const unicodeOriginal = `タイトル: 絵文字\n\n${'😀'.repeat(220)}終わり。`;
const unicodeRegion = splitOpeningHookRegion(unicodeOriginal);
assert.equal(Array.from(unicodeRegion.opening).length, 200);

const noTitle = splitOpeningHookRegion('  最初の説明。次の事件。\n\n続き。');
assert.equal(noTitle.before, '  ');
assert.match(noTitle.opening, /^最初の説明/);

const patchPrompt = buildOpeningHookPatchPrompt({
  text: original,
  mode: 'novel',
  modeLabel: '短編小説',
  review: {
    openingHook: { status: 'weak', reason: '経歴説明から始まる。' },
    revisionPlan: '冒頭だけを対立へ置き換える。',
  },
});
assert.match(patchPrompt, /冒頭200字以内/);
assert.match(patchPrompt, /タイトルを返さない/);
assert.match(patchPrompt, /続きとの接続/);
assert.match(patchPrompt, /経歴説明から始まる/);
assert.match(patchPrompt, /私は地方都市で生まれ/);

console.log('opening hook patch tests passed');
```

- [ ] **Step 2: Chạy test để xác nhận đỏ**

Run:

```powershell
node tests/openingHookPatch.test.js
```

Expected: FAIL với `ERR_MODULE_NOT_FOUND` cho `src/openingHookPatch.js`.

- [ ] **Step 3: Viết helper boundary và patch tối thiểu**

Tạo `src/openingHookPatch.js`:

```js
import { OPENING_HOOK_MAX_CHARS } from './openingHookContracts.js';

const TITLE_LINE_PATTERN = /^(?:タイトル|title|tiêu đề)\s*[:：]/iu;
const SENTENCE_END_PATTERN = /[。！？!?]/u;

function findBodyStart(source) {
  const firstBreak = source.search(/\r\n|\n|\r/u);
  if (firstBreak < 0) return source.search(/\S/u) < 0 ? source.length : source.search(/\S/u);
  const firstLine = source.slice(0, firstBreak).trim();
  if (!TITLE_LINE_PATTERN.test(firstLine)) {
    const firstVisible = source.search(/\S/u);
    return firstVisible < 0 ? source.length : firstVisible;
  }
  const lineBreak = source.match(/\r\n|\n|\r/u)?.[0] || '\n';
  let offset = firstBreak + lineBreak.length;
  const blankPrefix = source.slice(offset).match(/^(?:[\t ]*(?:\r\n|\n|\r))+/u)?.[0] || '';
  offset += blankPrefix.length;
  return offset;
}

export function splitOpeningHookRegion(text = '', maxChars = OPENING_HOOK_MAX_CHARS) {
  const source = String(text || '');
  const bodyStart = findBodyStart(source);
  const before = source.slice(0, bodyStart);
  const bodyChars = Array.from(source.slice(bodyStart));
  if (bodyChars.length === 0) {
    return { ok: false, before, opening: '', after: '', issue: 'opening_body_missing' };
  }
  const limit = Math.min(OPENING_HOOK_MAX_CHARS, Math.max(1, Number(maxChars) || OPENING_HOOK_MAX_CHARS), bodyChars.length);
  let openingLength = limit;
  for (let index = limit - 1; index >= 0; index -= 1) {
    if (SENTENCE_END_PATTERN.test(bodyChars[index])) {
      openingLength = index + 1;
      break;
    }
  }
  return {
    ok: true,
    before,
    opening: bodyChars.slice(0, openingLength).join(''),
    after: bodyChars.slice(openingLength).join(''),
  };
}

export function buildOpeningHookPatchPrompt({ text = '', review = {}, mode = '', modeLabel = '' } = {}) {
  const region = splitOpeningHookRegion(text);
  const seamPreview = Array.from(region.after || '').slice(0, 240).join('');
  return [
    'あなたは商業編集者です。弱い冒頭フックだけを局所修正してください。',
    `出力モード: ${modeLabel || mode || '未指定'}`,
    `弱い理由: ${review?.openingHook?.reason || review?.commentary || '冒頭の引力が不足している'}`,
    `改稿方針: ${review?.revisionPlan || '最初の一文と冒頭の流れを具体的な対立または違和感へ変える'}`,
    '返答は置換後の冒頭だけ。タイトル、講評、点数、JSON、Markdownコードフェンス、全文を返さない。',
    `冒頭200字以内。人物、事実、時制、語り口、スタイルを変えず、続きとの接続を自然にする。`,
    '--- 置換対象の冒頭 ---',
    region.opening,
    '--- 変更禁止の続き（接続確認用） ---',
    seamPreview,
  ].join('\n');
}

export function applyOpeningHookPatch({ originalText = '', replacement = '' } = {}) {
  const source = String(originalText || '');
  const region = splitOpeningHookRegion(source);
  if (!region.ok) return { ok: false, text: source, issue: region.issue };
  const patch = String(replacement || '').trim();
  if (!patch) return { ok: false, text: source, issue: 'opening_patch_empty' };
  if (/```|---\s*(?:元原稿|置換対象|変更禁止|評価対象)/u.test(patch)) {
    return { ok: false, text: source, issue: 'opening_patch_format' };
  }
  if (Array.from(patch).length > OPENING_HOOK_MAX_CHARS) {
    return { ok: false, text: source, issue: 'opening_patch_too_long' };
  }
  return {
    ok: true,
    text: `${region.before}${patch}${region.after}`,
    issue: null,
  };
}
```

- [ ] **Step 4: Test xanh và syntax check**

Run:

```powershell
node tests/openingHookPatch.test.js
node --check src/openingHookPatch.js
```

Expected: cả hai PASS; phần `after` giữ byte-for-byte theo chuỗi JS gốc.

- [ ] **Step 5: Commit patch helper**

```powershell
git add src/openingHookPatch.js tests/openingHookPatch.test.js
git commit -m "feat: add safe opening hook patches"
```

### Task 5: Tích hợp hook-only path vào brush-up hiện có

**Files:**
- Modify: `tests/editorialBrushupRuntime.test.js`
- Modify: `src/editorialBrushupRuntime.js:9`
- Modify: `src/editorialBrushupRuntime.js:57`
- Modify: `src/editorialBrushupRuntime.js:215`

- [ ] **Step 1: Mở rộng review fixture cho hook states**

Đổi helper đầu file `tests/editorialBrushupRuntime.test.js` thành:

```js
const structuredReviewText = (
  score,
  commentary = '改善点を具体的に確認した。',
  {
    hookStatus = '合格',
    hookReason = '最初の一文が具体的な発見から始まる。',
    revisionScope = '全文局所修正',
  } = {},
) => [
  `AI総合点: ${score}点`,
  'AI講評:', commentary,
  '良い点:', '主題が明確。',
  '問題点:', '対立の展開を強める必要がある。',
  '改稿方針:', '対立を行動と場面で具体化する。',
  `冒頭フック判定: ${hookStatus}`,
  `冒頭フック理由: ${hookReason}`,
  `改稿範囲: ${revisionScope}`,
  'モード契約適合: 適合',
].join('\n');
```

Thêm regression cho auto-trigger dù tổng điểm đã cao:

```js
assert.equal(shouldStartAutomaticBrushup({
  checked: true,
  review: { valid: true, score: 100, openingHook: { status: 'weak' } },
  running: false,
}), true);
assert.equal(shouldStartAutomaticBrushup({
  checked: true,
  review: { valid: true, score: 100, openingHook: { status: 'pass' } },
  running: false,
}), false);
assert.equal(formatEditorialCompletion({
  review: { score: 100, openingHook: { status: 'weak' } },
  attempts: 3,
  maxAttempts: 3,
}), 'Đã kết thúc tối đa 3 lần · hook mở đầu vẫn yếu (100 điểm)');
```

- [ ] **Step 2: Viết test đỏ cho hook-only repair và fallback**

Thêm cuối `tests/editorialBrushupRuntime.test.js`, trước log hoàn tất:

```js
const hookOriginal = [
  'タイトル: 父の鍵',
  '',
  '私は地方都市で生まれ、父の工房を手伝ってきた。父の葬儀の朝、義母は鍵を要求した。',
  '',
  'その鍵は、相続登記が終わるまで渡せないはずだった。',
].join('\n');
const hookReplacement = '「その鍵を渡しなさい」父の葬儀が終わる前に、義母は工房の所有者を名乗った。';
const hookInitialReview = {
  score: 82,
  commentary: '冒頭が経歴説明から始まる。',
  problems: '冒頭フックだけが弱い。',
  revisionPlan: '冒頭200字だけを具体的な対立へ置き換える。',
  modeFit: '適合',
  openingHook: { status: 'weak', reason: '最初の一文が経歴説明だけである。' },
  revisionScope: 'opening_only',
  structuredValid: true,
  valid: true,
};

let hookBrushupCalls = 0;
let hookReviewCalls = 0;
const hookOnlyResult = await runEditorialBrushup({
  text: hookOriginal,
  mode: 'novel',
  modeLabel: '短編小説',
  initialReview: hookInitialReview,
  callAi: async (prompt, context) => {
    if (context.stage === 'brushup') {
      hookBrushupCalls += 1;
      assert.match(prompt, /返答は置換後の冒頭だけ/);
      assert.match(prompt, /最初の一文が経歴説明だけ/);
      return { text: hookReplacement };
    }
    if (context.stage === 'review') {
      hookReviewCalls += 1;
      assert.match(prompt, new RegExp(hookReplacement));
      assert.match(prompt, /その鍵は、相続登記が終わるまで/);
      assert.doesNotMatch(prompt, /私は地方都市で生まれ/);
      return { text: structuredReviewText(95, '冒頭が改善した。', {
        hookStatus: '合格',
        hookReason: '対立する台詞から始まり、危機が明確。',
        revisionScope: 'なし',
      }) };
    }
    throw new Error(`unexpected ${context.stage}`);
  },
});
assert.equal(hookBrushupCalls, 1);
assert.equal(hookReviewCalls, 1);
assert.equal(hookOnlyResult.text.startsWith(`タイトル: 父の鍵\n\n${hookReplacement}`), true);
assert.equal(hookOnlyResult.text.endsWith('その鍵は、相続登記が終わるまで渡せないはずだった。'), true);
assert.equal(hookOnlyResult.decisions[0].adopt, true);

let invalidPatchReviewCalls = 0;
const invalidPatchResult = await runEditorialBrushup({
  text: hookOriginal,
  mode: 'novel',
  modeLabel: '短編小説',
  initialReview: hookInitialReview,
  callAi: async (_prompt, context) => {
    if (context.stage === 'brushup') return { text: 'あ'.repeat(201) };
    if (context.stage === 'review') invalidPatchReviewCalls += 1;
    throw new Error(`unexpected ${context.stage}`);
  },
});
assert.equal(invalidPatchReviewCalls, 0);
assert.equal(invalidPatchResult.text, hookOriginal);
assert.equal(invalidPatchResult.decisions[0].adopt, false);
assert.deepEqual(invalidPatchResult.decisions[0].issues, ['opening_patch_too_long']);
assert.match(formatEditorialProgress({
  phase: 'decision',
  attempt: 1,
  maxAttempts: 3,
  decision: invalidPatchResult.decisions[0],
}), /Bản vá hook không hợp lệ/);
```

- [ ] **Step 3: Chạy test để xác nhận đỏ**

Run:

```powershell
node tests/editorialBrushupRuntime.test.js
```

Expected: FAIL vì runtime vẫn gửi prompt rewrite toàn văn và nhận chuỗi patch như toàn bộ candidate.

- [ ] **Step 4: Import patch helper và thêm nhãn lỗi**

Trong `src/editorialBrushupRuntime.js`, thêm:

```js
import {
  applyOpeningHookPatch,
  buildOpeningHookPatchPrompt,
} from './openingHookPatch.js';
```

Thêm helper nội bộ và dùng nó trong auto-trigger:

```js
function reviewNeedsBrushup(review = null) {
  return Boolean(review?.valid && (
    Number(review.score) < EDITORIAL_BRUSHUP_TARGET_SCORE
    || review?.openingHook?.status === 'weak'
  ));
}

export function shouldStartAutomaticBrushup({ checked = false, review = null, running = false } = {}) {
  return Boolean(checked && !running && reviewNeedsBrushup(review));
}
```

Trong `issueLabels` của `formatEditorialProgress()`, thêm:

```js
opening_patch_empty: 'Bản vá hook không hợp lệ',
opening_patch_format: 'Bản vá hook không hợp lệ',
opening_patch_too_long: 'Bản vá hook không hợp lệ',
opening_body_missing: 'Không tìm thấy thân truyện để sửa hook',
```

- [ ] **Step 5: Chọn prompt theo `revisionScope` trong loop**

Thay đoạn từ tạo `rewrite` đến trước `candidateReview` trong `runEditorialBrushup()` bằng:

```js
const openingOnly = currentReview?.openingHook?.status === 'weak'
  && currentReview?.revisionScope === 'opening_only';
const rewritePrompt = openingOnly
  ? buildOpeningHookPatchPrompt({
      text: currentText,
      review: currentReview,
      mode,
      modeLabel,
    })
  : buildEditorialBrushupPrompt({
      text: currentText,
      review: currentReview,
      mode,
      modeLabel,
      rejectedCandidate,
    });
const rewrite = await callAi(rewritePrompt, {
  stage: 'brushup', mode, charLength: currentText.length, attempt: attempts,
});
const rewriteText = String(rewrite?.text || rewrite || '').trim();
const patchResult = openingOnly
  ? applyOpeningHookPatch({ originalText: currentText, replacement: rewriteText })
  : { ok: true, text: rewriteText, issue: null };

if (!patchResult.ok) {
  const decision = {
    adopt: false,
    currentScore: Number.isFinite(currentReview?.score) ? currentReview.score : null,
    candidateScore: null,
    issues: [patchResult.issue],
  };
  decisions.push(decision);
  onProgress?.({ phase: 'decision', attempt: attempts, maxAttempts: attemptLimit, decision });
  rejectedCandidate = { review: currentReview, issues: decision.issues };
  if (!autoUntilPass) break;
  continue;
}

const candidateText = patchResult.text;
const candidateReview = await runEditorialReview({
  text: candidateText,
  mode,
  modeLabel,
  callAi,
  onProgress,
  attempt: attempts,
  maxAttempts: attemptLimit,
  requireStructured: true,
});
```

Giữ nguyên `evaluateBrushupCandidate()`, quyết định adopt/reject, tối đa ba lần và full-rewrite path phía sau.

Đổi điều kiện tiếp tục loop:

```js
&& (attempts === 0 || (autoUntilPass && reviewNeedsBrushup(currentReview)))
```

Đổi điều kiện break sau quyết định:

```js
if (!reviewNeedsBrushup(currentReview) || !autoUntilPass) break;
```

Đổi điều kiện trong `queueAutomaticBrushup` thành:

```js
if (shouldStartAutomaticBrushup({
  checked: autoCheckbox?.checked,
  review: latestReview,
  running: brushupRunning,
})) {
  onBrushup();
}
```

Như vậy hook yếu luôn được sửa dù tổng điểm đạt 100; hook đạt và điểm 100 không gọi thêm API.

Đổi `formatEditorialCompletion()` để không báo đạt giả:

```js
export function formatEditorialCompletion({ review = null, score = 0, attempts = 0, maxAttempts = 3 } = {}) {
  const numericScore = Number.isFinite(Number(review?.score ?? score)) ? Number(review?.score ?? score) : 0;
  if (review?.openingHook?.status === 'weak') {
    return attempts >= maxAttempts
      ? `Đã kết thúc tối đa ${maxAttempts} lần · hook mở đầu vẫn yếu (${numericScore} điểm)`
      : `Tinh chỉnh chưa hoàn tất · hook mở đầu vẫn yếu (${numericScore} điểm)`;
  }
  const tier = getEditorialScoreTier(numericScore);
  if (tier.id === 'editorial_pass') return `Tinh chỉnh hoàn tất · đạt chuẩn biên tập (${numericScore} điểm)`;
  if (tier.id === 'publishable') return `Tinh chỉnh hoàn tất · có thể xuất bản (${numericScore} điểm / đạt chuẩn ${EDITORIAL_PASS_SCORE} điểm)`;
  if (attempts >= maxAttempts) return `Đã kết thúc tối đa ${maxAttempts} lần · cần tinh chỉnh (${numericScore} điểm / có thể xuất bản từ ${EDITORIAL_PUBLISHABLE_SCORE} điểm)`;
  return `Tinh chỉnh hoàn tất · cần tinh chỉnh (${numericScore} điểm)`;
}
```

Đổi call site completion thành:

```js
const completionMessage = formatEditorialCompletion({
  review: result.review,
  attempts: result.attempts,
  maxAttempts: result.maxAttempts,
});
```

- [ ] **Step 6: Test xanh, kiểm tra không tăng API call**

Run:

```powershell
node tests/editorialBrushupRuntime.test.js
node tests/openingHookPatch.test.js
node tests/editorialReviewContracts.test.js
node --check src/editorialBrushupRuntime.js
```

Expected: PASS. Hook-only thành công dùng đúng một call `brushup` và một call `review`, bằng full path hiện tại; patch lỗi dùng một call `brushup`, không gọi review và giữ nguyên bản gốc.

- [ ] **Step 7: Commit brush-up integration**

```powershell
git add src/editorialBrushupRuntime.js tests/editorialBrushupRuntime.test.js
git commit -m "feat: repair weak hooks without rewriting stories"
```

### Task 6: Xác minh toàn bộ và ghi handoff

**Files:**
- Modify: `HANDOFF.md`
- Verify: toàn bộ file source/test đã đổi

- [ ] **Step 1: Chạy focused suite**

```powershell
node tests/openingHookContracts.test.js
node tests/openingHookPatch.test.js
node tests/promptBuilder.test.js
node tests/directLong10000.test.js
node tests/stylePresetHelpers.test.js
node tests/editorialReviewContracts.test.js
node tests/editorialBrushupRuntime.test.js
```

Expected: tất cả PASS; không có unhandled rejection.

- [ ] **Step 2: Chạy syntax và full regression**

```powershell
node --check src/openingHookContracts.js
node --check src/openingHookPatch.js
node --check src/promptBuilder.js
node --check src/prompt.js
node --check src/directLong10000.js
node --check src/stylePresetHelpers.js
node --check src/editorialReviewContracts.js
node --check src/editorialBrushupRuntime.js
node --test "tests/**/*.test.js"
```

Expected: syntax PASS; full test runner báo toàn bộ test PASS. Lỗi độc lập phải được ghi nhận, không sửa ngoài phạm vi.

- [ ] **Step 3: Chạy contract checks và build**

```powershell
npm run check:generic-rules
npm run check:nano-4koma-contract
npm run lint --if-present
git diff --check -- . ':!dist'
npm run build
```

Expected: exit code `0`; Vite chunk-size warning được phép. Xác nhận `dist/` không được đưa vào commit tính năng.

- [ ] **Step 4: Ghi checkpoint vào HANDOFF**

Chèn ngay sau phần giới thiệu an toàn của `HANDOFF.md`:

```markdown
## 2026-08-01 Opening hook contract (local only)

- Story modes now require a hook in the first body sentence or first 4koma panel; the next 200 characters must continue the conflict or curiosity. Essay, poem, letter, and diary remain exempt.
- TXT style profiles pass `structure.opening_style` directly through the saved supplement, while the functional hook requirement remains mandatory.
- Editorial review now returns opening-hook status and revision scope. Hook-only failures use the existing brush-up call to replace at most the opening 200 Unicode characters; invalid patches preserve the original manuscript.
- Verification records only commands and local checks that actually passed. No deploy, version bump, push, tag, release, or backup was performed.
```

- [ ] **Step 5: Commit handoff và kiểm tra Git**

```powershell
git add HANDOFF.md
git commit -m "docs: record opening hook verification"
git status --short
git log -6 --oneline
```

Expected: working tree sạch. Thực hiện local-server verification và báo URL theo `AGENTS.md` trước khi tuyên bố hoàn tất. Không deploy, version bump, push, tag hoặc release.

---

## Completion Checklist

- [ ] Story modes có đúng một hợp đồng hook trong prompt.
- [ ] `long_10000` không lặp marker hook.
- [ ] `opening_style` từ TXT xuất hiện trực tiếp trong supplement.
- [ ] Non-story modes giữ nguyên.
- [ ] Review story modes parse đủ `openingHook` và `revisionScope`.
- [ ] Hook-only patch không đổi tiêu đề hoặc phần thân sau boundary.
- [ ] Patch lỗi giữ nguyên bản gốc.
- [ ] Không thêm API call, UI, dependency hoặc schema mới.
- [ ] Full tests, contract checks và build pass.
- [ ] Local URL được xác minh và cung cấp theo `AGENTS.md`.

# Story DNA Matrix & Novelty Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent 30/40/50-story DNA Matrix that prevents concept repetition while preserving the selected channel formula and existing Dashboard generation flow.

**Architecture:** Keep channel formula as the immutable style DNA. Store a separate per-formula series Matrix in IndexedDB. A pure model module normalizes rows, computes deterministic fingerprints, scores weighted similarity, and selects safe unused rows. A runtime module owns Matrix generation/UI; `channelFormulaRuntime` consumes one safe row when Random is clicked and `generationSettingsIo`/generation lifecycle integration marks the row used only after successful story output.

**Tech Stack:** Vanilla ES modules, Node built-in `node:test`, IndexedDB repository pattern already used by channel formulas and Story Projects, existing provider bridge, existing DOM/CSS runtime.

---

### Task 1: Implement the pure Matrix schema and novelty engine

**Files:**
- Create: `src/storyDnaMatrix.js`
- Create: `tests/storyDnaMatrix.test.js`

- [ ] **Step 1: Write failing tests for Matrix normalization**

Create tests for:

```js
test('normalizes a Matrix row to the eleven DNA fields and lifecycle metadata', () => {
  const row = normalizeStoryDnaRow({
    id: 'story-001',
    formulaId: 'formula-1',
    titlePromise: 'promise',
    hook: 'hook',
    victim: 'victim',
    antagonist: 'antagonist',
    falseAccusation: 'accusation',
    location: 'location',
    evidence: 'evidence',
    secret: 'secret',
    midpointTwist: 'midpoint',
    finalTwist: 'final',
    villainConsequence: 'consequence',
    ending: 'ending',
    moralDilemma: 'dilemma',
    apiKey: 'remove',
    rawSourceText: 'remove',
  });

  assert.equal(row.status, 'planned');
  assert.equal(row.formulaId, 'formula-1');
  assert.equal('apiKey' in row, false);
  assert.equal('rawSourceText' in row, false);
  assert.ok(row.noveltyFingerprint);
});
```

Also test invalid statuses default to `planned`, `usedAt`/`storyId` are nullable, and all text fields are bounded.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js
```

Expected: FAIL because `src/storyDnaMatrix.js` does not exist.

- [ ] **Step 3: Implement the schema and sanitization**

Export:

```js
export const STORY_DNA_MATRIX_SCHEMA = 'story-maker-story-dna-matrix-v1';
export const STORY_DNA_FIELDS = [
  'titlePromise', 'hook', 'victim', 'antagonist', 'falseAccusation',
  'location', 'evidence', 'secret', 'midpointTwist', 'finalTwist',
  'villainConsequence', 'ending', 'moralDilemma',
];
export function normalizeStoryDnaRow(value = {}, options = {});
export function normalizeStoryDnaMatrix(value = {}, options = {});
export function buildStoryDnaFingerprint(row);
```

Reuse the existing secret/raw-source filtering behavior conceptually, but keep this module independent from DOM and provider code. Normalize `status` to `planned | used | skipped`, preserve `formulaId`, and generate a stable fingerprint from normalized lower-case field values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js
```

Expected: PASS.

- [ ] **Step 5: Add failing tests for hard duplicate and weighted similarity**

Add tests proving:

```js
test('rejects a hard duplicate when hook, evidence, and midpoint twist match', () => {
  const result = compareStoryDnaRows(candidate, existing);
  assert.equal(result.hardDuplicate, true);
  assert.equal(result.decision, 'reject');
});

test('returns the weighted overlap fields and score for a warning candidate', () => {
  const result = compareStoryDnaRows(candidate, existing);
  assert.equal(result.decision, 'warning');
  assert.ok(result.score >= 0.35 && result.score <= 0.55);
  assert.ok(result.overlappingFields.includes('evidence'));
});
```

Add a safe case with score below `0.35`.

- [ ] **Step 6: Run the focused test and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js
```

Expected: FAIL because comparison functions are not implemented.

- [ ] **Step 7: Implement novelty scoring and Matrix selection**

Export:

```js
export const STORY_DNA_SIMILARITY_WEIGHTS = Object.freeze({
  hook: 0.18,
  midpointTwist: 0.16,
  finalTwist: 0.13,
  evidence: 0.12,
  falseAccusation: 0.10,
  antagonist: 0.09,
  secret: 0.08,
  location: 0.06,
  ending: 0.05,
  villainConsequence: 0.03,
});
export function compareStoryDnaRows(candidate, existing, options = {});
export function evaluateStoryDnaCandidate(candidate, rows, options = {});
export function chooseUnusedStoryDnaRow(rows, options = {});
export function validateMatrixDiversity(rows, options = {});
```

Implement:

- hard duplicate when `hook + evidence + midpointTwist` match or `falseAccusation + location + finalTwist` match;
- weighted normalized exact-token overlap for the initial local checker;
- `<0.35` safe, `0.35–0.55` warning, `>0.55` reject;
- ignore rows with `status === 'skipped'` only for selection, but include `used` rows in duplicate comparison;
- choose only unlocked `planned` rows and prefer the lowest maximum similarity to existing rows;
- diversity validation for location/evidence/antagonist/twist coverage and adjacent `evidence + midpointTwist` repetition.

- [ ] **Step 8: Run focused tests and commit**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js
```

Expected: PASS.

```powershell
git add src/storyDnaMatrix.js tests/storyDnaMatrix.test.js
git commit -m "feat: add story dna novelty engine"
```

### Task 2: Add persistent Matrix storage

**Files:**
- Create: `src/storyDnaMatrixStorage.js`
- Create: `tests/storyDnaMatrixStorage.test.js`

- [ ] **Step 1: Write failing repository tests**

Use the same in-memory backend style as `tests/channelFormulaRuntime.test.js` and test:

```js
test('creates, lists, reads, updates, and deletes Matrices by formula', async () => {
  const repository = createStoryDnaMatrixRepository({ backend: memoryBackend() });
  const matrix = await repository.saveMatrix({ formulaId: 'formula-1', targetCount: 30, rows: [] });
  assert.equal((await repository.listMatrices('formula-1')).length, 1);
  assert.equal((await repository.getMatrix(matrix.id)).formulaId, 'formula-1');
  await repository.updateRow(matrix.id, 'story-001', { status: 'used', storyId: 's1' });
  assert.equal((await repository.getMatrix(matrix.id)).rows[0].status, 'used');
  await repository.deleteMatrix(matrix.id);
  assert.equal((await repository.listMatrices('formula-1')).length, 0);
});
```

Test export/import sanitization and rejection of a Matrix with the wrong schema.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrixStorage.test.js
```

Expected: FAIL because the repository module does not exist.

- [ ] **Step 3: Implement IndexedDB and repository adapters**

Export:

```js
export const STORY_DNA_MATRIX_DB_NAME = 'story-maker-story-dna-matrix';
export function createStoryDnaMatrixRepository({ backend } = {});
export function parseStoryDnaMatrixImport(value);
```

Create a dedicated `matrices` object store. Repository methods must normalize every read/write:

- `saveMatrix(matrix)`;
- `listMatrices(formulaId)`;
- `getMatrix(matrixId)`;
- `updateRow(matrixId, rowId, patch)`;
- `deleteMatrix(matrixId)`;
- `exportMatrix(matrix)`.

Do not alter the existing channel-formula database schema. Keep raw source, API keys, tokens, and authorization fields excluded from stored/exported records.

- [ ] **Step 4: Run focused tests and commit**

Run:

```powershell
node --test tests/storyDnaMatrixStorage.test.js
```

Expected: PASS.

```powershell
git add src/storyDnaMatrixStorage.js tests/storyDnaMatrixStorage.test.js
git commit -m "feat: persist story dna matrices"
```

### Task 3: Add Matrix generation prompts, parsing, and diversity repair

**Files:**
- Create: `src/storyDnaMatrixRuntime.js`
- Create: `tests/storyDnaMatrixRuntime.test.js`

- [ ] **Step 1: Write failing prompt and parser tests**

Test that `buildStoryDnaMatrixPrompt()` requests 30/40/50 rows and all eleven DNA fields, plus diversity quotas and no source copying:

```js
assert.match(prompt, /titlePromise/);
assert.match(prompt, /midpointTwist/);
assert.match(prompt, /villainConsequence/);
assert.match(prompt, /30|40|50/);
assert.match(prompt, /raw|exact quote|copy/i);
```

Test that fenced JSON arrays parse into normalized rows and malformed rows are reported rather than silently accepted.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrixRuntime.test.js
```

Expected: FAIL because the prompt/parser exports do not exist.

- [ ] **Step 3: Implement prompt, parser, and fallback**

Export:

```js
export function buildStoryDnaMatrixPrompt({ formula, targetCount, existingRows = [] } = {});
export function parseStoryDnaMatrixResponse(value, { formulaId, targetCount } = {});
export function buildFallbackStoryDnaRows(formula, targetCount, options = {});
export async function generateStoryDnaMatrix(options = {});
```

The prompt must require:

- abstract Japanese concept cards only;
- eleven fields plus `moralDilemma`;
- 8–12 locations, 6 evidence types, 6 antagonists, 5 midpoint twists, and 5 consequences where the target count allows;
- no adjacent evidence/twist pair repetition;
- no exact source names, quotes, CTA, or plot incidents;
- JSON only.

`generateStoryDnaMatrix()` calls the existing structured provider sequentially. If the initial batch is short or fails diversity validation, it requests only the missing rows. On timeout/429/invalid JSON, preserve valid rows and use bounded local fallback rows for the remainder.

- [ ] **Step 4: Add tests for repair and fallback**

Assert that:

- a 30-row request with 24 valid rows generates only 6 additional rows;
- duplicate rows are removed before persistence;
- fallback rows have unique hook/evidence/twist combinations;
- no fallback row contains raw source text or secret-looking keys.

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
node --test tests/storyDnaMatrixRuntime.test.js
```

Expected: PASS.

```powershell
git add src/storyDnaMatrixRuntime.js tests/storyDnaMatrixRuntime.test.js
git commit -m "feat: generate diverse story dna matrices"
```

### Task 4: Add Matrix controls to the Formula workspace

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.js`
- Modify: `src/storyDnaMatrixRuntime.js`
- Create: `tests/storyDnaMatrixUi.test.js`

- [ ] **Step 1: Write failing markup/runtime tests**

Assert that the formula panel contains:

```js
assert.match(html, /cf-matrix-count/);
assert.match(html, /cf-matrix-create/);
assert.match(html, /cf-matrix-select/);
assert.match(html, /cf-matrix-table/);
```

Test that the runtime renders row status, novelty score, and buttons for `lock`, `skip`, `regenerate`, and `export`.

- [ ] **Step 2: Run focused UI tests and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrixUi.test.js
```

Expected: FAIL because Matrix controls do not exist.

- [ ] **Step 3: Add the Formula workspace Matrix section**

Add a card below the formula preview with:

- select `30 / 40 / 50`;
- button `Tạo Story DNA Matrix`;
- Matrix selector;
- progress/error area;
- summary counts `planned / used / skipped`;
- table/list showing DNA fields in compact form, novelty status, and lifecycle state;
- actions `Khóa`, `Bỏ qua`, `Tạo lại row`, `Xuất Matrix`.

Use existing `.cf-card`, `.cf-actions`, `.cf-progress`, `.cf-error`, and dark-purple tokens. Do not add a new workspace tab.

- [ ] **Step 4: Install the runtime from `src/main.js`**

Import `./storyDnaMatrixRuntime.js` after `./channelFormulaRuntime.js` so the formula panel exists before the Matrix runtime binds. Keep the module side-effect safe when the panel is absent.

- [ ] **Step 5: Implement row actions and UI status**

The runtime must:

- load Matrices for the selected formula;
- create a Matrix through `generateStoryDnaMatrix`;
- save rows incrementally so a reload resumes;
- show errors without losing valid rows;
- disable generation controls while a request is active;
- never expose raw TXT source in the table.

- [ ] **Step 6: Run UI tests and commit**

Run:

```powershell
node --test tests/storyDnaMatrixUi.test.js
```

Expected: PASS.

```powershell
git add index.html src/style.css src/main.js src/storyDnaMatrixRuntime.js tests/storyDnaMatrixUi.test.js
git commit -m "feat: add story dna matrix controls"
```

### Task 5: Make Formula Random select a safe unused Matrix row

**Files:**
- Modify: `src/channelFormulaRuntime.js`
- Modify: `src/generationSettingsIo.js`
- Modify: `tests/channelFormulaRuntime.test.js`
- Modify: `tests/settingsSnapshotHelpers.test.js`

- [ ] **Step 1: Write failing integration tests**

Add a Matrix with two rows and assert:

```js
test('random settings selects an unused safe Matrix row', async () => {
  const result = await randomizeAndApplyFormulaSettings({
    formula,
    matrix: matrixWithRows,
    callStructuredAi: async () => JSON.stringify({ titlePromise: 'ignored when matrix row is selected' }),
    applySettings: async payload => applied.push(payload),
  });
  assert.equal(result.matrixRow.id, 'story-002');
  assert.equal(result.settings.matrixRowId, 'story-002');
  assert.match(result.settings.supplement, /story-002|midpointTwist/);
});
```

Test that a warning/rejected row is not applied, used rows are never selected, and old no-Matrix fallback behavior remains available.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/channelFormulaRuntime.test.js
```

Expected: FAIL because `randomizeAndApplyFormulaSettings()` has no Matrix selection path.

- [ ] **Step 3: Add Matrix-aware randomization**

Extend `randomizeAndApplyFormulaSettings()` with optional:

```js
matrix,
matrixRepository,
onMatrixStatus,
```

When Matrix rows exist:

1. select a safe unused row with `chooseUnusedStoryDnaRow`;
2. use that row as the structured settings seed;
3. allow AI to fill only missing axis/character details;
4. re-run novelty validation against all Matrix rows;
5. include `matrixId`, `matrixRowId`, and the normalized row metadata in settings;
6. apply Dashboard and open Dashboard as today.

When no Matrix exists, preserve current random/fallback behavior and report `matrix unavailable`.

- [ ] **Step 4: Preserve Matrix metadata in settings snapshots**

Extend `captureCurrentGenerationSettings()` and `applyGenerationSettings()` to round-trip:

```js
settings.matrixId
settings.matrixRowId
settings.storyDna
```

Sanitize these fields and keep `channelFormula` locked. Do not put full story text in the settings snapshot.

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
node --test tests/channelFormulaRuntime.test.js tests/settingsSnapshotHelpers.test.js
```

Expected: PASS.

```powershell
git add src/channelFormulaRuntime.js src/generationSettingsIo.js tests/channelFormulaRuntime.test.js tests/settingsSnapshotHelpers.test.js
git commit -m "feat: randomize from unused story dna rows"
```

### Task 6: Mark rows used only after successful generation

**Files:**
- Create: `src/storyDnaMatrixGenerationBridge.js`
- Modify: `src/longifyBeta.js`
- Modify: `src/legacyMain.js`
- Modify: `src/storyProjectRuntime.js`
- Create: `tests/storyDnaMatrixGenerationBridge.test.js`

- [ ] **Step 1: Write failing lifecycle tests**

Test the bridge contract:

```js
test('marks a Matrix row used after a successful generated story', async () => {
  const result = await consumeGeneratedStory({
    outputText: `${'あ'.repeat(20000)}。`,
    settings: { matrixId: 'matrix-1', matrixRowId: 'story-001' },
    repository,
  });
  assert.equal(result.status, 'used');
});

test('does not mark a row used for empty or incomplete output', async () => {
  await consumeGeneratedStory({
    outputText: '',
    settings: { matrixId: 'matrix-1', matrixRowId: 'story-001' },
    repository,
  });
  assert.equal((await repository.getMatrix('matrix-1')).rows[0].status, 'planned');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrixGenerationBridge.test.js
```

Expected: FAIL because the lifecycle bridge does not exist.

- [ ] **Step 3: Implement the one-shot consume bridge**

Export:

```js
export async function consumeGeneratedStory({ outputText, settings, repository, storyId, now } = {});
export function installStoryDnaMatrixGenerationBridge({ doc, win, repository } = {});
```

The bridge must:

- require `matrixId` and `matrixRowId`;
- validate non-empty output and the selected formula’s existing quality threshold;
- update only once per `matrixRowId`;
- leave the row planned on failure;
- save `usedAt`, `storyId`, and a normalized story metadata snapshot;
- dispatch `story-maker:story-dna-used` after success.

- [ ] **Step 4: Add lifecycle hooks without changing provider behavior**

Use the existing generation lifecycle:

- standard Dashboard generation: emit a one-shot `story-maker:story-generated` event from the existing completion path in `src/legacyMain.js`;
- Longify completion: emit the same event from the final successful output path in `src/longifyBeta.js`;
- Story Project `saveSuccess`: call `consumeGeneratedStory()` after the story is saved.

The event detail must contain only output text, settings metadata, mode, and optional story ID. Do not emit API keys or raw source snapshots.

- [ ] **Step 5: Run focused lifecycle tests and commit**

Run:

```powershell
node --test tests/storyDnaMatrixGenerationBridge.test.js tests/storyProjectRuntime.test.js
```

Expected: PASS.

```powershell
git add src/storyDnaMatrixGenerationBridge.js src/longifyBeta.js src/legacyMain.js src/storyProjectRuntime.js tests/storyDnaMatrixGenerationBridge.test.js
git commit -m "feat: consume story dna rows after generation"
```

### Task 7: Integrated verification and handoff

**Files:**
- Modify: `HANDOFF.md`
- Test: all existing tests and new Matrix tests

- [ ] **Step 1: Run focused Matrix verification**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js tests/storyDnaMatrixStorage.test.js tests/storyDnaMatrixRuntime.test.js tests/storyDnaMatrixUi.test.js tests/storyDnaMatrixGenerationBridge.test.js
```

Expected: all Matrix tests pass.

- [ ] **Step 2: Run the full verification suite**

Run:

```powershell
node --test "tests/**/*.test.js"
npm.cmd run check:generic-rules
npm.cmd run check:nano-4koma-contract
node --check src/storyDnaMatrix.js
node --check src/storyDnaMatrixStorage.js
node --check src/storyDnaMatrixRuntime.js
node --check src/storyDnaMatrixGenerationBridge.js
npm.cmd run build
git diff --check
```

Expected:

- all Node tests pass;
- generic-rule guard passes;
- Nano contract passes or reports the documented sibling-project skip;
- build exits 0 with only the existing large-chunk warning;
- no whitespace errors.

- [ ] **Step 3: Start the local server and smoke-test**

Run:

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Verify HTTP 200 at:

```text
http://localhost:5179
```

Verify manually that the Formula tab can create/select a Matrix without calling `Tạo truyện`, and that Random applies one Matrix row to Dashboard.

- [ ] **Step 4: Update `HANDOFF.md`**

Record:

- Matrix schema and storage;
- novelty thresholds and diversity quotas;
- Random selection behavior;
- used-row lifecycle;
- focused/full verification results;
- local URL;
- no deploy/version bump/API credential change.

- [ ] **Step 5: Commit the completed snapshot**

```powershell
git add HANDOFF.md
git commit -m "docs: record story dna matrix verification"
```

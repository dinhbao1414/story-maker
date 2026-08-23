# Channel Formula / Công thức kênh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable Japanese YouTube-channel formula workflow that analyzes the approved 40-file folder, persists a sanitized named formula, and generates validated 20,000+ character stories through the existing Longify pipeline.

**Architecture:** Keep formula logic in focused modules (`channelFormula.js`, storage, catalog, runtime) and keep provider calls, API sessions, Longify, output cleanup, and Story Project persistence authoritative in their existing modules. The runtime passes a sanitized formula reproduction prompt and a fixed 20k policy through existing settings/DOM bridges; it never introduces a second provider client or parallel generation queue.

**Tech Stack:** Vite, browser JavaScript modules, IndexedDB, existing Gemini/OpenAI clients, Node’s built-in `node:test`, existing DOM workspace/tab patterns.

---

## File map

Create:

- `src/channelFormula.js` — canonical formula schema, sanitization, fingerprints, representative slices, analysis prompt, synthesis prompt, generation prompt, and 20k validation.
- `src/channelFormulaStorage.js` — IndexedDB repository for formulas and per-file analysis checkpoints, plus safe JSON import/export helpers.
- `src/channelFormulaCatalog.js` — sanitized built-in catalog entry for `Daily Scat – Drama gia đình Nhật`; no raw story text and no API credentials.
- `src/channelFormulaRuntime.js` — folder input, progress/checkpoint UI, AI analysis orchestration, formula preview/save/select, and generation launch.
- `tests/channelFormula.test.js` — pure model and prompt contract tests.
- `tests/channelFormulaStorage.test.js` — storage/import/export/checkpoint tests using an in-memory backend.
- `tests/channelFormulaRuntime.test.js` — runtime orchestration and UI-state tests with fake DOM/provider functions.

Modify:

- `index.html` — add the `Công thức kênh` tab and panel markup.
- `src/main.js` — import `channelFormulaRuntime.js` after `storyProjectRuntime.js` and before `workspaceTabs.js`.
- `src/workspaceTabs.js` — add `formulas` to the workspace list and handle formula-open events.
- `src/style.css` — scoped formula workspace, progress, preview, error, and responsive styles.
- `src/generationSettingsIo.js` — preserve a sanitized `channelFormula` reference/prompt/policy in settings export/import.
- `src/storyProjectHelpers.js` — preserve sanitized formula metadata in project settings and keep formula settings locked during controlled variations.
- `src/storyProjectRuntime.js` — show selected formula metadata and allow project generation to retain it.
- `src/longifyBeta.js` — accept formula prompt/policy context and use the formula’s 20k minimum/target without changing the existing provider path.
- `tests/generationSettingsIo.test.js` — formula metadata export/import coverage.
- `tests/storyProjectHelpers.test.js` — formula lock/sanitization coverage.
- `tests/longifyBeta.test.js` — formula prompt and 20k policy coverage.

No deploy, version bump, `dist/`, or provider credential file changes are part of implementation.

## Task 1: Define the pure formula model

**Files:**

- Create: `src/channelFormula.js`
- Test: `tests/channelFormula.test.js`

- [ ] **Step 1: Write failing schema and sanitizer tests**

Add tests that import `createChannelFormula`, `sanitizeChannelFormula`, `buildRepresentativeSlices`, `buildFileAnalysisPrompt`, `buildFormulaSynthesisPrompt`, `buildFormulaGenerationPrompt`, and `validateChannelFormulaStory`.

Required assertions:

```js
const formula = createChannelFormula({
  name: 'Daily Scat – Drama gia đình Nhật',
  sourceCount: 40,
  analysis: { tone: '家族因果応報ドラマ' },
});
assert.equal(formula.language, 'ja');
assert.equal(formula.generationPolicy.minNonWhitespaceChars, 20000);
assert.equal(formula.generationPolicy.chapterCount, 4);
assert.equal(formula.generationPolicy.includeYoutubeCtaByDefault, false);

const sanitized = sanitizeChannelFormula({
  name: 'x',
  reproductionPrompt: 'safe',
  apiKey: 'remove',
  nested: { authorization: 'remove' },
});
assert.equal('apiKey' in sanitized, false);
assert.equal('authorization' in sanitized.nested, false);
```

Add representative-slice tests proving that the output contains bounded opening, middle, and ending excerpts and never exceeds the configured total sample size.

Add validation tests proving:

```js
assert.equal(validateChannelFormulaStory('あ'.repeat(20000) + '。').ok, true);
assert.equal(validateChannelFormulaStory('あ'.repeat(19999) + '。').ok, false);
assert.match(validateChannelFormulaStory('あ'.repeat(20000)).issues.join(','), /unclosed_ending/);
```

- [ ] **Step 2: Run the focused test to verify failure**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: FAIL because the new module and exports do not exist.

- [ ] **Step 3: Implement the minimal pure model**

Implement:

- `CHANNEL_FORMULA_SCHEMA = 'story-maker-channel-formula-v1'`;
- `CHANNEL_FORMULA_DEFAULT_POLICY`;
- bounded recursive sanitizer removing keys matching API-key, authorization, token, secret;
- normalized text and non-whitespace character counting;
- deterministic SHA-256-compatible fingerprint using the Web Crypto API when available and a stable fallback for tests;
- representative opening/middle/ending slices;
- structured per-file prompt demanding abstract JSON and no copied prose;
- bounded synthesis prompt demanding canonical formula JSON;
- generation prompt enforcing Japanese-only output, four chapter roles, 20,000 minimum, 22,000 target, complete ending, and no source copying;
- `validateChannelFormulaStory`.

Do not import DOM, provider clients, or storage from this module.

- [ ] **Step 4: Run the focused test to verify success**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/channelFormula.js tests/channelFormula.test.js
git commit -m "feat: add channel formula model"
```

## Task 2: Add formula and analysis checkpoint storage

**Files:**

- Create: `src/channelFormulaStorage.js`
- Test: `tests/channelFormulaStorage.test.js`

- [ ] **Step 1: Write failing repository tests**

Cover:

- saving/listing/getting/deleting formulas;
- saving and reading per-file checkpoints by formula id;
- replacing a checkpoint for the same file fingerprint;
- import/export round-trip;
- rejecting a wrong schema;
- preserving built-in formulas from dynamic deletion.

Use a small in-memory backend implementing `put`, `get`, `list`, and `delete`, so tests do not require a browser.

- [ ] **Step 2: Run the focused test to verify failure**

```powershell
node --test tests/channelFormulaStorage.test.js
```

Expected: FAIL because storage exports do not exist.

- [ ] **Step 3: Implement storage**

Create a versioned IndexedDB database with `formulas` and `analysisCheckpoints` stores. Expose:

```js
createChannelFormulaRepository({ backend })
saveFormula(formula)
listFormulas()
getFormula(id)
deleteDynamicFormula(id)
saveAnalysisCheckpoint(checkpoint)
listAnalysisCheckpoints(formulaId)
exportChannelFormula(formula)
parseChannelFormulaImport(input)
```

The repository must sanitize before every write and must mark catalog entries with `builtIn: true`.

- [ ] **Step 4: Run the focused test**

```powershell
node --test tests/channelFormulaStorage.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/channelFormulaStorage.js tests/channelFormulaStorage.test.js
git commit -m "feat: persist channel formulas and checkpoints"
```

## Task 3: Preserve formula metadata in generation settings and Story Projects

**Files:**

- Modify: `src/generationSettingsIo.js`
- Modify: `src/storyProjectHelpers.js`
- Modify: `src/storyProjectRuntime.js`
- Test: `tests/generationSettingsIo.test.js`
- Test: `tests/storyProjectHelpers.test.js`

- [ ] **Step 1: Write failing serialization and lock tests**

Assert that a settings export can carry:

```js
channelFormula: {
  id: 'formula-1',
  name: 'Daily Scat – Drama gia đình Nhật',
  reproductionPrompt: 'abstract rules only',
  generationPolicy: { minNonWhitespaceChars: 20000, targetNonWhitespaceChars: 22000 }
}
```

Assert that API keys and raw-source fields are removed, and that `buildControlledVariationSettings` keeps the formula fixed while randomizing only theme, worldview, era, ending, and characters.

- [ ] **Step 2: Run tests to verify failure**

```powershell
node --test tests/generationSettingsIo.test.js tests/storyProjectHelpers.test.js
```

Expected: FAIL on missing formula serialization/lock behavior.

- [ ] **Step 3: Implement serialization and project integration**

Add a bounded `channelFormula` object to generation settings export/import. Extend Story Project cards/detail markup to show the selected formula name and target policy without printing the reproduction prompt. Keep formula metadata in `settingsPayload` and preserve it through project export/import.

- [ ] **Step 4: Run tests**

```powershell
node --test tests/generationSettingsIo.test.js tests/storyProjectHelpers.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/generationSettingsIo.js src/storyProjectHelpers.js src/storyProjectRuntime.js tests/generationSettingsIo.test.js tests/storyProjectHelpers.test.js
git commit -m "feat: carry channel formulas through generation settings"
```

## Task 4: Add the formula workspace markup and tab behavior

**Files:**

- Modify: `index.html`
- Modify: `src/workspaceTabs.js`
- Modify: `src/style.css`
- Test: `tests/workspaceTabs.test.js`

- [ ] **Step 1: Write failing tab/markup assertions**

Assert that the document contains:

- `data-workspace-tab="formulas"`;
- `data-workspace-panel="formulas"`;
- `#cf-folder-input[webkitdirectory]`;
- `#cf-formula-name`;
- `#cf-analyze`;
- `#cf-generate`;
- `#cf-progress`;
- `#cf-preview`;
- `#cf-import`;
- `#cf-export`.

Assert `resolveWorkspaceTab('formulas')` returns `formulas` and invalid values still resolve to `dashboard`.

- [ ] **Step 2: Run the focused test**

```powershell
node --test tests/workspaceTabs.test.js
```

Expected: FAIL until the new tab and panel are present.

- [ ] **Step 3: Add markup and styles**

Add a fourth workspace tab and a panel containing:

- formula list/select;
- folder input;
- name input;
- analyze/save buttons;
- progress/status area;
- formula preview;
- import/export controls;
- Japanese language indicator;
- fixed 20k minimum and 22k target display;
- random-generation button and error/result status.

Use scoped `.cf-*` classes and preserve the existing dark-purple visual tokens and mobile one-column rules.

- [ ] **Step 4: Add tab state**

Update `WORKSPACE_TABS`, tab activation, and formula-open event handling. Keep Dashboard as the default tab after reload.

- [ ] **Step 5: Run focused UI tests**

```powershell
node --test tests/workspaceTabs.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add index.html src/workspaceTabs.js src/style.css tests/workspaceTabs.test.js
git commit -m "feat: add channel formula workspace"
```

## Task 5: Implement sequential file analysis and formula synthesis runtime

**Files:**

- Create: `src/channelFormulaRuntime.js`
- Modify: `src/main.js`
- Test: `tests/channelFormulaRuntime.test.js`

- [ ] **Step 1: Write failing runtime tests**

Cover:

- filtering only `.txt`;
- progress callback order for 40 files;
- checkpoint resume skips completed fingerprints;
- provider calls are sequential, never concurrent;
- per-file JSON parse/repair failure records an error and continues;
- final synthesis receives intermediate summaries, not raw full files;
- save uses the entered formula name;
- no API key value is logged or included in the formula.

Use fake files, fake provider calls, fake repository, and fake DOM elements.

- [ ] **Step 2: Run focused runtime tests**

```powershell
node --test tests/channelFormulaRuntime.test.js
```

Expected: FAIL because runtime exports do not exist.

- [ ] **Step 3: Implement runtime**

Implement:

```js
installChannelFormulaRuntime({
  doc,
  win,
  repository,
  getApiSession,
  callStructuredAi,
  callGeneration,
  now
})
```

The folder handler must normalize and sample each file locally. The analysis runner must:

1. load existing checkpoints;
2. process files in filename order;
3. call the existing structured provider route one file at a time;
4. save each checkpoint immediately;
5. group compact analyses into batches of eight;
6. synthesize the canonical formula;
7. save a dynamic formula;
8. render the sanitized preview.

Expose a small controller API for tests:

```js
startAnalysis(files)
pauseAnalysis()
resumeAnalysis()
cancelAnalysis()
getState()
```

Never persist raw file text beyond the active request and never include API keys in logs, checkpoints, exports, or formula objects.

- [ ] **Step 4: Wire runtime import**

Import `channelFormulaRuntime.js` from `src/main.js` after Story Project runtime and before workspace tab activation.

- [ ] **Step 5: Run focused runtime tests**

```powershell
node --test tests/channelFormulaRuntime.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/channelFormulaRuntime.js src/main.js tests/channelFormulaRuntime.test.js
git commit -m "feat: analyze and synthesize channel formulas"
```

## Task 6: Integrate formula generation with Longify 20k

**Files:**

- Modify: `src/longifyBeta.js`
- Modify: `src/channelFormulaRuntime.js`
- Test: `tests/longifyBeta.test.js`
- Test: `tests/channelFormulaRuntime.test.js`

- [ ] **Step 1: Write failing 20k integration tests**

Assert:

- formula context appears in the seed/chapter prompt;
- formula rules are abstract and source-copying prohibitions are present;
- `targetTotalNumber` is at least 22000 while `minNonWhitespaceChars` remains 20000;
- chapter count is four for the 20k policy;
- generated text below 20k is rejected or routed to supplementation;
- a complete Japanese ending is required;
- formula generation does not invoke two provider calls concurrently.

- [ ] **Step 2: Run focused tests to verify failure**

```powershell
node --test tests/longifyBeta.test.js tests/channelFormulaRuntime.test.js
```

Expected: FAIL on missing formula context and policy handling.

- [ ] **Step 3: Add formula-aware Longify options**

Extend the existing Longify run options with:

```js
channelFormulaPrompt
channelFormulaName
channelFormulaPolicy
```

Use the policy to select four chapters for a 20k target and inject the reproduction prompt into the existing chapter/seed prompts. Keep current retries, audits, cleanup, and provider fallback behavior unchanged.

- [ ] **Step 4: Add formula generation controller**

The formula runtime must:

1. apply a randomized settings snapshot with the formula metadata;
2. generate a fresh seed;
3. launch Longify with the formula options and 20k target;
4. wait for the existing generation lifecycle;
5. validate the final output using `validateChannelFormulaStory`;
6. run bounded supplementation/closure repair on under-length output;
7. save only passing text to the active Story Project or dashboard Output.

- [ ] **Step 5: Run focused tests**

```powershell
node --test tests/longifyBeta.test.js tests/channelFormulaRuntime.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/longifyBeta.js src/channelFormulaRuntime.js tests/longifyBeta.test.js tests/channelFormulaRuntime.test.js
git commit -m "feat: generate formula stories at 20k"
```

## Task 7: Add the built-in Daily Scat catalog entry

**Files:**

- Create: `src/channelFormulaCatalog.js`
- Modify: `src/channelFormulaRuntime.js`
- Test: `tests/channelFormula.test.js`

- [ ] **Step 1: Write failing catalog tests**

Assert that the catalog contains exactly one initial built-in formula with:

```js
name === 'Daily Scat – Drama gia đình Nhật'
language === 'ja'
sourceCount === 40
generationPolicy.minNonWhitespaceChars === 20000
```

Assert that the catalog contains no raw source filenames beyond bounded metadata, no raw story excerpts, and no key/token/secret fields.

- [ ] **Step 2: Run the focused test**

```powershell
node --test tests/channelFormula.test.js
```

Expected: FAIL because the catalog does not exist.

- [ ] **Step 3: Add the sanitized catalog object**

Add only the abstract formula and reproduction prompt derived from the approved 40-file set. Mark it `builtIn: true`; do not add the 40 TXT contents.

- [ ] **Step 4: Load catalog formulas on runtime startup**

Merge built-in catalog entries with dynamic IndexedDB entries, deduplicating by id and keeping built-ins protected from dynamic delete.

- [ ] **Step 5: Run focused test**

```powershell
node --test tests/channelFormula.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/channelFormulaCatalog.js src/channelFormulaRuntime.js tests/channelFormula.test.js
git commit -m "feat: add Daily Scat channel formula catalog"
```

## Task 8: Verification and handoff

**Files:**

- Modify: `HANDOFF.md` only if verification findings or remaining work need recording.

- [ ] **Step 1: Run focused tests**

```powershell
node --test tests/channelFormula.test.js tests/channelFormulaStorage.test.js tests/channelFormulaRuntime.test.js tests/generationSettingsIo.test.js tests/storyProjectHelpers.test.js tests/longifyBeta.test.js tests/workspaceTabs.test.js
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

```powershell
node --test "tests/**/*.test.js"
```

Expected: all existing and new tests pass.

- [ ] **Step 3: Run project guards**

```powershell
npm.cmd run check:generic-rules
npm.cmd run check:nano-4koma-contract
git diff --check -- . ':!dist'
```

Expected: all commands pass.

- [ ] **Step 4: Run syntax checks and production build**

```powershell
node --check src/channelFormula.js
node --check src/channelFormulaStorage.js
node --check src/channelFormulaRuntime.js
npm.cmd run build
```

Expected: syntax checks and build pass; only the existing chunk-size warning may remain.

- [ ] **Step 5: Start/verify local server**

If port 5179 is not already serving, run:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Verify `http://localhost:5179` returns HTTP 200, the formula tab renders, and no console error or Vite overlay appears.

- [ ] **Step 6: Run intentional API acceptance**

Have the user enter the API key in the app UI. Select the approved folder, run the 40-file analysis, save the formula, and generate one Japanese 20k story. Do not print, copy, paste, or persist the key outside the existing app session flow.

- [ ] **Step 7: Record handoff**

Record test results, local URL, API acceptance status, known limitations, and any remaining user-run analysis work in `HANDOFF.md`. Do not deploy or bump version unless the user separately requests publication.


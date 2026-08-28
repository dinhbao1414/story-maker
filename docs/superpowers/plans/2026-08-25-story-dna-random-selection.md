# Story DNA Random Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repeated `AI Random mô típ & điền thiết lập` clicks randomly choose eligible Matrix rows without immediately repeating the previous row or marking previewed rows as used.

**Architecture:** Extend the pure Story DNA selector with injected randomness and an optional excluded row ID. Keep per-Matrix last-selection memory inside the Formula runtime and pass it into the selector; leave persistent Matrix lifecycle changes exclusively in the existing generation bridge.

**Tech Stack:** JavaScript ES modules, Node built-in test runner, IndexedDB-backed Matrix repository, Vite.

---

### Task 1: Randomize the pure Story DNA selector

**Files:**
- Modify: `tests/storyDnaMatrix.test.js`
- Modify: `src/storyDnaMatrix.js`

- [ ] **Step 1: Write failing selector tests**

Add tests that inject deterministic random values, exclude the immediately previous row when alternatives exist, retain a single eligible row and continue excluding non-planned or locked rows.

```js
test('randomly chooses eligible planned rows and can reach more than the first row', () => {
  const rows = [makeRow({ id: 'first' }), makeRow({ id: 'second' })];
  assert.equal(chooseUnusedStoryDnaRow(rows, { random: () => 0 }).row.id, 'first');
  assert.equal(chooseUnusedStoryDnaRow(rows, { random: () => 0.99 }).row.id, 'second');
});

test('avoids the immediately previous row when another eligible row exists', () => {
  const rows = [makeRow({ id: 'first' }), makeRow({ id: 'second' })];
  const selected = chooseUnusedStoryDnaRow(rows, {
    excludeRowId: 'first',
    random: () => 0,
  });
  assert.equal(selected.row.id, 'second');
});

test('keeps the only eligible row even when it matches the previous row', () => {
  const rows = [makeRow({ id: 'only' })];
  const selected = chooseUnusedStoryDnaRow(rows, {
    excludeRowId: 'only',
    random: () => 0,
  });
  assert.equal(selected.row.id, 'only');
});
```

- [ ] **Step 2: Run selector tests and verify RED**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js
```

Expected: the random/high-index and exclusion assertions fail because the current selector always returns the first sorted candidate.

- [ ] **Step 3: Implement minimal random selection**

Update the selector to preserve current eligibility/novelty evaluation, exclude `excludeRowId` only when another candidate exists, clamp the injected random value and select from the resulting pool.

```js
export function chooseUnusedStoryDnaRow(rows = [], {
  random = Math.random,
  excludeRowId = null,
  ...evaluationOptions
} = {}) {
  const candidates = rows.filter(row => row?.status === 'planned' && !row.locked);
  const evaluated = candidates.map(row => ({
    row,
    evaluation: evaluateStoryDnaCandidate(row, rows, evaluationOptions),
  })).filter(item => item.evaluation.decision !== 'reject');
  const withoutPrevious = evaluated.filter(item => item.row.id !== excludeRowId);
  const pool = withoutPrevious.length ? withoutPrevious : evaluated;
  if (!pool.length) return null;
  const value = Math.min(0.999999999, Math.max(0, Number(random()) || 0));
  return pool[Math.floor(value * pool.length)];
}
```

- [ ] **Step 4: Run selector tests and verify GREEN**

Run:

```powershell
node --test tests/storyDnaMatrix.test.js
```

Expected: all selector and novelty tests pass.

### Task 2: Remember the previous row per Matrix in Formula Random

**Files:**
- Modify: `tests/channelFormulaRuntime.test.js`
- Modify: `src/channelFormulaRuntime.js`

- [ ] **Step 1: Write failing Formula runtime tests**

Add a test that calls Formula Random twice with the same Matrix, injected random values and a shared last-selection map. Verify the second click chooses a different row while both rows remain `planned`.

```js
test('repeated Matrix randomization avoids the previous preview without consuming it', async () => {
  const lastSelections = new Map();
  const matrix = {
    id: 'matrix-random',
    rows: [
      makeMatrixRow({ id: 'story-a' }),
      makeMatrixRow({ id: 'story-b' }),
    ],
  };
  const first = await randomizeAndApplyFormulaSettings({
    formula: motifFormula,
    matrix,
    random: () => 0,
    lastMatrixSelections: lastSelections,
  });
  const second = await randomizeAndApplyFormulaSettings({
    formula: motifFormula,
    matrix,
    random: () => 0,
    lastMatrixSelections: lastSelections,
  });
  assert.equal(first.matrixRow.id, 'story-a');
  assert.equal(second.matrixRow.id, 'story-b');
  assert.equal(matrix.rows.every(row => row.status === 'planned'), true);
});
```

- [ ] **Step 2: Run Formula tests and verify RED**

Run:

```powershell
node --test tests/channelFormulaRuntime.test.js
```

Expected: both calls select the same Matrix row because the runtime does not pass exclusion state to the selector.

- [ ] **Step 3: Implement per-Matrix last-selection memory**

Extend `randomizeAndApplyFormulaSettings` with optional `lastMatrixSelections`, pass injected randomness and the last row ID to the selector, and update the map only after a Matrix row is selected.

```js
const matrixId = text(matrix?.id, 160);
const selected = chooseUnusedStoryDnaRow(matrixRows, {
  random,
  excludeRowId: matrixId ? lastMatrixSelections?.get?.(matrixId) : null,
});
if (selected?.row) {
  matrixRow = normalizeStoryDnaRow(selected.row, { formulaId: safeFormula.id });
  if (matrixId) lastMatrixSelections?.set?.(matrixId, matrixRow.id);
}
```

Create one `Map` in `installChannelFormulaRuntime` and pass it to every Random call. Do not persist this map or change Matrix row status.

- [ ] **Step 4: Run focused Formula tests and verify GREEN**

Run:

```powershell
node --test tests/channelFormulaRuntime.test.js tests/storyDnaMatrix.test.js
```

Expected: all focused tests pass and repeated previews use different eligible rows.

### Task 3: Verify integration and record the fix

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the complete Node test suite**

```powershell
$tests = rg --files tests -g '*.test.js'
node --test $tests
```

Expected: zero failures.

- [ ] **Step 2: Run syntax, build and diff checks**

```powershell
node --check src/storyDnaMatrix.js
node --check src/channelFormulaRuntime.js
npm.cmd run build
git diff --check
```

Expected: syntax and build exit successfully; the optional Nano contract may report its documented skip when the sibling source is unavailable.

- [ ] **Step 3: Update the local handoff**

Record the deterministic-selector root cause, true random selection, immediate-repeat avoidance, unchanged `used` lifecycle and fresh verification counts in `HANDOFF.md`.

- [ ] **Step 4: Start or verify the local server**

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5199
```

Expected: Vite serves the current workspace at `http://127.0.0.1:5199/`; if the port is already occupied, verify the owning process command line points to this workspace and confirm HTTP 200.


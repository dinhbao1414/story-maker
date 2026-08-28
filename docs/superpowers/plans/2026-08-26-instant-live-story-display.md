# Instant Live Story Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the synthetic standard-story typewriter delay so received story text and its character count display immediately.

**Architecture:** Keep the existing stream accumulation, sanitization, cleanup and finalization. Replace only the delayed `liveTarget` to `liveDisplayed` renderer in `legacyMain.js` with direct rendering of the complete cleaned target on every stream callback.

**Tech Stack:** JavaScript ES modules, Node built-in test runner, Vite.

---

### Task 1: Add a regression contract for immediate rendering

**Files:**
- Create: `tests/standardLiveImmediateDisplay.test.js`
- Inspect: `src/legacyMain.js`

- [ ] **Step 1: Write the failing source contract**

Create a test that reads `src/legacyMain.js` and verifies the standard live preview no longer owns `liveDisplayed` or `liveTimer`, does not schedule `renderStandardLivePreview` at 35 ms, writes the complete `liveTarget` into the output and counts the complete `liveTarget`.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/legacyMain.js', import.meta.url), 'utf8');

test('standard live story displays the complete received target without typewriter pacing', () => {
  assert.doesNotMatch(source, /liveDisplayed/);
  assert.doesNotMatch(source, /liveTimer/);
  assert.doesNotMatch(source, /setInterval\(\(\)=>renderStandardLivePreview\(!1\),35\)/);
  assert.match(source, /a\.textContent=liveTarget/);
  assert.match(source, /Array\.from\(liveTarget\)\.length\.toLocaleString\(\)/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/standardLiveImmediateDisplay.test.js
```

Expected: FAIL because the current runtime contains `liveDisplayed`, `liveTimer` and the 35 ms interval.

### Task 2: Remove delayed standard-story rendering

**Files:**
- Modify: `src/legacyMain.js`
- Test: `tests/standardLiveImmediateDisplay.test.js`

- [ ] **Step 1: Implement direct live-target rendering**

In the standard generation block:

- Retain `liveTarget` and the independent scroll helper.
- Make `renderStandardLivePreview()` assign `liveTarget` directly to the output.
- Calculate the counter from `liveTarget`.
- Make `stopStandardLivePreview()` perform one direct render.
- Make `updateStandardLivePreview()` sanitize, clean, replace `liveTarget` and render immediately.
- Remove `liveDisplayed`, `liveTimer` and the 35 ms interval.

Target behavior:

```js
let liveTarget = '';
let liveScrollTimer = null;

function renderStandardLivePreview() {
  if (!liveTarget) return;
  output.className = 'output-box text-selectable';
  output.textContent = liveTarget;
  counter.textContent = `${Array.from(liveTarget).length.toLocaleString()} ký tự`;
  scrollStandardLiveToOutputCursor();
}

function stopStandardLivePreview() {
  renderStandardLivePreview();
}

function updateStandardLivePreview(text) {
  const sanitized = sanitizeStandardLiveText(text);
  if (!sanitized.trim()) return;
  liveTarget = cleanFooter(sanitized);
  output.className = 'output-box text-selectable';
  startStandardLiveScroll();
  renderStandardLivePreview();
}
```

- [ ] **Step 2: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/standardLiveImmediateDisplay.test.js tests/standardLiveProgress.test.js tests/standardTypewriterRenderer.test.js
```

Expected: all focused tests pass.

### Task 3: Verify integration and record the correction

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
node --check src/legacyMain.js
npm.cmd run build
git diff --check
```

Expected: syntax and build succeed. The documented optional Nano contract may skip when its sibling source is unavailable.

- [ ] **Step 3: Update the handoff**

Record the background-tab timer-throttling root cause, removal of the 35 ms artificial pacing, direct received-text counting and fresh verification totals.

- [ ] **Step 4: Verify the local server**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5199
```

If the port is already occupied, verify its process command line points to this workspace, confirm HTTP 200 and confirm the served `legacyMain.js` contains direct `liveTarget` rendering with no `liveDisplayed` or `liveTimer`.


# Formula Random Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Change the channel-formula action from direct 20K generation to AI/local motif randomization that fills Dashboard settings and lets the user click the normal Dashboard generation button.

**Architecture:** Keep the selected channel formula fixed while generating one short structured JSON settings packet. Reuse `applyGenerationSettings` for Dashboard population, preserve the sanitized formula metadata in the settings payload, and dispatch an explicit dashboard-open event after successful application. If the structured AI call fails, use bounded local motif arrays without blocking the workflow.

**Tech Stack:** Browser JavaScript modules, existing provider client fallback, existing generation-settings import bridge, IndexedDB formula storage, Node `node:test`.

---

### Task 1: Define the random-settings model and prompt

**Files:**

- Modify: `src/channelFormulaRuntime.js`
- Test: `tests/channelFormulaRuntime.test.js`

- [ ] **Step 1: Write failing tests**

Cover:

```js
const settings = normalizeRandomizedFormulaSettings({
  theme: 'hidden inheritance',
  characters: [{ name: 'Mio', role: 'daughter' }],
}, formula);
assert.equal(settings.mode, 'novel');
assert.equal(settings.channelFormula.id, formula.id);
assert.equal(settings.characters[0].name, 'Mio');
assert.equal(settings.locked.channelFormula, true);
```

Also assert the randomization prompt requests JSON-only output, Japanese story settings, abstract formula rules, new names, and no source copying.

- [ ] **Step 2: Run the focused test and observe the expected missing-export failure**

```powershell
node --test tests/channelFormulaRuntime.test.js
```

- [ ] **Step 3: Implement minimal pure helpers**

Add:

```js
buildFormulaSettingsRandomizationPrompt({ formula, randomSeed })
normalizeRandomizedFormulaSettings(value, formula)
buildFallbackFormulaSettings(formula, { random })
```

The normalized payload must contain `mode: 'novel'`, bounded axes/characters, `supplement`, `channelFormula`, and `locked.channelFormula: true`. It must never retain API keys, raw source text, or exact source excerpts.

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests/channelFormulaRuntime.test.js
```

- [ ] **Step 5: Commit**

```powershell
git add src/channelFormulaRuntime.js tests/channelFormulaRuntime.test.js
git commit -m "feat: add formula motif settings model"
```

### Task 2: Replace direct generation with Dashboard settings application

**Files:**

- Modify: `src/channelFormulaRuntime.js`
- Modify: `src/workspaceTabs.js`
- Modify: `index.html`
- Test: `tests/channelFormulaRuntime.test.js`
- Test: `tests/workspaceTabs.test.js`

- [ ] **Step 1: Write failing tests**

Assert that a successful randomization:

1. calls the structured AI once;
2. falls back locally after a rejected AI response;
3. calls the existing settings application bridge with the sanitized formula metadata;
4. dispatches `story-maker:open-dashboard`;
5. does not call `generateFormulaStory` or Longify.

Assert the button label is `AI Random mô típ & điền thiết lập`.

- [ ] **Step 2: Run focused tests and observe failure**

```powershell
node --test tests/channelFormulaRuntime.test.js tests/workspaceTabs.test.js
```

- [ ] **Step 3: Implement the runtime flow**

Add `randomizeAndApplyFormulaSettings()` to the runtime controller. It must:

```js
const result = await callStructuredAi(prompt);
const settings = normalizeRandomizedFormulaSettings(parseStructuredFormulaAnalysis(result), formula);
await applyGenerationSettings({ schema: 'story-maker-generation-settings-v1', settings }, { announce: false });
win.dispatchEvent(new win.CustomEvent('story-maker:open-dashboard'));
```

On AI/429/timeout/invalid JSON, use `buildFallbackFormulaSettings` and show a non-blocking fallback status. Do not call a story-generation provider or Longify.

Update the click handler for `#cf-generate` to call this method. Update the button text and status/result copy to describe settings generation, not 20K output.

Add an `open-dashboard` listener to `workspaceTabs.js` that activates the Dashboard tab.

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests/channelFormulaRuntime.test.js tests/workspaceTabs.test.js
```

- [ ] **Step 5: Commit**

```powershell
git add src/channelFormulaRuntime.js src/workspaceTabs.js index.html tests/channelFormulaRuntime.test.js tests/workspaceTabs.test.js
git commit -m "feat: fill dashboard from formula motifs"
```

### Task 3: Verify the new user flow

**Files:** No source changes unless verification finds a regression.

- [ ] **Step 1: Run all tests**

```powershell
node --test "tests/**/*.test.js"
```

- [ ] **Step 2: Run project guards and build**

```powershell
npm.cmd run check:generic-rules
npm.cmd run check:nano-4koma-contract
npm.cmd run build
git diff --check -- . ':!dist'
```

- [ ] **Step 3: Verify localhost**

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5179/
```

Expected: HTTP 200, formula tab present, button text refers to random motif/settings, and no deployment/version bump.


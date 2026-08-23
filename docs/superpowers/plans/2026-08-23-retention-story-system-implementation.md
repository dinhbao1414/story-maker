# CTR–Retention–Comment Story System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the approved CTR, 30-second hook, progressive curiosity, long-retention, twist, and comment-payoff rules into channel-formula analysis, motif randomization, fallback settings, and the 20K generation prompt.

**Architecture:** Keep the existing `formula → random settings → Dashboard → Tạo truyện` flow. Add a sanitized `audienceGrowthSystem` to formula analysis and synthesize a normalized retention package into the existing `supplement` field, so the existing Dashboard prompt consumes the new rules without a new UI or provider path.

**Tech Stack:** Vanilla ES modules, Node’s built-in `node:test`, existing formula sanitizers/repository, existing Gemini/OpenAI provider bridge, Vite.

---

### Task 1: Lock the formula analysis and synthesis contract

**Files:**
- Modify: `src/channelFormula.js` (`buildFileAnalysisPrompt`, `buildFormulaSynthesisPrompt`)
- Test: `tests/channelFormula.test.js`

- [ ] **Step 1: Write failing tests for the new analysis contract**

Add assertions that `buildFileAnalysisPrompt()` asks for:

```js
assert.match(prompt, /audienceGrowthSystem/);
assert.match(prompt, /ctrPromise/);
assert.match(prompt, /hook30s/);
assert.match(prompt, /curiosityLadder/);
assert.match(prompt, /retentionBeats/);
assert.match(prompt, /commentPayoff/);
```

Add assertions that `buildFormulaSynthesisPrompt()` requests the same nested keys and explicitly requires a question to be answered before the next larger question is introduced.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: FAIL because the current analysis and synthesis prompt JSON shapes do not contain `audienceGrowthSystem`.

- [ ] **Step 3: Implement the minimal prompt contract**

Extend the JSON examples in `buildFileAnalysisPrompt()` and `buildFormulaSynthesisPrompt()` with:

```js
audienceGrowthSystem: {
  ctrPromise: '',
  hook30s: '',
  curiosityLadder: [
    { question: '', answer: '', nextQuestion: '' },
  ],
  retentionBeats: [
    { window: '30s-3m', goal: '', beat: '' },
  ],
  commentPayoff: '',
  antiDropRules: [],
}
```

Add instructions that the values must be abstract construction rules, not copied prose, exact names, exact quotes, or one-off incidents.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: PASS with all existing and new assertions green.

- [ ] **Step 5: Commit the contract change**

```powershell
git add src/channelFormula.js tests/channelFormula.test.js
git commit -m "feat: add audience growth formula contract"
```

### Task 2: Add the built-in Daily Scat retention formula

**Files:**
- Modify: `src/channelFormulaCatalog.js`
- Test: `tests/channelFormula.test.js`

- [ ] **Step 1: Write failing tests for the built-in formula**

Add assertions that the built-in formula contains:

```js
assert.equal(formula.analysis.audienceGrowthSystem.ctrPromise.length > 0, true);
assert.equal(formula.analysis.audienceGrowthSystem.hook30s.length > 0, true);
assert.equal(formula.analysis.audienceGrowthSystem.curiosityLadder.length >= 3, true);
assert.equal(formula.analysis.audienceGrowthSystem.retentionBeats.length >= 5, true);
assert.equal(formula.analysis.audienceGrowthSystem.commentPayoff.length > 0, true);
```

Also assert that `JSON.stringify(formula)` still excludes source filenames, raw story text, and API-key-looking keys.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: FAIL because the built-in catalog currently only stores the older opening/escalation/pacing fields.

- [ ] **Step 3: Implement the approved 40-file synthesis**

Add an abstract `audienceGrowthSystem` to `DAILY_SCAT_FORMULA.analysis`:

- CTR promise: public family injustice, hidden evidence, relationship/status, promised reversal.
- Hook: open during the humiliation or accusation with a concrete line/object; no greeting before the first shock.
- Curiosity ladder: at least three linked question/answer transitions.
- Retention beats: the approved five time windows.
- Comment payoff: resolve the main injustice while leaving a defensible moral choice.
- Anti-drop rules: answer questions promptly, introduce a larger question after each answer, vary evidence and actions, avoid repeated explanations.

Extend `reproductionPrompt` with the same rules in Japanese and preserve the existing Japanese-only, 4-chapter, 20K, no-copying, complete-ending requirements.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the built-in formula update**

```powershell
git add src/channelFormulaCatalog.js tests/channelFormula.test.js
git commit -m "feat: encode Daily Scat retention formula"
```

### Task 3: Extend motif randomization and normalization

**Files:**
- Modify: `src/channelFormulaRuntime.js`
- Test: `tests/channelFormulaRuntime.test.js`

- [ ] **Step 1: Write failing tests for random motif fields**

Add a structured-AI response containing:

```js
{
  titlePromise: '...',
  thumbnailConcept: '...',
  hook30s: '...',
  questionLadder: [
    { question: 'A', answer: 'A answer', nextQuestion: 'B' },
    { question: 'B', answer: 'B answer', nextQuestion: 'C' },
    { question: 'C', answer: 'C answer', nextQuestion: '' }
  ],
  retentionBeats: [{ window: '30s-3m', goal: '...', beat: '...' }],
  twist: '...',
  commentDilemma: '...'
}
```

Assert that `normalizeRandomizedFormulaSettings()` preserves bounded, sanitized values and that `settings.supplement` includes labels for CTR, hook, question ladder, retention beats, twist, and comment dilemma.

Add a fallback test requiring at least three linked question objects and a non-empty moral dilemma.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/channelFormulaRuntime.test.js
```

Expected: FAIL because the current normalizer only recognizes antagonist, evidence, and escalation.

- [ ] **Step 3: Implement bounded normalization**

Add helpers in `src/channelFormulaRuntime.js` to:

- limit scalar fields to existing safe text limits;
- cap `questionLadder` at five items and normalize each `{ question, answer, nextQuestion }`;
- cap `retentionBeats` at five items and normalize each `{ window, goal, beat }`;
- preserve `twist` and `commentDilemma`;
- append all non-empty retention fields to `supplement` using stable Japanese labels;
- continue filtering secret/raw-source-looking keys through `sanitizeAnalysis()`.

Keep the existing axes, characters, mode, locks, and channel formula behavior unchanged.

- [ ] **Step 4: Extend the JSON randomization prompt**

Update `buildFormulaSettingsRandomizationPrompt()` to request the new fields and state:

- `questionLadder` must contain 3–5 linked question/answer transitions;
- `hook30s` must be usable as the opening scene;
- `retentionBeats` must cover the five approved windows;
- `commentDilemma` must be debatable but not unresolved main plot;
- no source copying or exact source CTA.

- [ ] **Step 5: Update fallback motif data**

Add the same fields to every local fallback motif. Use generic Japanese constructions, not transcript-specific names or quotes.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/channelFormulaRuntime.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit motif randomization changes**

```powershell
git add src/channelFormulaRuntime.js tests/channelFormulaRuntime.test.js
git commit -m "feat: randomize retention motif settings"
```

### Task 4: Enforce the retention system in the 20K generation prompt

**Files:**
- Modify: `src/channelFormula.js` (`buildFormulaGenerationPrompt`)
- Test: `tests/channelFormula.test.js`

- [ ] **Step 1: Write failing prompt-contract tests**

Add assertions that a generated formula prompt includes patterns for:

```js
assert.match(prompt, /30.*秒|30s/);
assert.match(prompt, /Question A|question.*answer|質問.*答え/iu);
assert.match(prompt, /30s-3m|3-8m|8-15m|15-20m|20-25m/);
assert.match(prompt, /commentDilemma|道徳|議論|コメント/iu);
assert.match(prompt, /CTA.*hook|hook.*CTA/iu);
```

Assert that the prompt still includes the 20,000-character contract, Japanese-only output, four chapters, no source copying, and complete ending.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: FAIL because the current prompt only requires generic 4-chapter pacing.

- [ ] **Step 3: Implement the minimal generation rules**

Add Japanese instructions to `buildFormulaGenerationPrompt()` that:

1. Open in a live abnormal scene or shocking dialogue within the first 30 seconds.
2. Deliver the title/thumbnail promise early.
3. Answer every active question in the same or next chapter, then create a larger question.
4. Place the five retention windows and a central mid-story twist.
5. Resolve the injustice with concrete evidence/action.
6. End with a natural moral dilemma, without a forced subscribe/comment CTA.

Keep `includeYoutubeCta` behavior unchanged: if enabled, a generic greeting may appear only after the hook.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/channelFormula.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit generation prompt changes**

```powershell
git add src/channelFormula.js tests/channelFormula.test.js
git commit -m "feat: enforce retention beats in formula generation"
```

### Task 5: Verify the integrated flow and document the handoff

**Files:**
- Modify: `HANDOFF.md`
- Test: existing test suite and build outputs only

- [ ] **Step 1: Run the full verification suite**

Run each command separately:

```powershell
npm test
npm run check:generic-rules
npm run check:nano-4koma-contract
npm run build
git diff --check
```

Expected:

- Node suite reports all tests passing.
- Generic-rule check exits 0.
- Nano contract passes or reports the documented sibling-project skip.
- Vite build exits 0 with only the existing large-chunk warning, if still present.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Start the local development server**

Run:

```powershell
npm run dev -- --host 0.0.0.0
```

Verify the local app responds with HTTP 200 at:

```text
http://localhost:5179
```

- [ ] **Step 3: Update HANDOFF.md**

Record:

- the new retention contract;
- random settings fields and fallback behavior;
- test/build/HTTP evidence;
- that no deploy, version bump, release, or API credential change was made.

- [ ] **Step 4: Commit the implementation snapshot**

```powershell
git add HANDOFF.md
git commit -m "docs: record retention story system verification"
```


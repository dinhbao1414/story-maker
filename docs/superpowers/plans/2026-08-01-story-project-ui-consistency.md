# Story Project UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the native Create Project dialog and make the Story Project workspace visually consistent with Story Maker's existing dark-purple interface without changing behavior.

**Architecture:** Keep the existing runtime markup, event delegation, IndexedDB, and generation bridge untouched. Add a small static CSS contract test, then replace the compressed Story Project CSS block with scoped, token-based presentation rules covering the dialog, dashboard cards, detail surfaces, and responsive layouts.

**Tech Stack:** Vanilla JavaScript, native `<dialog>`, CSS custom properties, Node.js `assert`, Vite.

---

## File Map

- Modify `tests/storyProjectRuntime.test.js`: load `src/style.css` and assert required modal/workspace CSS contracts.
- Modify `src/style.css`: center and style the dialog; unify Story Project dashboard/detail surfaces; preserve runtime selectors.
- Modify `HANDOFF.md`: record the UI-only correction and verification evidence.
- Modify `docs/troubleshooting.md` only if implementation confirms a reusable global-reset/native-dialog lesson not already documented.

### Task 1: Lock the CSS Contract

**Files:**
- Modify: `tests/storyProjectRuntime.test.js`
- Test: `tests/storyProjectRuntime.test.js`

- [ ] **Step 1: Add the stylesheet import and focused assertions**

Add after the existing imports:

```js
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
```

Add after the existing dialog markup assertions:

```js
assert.match(css, /\.sp-dialog\s*\{[^}]*margin:\s*auto/);
assert.match(css, /\.sp-dialog::backdrop\s*\{[^}]*background:/);
assert.match(css, /\.sp-dialog\s*>\s*form\s*\{[^}]*display:\s*flex/);
assert.match(css, /\.sp-dialog\s+header\s*\{[^}]*display:\s*flex/);
assert.match(css, /\.sp-dialog-actions\s*\{[^}]*justify-content:\s*flex-end/);
assert.match(css, /#story-projects-root\s*\{[^}]*max-width:/);
assert.match(css, /\.sp-summary-card\s*\{[^}]*background:/);
assert.match(css, /\.sp-toolbar\s*\{[^}]*background:/);
assert.match(css, /\.sp-grid\s*\{[^}]*auto-fit/);
assert.match(css, /\.sp-card-actions\s+\.btn-generate\s*\{[^}]*width:\s*auto/);
assert.match(css, /\.sp-detail-section\s*\{[^}]*background:/);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
node tests/storyProjectRuntime.test.js
```

Expected: FAIL at the first missing CSS contract, currently `.sp-dialog { ... margin:auto ... }`.

- [ ] **Step 3: Commit the failing contract test**

```powershell
git add tests/storyProjectRuntime.test.js
git commit -m "test: define Story Project UI contract"
```

### Task 2: Center and Structure the Native Dialog

**Files:**
- Modify: `src/style.css:2381`
- Test: `tests/storyProjectRuntime.test.js`

- [ ] **Step 1: Replace the current `.sp-dialog` one-liner with centered dialog rules**

Use existing tokens and native dialog behavior:

```css
.sp-dialog {
  position: fixed;
  inset: 0;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 80px rgba(0, 0, 0, .55);
}
.sp-dialog::backdrop {
  background: rgba(4, 4, 10, .58);
  backdrop-filter: blur(3px);
}
.sp-dialog > form {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 32px);
  overflow: hidden;
}
.sp-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
}
.sp-dialog header h2 { margin: 0; }
.sp-dialog header button {
  width: 44px;
  min-width: 44px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface3);
  color: var(--text2);
  font-size: 24px;
  cursor: pointer;
}
.sp-dialog section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 24px;
}
.sp-dialog section > label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface2);
}
.sp-dialog section > label input[type="radio"] {
  width: auto;
  margin-top: 2px;
}
.sp-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--surface2);
}
.sp-dialog-actions .btn-generate,
.sp-dialog-actions .btn-secondary { width: auto; }
```

- [ ] **Step 2: Add the mobile dialog override**

Inside the Story Project `@media(max-width:640px)` block, add:

```css
.sp-dialog {
  width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
}
.sp-dialog > form { max-height: calc(100vh - 24px); }
.sp-dialog header,
.sp-dialog section,
.sp-dialog-actions { padding-left: 16px; padding-right: 16px; }
.sp-dialog-actions { flex-wrap: wrap; }
.sp-dialog-actions .btn-generate,
.sp-dialog-actions .btn-secondary { flex: 1 1 140px; }
```

- [ ] **Step 3: Run the focused test**

Run:

```powershell
node tests/storyProjectRuntime.test.js
```

Expected: modal assertions PASS; workspace assertions may still FAIL until Task 3.

- [ ] **Step 4: Commit the modal correction**

```powershell
git add src/style.css
git commit -m "fix: center Story Project dialog"
```

### Task 3: Unify the Projects Workspace

**Files:**
- Modify: `src/style.css:2381`
- Test: `tests/storyProjectRuntime.test.js`

- [ ] **Step 1: Replace the compressed dashboard rules with scoped layout and surface rules**

Keep selectors owned by `storyProjectRuntime.js`; do not change markup or JavaScript:

```css
.story-projects-panel {
  width: 100%;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: var(--bg);
}
#story-projects-root {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}
.sp-header,
.sp-toolbar,
.sp-card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sp-header {
  justify-content: space-between;
  margin-bottom: 20px;
}
.sp-header h2,
.sp-header p { margin: 0; }
.sp-header h2 { font-size: 24px; }
.sp-header p { margin-top: 6px; color: var(--text3); }
.sp-header > .sp-card-actions { justify-content: flex-end; }
.sp-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.sp-summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface2);
}
.sp-summary-card strong { color: var(--accent2); font-size: 26px; }
.sp-summary-card span { color: var(--text3); font-size: 12px; font-weight: 700; }
.sp-toolbar {
  align-items: end;
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.sp-toolbar label {
  display: flex;
  flex: 0 1 220px;
  flex-direction: column;
  gap: 7px;
  color: var(--text2);
  font-size: 12px;
  font-weight: 800;
}
.sp-toolbar .sp-search { flex: 1 1 320px; }
.sp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: 16px;
}
.sp-card {
  display: flex;
  min-width: 0;
  min-height: 100%;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface2);
}
.sp-card:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
.sp-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.sp-card-heading h3 { margin: 8px 0 0; overflow-wrap: anywhere; }
.sp-card-meta,
.sp-card-count { margin: 0; color: var(--text3); }
.sp-card-count strong { color: var(--text); }
.sp-status {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 9px;
  border: 1px solid var(--border2);
  border-radius: 999px;
  background: var(--surface3);
  color: var(--text2);
  font-size: 11px;
  font-weight: 800;
}
.sp-status-running { border-color: rgba(34, 211, 238, .35); color: #67e8f9; }
.sp-status-completed { border-color: rgba(74, 222, 128, .35); color: #86efac; }
.sp-status-error { border-color: rgba(248, 113, 113, .35); color: #fca5a5; }
.sp-menu-button {
  width: 44px;
  min-width: 44px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface3);
  color: var(--text2);
  cursor: pointer;
}
.sp-progress {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface3);
}
.sp-progress > span { display: block; height: 100%; background: var(--accent); }
.sp-card-actions { flex-wrap: wrap; }
.sp-card > .sp-card-actions { margin-top: auto; }
.sp-card-actions .btn-generate { width: auto; margin: 0; }
.sp-card-actions .btn-secondary { width: auto; margin: 0; }
.sp-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 48px 24px;
  border: 1px dashed var(--border2);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
}
.sp-empty h3,
.sp-empty p { margin: 0; }
.sp-empty p { color: var(--text3); }
.sp-empty .btn-generate { width: auto; margin-top: 8px; }
```

- [ ] **Step 2: Add detail, story-row, preview, and history hierarchy**

Append within the same scoped Story Project block:

```css
.sp-detail-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.sp-detail-tabs span {
  flex: 0 0 auto;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface2);
  color: var(--text2);
  font-size: 12px;
  font-weight: 800;
}
.sp-detail-section {
  margin-bottom: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.sp-detail-section h3 { margin: 0 0 14px; }
.sp-detail-section > p { color: var(--text2); }
.sp-detail-section label {
  display: flex;
  min-width: 110px;
  flex-direction: column;
  gap: 6px;
  color: var(--text2);
  font-size: 12px;
  font-weight: 800;
}
#sp-variation-preview {
  min-height: 220px;
  margin-top: 14px;
  resize: vertical;
}
.sp-story-list { display: flex; flex-direction: column; gap: 10px; }
.sp-story-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface2);
}
.sp-story-item h4,
.sp-story-item p { margin: 0; }
.sp-story-item p { margin-top: 5px; color: var(--text3); }
.sp-story-text {
  width: 100%;
  margin: 12px 0 0;
  padding: 14px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text2);
}
.sp-story-item:has(.sp-story-text:not([hidden])) { flex-wrap: wrap; }
.sp-detail-section ul {
  margin: 0;
  padding-left: 20px;
  color: var(--text2);
}
```

- [ ] **Step 3: Replace old responsive one-liners with explicit responsive behavior**

```css
@media(max-width:1100px) {
  .sp-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media(max-width:640px) {
  .story-projects-panel { padding: 14px; }
  .sp-summary { grid-template-columns: 1fr; }
  .sp-header,
  .sp-toolbar,
  .sp-story-item { align-items: stretch; flex-direction: column; }
  .sp-header > .sp-card-actions,
  .sp-toolbar label { width: 100%; flex-basis: auto; }
  .sp-card-actions > button { flex: 1 1 140px; }
  .sp-card-actions .btn-generate,
  .sp-card-actions .btn-secondary { width: 100%; }
  .sp-card > .sp-card-actions .btn-generate,
  .sp-card > .sp-card-actions .btn-secondary { width: auto; }
  .sp-detail-section { padding: 16px; }
}
@media(prefers-reduced-motion:reduce) {
  .sp-card,
  .sp-progress > span { transition: none; }
}
```

- [ ] **Step 4: Run focused UI contract tests**

Run:

```powershell
node tests/storyProjectRuntime.test.js
node tests/workspaceTabs.test.js
node tests/vietnameseUi.test.js
```

Expected: all three commands PASS with existing behavior assertions unchanged.

- [ ] **Step 5: Commit the workspace presentation**

```powershell
git add src/style.css
git commit -m "style: unify Story Project workspace"
```

### Task 4: Verify Geometry and Record the Fix

**Files:**
- Modify: `docs/troubleshooting.md`
- Modify: `HANDOFF.md`
- Test: full repository validation and browser acceptance

- [ ] **Step 1: Run the full automated verification sequence**

```powershell
node tests/storyProjectRuntime.test.js
node tests/workspaceTabs.test.js
node tests/vietnameseUi.test.js
node --test "tests/**/*.test.js"
& npm.cmd run check:generic-rules
& npm.cmd run check:nano-4koma-contract
& npm.cmd run lint --if-present
git diff --check
& npm.cmd run build
```

Expected: focused tests and full suite PASS; guards PASS; `git diff --check` is clean; Vite build succeeds with only the existing large-chunk warning if present.

- [ ] **Step 2: Start the mandatory local server**

Run in a dedicated terminal:

```powershell
& npm.cmd run dev -- --host 127.0.0.1 --port 5179
```

Verify from another terminal:

```powershell
(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5179/').StatusCode
```

Expected: `200`.

- [ ] **Step 3: Perform browser geometry acceptance without calling any AI API**

At `http://127.0.0.1:5179/`:

1. Open `Dự án Story`; click `＋ Tạo dự án`.
2. Calculate dialog center deltas from its bounding rectangle and viewport; require horizontal and vertical deltas at most `2px`.
3. Confirm computed margin is `auto`; dialog header/footer are `display:flex`; backdrop covers the page.
4. Repeat at `1920x1080`, `764x485`, and about `390x844`.
5. Confirm viewport gutters, internal scrolling, no horizontal overflow, visible focus outlines, and reduced-motion behavior.
6. Close with `Escape`; reopen; close with `×` to preserve native dialog behavior.
7. Inspect summary, toolbar, cards, empty state, detail surfaces, preview textarea, story rows, statuses, progress, and actions.
8. Do not trigger generation; do not read, expose, or modify the saved API key.

Expected: centered modal, consistent surfaces, compact Card actions, no `.sp-error`, Vite overlay, or console error.

- [ ] **Step 4: Document the reusable reset lesson**

Append to `docs/troubleshooting.md`:

```markdown
## Native dialog opens at the viewport origin after a CSS reset

- Symptom: `showModal()` works, but the dialog appears at `x=0`, `y=0` instead of centered.
- Cause: a global reset removes the user-agent `dialog { margin: auto; }` rule.
- Fix: explicitly set `position: fixed; inset: 0; margin: auto;` on the scoped dialog and constrain width/height with viewport gutters.
- Preserve native behavior: keep `<dialog>`, `showModal()`, Escape handling, focus trapping, and `::backdrop`; do not replace them with custom JavaScript positioning.
```

- [ ] **Step 5: Record completion evidence in the handoff**

Append to `HANDOFF.md`:

```markdown
## 2026-08-01 Story Project UI consistency correction

- Centered the native Create Project dialog with explicit fixed inset and auto margins because the global reset removed browser dialog centering.
- Unified Story Project summary cards, toolbar, project cards, status/progress, empty state, detail sections, story rows, actions, and responsive layouts using existing dark-purple tokens.
- Preserved runtime markup, IDs, data actions, IndexedDB, analysis, generation, retry, timeout, provider, API, and version behavior.
- Verification: focused UI tests, full Node suite, static guards, build, HTTP 200, and browser geometry checks at desktop, compact, and mobile viewports.
- Local verification URL: `http://127.0.0.1:5179/`.
- No deploy, push, release, tag, backup, version bump, or API usage was performed.
```

- [ ] **Step 6: Commit documentation and verification record**

```powershell
git add docs/troubleshooting.md HANDOFF.md
git commit -m "docs: record Story Project UI correction"
```

## Completion Guardrails

- Do not edit `src/storyProjectRuntime.js`, `index.html`, storage code, generation code, provider routing, timeout/retry logic, version files, or `dist/`.
- Do not deploy, push, tag, release, back up, or call an AI API.
- If build or Git validation fails, stop; report the exact error instead of deploying or broadening scope.
- Final report must include `Local xác nhận: http://localhost:5179/`.

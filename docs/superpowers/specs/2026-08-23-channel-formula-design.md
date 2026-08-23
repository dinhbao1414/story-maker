# Channel Formula / Công thức kênh — Design Specification

**Date:** 2026-08-23  
**Target app:** `story-maker`  
**Status:** Design approved by user

## Goal

Add a Hybrid channel-formula workflow that analyzes a folder of source TXT stories, combines the analyses into one named reusable formula, optionally stores the formula in source as a built-in catalog entry, and generates a new Japanese story using that formula with a minimum of 20,000 non-whitespace characters.

The first source set is the 40 `ja.auto.txt` files under:

```text
C:\Users\thedu\Downloads\bulk-20260823-103823-32654459\UCr06YgwC3IQp_x0qxsy3hwA
```

The resulting built-in formula name is:

```text
Daily Scat – Drama gia đình Nhật
```

Raw source stories must not be embedded into the public source. Only an abstract formula, sanitized analysis, prompt rules, and source fingerprint may be stored.

## Product behavior

### Formula management workspace

Add a workspace named `Công thức kênh` alongside Dashboard, Story Projects, and Settings.

The workspace must support:

1. Listing built-in and browser-persisted formulas.
2. Selecting a folder through a directory file input (`webkitdirectory`).
3. Accepting `.txt` files from the selected folder and ignoring unsupported files.
4. Entering or editing a formula name.
5. Starting sequential per-file analysis with visible progress (`file N / total`).
6. Persisting each completed file analysis so an interrupted run can resume.
7. Aggregating file analyses into a single formula.
8. Previewing the abstracted formula before saving.
9. Saving, renaming, deleting, exporting, and importing formula JSON.
10. Starting one random story generation using the selected formula.

The first built-in formula is Japanese-only and is based on the approved source folder. Dynamic formulas may retain a selected output-language field, but the first generation workflow defaults to Japanese and must enforce Japanese output.

### Formula preview

The preview must expose, in readable form:

- language and source count;
- point of view and narrator pattern;
- tone and audience;
- opening-hook pattern;
- protagonist and antagonist patterns;
- escalation beats;
- reveal/evidence pattern;
- justice/payoff pattern;
- epilogue pattern;
- pacing and chapter guidance;
- forbidden patterns;
- minimum and target character counts.

The preview must not display or persist large excerpts from the source stories.

### Story generation

The formula-generation action must:

1. Keep the selected formula fixed.
2. Randomize theme, setting, characters, occupations, evidence objects, and antagonist details.
3. Generate a new seed/premise rather than copying a source story.
4. Reuse the existing Longify pipeline for sequential chapter generation.
5. Request four chapters for the initial 20,000-character target.
6. Require at least 20,000 non-whitespace characters.
7. Aim for approximately 22,000 target non-whitespace characters.
8. Require a complete ending.
9. Reject or repair repeated scenes, repeated psychological summaries, unfinished endings, prompt leakage, analysis text, and accidental source phrases.
10. Run a bounded supplementation/closure repair if the result is under the minimum.
11. Save a result to Story Projects only after the quality gate passes.

The YouTube intro/CTA is an explicit option and is off by default. Formula reproduction must not copy channel names, exact CTA wording, character names, or source plot details unless the user explicitly provides them as new generation input.

## Formula schema

The canonical formula shape is:

```js
{
  id: string,
  name: string,
  language: 'ja',
  sourceCount: number,
  sourceFingerprint: string,
  analysis: {
    genre: string,
    audience: string,
    pointOfView: string,
    tone: string,
    openingHook: string,
    protagonistPattern: string,
    antagonistPattern: string,
    escalationPattern: string[],
    revealPattern: string,
    evidenceMotifs: string[],
    justicePayoff: string,
    epiloguePattern: string,
    narrationRules: string[],
    pacingRules: string[],
    forbiddenPatterns: string[]
  },
  reproductionPrompt: string,
  generationPolicy: {
    minNonWhitespaceChars: 20000,
    targetNonWhitespaceChars: 22000,
    chapterCount: 4,
    requireCompleteEnding: true,
    randomizeTheme: true,
    randomizeCharacters: true,
    includeYoutubeCtaByDefault: false
  },
  createdAt: string,
  updatedAt: string
}
```

All persisted formula values must be sanitized and bounded. API keys, authorization values, tokens, secrets, and raw source story text must be removed.

## Analysis pipeline

The analysis runner operates sequentially to preserve the existing provider retry and quota behavior.

### Local preprocessing

For each TXT file:

- normalize line endings;
- trim empty leading/trailing content;
- compute character, non-whitespace character, line, and token counts;
- fingerprint the normalized file;
- detect repeated channel-intro/CTA markers;
- select representative opening, middle, and ending slices;
- retain only bounded excerpts for the AI request.

The full raw file must never be included in the stored formula.

### Per-file AI analysis

Each file receives one structured JSON analysis request using its metadata, representative slices, and detected markers. The response must identify the story’s abstract construction rather than reproduce prose.

Each response must be parsed, repaired if necessary, sanitized, and stored immediately in an analysis checkpoint record.

### Aggregation

Completed file analyses are grouped into bounded batches. Each batch produces a compact intermediate summary. A final synthesis request combines the intermediate summaries into the canonical formula schema and reproduction prompt.

The synthesis must explicitly:

- generalize recurring patterns;
- separate high-confidence recurring rules from one-off incidents;
- remove exact names, exact quotes, and unique plot events;
- state forbidden source-copying behavior;
- state Japanese-only output rules;
- state chapter progression and 20,000-character requirements.

## Storage and source catalog

Dynamic formulas are stored in IndexedDB with a versioned schema and support export/import as JSON.

The source catalog is a small JavaScript module containing sanitized formula objects only. The approved first formula may be copied into this catalog after the 40-file analysis completes successfully. Catalog updates are source changes and must follow the project’s normal version/deploy rules if published.

Formula data must not be stored in API session storage, and API credentials must remain in the existing runtime-only key flow.

## Integration boundaries

The implementation must add focused modules rather than expand `legacyMain.js` with unrelated responsibilities:

- `src/channelFormula.js`: schema, sanitizer, fingerprint, sampling, prompt builder, minimum-length validation.
- `src/channelFormulaStorage.js`: IndexedDB repository and import/export helpers.
- `src/channelFormulaRuntime.js`: workspace UI, folder intake, analysis checkpoints, formula selection, generation launch.
- `src/channelFormulaCatalog.js`: built-in sanitized formulas.

Existing modules remain authoritative for:

- provider calls and fallback handling;
- API session handling;
- Longify chapter generation;
- output cleanup and quality checks;
- Story Project persistence and sequential batch behavior.

The formula runtime may pass the reproduction prompt and generation policy through the existing settings/supplement bridge, but it must not introduce a parallel provider client or parallel generation queue.

## Error handling

- No valid API key: stop before sending a request and show an actionable message.
- Unsupported or empty file: skip it and record the filename and reason.
- Provider quota/rate-limit/timeout: use existing retry/fallback behavior and preserve completed checkpoints.
- Invalid AI JSON: run bounded JSON repair; if repair fails, mark that file/batch failed without destroying the previous formula.
- Interrupted analysis: resume from the first incomplete file.
- Under-length story: retain draft diagnostics, run bounded supplementation/closure repair, and mark the result failed if it still does not reach 20,000 non-whitespace characters.
- Formula deletion: do not delete the built-in catalog entry unless an explicit source edit removes it.

## Testing strategy

Unit tests must cover:

- formula schema defaults and sanitization;
- API-secret stripping;
- source fingerprint and representative slice selection;
- CTA/intro marker extraction;
- per-file analysis response normalization;
- aggregation prompt construction;
- formula reproduction prompt construction;
- 20,000-character validation and complete-ending checks;
- IndexedDB repository operations;
- import/export round trips;
- interrupted-analysis checkpoint and resume behavior;
- randomized generation settings preserving the formula while varying allowed fields.

UI/runtime tests must cover:

- directory selection and TXT filtering;
- progress and resume states;
- formula preview, save, rename, delete, import, and export;
- generation button state and failure messaging;
- integration with the existing Story Project flow;
- no concurrent generation requests.

Verification after implementation:

1. Focused unit/runtime tests.
2. Full Node test suite.
3. Generic-rule and Nano 4koma contract checks.
4. Syntax and `git diff --check`.
5. Production build.
6. Local browser smoke at `http://localhost:5179`.
7. One intentional real API analysis/generation run using a key entered in the app UI only; never print, copy, or persist the key in source or chat.

No deploy, release, tag, or version bump is part of this design approval. A deploy later must bump the public version first and follow `docs/deploy.md`.

# Troubleshooting

## DNA Matrix batch completes very few stories

- Symptoms: a 10-story batch with two workers completes only a few rows; most rows fail after one transient provider error, a 10K–19,999-character draft is discarded, or rerunning the batch selects planned rows instead of previously failed rows.
- Duplicate-ID cause: Matrix creation requests five cards per AI batch, and compatible models may restart every response at `story-001` through `story-005`. If those IDs are stored unchanged, row lifecycle updates always match the first duplicate ID.
- ID fix: after all AI batches are accepted, the complete Matrix is reindexed once in stable order as `story-001` through the target count. Lifecycle metadata, content, timestamps, locks, and novelty fingerprints are preserved.
- Retry fix: each story receives at most four total generation attempts. Transient errors use bounded backoff between attempts. A Matrix row remains `generating` during retries and becomes `failed` only after attempt 4 fails.
- Short-output fix: an output from 10,000 through 19,999 non-whitespace characters is continued in the same worker and from the existing manuscript. The continuation prompt forbids rewriting the title/opening, repeating existing prose, or adding chapter headings. Output below 10,000 characters starts a new full attempt.
- Batch speed policy: batch workers explicitly turn off `Tự động tinh chỉnh để đạt điểm cao (tối đa 3 lần)` before generation. The normal Dashboard checkbox and its default remain unchanged. Batch still performs the initial editorial review, but it does not automatically run up to three rewrite-and-rescore passes.
- Rerun behavior: eligible `failed` rows are shuffled and selected before eligible `planned` rows. Locked, used, skipped, queued, and generating rows remain excluded.
- UI diagnostics: every job shows its current attempt as `Lần x/4`, continuation/backoff state, character count, and the provider/generation error text. Keep the full row error visible; do not replace it with a generic `Lỗi`.
- Regression test: the deterministic end-to-end batch test runs ten stories at concurrency two, injects transient `429` failures and 14,200-character drafts, verifies peak concurrency two, continuation beyond 20K, retry recovery, and ten successful completions.

### Formula tab unexpectedly switches to Dashboard during a long batch

- Symptom: after batch generation has run for several minutes, the visible workspace leaves `Công thức kênh` and shows Dashboard even though the user did not click another tab. The batch job list becomes hidden behind the Dashboard tab.
- Cause: workspace tabs accepted late programmatic navigation events from shared settings/formula pipelines while the batch was still active. The batch runtime did not tell the tab controller that a long-running operation should preserve the user's current workspace.
- Fix: batch start/end now emits `story-maker:batch-state`. While running, the tab controller protects the tab most recently selected by the user and ignores conflicting programmatic requests such as `story-maker:open-dashboard` or `story-maker:settings-imported`.
- Manual navigation remains allowed. If the user explicitly clicks Dashboard, Projects, Formula, or Settings during the batch, that newly selected tab becomes the protected tab.
- The protection ends when the batch completes, fails, or is cancelled; normal programmatic navigation then resumes.

## Channel Formula still generates visible chapter headings

- Symptom: a formula intended for YouTube audio narration emits labels such as `第一章`, `第1章`, `Chapter 1`, chapter titles, or Markdown headings.
- Cause: older Channel Formula policy normalization discarded unknown flow-format fields, while generation prompts still required visible chapter structure. Adding fields only to IndexedDB therefore did not affect Dashboard generation.
- Fix: Channel Formula policy now preserves `stripChapterHeaders` and `flowFormat`. When `stripChapterHeaders` is `true` or `flowFormat` is `continuous_audio_narration`, generation keeps the configured structural stages internally but explicitly forbids visible chapter labels.
- Dashboard randomization appends the same continuous-audio contract after the saved reproduction prompt, so a legacy prompt that mentions four chapters cannot override the no-heading rule.
- Required narration transition: connect internal stages through prose such as `翌日`, `二日後の説明会当日`, or `それから半年後`, rather than a heading.
- The direct Formula quality gate reports `chapter_headers` if a no-heading formula still returns a visible Japanese or English chapter label.

## Channel Formula JSON is very short or incomplete after folder analysis

- Symptom: folder analysis reports one or more errors but still produces a small formula JSON with empty `audienceGrowthSystem`, a generic three-line `reproductionPrompt`, or insufficient detail to reproduce the source channel.
- Previous cause: the runtime sampled only opening/middle/ending excerpts, accepted shallow per-file JSON, and saved a local fallback even when a source file or the final synthesis failed. An overloaded provider-call argument could also treat an options object as a fallback callback and raise `onFallback is not a function`.
- Fix: analysis contract v2 samples 12 chronological regions per transcript (up to 30,000 characters), requires a per-story blueprint and CTR/retention/comment systems, retries one invalid response, and fails closed if any selected TXT or the final synthesis still fails.
- A successful v2 formula stores 100% source coverage, validated quality metadata, and compact per-story blueprints for up to 50 selected TXT files. Story DNA Matrix generation receives the resulting production DNA instead of only the formula name.
- Old checkpoints have analysis version `0` or `1` and are deliberately not resumed. Select the folder and run analysis again; completed v2 checkpoints can then be resumed safely after an interruption.
- Do not save or unlock Matrix production from a fallback formula. The Matrix and batch controls remain unavailable until the selected dynamic formula has validated v2 analysis, complete source coverage, a detailed reproduction prompt, and the required audience-growth fields.

### Per-file analysis fails with `story_blueprint_incomplete`

- Symptom: a source file fails after retry even though the AI returned useful hook, escalation, reveal, payoff, and retention analysis.
- Cause: compatible models may return five story beats instead of six, or use equivalent keys such as `beats`, `storyBeats`, or `canonicalBeatMap` instead of `storyBlueprint.beatMap`.
- Fix: normalize supported beat-map aliases and complete the chronology from that same file's analyzed hook, midpoint, reveal, climax, and ending. This is not a generic formula fallback and does not copy raw source text.
- Guardrail: recovery does not hide missing core analysis. Missing opening hook, reveal pattern, three escalation beats, curiosity ladder, retention windows, or 30-second hook still fails the quality gate.
- Retry behavior: click folder analysis again. Completed checkpoints resume; only failed files are analyzed again.

## Story DNA Matrix AI returns invalid JSON

- Symptom: Matrix creation reports `Matrix response must be a JSON array`, or an older build saves rows supplemented by local fallback.
- Root cause for OpenAI-compatible providers: the request used `response_format: json_object` while the Matrix prompt required a top-level JSON array. The provider therefore returned an object that contradicted the parser contract.
- Additional compatibility issue: providers may return one card, keyed card objects, snake_case fields, prose/Markdown wrappers, or fewer cards than requested.
- Current behavior: Matrix creation is AI-only. There is no local fallback path and no incomplete Matrix is saved.
- The prompt and structured provider now agree on a top-level `{"rows":[...]}` JSON object. Bare arrays remain accepted for backward compatibility.
- AI requests are limited to five cards per batch. The parser accepts fenced/explanatory JSON, common wrappers, single-card objects, objects keyed by story ID, snake_case aliases, nested provider data, and message content.
- A partial valid response is preserved and the next AI call requests the remaining count. The call budget supports providers that return only one card per request.
- When a batch is invalid, the exact bounded response is sent back to AI with a strict `{"rows":[...]}` repair instruction. Each batch receives the initial request plus at most two repairs.
- If all repairs fail, the visible error includes a bounded response preview for diagnosis.
- If a batch still fails, the UI reports the batch/provider/parser reason and explicitly states that no Matrix was saved.
- Existing fallback-generated Matrix data is not rewritten automatically. Delete it before creating a new AI-only Matrix.

## Local OpenAI-compatible server

- Local Story Maker URLs (`localhost` or `127.0.0.1`) use `http://localhost:20128/v1/chat/completions`.
- The local model order is `cx/gpt-5.5`, `cx/gpt-5.4`, then `cx/gpt-5.4-mini`.
- The `cx/` prefix belongs to the local ledger server only. A different OpenAI-compatible base URL uses `gpt-5.5`, `gpt-5.4`, then `gpt-5.4-mini` without that prefix.
- The local server currently returns `404` for `/v1/responses`, so Responses mode is disabled locally.
- The official base URL keeps the official OpenAI request unchanged. A custom base URL uses Chat Completions only.
- API keys remain runtime input only. Never add them to source files or documentation.
- If local generation returns `404`, verify `http://localhost:20128/v1/models` and confirm the `cx/` model IDs are present.
- If a custom server fails, preserve the HTTP status and server message for every attempted model. Do not replace model-not-found, authentication, CORS, or quota errors with one generic API-key message.

### TTMAPI custom endpoint

- On August 29, 2026, `https://ttmapi.site/v1/chat/completions` returned a successful CORS preflight for origin `http://localhost:5199`, including `Authorization`, `Content-Type`, and `Access-Control-Allow-Origin: *`.
- Therefore a browser failure against this endpoint should first be checked for model namespace and authenticated HTTP response, not classified as CORS without evidence.
- Use `gpt-5.5` for this custom endpoint; do not send the local-only `cx/gpt-5.5` identifier.
- The editorial/commentary path calls `providerClients.js` directly, so it must use the same configured endpoint and model namespace as the normal story-generation path. If an error still lists `cx/gpt-5.5` while a custom URL is selected, the page is running an old bundle; restart the local server and hard-refresh the browser.

## Story Project batch stops after one story

- Symptom: batch history records `Tạo truyện quá thời gian chờ.` at exact watchdog intervals; only one story may be saved even though multiple stories were requested.
- Root cause: the Story Project bridge used a fixed 10-minute overall timeout. The existing generation pipeline can legitimately exceed that because generation, fallback, consistency review, and editorial steps run sequentially. After bridge timeout, the batch runner continued while `#btn-generate` was still disabled, so the next click was ignored and a later completion could be attributed to the wrong queue item.
- Fix: the bridge now uses a 30-minute inactivity watchdog, renewed by button, output, progress log, progress title, character counter, or alert changes. A watchdog timeout is fatal for the current batch, preventing another story from starting while the previous generation may still be active.
- Guardrail: never continue a Story Project batch after a bridge timeout unless the existing generation lifecycle has definitively returned idle.

## DNA Matrix batch button stays disabled after creating a Matrix

- Symptom: a Matrix is visible in the Matrix table, but `Tạo hàng loạt từ nhiều DNA Matrix` still shows no usable Matrix or keeps its start button disabled until a reload.
- Cause: the Matrix runtime refreshed only its own table after create/delete/row changes. The batch runtime had already loaded an empty list and received no change notification.
- Fix: Matrix changes now emit `story-maker:matrix-updated`; the batch runtime listens and reloads its Matrix list immediately while idle.

## Native dialog opens at the viewport origin after a CSS reset

- Symptom: `showModal()` works, but the dialog appears at `x=0`, `y=0` instead of centered.
- Cause: the global reset removes the browser's default `dialog { margin: auto; }` behavior.
- Fix: explicitly set `position: fixed; inset: 0; margin: auto;` on the scoped dialog and constrain its width and height with viewport gutters.
- Hidden-step guardrail: when dialog sections use `display:flex`, add an explicit `section[hidden] { display:none; }` rule so author CSS does not reveal every wizard step.
- Preserve native behavior: keep `<dialog>`, `showModal()`, Escape handling, focus trapping, and `::backdrop`; do not replace them with custom JavaScript positioning.

# Troubleshooting

## Local OpenAI-compatible server

- Local Story Maker URLs (`localhost` or `127.0.0.1`) use `http://localhost:20128/v1/chat/completions`.
- The local model order is `cx/gpt-5.5`, `cx/gpt-5.4`, then `cx/gpt-5.4-mini`.
- The local server currently returns `404` for `/v1/responses`, so Responses mode is disabled locally.
- Non-local builds keep `https://api.openai.com/v1` and the official OpenAI model list.
- API keys remain runtime input only. Never add them to source files or documentation.
- If local generation returns `404`, verify `http://localhost:20128/v1/models` and confirm the `cx/` model IDs are present.

## Story Project batch stops after one story

- Symptom: batch history records `Tạo truyện quá thời gian chờ.` at exact watchdog intervals; only one story may be saved even though multiple stories were requested.
- Root cause: the Story Project bridge used a fixed 10-minute overall timeout. The existing generation pipeline can legitimately exceed that because generation, fallback, consistency review, and editorial steps run sequentially. After bridge timeout, the batch runner continued while `#btn-generate` was still disabled, so the next click was ignored and a later completion could be attributed to the wrong queue item.
- Fix: the bridge now uses a 30-minute inactivity watchdog, renewed by button, output, progress log, progress title, character counter, or alert changes. A watchdog timeout is fatal for the current batch, preventing another story from starting while the previous generation may still be active.
- Guardrail: never continue a Story Project batch after a bridge timeout unless the existing generation lifecycle has definitively returned idle.

## Native dialog opens at the viewport origin after a CSS reset

- Symptom: `showModal()` works, but the dialog appears at `x=0`, `y=0` instead of centered.
- Cause: the global reset removes the browser's default `dialog { margin: auto; }` behavior.
- Fix: explicitly set `position: fixed; inset: 0; margin: auto;` on the scoped dialog and constrain its width and height with viewport gutters.
- Hidden-step guardrail: when dialog sections use `display:flex`, add an explicit `section[hidden] { display:none; }` rule so author CSS does not reveal every wizard step.
- Preserve native behavior: keep `<dialog>`, `showModal()`, Escape handling, focus trapping, and `::backdrop`; do not replace them with custom JavaScript positioning.

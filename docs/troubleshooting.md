# Troubleshooting

## Local OpenAI-compatible server

- Local Story Maker URLs (`localhost` or `127.0.0.1`) use `http://localhost:20128/v1/chat/completions`.
- The local model order is `cx/gpt-5.5`, `cx/gpt-5.4`, then `cx/gpt-5.4-mini`.
- The local server currently returns `404` for `/v1/responses`, so Responses mode is disabled locally.
- Non-local builds keep `https://api.openai.com/v1` and the official OpenAI model list.
- API keys remain runtime input only. Never add them to source files or documentation.
- If local generation returns `404`, verify `http://localhost:20128/v1/models` and confirm the `cx/` model IDs are present.

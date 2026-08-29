# TTMAPI compatibility test

This folder is an independent test harness. It does not import, modify, or
replace any Story Maker runtime code.

The script checks the OpenAI-compatible endpoints used by Story Maker:

1. `GET /models`
2. `POST /chat/completions` without streaming
3. `POST /chat/completions` with an SSE stream
4. A complete Japanese YouTube-drama story generation

It also checks whether `/models` exposes at least one model ID currently used
by Story Maker's local runtime:

- `cx/gpt-5.5`
- `cx/gpt-5.4`
- `cx/gpt-5.4-mini`

This model-ID check matters when evaluating whether the server can replace the
current local server without changing Story Maker source code.

## Run

Open PowerShell in the Story Maker repository and run:

```powershell
.\external-tests\ttmapi\test-ttmapi.ps1
```

The API key prompt is hidden. The key is not written to the report or story
file.

You may also set the key only for the current PowerShell process:

```powershell
$env:TTMAPI_API_KEY = Read-Host "TTMAPI API key" -AsSecureString |
    ForEach-Object {
        $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)
        try {
            [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)
        }
    }
.\external-tests\ttmapi\test-ttmapi.ps1
Remove-Item Env:TTMAPI_API_KEY
```

To force a model or change the story test length:

```powershell
.\external-tests\ttmapi\test-ttmapi.ps1 `
    -Model "MODEL_ID_FROM_TTMAPI" `
    -StoryTargetCharacters 5000
```

By default, results are saved under:

```text
%TEMP%\story-maker-ttmapi-YYYYMMDD-HHMMSS\
```

The generated files are:

- `report.json`: endpoint status, selected model, latency, character counts,
  SSE event count, and completion checks.
- `story.txt`: generated story text.

Neither file contains the API key or request authorization headers.

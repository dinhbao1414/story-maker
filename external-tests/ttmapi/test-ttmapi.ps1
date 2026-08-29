[CmdletBinding()]
param(
    [string]$BaseUrl = "https://ttmapi.site/v1",
    [string]$Model = "",
    [ValidateRange(500, 20000)]
    [int]$StoryTargetCharacters = 3000,
    [ValidateRange(30, 1800)]
    [int]$TimeoutSeconds = 300,
    [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Net.Http

function ConvertFrom-SecureStringToPlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Get-ApiKey {
    if (-not [string]::IsNullOrWhiteSpace($env:TTMAPI_API_KEY)) {
        return $env:TTMAPI_API_KEY.Trim()
    }

    $secureKey = Read-Host "TTMAPI API key (hidden)" -AsSecureString
    $plainKey = ConvertFrom-SecureStringToPlainText -SecureValue $secureKey
    if ([string]::IsNullOrWhiteSpace($plainKey)) {
        throw "No API key was provided."
    }
    return $plainKey.Trim()
}

function Get-ErrorText {
    param(
        [int]$StatusCode,
        [string]$Body
    )

    $cleanBody = if ($null -eq $Body) { "" } else { $Body.Trim() }
    if ($cleanBody.Length -gt 600) {
        $cleanBody = $cleanBody.Substring(0, 600) + "..."
    }
    return "HTTP $StatusCode. $cleanBody".Trim()
}

function Invoke-JsonHttpRequest {
    param(
        [Parameter(Mandatory = $true)][Net.Http.HttpClient]$Client,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [AllowNull()][object]$Body,
        [Parameter(Mandatory = $true)][int]$RequestTimeoutSeconds
    )

    $request = [Net.Http.HttpRequestMessage]::new(
        [Net.Http.HttpMethod]::new($Method),
        $Uri
    )
    $cancellation = [Threading.CancellationTokenSource]::new(
        [TimeSpan]::FromSeconds($RequestTimeoutSeconds)
    )
    $stopwatch = [Diagnostics.Stopwatch]::StartNew()

    try {
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 20 -Compress
            $request.Content = [Net.Http.StringContent]::new(
                $json,
                [Text.Encoding]::UTF8,
                "application/json"
            )
        }

        $response = $Client.SendAsync(
            $request,
            [Net.Http.HttpCompletionOption]::ResponseContentRead,
            $cancellation.Token
        ).GetAwaiter().GetResult()
        $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $stopwatch.Stop()

        if (-not $response.IsSuccessStatusCode) {
            throw (Get-ErrorText -StatusCode ([int]$response.StatusCode) -Body $responseBody)
        }

        $parsed = $null
        if (-not [string]::IsNullOrWhiteSpace($responseBody)) {
            $parsed = $responseBody | ConvertFrom-Json
        }

        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            LatencyMs  = $stopwatch.ElapsedMilliseconds
            Body       = $responseBody
            Json       = $parsed
        }
    }
    finally {
        $stopwatch.Stop()
        $cancellation.Dispose()
        $request.Dispose()
    }
}

function Invoke-StreamingChatTest {
    param(
        [Parameter(Mandatory = $true)][Net.Http.HttpClient]$Client,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$SelectedModel,
        [Parameter(Mandatory = $true)][int]$RequestTimeoutSeconds
    )

    $payload = @{
        model       = $SelectedModel
        stream      = $true
        temperature = 0
        max_tokens  = 80
        messages    = @(
            @{
                role    = "user"
                content = "Reply with exactly TTMAPI_STREAM_OK and no other text."
            }
        )
    }
    $request = [Net.Http.HttpRequestMessage]::new(
        [Net.Http.HttpMethod]::Post,
        $Uri
    )
    $request.Content = [Net.Http.StringContent]::new(
        ($payload | ConvertTo-Json -Depth 20 -Compress),
        [Text.Encoding]::UTF8,
        "application/json"
    )
    $cancellation = [Threading.CancellationTokenSource]::new(
        [TimeSpan]::FromSeconds($RequestTimeoutSeconds)
    )
    $stopwatch = [Diagnostics.Stopwatch]::StartNew()
    $reader = $null
    $response = $null

    try {
        $response = $Client.SendAsync(
            $request,
            [Net.Http.HttpCompletionOption]::ResponseHeadersRead,
            $cancellation.Token
        ).GetAwaiter().GetResult()

        if (-not $response.IsSuccessStatusCode) {
            $errorBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            throw (Get-ErrorText -StatusCode ([int]$response.StatusCode) -Body $errorBody)
        }

        $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8)
        $textBuilder = [Text.StringBuilder]::new()
        $eventCount = 0
        $sawDone = $false

        while (-not $reader.EndOfStream) {
            $lineTask = $reader.ReadLineAsync()
            if (-not $lineTask.Wait(
                [TimeSpan]::FromSeconds($RequestTimeoutSeconds)
            )) {
                throw "Timed out while waiting for an SSE event."
            }

            $line = $lineTask.Result
            if ([string]::IsNullOrWhiteSpace($line) -or
                -not $line.StartsWith("data:", [StringComparison]::OrdinalIgnoreCase)) {
                continue
            }

            $data = $line.Substring(5).Trim()
            if ($data -eq "[DONE]") {
                $sawDone = $true
                break
            }
            if ([string]::IsNullOrWhiteSpace($data)) {
                continue
            }

            try {
                $event = $data | ConvertFrom-Json
                $eventCount++
                if ($null -ne $event.choices -and $event.choices.Count -gt 0) {
                    $delta = $event.choices[0].delta
                    if ($null -ne $delta -and
                        $delta.PSObject.Properties.Name -contains "content" -and
                        $null -ne $delta.content) {
                        [void]$textBuilder.Append([string]$delta.content)
                    }
                }
            }
            catch {
                throw "The streaming endpoint returned invalid SSE JSON: $($_.Exception.Message)"
            }
        }

        $stopwatch.Stop()
        $text = $textBuilder.ToString()
        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            LatencyMs  = $stopwatch.ElapsedMilliseconds
            Text       = $text
            Characters = $text.Length
            EventCount = $eventCount
            SawDone    = $sawDone
            MarkerOk   = $text.Trim() -eq "TTMAPI_STREAM_OK"
        }
    }
    finally {
        $stopwatch.Stop()
        if ($null -ne $reader) {
            $reader.Dispose()
        }
        if ($null -ne $response) {
            $response.Dispose()
        }
        $cancellation.Dispose()
        $request.Dispose()
    }
}

function Get-ChatContent {
    param([Parameter(Mandatory = $true)][object]$ResponseJson)

    if ($null -eq $ResponseJson.choices -or $ResponseJson.choices.Count -eq 0) {
        throw "The response does not contain choices[0]."
    }
    $message = $ResponseJson.choices[0].message
    if ($null -eq $message -or
        -not ($message.PSObject.Properties.Name -contains "content") -or
        $null -eq $message.content) {
        throw "The response does not contain choices[0].message.content."
    }
    return [string]$message.content
}

function Select-ChatModel {
    param(
        [string[]]$ModelIds,
        [string]$RequestedModel,
        [string[]]$StoryMakerModelIds
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedModel)) {
        return $RequestedModel.Trim()
    }
    if ($null -eq $ModelIds -or $ModelIds.Count -eq 0) {
        throw "GET /models returned no model IDs. Run again with -Model <model-id>."
    }

    foreach ($expectedModel in $StoryMakerModelIds) {
        $exactMatch = $ModelIds | Where-Object {
            $_ -eq $expectedModel
        } | Select-Object -First 1
        if ($null -ne $exactMatch) {
            return [string]$exactMatch
        }
    }

    $excluded = "embed|rerank|whisper|audio|speech|tts|image|dall|moderation|transcri"
    $chatCandidates = @($ModelIds | Where-Object { $_ -notmatch $excluded })
    if ($chatCandidates.Count -eq 0) {
        $chatCandidates = @($ModelIds)
    }

    $preferredPatterns = @(
        "^gpt-5",
        "^gpt-4\.1",
        "^gpt-4o",
        "^claude",
        "^gemini",
        "^deepseek",
        "^qwen"
    )
    foreach ($pattern in $preferredPatterns) {
        $match = $chatCandidates | Where-Object { $_ -match $pattern } |
            Select-Object -First 1
        if ($null -ne $match) {
            return [string]$match
        }
    }
    return [string]$chatCandidates[0]
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$modelsUri = "$normalizedBaseUrl/models"
$chatUri = "$normalizedBaseUrl/chat/completions"
$storyMakerModelIds = @(
    "cx/gpt-5.5",
    "cx/gpt-5.4",
    "cx/gpt-5.4-mini"
)

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $runStamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputDirectory = Join-Path $env:TEMP "story-maker-ttmapi-$runStamp"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
[void][IO.Directory]::CreateDirectory($OutputDirectory)

$reportPath = Join-Path $OutputDirectory "report.json"
$storyPath = Join-Path $OutputDirectory "story.txt"
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$apiKey = $null
$client = $null
$report = [ordered]@{
    tested_at                    = (Get-Date).ToString("o")
    base_url                     = $normalizedBaseUrl
    selected_model               = $null
    story_maker_model_compatibility = $null
    models                       = $null
    non_stream_chat_completion   = $null
    stream_chat_completion       = $null
    story_generation             = $null
    overall_ok                   = $false
}

try {
    $apiKey = Get-ApiKey
    $handler = [Net.Http.HttpClientHandler]::new()
    $client = [Net.Http.HttpClient]::new($handler)
    $client.DefaultRequestHeaders.Authorization =
        [Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $apiKey)
    $client.DefaultRequestHeaders.Accept.Add(
        [Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new("application/json")
    )

    Write-Host "[1/4] GET /models"
    $modelsResponse = Invoke-JsonHttpRequest `
        -Client $client `
        -Method "GET" `
        -Uri $modelsUri `
        -Body $null `
        -RequestTimeoutSeconds $TimeoutSeconds

    $modelIds = @()
    if ($null -ne $modelsResponse.Json -and
        $modelsResponse.Json.PSObject.Properties.Name -contains "data") {
        $modelIds = @(
            $modelsResponse.Json.data |
                ForEach-Object {
                    if ($_.PSObject.Properties.Name -contains "id") {
                        [string]$_.id
                    }
                } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )
    }
    $report.models = [ordered]@{
        ok          = $true
        status_code = $modelsResponse.StatusCode
        latency_ms  = $modelsResponse.LatencyMs
        model_count = $modelIds.Count
    }
    $availableStoryMakerModels = @(
        $storyMakerModelIds | Where-Object { $modelIds -contains $_ }
    )
    $report.story_maker_model_compatibility = [ordered]@{
        compatible                = $availableStoryMakerModels.Count -gt 0
        expected_model_ids        = $storyMakerModelIds
        available_expected_models = $availableStoryMakerModels
    }

    $selectedModel = Select-ChatModel `
        -ModelIds $modelIds `
        -RequestedModel $Model `
        -StoryMakerModelIds $storyMakerModelIds
    $report.selected_model = $selectedModel
    Write-Host "      Selected model: $selectedModel"

    Write-Host "[2/4] POST /chat/completions (non-stream)"
    $nonStreamPayload = @{
        model       = $selectedModel
        stream      = $false
        temperature = 0
        max_tokens  = 80
        messages    = @(
            @{
                role    = "user"
                content = "Reply with exactly TTMAPI_NON_STREAM_OK and no other text."
            }
        )
    }
    $nonStreamResponse = Invoke-JsonHttpRequest `
        -Client $client `
        -Method "POST" `
        -Uri $chatUri `
        -Body $nonStreamPayload `
        -RequestTimeoutSeconds $TimeoutSeconds
    $nonStreamText = Get-ChatContent -ResponseJson $nonStreamResponse.Json
    $nonStreamMarkerOk = $nonStreamText.Trim() -eq "TTMAPI_NON_STREAM_OK"
    $report.non_stream_chat_completion = [ordered]@{
        ok          = $nonStreamMarkerOk
        status_code = $nonStreamResponse.StatusCode
        latency_ms  = $nonStreamResponse.LatencyMs
        characters  = $nonStreamText.Length
        marker_ok   = $nonStreamMarkerOk
    }

    Write-Host "[3/4] POST /chat/completions (SSE stream)"
    $streamResult = Invoke-StreamingChatTest `
        -Client $client `
        -Uri $chatUri `
        -SelectedModel $selectedModel `
        -RequestTimeoutSeconds $TimeoutSeconds
    $report.stream_chat_completion = [ordered]@{
        ok          = ($streamResult.MarkerOk -and $streamResult.EventCount -gt 0)
        status_code = $streamResult.StatusCode
        latency_ms  = $streamResult.LatencyMs
        characters  = $streamResult.Characters
        event_count = $streamResult.EventCount
        saw_done    = $streamResult.SawDone
        marker_ok   = $streamResult.MarkerOk
    }

    Write-Host "[4/4] Generate a complete Japanese story"
    $storyMaxTokens = [Math]::Min(
        16000,
        [Math]::Max(2000, [int][Math]::Ceiling($StoryTargetCharacters * 1.8))
    )
    $storyPayload = @{
        model       = $selectedModel
        stream      = $false
        temperature = 0.85
        max_tokens  = $storyMaxTokens
        messages    = @(
            @{
                role    = "system"
                content = @"
You are a professional writer of Japanese-language drama stories for YouTube.
Write the entire story in natural Japanese. Start with a strong first-30-second
hook. Each answered question must create a larger question. Include family
conflict, evidence, a midpoint reversal, satisfying consequences, and an
ethical aftertaste that invites comments. Output only the story. The final
line must be exactly [[TTMAPI_STORY_COMPLETE]].
"@
            }
            @{
                role    = "user"
                content = @"
Create one completely original story without borrowing names or plots from
existing works. Target approximately $StoryTargetCharacters Japanese
characters. Do not switch to a summary or bullet points. Finish the full story.
"@
            }
        )
    }
    $storyResponse = Invoke-JsonHttpRequest `
        -Client $client `
        -Method "POST" `
        -Uri $chatUri `
        -Body $storyPayload `
        -RequestTimeoutSeconds $TimeoutSeconds
    $storyText = Get-ChatContent -ResponseJson $storyResponse.Json
    $completionMarkerOk = $storyText.TrimEnd().EndsWith(
        "[[TTMAPI_STORY_COMPLETE]]"
    )
    [IO.File]::WriteAllText($storyPath, $storyText, $utf8NoBom)
    $report.story_generation = [ordered]@{
        ok                   = ($storyText.Length -gt 0 -and $completionMarkerOk)
        status_code          = $storyResponse.StatusCode
        latency_ms           = $storyResponse.LatencyMs
        target_characters    = $StoryTargetCharacters
        response_characters  = $storyText.Length
        completion_marker_ok = $completionMarkerOk
        story_path           = $storyPath
    }

    $report.overall_ok = (
        $report.models.ok -and
        $report.story_maker_model_compatibility.compatible -and
        $report.non_stream_chat_completion.ok -and
        $report.stream_chat_completion.ok -and
        $report.story_generation.ok
    )
}
catch {
    $report.overall_ok = $false
    $report.error = $_.Exception.Message
    Write-Error $_.Exception.Message
}
finally {
    [IO.File]::WriteAllText(
        $reportPath,
        ($report | ConvertTo-Json -Depth 20),
        $utf8NoBom
    )
    if ($null -ne $client) {
        $client.Dispose()
    }
    $apiKey = $null
    Remove-Variable apiKey -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "Report: $reportPath"
    if (Test-Path -LiteralPath $storyPath) {
        Write-Host "Story:  $storyPath"
    }
}

if (-not $report.overall_ok) {
    exit 1
}

Write-Host ""
Write-Host "All TTMAPI compatibility tests passed."
exit 0

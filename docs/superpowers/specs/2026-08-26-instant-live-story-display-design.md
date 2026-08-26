# Instant Live Story Display Design

Date: 2026-08-26

## Goal

Display all story text received from the AI immediately and keep the character counter synchronized with that received text, without a synthetic typewriter delay.

## Current Problem

Standard story generation stores the latest sanitized stream in `liveTarget`, but copies it gradually into `liveDisplayed` with a 35 ms interval. The counter uses `liveDisplayed`, so background-tab timer throttling makes both the visible text and count lag behind the actual response.

## Approved Behavior

- Remove the 35 ms typewriter pacing timer from standard story generation.
- On every non-thought stream update, sanitize and clean the latest accumulated story exactly as before.
- Write the complete latest cleaned text to the output immediately.
- Calculate the displayed character count from that same latest text.
- Keep the existing cursor, scrolling, output cleanup, continuation, contradiction audit, quality gates and final formatting.
- Do not change the separate chapter-based legacy long-novel pipeline.

## Boundary Behavior

- Empty or thought-only chunks remain hidden.
- If a later sanitized response no longer shares the earlier prefix, replace the preview with the corrected latest response.
- When generation finishes while the browser tab is in the background, returning to the tab shows the latest DOM state rather than replaying a queued typewriter animation.
- Browser background policies may batch network callbacks, but the app does not add any additional display delay.

## Test Coverage

- The standard live-generation source no longer schedules the 35 ms preview-render interval.
- The live preview writes the complete cleaned target rather than a partial `liveDisplayed` prefix.
- The character counter uses the complete cleaned target.
- Existing standard live sanitization and progress tests continue to pass.

## Scope

Only the standard live preview rendering behavior and focused regression coverage change. No API, story-generation prompt, Matrix lifecycle, storage schema, UI layout, deploy or version change is included.

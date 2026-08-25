# Story DNA Random Selection Design

Date: 2026-08-25

## Goal

Make `AI Random mô típ & điền thiết lập` actually choose different eligible Story DNA Matrix concepts across repeated clicks, without consuming a Matrix row before a story is successfully generated.

## Current Problem

The Matrix selector evaluates eligible rows, sorts them by similarity score and row ID, then always returns the first row. A selected row remains `planned` until a generated story passes the existing quality gate. Repeated Random clicks before generation therefore select the same row and refill the Dashboard with the same concept.

## Approved Behavior

- Eligible rows remain limited to `planned`, unlocked rows that do not receive a `reject` novelty decision.
- Selection is uniform random across the eligible rows.
- The most recently selected row is remembered separately for each Matrix during the current browser session.
- When at least two eligible rows exist, the immediately previous row is excluded from the next draw.
- When only one eligible row remains, it may be selected again.
- Selecting or previewing a row does not persist a new status and does not mark the row `used`.
- The existing generation bridge remains the only path that marks a row `used`, after a completed story passes the current quality gate.
- AI and local fallback behavior used when no Matrix row is available remains unchanged.

## Data Flow

1. The Formula runtime loads the selected Matrix.
2. It passes the Matrix rows, an injectable random function and the last row ID for that Matrix to the selector.
3. The selector filters invalid rows and evaluates novelty exactly as before.
4. If multiple eligible rows exist, it removes the immediately previous row from the draw pool.
5. It chooses one row using the injected random function.
6. The Formula runtime stores the selected row ID in an in-memory map keyed by Matrix ID.
7. The selected DNA is applied to Dashboard settings.
8. Only successful story generation persists `used`.

## Error and Boundary Handling

- No eligible row: retain the existing fallback motif path.
- One eligible row: return it even when it is the previous row.
- Invalid random values: clamp selection to the available pool.
- Switching Matrix: each Matrix maintains its own last selected row ID.
- Reloading the page: the in-memory anti-repeat history resets; Matrix lifecycle data remains unchanged.

## Test Coverage

- Injected random values can select different eligible rows.
- Two consecutive selections avoid the immediately previous row.
- `used`, `skipped`, locked and novelty-rejected rows are never selected.
- A single eligible row remains selectable.
- Repeated Random clicks do not change the selected row to `used`.
- Existing Matrix metadata continues to reach Dashboard settings.

## Scope

Only the Story DNA row-selection helper, Formula Random runtime wiring and their focused tests are changed. No UI redesign, Matrix schema change, persistence migration, API change, deploy or version bump is included.

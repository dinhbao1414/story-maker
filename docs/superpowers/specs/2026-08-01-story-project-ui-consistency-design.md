# Story Project UI Consistency Design

**Date:** 2026-08-01

## Goal

Center the native Create Project dialog and make the entire `Dự án Story` workspace visually consistent with Story Maker's existing dark-purple interface without changing project, storage, analysis, or generation behavior.

## Verified Problem

- Browser measurement while the Projects tab is active: dialog `x=0`, `y=0`, `margin=0`, `padding=0`, fixed at the viewport origin.
- The global CSS reset removes the browser's default dialog centering margin.
- Dialog header/footer remain unstyled block elements; no isolating backdrop is defined.
- Summary blocks, toolbar controls, cards, statuses, actions, and detail sections have only structural CSS, producing inconsistent spacing, hierarchy, and control sizing.
- Global `.btn-generate { width:100% }` makes primary actions dominate Card layouts unless scoped overrides are added.

## Scope

### Modify

- `src/style.css`
- `tests/storyProjectRuntime.test.js`
- `HANDOFF.md`
- `docs/troubleshooting.md` only if a reusable CSS-reset/modal rule is discovered during implementation.

### Preserve

- All markup IDs and `data-*` actions.
- `src/storyProjectRuntime.js` behavior and event delegation.
- IndexedDB repository and saved data.
- Style analysis and settings snapshot logic.
- Existing `#btn-generate` generation path.
- API routing, retry, timeout, output formatting, and version.

## Visual Design

### Create Project Dialog

- Use fixed viewport positioning with `inset:0` and explicit `margin:auto`.
- Width: up to approximately 720px with 16px viewport gutters.
- Height: content-driven, capped to the viewport; internal form scrolls when needed.
- Add a 40–60% dark scrim and subtle backdrop blur.
- Use existing `--surface`, `--surface2`, `--border`, `--accent`, and text tokens.
- Header: title left, 44px close target right, bottom divider.
- Body: 24px desktop padding, 16px mobile padding, consistent labels and form fields.
- Footer: right-aligned Back/Next/Create actions with top divider; buttons do not stretch unexpectedly.
- Radio source choices render as selectable surface rows.
- Keep native `<dialog>` semantics, focus behavior, Escape handling, and `showModal()` logic.

### Projects Dashboard

- Center content inside a readable maximum width while retaining full panel scrolling.
- Give header title, supporting text, and actions a clear hierarchy.
- Style summary metrics as four matching surface cards.
- Style search/filter/sort as one toolbar surface with consistent labels and controls.
- Use an auto-fit Card Grid with approximately 320px minimum Card width.
- Cards use consistent border, radius, padding, vertical rhythm, status badge, progress bar, metadata, and action row.
- Scope Card primary buttons so they share row space instead of forcing full width.
- Empty state uses the same surface/border system.
- Detail sections, story rows, preview textarea, and history share the same surface hierarchy.

### Responsive Behavior

- Desktop: centered dialog; auto-fit grid; horizontal toolbar/action groups.
- Tablet: two-column summary/grid where space allows; wrapping actions.
- Mobile: one-column layout, stacked toolbar, full-width safe actions, 16px modal gutters.
- Preserve visible focus outlines and 44px minimum interactive targets.
- Disable decorative transitions under `prefers-reduced-motion`.

## Acceptance Criteria

- Open dialog bounding box is horizontally and vertically centered within a small tolerance.
- Dialog has non-zero padding through its header/body/footer structure and a visible backdrop.
- Dialog never touches viewport edges at 1920×1080, 764×485, or mobile widths.
- Projects summary, toolbar, Cards, empty state, detail sections, and story rows use consistent token-based surfaces and spacing.
- Card action buttons remain readable without one primary button consuming the entire row.
- Existing create/edit/delete/generate/import/export interactions remain unchanged.
- Focus, keyboard navigation, reduced motion, and responsive behavior remain intact.
- Focused tests, full Node suite, static guards, production build, HTTP check, and Chrome computed-style/browser screenshots pass.

## Non-Goals

- No Story Project workflow changes.
- No new icons, dependencies, themes, animations, charts, or navigation.
- No redesign of Dashboard, Settings, progress window, or generation output.
- No deploy, release, version bump, or API usage.

# B-011: Concurrency setting accepts invalid values

- **Status:** Done
- **Priority:** Medium
- **Category:** Bug
- **Branch:** `bugfix/concurrency-input-validation`

## Source

- `src/renderer/pages/SettingsPage.tsx:125-133` — `Number(event.target.value)` yields NaN for empty input
- `src/renderer/pages/SettingsPage.tsx:50` — value sent to `updateSettings` verbatim
- Related main-process hardening: B-003

## Problem

Clearing the input produces NaN; HTML min/max constraints are not enforced in code. Values like `0` or above the max are sent to the backend unvalidated.

## Fix

- Parse with a guard (empty → keep previous or default), clamp to `[1, maxConcurrencyLimit]` before saving.
- Show inline validation feedback instead of silently clamping, if feasible.

## Acceptance Criteria

- [ ] Empty input never produces NaN.
- [ ] Out-of-range values are clamped or rejected with visible feedback.
- [ ] Renderer test covering empty/zero/oversized inputs.

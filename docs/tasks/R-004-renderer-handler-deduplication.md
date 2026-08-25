# R-004: Collapse duplicated action handlers and alert markup

- **Status:** Open
- **Priority:** Low
- **Category:** Refactoring
- **Branch:** `refactor/renderer-handler-deduplication`

## Source

- `src/renderer/pages/DownloadsPage.tsx:97-198` — eight near-identical handlers without try/catch
- `src/renderer/pages/DownloadsPage.tsx:223-269`, `SettingsPage.tsx:67-76`, `HistorySection.tsx:33-42` — repeated alert markup

## Problem

Eight handlers follow "call api, set error if !ok" with ~90 lines of duplication and inconsistent exception handling (no try/catch, unlike HomePage/SettingsPage). The `<div className="alert" role="alert">` block is repeated 5+ times. The header/"Clear history" logic is duplicated across empty/non-empty branches.

## Approach

- Add a `runAction(promise)` helper wrapping IPC calls with unified error handling (result check + try/catch).
- Extract an `ErrorAlert` component and a `PageHeader`.
- Deduplicate the empty vs non-empty page branches.

## Acceptance Criteria

- [ ] All async handlers consistently catch exceptions and surface errors.
- [ ] Single alert component used everywhere.
- [ ] No behavior change; renderer tests pass.

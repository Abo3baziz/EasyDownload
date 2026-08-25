# B-016: Renderer downloads state never reconciles

- **Status:** Open
- **Priority:** Medium
- **Category:** Bug / State consistency
- **Branch:** `bugfix/downloads-state-reconciliation`

## Source

- `src/renderer/hooks/useDownloads.ts:19,22-24,36-37` — `deletedIds` grows forever; re-emitted events swallowed
- `src/renderer/pages/DownloadsPage.tsx:68-74` — initial `listConversions()` merged instead of replaced

## Problem

1. IDs added to `deletedIds` are never cleared for the hook's lifetime. Any re-emitted state event for a previously deleted id (e.g., retry recreating a record) is silently swallowed forever.
2. The initial conversions fetch merges into existing state rather than replacing it, so server-side removed conversions linger until "Clear history".

## Fix

- Remove an id from `deletedIds` when a live matching state event arrives, or scope the set to the initial-load window like `historyState.tsx`.
- Replace conversion state on load; keep merge semantics only for live events.

Note: coordinate with B-007 and R-003 — all three touch downloads state ownership.

## Acceptance Criteria

- [ ] A retried/recreated download id is no longer suppressed by stale tombstones.
- [ ] Server-deleted conversions disappear on next load.
- [ ] Renderer tests for both scenarios.

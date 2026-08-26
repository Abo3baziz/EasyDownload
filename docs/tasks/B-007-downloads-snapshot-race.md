# B-007: Downloads snapshot overwrite race in renderer

- **Status:** Done
- **Priority:** Medium
- **Category:** Bug
- **Branch:** `refactor/download-state-provider`

## Source

- `src/renderer/hooks/useDownloads.ts:21-46` — `listDownloads()` replaces state after events applied
- Reference (correct pattern): `src/renderer/state/historyState.tsx:30-60` — pending-event buffer during initial load

## Problem

Live events are applied functionally to state, but when `listDownloads()` resolves it *replaces* the array. An event that arrives after the main process took its snapshot but before the invoke response lands is applied first, then wiped by the older snapshot — the download appears stale or invisible until the next event.

Each consumer of `useDownloads` (Sidebar, DownloadsPage) has this race independently.

## Fix

- Buffer live events received before the initial fetch resolves, then apply them on top of the snapshot (same approach as `historyState`).
- Or merge fetched results by id instead of replacing.

Note: R-003 (shared DownloadStateProvider) would fix this once for all consumers; coordinate or fold into that task if scheduled together.

## Acceptance Criteria

- [ ] Events arriving during initial load are not lost.
- [ ] Regression test simulating event-before-response ordering.
- [ ] `npm run test:renderer` passes.

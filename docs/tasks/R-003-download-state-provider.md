# R-003: Create shared DownloadStateProvider for renderer

- **Status:** Done
- **Priority:** Medium
- **Category:** Refactoring / Performance
- **Branch:** `refactor/download-state-provider`

## Source

- `src/renderer/hooks/useDownloads.ts:12-71`
- `src/renderer/components/Sidebar.tsx:44,46-51` — independent subscription + fetch
- `src/renderer/pages/DownloadsPage.tsx:57` — another independent copy
- Pattern to follow: `src/renderer/state/historyState.tsx`, `homeState.tsx`

## Problem

History and Home inspection state have dedicated context providers; downloads do not. Each consumer keeps its own array copy and its own subscription, duplicating fetches and risking divergence (B-007 race exists per consumer). The Sidebar re-renders on every progress tick just to compute badge counts.

## Approach

- Create a `DownloadStateProvider` mirroring the existing provider pattern, including the pending-event buffer from B-007's fix.
- Migrate DownloadsPage and Sidebar onto it.
- Derive badge counts via selectors so progress ticks don't re-render the sidebar.

## Acceptance Criteria

- [ ] One owner of downloads data in the renderer.
- [ ] Sidebar no longer re-renders on pure progress updates (verify with render-count test).
- [ ] B-007 regression test included here or already landed.

## Dependencies

- Best done with/after B-007 and B-016.

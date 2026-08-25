# B-015: Relative timestamps never refresh

- **Status:** Open
- **Priority:** Low
- **Category:** Bug / UX
- **Branch:** `bugfix/relative-time-refresh`

## Source

- `src/renderer/utils/history.ts:19-30` — `formatEntryTime` defaults `now` to render-time
- `src/renderer/components/HistorySection.tsx:91` — consumer with no timer

## Problem

"Just now" / "N min ago" labels are computed at render time and never refresh, so they stay frozen until an unrelated re-render happens.

## Fix

- Add a low-frequency tick (30–60 s) in the components displaying relative times (a small `useRelativeTimeTick` hook or a shared clock context).

## Acceptance Criteria

- [ ] Relative timestamps update automatically without user interaction.
- [ ] No visible flicker or excessive re-renders.

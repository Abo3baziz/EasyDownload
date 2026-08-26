# E-007: Accessibility improvements

- **Status:** Open
- **Priority:** Low
- **Category:** Enhancement / A11y
- **Branch:** `feature/accessibility`

## Source

- `src/renderer/pages/DownloadsPage.tsx:569-582` — progress track/fill are plain divs
- `src/renderer/components/StatusBadge.tsx:4` — raw enum text (`status-downloading`)
- `src/renderer/pages/HomePage.tsx:70` — "Download started" notice with no navigation affordance
- `src/renderer/components/HistorySection.tsx:103-111` — single-click permanent delete, no confirm/undo
- `src/renderer/state/homeState.tsx:39,64-66` — unbounded inspections cache (memory hygiene)

## Problem

Several UX/a11y gaps:

1. Progress bars lack `role="progressbar"` + `aria-valuenow/min/max` and labels.
2. Status badges show raw enum strings instead of human-friendly labels.
3. The "Download started" notice tells users to check the Downloads page but provides no link/button.
4. History delete is one click, permanent, optimistic — needs confirm step or undo toast (restore-on-failure path already exists).
5. Inspections cache grows unbounded for the session; add an LRU cap.

## Acceptance Criteria

- [ ] Progress bars expose proper ARIA semantics with item titles as labels.
- [ ] Status badges display friendly labels.
- [ ] Notice includes navigation to Downloads page via existing `setSection`.
- [ ] Delete has confirm or undo; accidental loss prevented.
- [ ] Inspections cache capped.

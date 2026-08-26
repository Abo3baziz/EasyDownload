# B-013: Double-click starts duplicate conversions

- **Status:** Done
- **Priority:** Medium
- **Category:** Bug / UX
- **Branch:** `bugfix/duplicate-conversion-guard`

## Source

- `src/renderer/pages/DownloadsPage.tsx:152-167` — `handleStartConversion`
- `src/renderer/components/ConversionControl.tsx:77-83` — no disabled/in-flight state

## Problem

No in-flight guard or disabled state, so rapid clicks fire multiple `startConversion` IPC calls for the same source file. HomePage guards duplicates via `markDownloading`; this path has no equivalent.

## Fix

- Track in-flight conversion keys (per source file) in component state; disable the control while pending.
- Consider a main-process guard as defense-in-depth once E-002 (conversion queue) lands.

## Acceptance Criteria

- [ ] Double-click produces exactly one conversion per source file.
- [ ] Renderer test verifying duplicate suppression.

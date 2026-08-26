# R-005: Remove dead code

- **Status:** Done
- **Priority:** Low
- **Category:** Refactoring
- **Branch:** `refactor/remove-dead-code`

## Source

- `src/main/services/process/process-manager.ts:77-87` — `spawnProcess` unused in production
- `src/main/services/ffmpeg/ffmpeg-service.ts:51,84-100` — `FfmpegService.merge` used only by tests (merging delegated to yt-dlp)
- `src/main/services/filesystem/file-manager.ts:10,21-24` — `isPathInside` unused (until B-001 wires it up)

## Problem

Dead code adds maintenance surface and misleads readers about actual capabilities.

## Approach

- Wire up `isPathInside` via B-001, then remove it from this task's scope.
- Remove `spawnProcess` and `FfmpegService.merge` along with their tests, unless a near-term feature needs them.

## Acceptance Criteria

- [ ] No unused exports remain in the listed files.
- [ ] Typecheck and all tests pass.

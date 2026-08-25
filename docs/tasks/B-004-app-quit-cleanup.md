# B-004: No child-process/history cleanup on app quit

- **Status:** Done
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/app-quit-cleanup`

## Source

- `src/main/index.ts` — no `before-quit`/`will-quit` handler anywhere
- `src/main/services/process/process-manager.ts:82,135` — direct-child-only kill

## Problem

On quit, running yt-dlp/ffmpeg children are never killed and terminal-state history changes may never be flushed. Child processes (especially ffmpeg spawned by yt-dlp during merge) can outlive the app as orphans, since `child.kill()` only kills the direct process.

Related: E-005 covers process-tree kill hardening; this task wires the quit lifecycle.

## Fix (Implemented)

- Added `shutdown()` to `DownloadManager`: cancels all queued and active downloads, awaits in-flight executions, and flushes history persistence.
- Added `shutdown()` to `ConversionManager`: cancels all running ffmpeg conversions (run promises are now tracked), waits for them to settle, and persists.
- Registered a `before-quit` handler in `src/main/index.ts` that prevents default quit, runs both shutdowns, then re-issues `app.quit()`. A guard flag makes it idempotent.

Note: full process-tree kill escalation remains E-005.

## Acceptance Criteria

- [x] Quitting mid-download cancels downloads/conversions and persists terminal states (unit tests).
- [x] Shutdown is safe when nothing is running (test).
- [ ] Manual verification on Windows/macOS/Linux quit paths (requires running app; deferred to release testing).

# B-004: No child-process/history cleanup on app quit

- **Status:** Open
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/app-quit-cleanup`

## Source

- `src/main/index.ts:70-85` — no `before-quit`/`will-quit` handler anywhere
- `src/main/services/process/process-manager.ts:82,135` — direct-child-only kill

## Problem

On quit, running yt-dlp/ffmpeg children are never killed and terminal-state history changes may never be flushed. Child processes (especially ffmpeg spawned by yt-dlp during merge) can outlive the app as orphans, since `child.kill()` only kills the direct process.

Related: E-005 covers process-tree kill hardening; this task wires the quit lifecycle.

## Impact

Orphaned processes consume CPU/disk after exit; pending history persistence can be lost.

## Fix

- Add `before-quit`: cancel all active downloads/conversions, kill all tracked processes, await history persist flush.
- Add `will-quit` safety net that force-kills any remaining tracked children.

## Acceptance Criteria

- [ ] Quitting mid-download kills yt-dlp and its ffmpeg children (verify no orphaned processes remain).
- [ ] Terminal history states are persisted before exit completes.
- [ ] Manual testing documented for Windows/macOS/Linux quit paths where feasible.

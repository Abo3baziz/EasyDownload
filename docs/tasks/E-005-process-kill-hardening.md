# E-005: Process-tree kill and timeout enforcement

- **Status:** Open
- **Priority:** Medium
- **Category:** Enhancement / Robustness
- **Branch:** `feature/process-kill-hardening`

## Source

- `src/main/services/process/process-manager.ts:47,82,135` — single `child.kill()`, no escalation, no tree kill
- `src/main/services/process/process-manager.ts:22-30,89-137` — `timeoutMs` accepted by streaming APIs but never read

## Problem

1. A single kill signal doesn't stop process trees: yt-dlp's ffmpeg children survive cancels (compounds B-004 orphans).
2. No SIGKILL fallback for processes that ignore termination.
3. A hung yt-dlp download runs forever because `startStreaming` ignores `RunOptions.timeoutMs`.

## Approach

- On Windows use `taskkill /PID <pid> /T /F`; on POSIX use detached process groups + `process.kill(-pgid)`.
- Add SIGKILL fallback after a grace period.
- Honor `timeoutMs` in streaming APIs with a configurable default for downloads.

## Acceptance Criteria

- [ ] Cancelling a download kills yt-dlp and its ffmpeg children on all platforms.
- [ ] Hung streams time out per configured limit.
- [ ] Tests cover timeout firing and cleanup callbacks.

## Dependencies

- Coordinate with B-004 quit cleanup.

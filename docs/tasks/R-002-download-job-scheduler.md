# R-002: Extract job registry/scheduler from DownloadManager

- **Status:** Open
- **Priority:** Medium
- **Category:** Refactoring
- **Branch:** `refactor/download-job-scheduler`

## Source

- `src/main/services/download/download-manager.ts:52-67` — 10 mutable collections
- Whole file is a ~715-line factory function

## Problem

`DownloadManager` carries `jobs`, `configs`, `queue`, `activeIds`, `executionPromises`, `handles`, `mediaOptionsById`, `mediaMetaById`, `pauseRequests`, `cancelRequests` as closures. The interactions between these collections are where state-machine bugs live (see B-002 cancel/retry race).

## Approach

- Extract a `JobRegistry` (job/config/meta maps) and a `QueueScheduler` (queue, activeIds, execution promises).
- Make ownership explicit: only the scheduler mutates queue/active state; generation tokens per execution to prevent stale-cleanup bugs.
- Coordinate with B-002 — fixing the race first may be simpler; refactor can follow.

## Acceptance Criteria

- [ ] DownloadManager reduced to orchestration over extracted modules.
- [ ] All existing download-manager tests pass; new tests cover cancel/retry/pause interleavings.

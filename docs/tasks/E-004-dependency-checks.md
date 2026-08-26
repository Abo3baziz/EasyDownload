# E-004: Parallelize and cache dependency checks

- **Status:** Done
- **Priority:** Low
- **Category:** Enhancement / Performance
- **Branch:** `perf/dependency-checks`

## Source

- `src/main/services/dependencies/dependency-manager.ts:46-49` — sequential checks
- `src/main/services/media/media-service.ts:24` — fresh `yt-dlp --version` spawn per inspect

## Problem

Two independent 5-second-timeout process spawns run serially, doubling worst-case latency of `dependencies:get`. Additionally, every URL inspection spawns a fresh version check.

## Approach

- Run checks with `Promise.all`.
- Cache binary availability/version results (with a TTL or invalidation on settings change / failed spawn).

## Acceptance Criteria

- [ ] `dependencies:get` worst-case latency roughly halved.
- [ ] Inspections no longer spawn redundant version checks.
- [ ] Cache invalidates when the resolved binary path changes.

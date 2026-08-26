# E-006: Async file existence checks in list path

- **Status:** Done
- **Priority:** Low
- **Category:** Enhancement / Performance
- **Branch:** `perf/async-existence-checks`

## Source

- `src/main/services/download/download-manager.ts:117-134,631-635` — `pruneMissingFiles` inside `list()`
- Wired to synchronous `existsSync` at `src/main/services/index.ts:123`

## Problem

Every renderer list refresh stats every completed file synchronously on the main thread, blocking the event loop proportionally to history size.

## Approach

- Switch to async `fs.promises.access` (batched with `Promise.all`, bounded concurrency).
- Consider pruning lazily/on-change instead of per list call.

## Acceptance Criteria

- [ ] No synchronous fs calls in the list path.
- [ ] Missing files are still pruned correctly; tests pass.

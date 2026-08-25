# B-002: Cancel→retry race deletes retried download files

- **Status:** Open
- **Priority:** Critical
- **Category:** Bug
- **Branch:** `bugfix/cancel-retry-file-race`

## Source

- `src/main/services/download/download-manager.ts:504-533` — `cancel()`
- `src/main/services/download/download-manager.ts:535-557` — `retry()`
- `src/main/services/download/download-manager.ts:294-295, 327-333` — `finishCancelled`

## Problem

`cancel()` sets the status to `cancelled` and returns immediately while the old execution promise is still unwinding. If the user clicks Retry before the old `execute()` resolves:

1. `retry()` clears `cancelRequests` and re-queues the job.
2. The old execution's `finishCancelled(id, result.destination)` then runs and unconditionally calls `cleanupFiles(destination)`.

The status overwrite is guarded, but the file deletion is not — the fresh retry attempt's partial files get deleted.

## Impact

Data loss: partial files of the new attempt are removed by the stale cancel path; the retried download can end up corrupted or missing files.

## Fix

- Make file cleanup conditional on the job's current state matching the cancelling run (e.g., compare an execution token/generation counter before deleting).
- Alternatively, defer cleanup until the owning execution confirms it still owns the job.

## Acceptance Criteria

- [ ] Rapid cancel→retry sequences never delete files owned by the new run (covered by a regression test that simulates the interleaving).
- [ ] Cancelled downloads still clean up their own partial files in normal flow.
- [ ] `npm run test:unit` passes.

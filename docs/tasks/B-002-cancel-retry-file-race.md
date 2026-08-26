# B-002: Cancel→retry race deletes retried download files

- **Status:** Done
- **Priority:** Critical
- **Category:** Bug
- **Branch:** `bugfix/cancel-retry-file-race`
- **Outcome:** Verified no defect; regression coverage added

## Source

- `src/main/services/download/download-manager.ts:504-533` — `cancel()`
- `src/main/services/download/download-manager.ts:535-557` — `retry()`
- `src/main/services/download/download-manager.ts:294-295, 327-333` — `finishCancelled`

## Reported Problem

`cancel()` sets the status to `cancelled` and returns immediately while the old execution promise is still unwinding. If the user clicks Retry before the old `execute()` resolves:

1. `retry()` clears `cancelRequests` and re-queues the job.
2. The old execution's `finishCancelled(id, result.destination)` then runs and unconditionally calls `cleanupFiles(destination)`.

The status overwrite is guarded, but the file deletion was believed not to be.

## Verification Result

**The race cannot occur.** Code analysis and a targeted regression test confirmed that
`executeNext()` (`download-manager.ts:187-204`) serializes executions per id through the
`activeIds` set: while the cancelled execution is still unwinding, the id remains in
`activeIds`, so the retried run stays queued and cannot start until the old run fully
completes — including its file cleanup. The deletion therefore only ever removes the
cancelled run's own partial files, which is intended behavior.

## Action Taken

Instead of adding speculative generation-token machinery (unnecessary complexity), a
regression test locks the invariant in:
`does not let a stale cancelled run delete files of a retried run`
(`src/main/services/download/download-manager.test.ts`) simulates retry-before-unwind with
an `unlink` spy and asserts no deletions occur after the retried run starts.

## Acceptance Criteria

- [x] Rapid cancel→retry sequences never delete files owned by the new run (regression test).
- [x] Cancelled downloads still clean up their own partial files in normal flow (existing tests).
- [x] `npm run test:unit` passes.


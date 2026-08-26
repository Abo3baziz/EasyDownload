# B-014: Stale closure allows duplicate history deletes

- **Status:** Done
- **Priority:** Low
- **Category:** Bug
- **Branch:** `bugfix/history-delete-stale-closure`

## Source

- `src/renderer/state/historyState.tsx:69-83` — `deleteEntry` depends on stale `entries`

## Problem

Two rapid delete calls both pass the `entries.find` guard using stale data, issuing duplicate IPC deletes. The failure-restoration path can also resurrect an entry the second delete legitimately removed.

Related perf note: the dependency on the whole `entries` array also recreates the context value on every mutation — reading via a ref fixes both.

## Fix

- Perform existence check and optimistic removal inside the `setEntries` updater (idempotent), or keep an id-set ref.
- Read `entries` via a ref to stabilize callback/context identity.

## Acceptance Criteria

- [ ] Rapid double-delete is idempotent and never resurrects entries.
- [ ] Renderer test simulating back-to-back deletes.

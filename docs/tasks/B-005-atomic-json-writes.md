# B-005: Non-atomic JSON writes risk corrupting persisted stores

- **Status:** Open
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/atomic-json-writes`

## Source

- `src/main/services/history/json-store.ts:31-38` — direct `writeFile` to final path
- `src/main/services/settings/settings-manager.ts:33-41` — same pattern
- Related: B-003 (no recovery path when files are corrupted)

## Problem

Both stores write directly to the final file. A crash or power loss mid-write truncates `history.json` / `settings.json` / `conversions.json`. Combined with the lack of validation in B-003, there is no recovery path for a damaged store.

## Impact

All download/conversion history or user settings can be lost on an unlucky crash.

## Fix

- Write to a temp file in the same directory, then `rename` over the target (atomic on POSIX; near-atomic on Windows with retry-on-EBUSY).
- Optionally keep a single `.bak` of the previous good file.
- On load, if parse fails, fall back to `.bak`/defaults instead of throwing.

## Acceptance Criteria

- [ ] All persisted stores use write-temp-then-rename.
- [ ] Load path recovers from truncated/corrupt JSON without crashing.
- [ ] Unit tests simulate interrupted writes and corrupt files.

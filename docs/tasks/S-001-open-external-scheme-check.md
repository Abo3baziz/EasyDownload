# S-001: Validate URL scheme before shell.openExternal

- **Status:** Done
- **Priority:** Low
- **Category:** Security hardening
- **Branch:** `chore/open-external-scheme-check`

## Source

- `src/main/index.ts:33-36` — `setWindowOpenHandler` calls `shell.openExternal(url)` for every denied URL

## Problem

Per Electron security guidance, only `https:`/`http:` URLs should be forwarded to the OS shell. Currently any scheme from a denied window-open (including custom protocol handlers) reaches `shell.openExternal`.

## Fix

- Only call `shell.openExternal` for http/https URLs; deny and log everything else.

## Acceptance Criteria

- [ ] Non-http(s) schemes are never passed to the OS.
- [ ] Unit test for the handler decision logic.

# S-002: Sanitize unknown error messages crossing IPC boundary

- **Status:** Open
- **Priority:** Low
- **Category:** Security hardening
- **Branch:** `chore/ipc-error-sanitization`

## Source

- `src/main/utils/errors.ts:32-33` — unknown errors become `UnknownError` with raw `Error.message`

## Problem

Unknown/internal errors carry their raw message to the renderer, potentially exposing filesystem paths and Node internals.

## Fix

- Map unknown errors to a generic sanitized message; keep full details in main-process logs only.

## Acceptance Criteria

- [ ] Renderer receives only generic messages for non-AppError failures.
- [ ] Main-process logging preserves diagnostic detail.

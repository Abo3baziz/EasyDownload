# E-003: Automatic retry for transient network failures

- **Status:** Open
- **Priority:** Low
- **Category:** Enhancement
- **Branch:** `feature/transient-retry`

## Source

- `src/main/services/ytdlp/ytdlp-service.ts:107-130` — inspection fails terminally
- `src/main/services/ytdlp/ytdlp-service.ts:241-250` — `NetworkError` classification already exists

## Problem

Inspection and downloads fail terminally on transient network errors even though the error classification needed for a bounded retry policy already exists.

## Approach

- Add bounded exponential-backoff retry (e.g., 3 attempts) for classified `NetworkError` during inspection and download startup.
- Surface retry attempts in status/progress events; keep manual Retry for terminal failures.

## Acceptance Criteria

- [ ] Transient network blips self-heal without user action.
- [ ] Non-network errors are never auto-retried.
- [ ] Tests cover retry, backoff timing (fake timers), and exhaustion.

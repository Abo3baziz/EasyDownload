# B-008: Download URL scheme not restricted to http(s)

- **Status:** Done
- **Priority:** Medium
- **Category:** Bug / Security
- **Branch:** `bugfix/url-scheme-restriction`

## Source

- `src/shared/schemas/index.ts:3,14` — `urlSchema` is `z.string().url()` (accepts any scheme)
- `src/main/services/media/media-service.ts:20-22` — inspect path validates via `isValidMediaUrl`
- `src/shared/utils/url.ts` — `isValidMediaUrl` helper already exists

## Problem

`mediaService.inspectUrl` re-validates URLs with `isValidMediaUrl` (http/https only), but `download:create` passes the URL straight to yt-dlp without the same check. The two entry points for the same URL have inconsistent validation.

## Fix

- Enforce `isValidMediaUrl` in the `download:create` IPC handler (or tighten `urlSchema`) so both paths share one validation rule.

## Acceptance Criteria

- [ ] `download:create` rejects non-http(s) schemes with a proper `AppError`.
- [ ] Unit test covering rejection and acceptance cases.

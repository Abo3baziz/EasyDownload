# B-009: Destination detection uses unsanitized media title

- **Status:** Open
- **Priority:** Medium
- **Category:** Bug
- **Branch:** `bugfix/destination-title-sanitization`

## Source

- `src/main/services/download/download-manager.ts:346-357` — `deriveCompletedDestination`
- `src/main/ipc/index.ts:40-42` — `removeForInput` matches conversions by exact `destination` string

## Problem

The candidate filename `${meta.title} [${id}] [${fmt}].${ext}` uses the raw media title, but yt-dlp sanitizes titles for the filesystem (illegal Windows characters like `<>:"|?*`, trailing dots, length limits). When the two diverge, a completed download ends up with `destination: undefined`, losing fileName/fileSize and breaking conversion linkage.

## Fix

- Rely solely on `--print after_move:filepath` for destination resolution.
- Remove or heavily simplify `deriveCompletedDestination`; if kept as fallback, replicate yt-dlp's sanitization rules.

## Acceptance Criteria

- [ ] Completed downloads with special-character titles get a correct `destination`.
- [ ] Conversion linkage (`removeForInput`) works for such downloads.
- [ ] Unit test with Windows-illegal characters in titles.

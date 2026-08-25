# B-006: Conversion output collisions overwrite files; partials left behind

- **Status:** Open
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/conversion-output-handling`

## Source

- `src/main/services/conversion/conversion-manager.ts:250-295` — output path never checked for existence
- `src/main/services/conversion/conversion-manager.ts:137-153` — no cleanup on failure/cancel
- `src/main/services/ffmpeg/ffmpeg-service.ts:80-82` — `-y` overwrite default

## Problem

1. Two conversions of the same input with the same codec produce identical output paths and run concurrently writing to the same file; an unrelated pre-existing file with the same name is silently destroyed.
2. Failed/cancelled conversions leave partial/corrupt output files behind — unlike downloads which have `cleanupFiles`.
3. The `overwrite` option exists in `FfmpegConvertOptions` but `ConversionManager.run` never sets it.

## Impact

Silent data loss and leftover corrupt files that look like valid completed conversions.

## Fix

- Generate collision-free output paths (numeric suffix `-1`, `-2`, …) before starting.
- Clean up partial output on failure/cancel, mirroring `download-manager.ts` `cleanupFiles`.
- Never pass `-y` from ConversionManager; fail fast if target exists at spawn time.

## Acceptance Criteria

- [ ] Concurrent identical conversions get distinct output paths.
- [ ] Pre-existing files are never overwritten without explicit user intent.
- [ ] Failure/cancel removes partial outputs (regression test included).

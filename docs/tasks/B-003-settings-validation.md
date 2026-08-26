# B-003: Corrupt settings file silently bricks download queue

- **Status:** Done
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/settings-validation`

## Source

- `src/main/services/settings/settings-manager.ts:20-31` — `load()` with no shape validation
- `src/main/services/download/download-manager.ts:172-181` — `resolveConcurrencyLimit()`
- `src/main/services/download/download-manager.ts` — scheduler loop condition

## Problem

`SettingsManager.load()` merges raw JSON with defaults but performs no shape validation. A hand-edited or corrupted file can persist e.g. `concurrencyLimit: "abc"`. Then:

- `resolveConcurrencyLimit()` computes `Math.max(1, NaN) = NaN`.
- The scheduler condition `activeIds.size < NaN` is always false.
- No queued download ever starts and no error is surfaced anywhere.

## Impact

The entire download queue silently stops working until the user manually deletes/fixes the settings file.

## Fix

- Validate settings against a zod schema (already a dependency) on load; fall back to defaults per-field on mismatch.
- Clamp `concurrencyLimit` defensively in `resolveConcurrencyLimit()` (guard non-finite values).
- Surface a warning when invalid fields are repaired.

## Acceptance Criteria

- [ ] Settings schema validation added with field-level fallback to defaults.
- [ ] Regression test: corrupt/untyped settings file still yields working scheduler.
- [ ] `npm run test:unit && npm run test:integration` passes.

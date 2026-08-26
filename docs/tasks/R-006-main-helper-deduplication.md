# R-006: Deduplicate main-process helper functions

- **Status:** Done
- **Priority:** Low
- **Category:** Refactoring
- **Branch:** `refactor/main-helper-deduplication`

## Source

- `statFile` duplicated verbatim: `src/main/services/index.ts:109-116` and `132-139`
- `isMissingFileError`/`describeError`: duplicated between `json-store.ts:43-49` and `settings-manager.ts:46-52`
- `escapeRegExp`: local in `download-manager.ts:713-715`, belongs in shared utils
- `toInspectionError` vs `toDownloadError`: ~90% shared structure in `ytdlp-service.ts:215-262`
- Wrong error code: `AppError('DownloadError', ...)` used for conversion failures at `conversion-manager.ts:81,95,205`
- Inconsistent load-failure policy: silent swallow (`download-manager.ts:96`) vs log (`inspection-history-manager.ts:67-69`) vs throw (`json-store.load`)

## Approach

- Move helpers to shared locations; unify error mappers with a parameterized factory.
- Introduce proper conversion error codes.
- Pick one documented load-failure policy and apply it consistently.

## Acceptance Criteria

- [ ] Each helper exists once.
- [ ] Conversions surface semantically correct error codes.
- [ ] Consistent load-failure behavior across managers; tests pass.

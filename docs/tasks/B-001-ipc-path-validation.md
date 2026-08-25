# B-001: IPC path validation gaps (open/download/conversion)

- **Status:** Open
- **Priority:** Critical
- **Category:** Bug / Security
- **Branch:** `bugfix/ipc-path-validation`

## Source

- `src/main/ipc/index.ts:63-71` — `fileOpen`/`fileOpenDirectory`
- `src/shared/schemas/index.ts:11-17` — `downloadOptionsSchema.directory`
- `src/shared/schemas/index.ts:43-53` — `conversionStartSchema.input`
- `src/main/services/filesystem/file-manager.ts:21-24` — `isPathInside` (exists but unused in production)

## Problem

The renderer can pass arbitrary paths over IPC and the main process acts on them without containment checks:

1. `fileOpen`/`fileOpenDirectory` call `shell.openPath(path)` for any non-empty string, including executables.
2. `download:create` accepts any directory as the download target (e.g., system or startup folders).
3. Conversion input is unvalidated; ffmpeg reads it and writes output into its directory with `-y`.

`FileManager.isPathInside` was written exactly for this purpose but is never called in production code.

## Impact

A compromised renderer gains arbitrary-file open, write, and overwrite primitives on the host filesystem.

## Fix

- Restrict `fileOpen`/`fileOpenDirectory` to paths inside the downloads directory (and conversion outputs) using `isPathInside`.
- Validate/resolve `directory` against the configured `settings.downloadDirectory`, or remove the per-download override.
- Validate conversion input is inside the managed downloads directory before starting ffmpeg.
- Resolve paths to canonical form before comparison to prevent traversal tricks (`..`, symlinks).

## Acceptance Criteria

- [ ] All three IPC entry points enforce path containment via a single shared guard.
- [ ] Unit tests cover rejection of outside paths, traversal attempts, and allowed paths.
- [ ] Existing tests pass: `npm run test:unit && npm run test:integration`.

# Tasks Index

Tracking file for bugs and fixes identified during project analysis (2026-08-25).

Each task has its own file. Update the Status column here when a task changes state.

## Status Legend

| Status      | Meaning                                  |
| ----------- | ---------------------------------------- |
| Open        | Not started                              |
| In Progress | A branch exists and work is ongoing      |
| In Review   | Implemented, awaiting review             |
| Done        | Implemented, verified, merged            |
| Cancelled   | Dropped or no longer relevant            |

## Bugs

| ID    | Title                                                            | Priority | Status | Task File                                            |
| ----- | ---------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------- |
| B-001 | IPC path validation gaps (open/download/conversion)               | Critical | Open   | [B-001-ipc-path-validation.md](B-001-ipc-path-validation.md) |
| B-002 | Cancel→retry race deletes retried download files                  | Critical | Done   | [B-002-cancel-retry-file-race.md](B-002-cancel-retry-file-race.md) |
| B-003 | Corrupt settings file silently bricks download queue              | High     | Done | [B-003-settings-validation.md](B-003-settings-validation.md) |
| B-004 | No child-process/history cleanup on app quit                      | High     | Done   | [B-004-app-quit-cleanup.md](B-004-app-quit-cleanup.md) |
| B-005 | Non-atomic JSON writes risk corrupting persisted stores           | High     | Done   | [B-005-atomic-json-writes.md](B-005-atomic-json-writes.md) |
| B-006 | Conversion output collisions overwrite files; partials left behind | High     | Done   | [B-006-conversion-output-handling.md](B-006-conversion-output-handling.md) |
| B-007 | Downloads snapshot overwrite race in renderer                     | Medium   | Done   | [B-007-downloads-snapshot-race.md](B-007-downloads-snapshot-race.md) |
| B-008 | Download URL scheme not restricted to http(s)                     | Medium   | Done   | [B-008-url-scheme-restriction.md](B-008-url-scheme-restriction.md) |
| B-009 | Destination detection uses unsanitized media title                | Medium   | Done   | [B-009-destination-title-sanitization.md](B-009-destination-title-sanitization.md) |
| B-010 | SettingsPage save failure destroys form UI                        | High     | Done   | [B-010-settings-form-save-error.md](B-010-settings-form-save-error.md) |
| B-011 | Concurrency setting accepts invalid values                        | Medium   | Done   | [B-011-concurrency-input-validation.md](B-011-concurrency-input-validation.md) |
| B-012 | Notification manager reads settings from disk per progress tick   | Low      | Done   | [B-012-notification-settings-cache.md](B-012-notification-settings-cache.md) |
| B-013 | Double-click starts duplicate conversions                         | Medium   | Done   | [B-013-duplicate-conversion-guard.md](B-013-duplicate-conversion-guard.md) |
| B-014 | Stale closure allows duplicate history deletes                    | Low      | Done   | [B-014-history-delete-stale-closure.md](B-014-history-delete-stale-closure.md) |
| B-015 | Relative timestamps never refresh                                 | Low      | Done   | [B-015-relative-time-refresh.md](B-015-relative-time-refresh.md) |
| B-017 | Downloads fail with generic NetworkError (stale yt-dlp, hidden detail) | Critical | Done | [B-017-ytdlp-error-reporting.md](B-017-ytdlp-error-reporting.md) |
| B-018 | Progress bar not showing (--print implies quiet mode)            | High     | Done   | [B-018-download-progress-suppressed.md](B-018-download-progress-suppressed.md) |
| B-016 | Renderer downloads state never reconciles (deletedIds, merge)     | Medium   | Done   | [B-016-downloads-state-reconciliation.md](B-016-downloads-state-reconciliation.md) |

## Security Hardening

| ID    | Title                                                     | Priority | Status | Task File                                              |
| ----- | --------------------------------------------------------- | -------- | ------ | ------------------------------------------------------ |
| S-001 | Validate URL scheme before `shell.openExternal`            | Low      | Done   | [S-001-open-external-scheme-check.md](S-001-open-external-scheme-check.md) |
| S-002 | Sanitize unknown error messages crossing IPC boundary      | Low      | Done   | [S-002-ipc-error-sanitization.md](S-002-ipc-error-sanitization.md) |

## Refactoring

| ID    | Title                                                        | Priority | Status | Task File                                          |
| ----- | ------------------------------------------------------------ | -------- | ------ | -------------------------------------------------- |
| R-001 | Extract shared persistent-collection abstraction              | Medium   | Open   | [R-001-persistent-collection.md](R-001-persistent-collection.md) |
| R-002 | Extract job registry/scheduler from DownloadManager           | Medium   | Open   | [R-002-download-job-scheduler.md](R-002-download-job-scheduler.md) |
| R-003 | Create shared DownloadStateProvider for renderer              | Medium   | Done   | [R-003-download-state-provider.md](R-003-download-state-provider.md) |
| R-004 | Collapse duplicated action handlers and alert markup          | Low      | Done   | [R-004-renderer-handler-deduplication.md](R-004-renderer-handler-deduplication.md) |
| R-005 | Remove dead code (spawnProcess, FfmpegService.merge, isPathInside decision) | Low | Done | [R-005-remove-dead-code.md](R-005-remove-dead-code.md) |
| R-006 | Deduplicate main-process helper functions                     | Low      | Done   | [R-006-main-helper-deduplication.md](R-006-main-helper-deduplication.md) |

## Enhancements

| ID    | Title                                                | Priority | Status | Task File                                        |
| ----- | ---------------------------------------------------- | -------- | ------ | ------------------------------------------------ |
| E-001 | Throttle download progress IPC broadcasts             | Medium   | Done   | [E-001-progress-throttling.md](E-001-progress-throttling.md) |
| E-002 | Add concurrency limit/queue for conversions           | Medium   | Done   | [E-002-conversion-concurrency.md](E-002-conversion-concurrency.md) |
| E-003 | Automatic retry for transient network failures        | Low      | Done   | [E-003-transient-retry.md](E-003-transient-retry.md) |
| E-004 | Parallelize and cache dependency checks               | Low      | Done   | [E-004-dependency-checks.md](E-004-dependency-checks.md) |
| E-005 | Process-tree kill and timeout enforcement             | Medium   | Done   | [E-005-process-kill-hardening.md](E-005-process-kill-hardening.md) |
| E-006 | Async file existence checks in list path              | Low      | Done   | [E-006-async-existence-checks.md](E-006-async-existence-checks.md) |
| E-007 | Accessibility improvements (progressbar, badges)      | Low      | Done   | [E-007-accessibility.md](E-007-accessibility.md) |
| E-008 | Bundle/detect a JS runtime for yt-dlp                 | Medium   | Open   | [E-008-ytdlp-js-runtime.md](E-008-ytdlp-js-runtime.md) |

## Features

| ID    | Title                                                | Priority | Status      | Task File                                        |
| ----- | ---------------------------------------------------- | -------- | ----------- | ------------------------------------------------ |
| F-001 | Playlist downloads (FR-020)                           | High     | In Review   | [F-001-playlist-downloads.md](F-001-playlist-downloads.md) |

> Note: the `feature/playlist-downloads` branch includes transient auto-retry with
> backoff, overlapping E-003 — dedupe when integrating.

## Suggested Order

1. B-001 (security trio — enforcement helper already exists)
2. B-002, B-004 (data-loss races and quit hygiene)
3. B-003, B-005 (persistence robustness)
4. B-010, B-011 (user-facing settings breakage)
5. B-007, B-016 + R-003 (renderer downloads state, one coherent effort)
6. E-001, E-002, E-005 (throughput and process hardening)
7. Remaining low-priority items

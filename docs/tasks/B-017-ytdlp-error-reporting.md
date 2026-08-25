# B-017: Downloads fail with generic NetworkError (HTTP 403)

- **Status:** Done
- **Priority:** Critical
- **Category:** Bug / Diagnosability
- **Branch:** `bugfix/ytdlp-error-reporting`
- **Reported:** "NetworkError: yt-dlp could not complete the download. The video may be unavailable or the network request failed." on download and retry.

## Root Cause

Reproduced locally with the exact args `buildDownloadArgs` produces:

1. **Stale bundled yt-dlp** — `resources/bin/yt-dlp.exe` was 2026.07.04; YouTube returns
   `HTTP Error 403: Forbidden` for video data with that build. Updating to the latest
   release (2026.08.19) fixed downloads immediately (`npm run download:yt-dlp -- --force`).
   The binary is gitignored, so refresh it locally and in release builds via
   `npm run dist:*` (which re-downloads it).
2. **Error detail was discarded** — `toDownloadError` matched broad patterns like
   `unable to download` and returned a generic message, dropping yt-dlp's actual
   `ERROR:` line, making diagnosis impossible.

Also found: `--no-call-home` is deprecated by yt-dlp and prints a deprecation warning on
every invocation ("remove them to avoid future errors").

## Fix

- Removed deprecated `--no-call-home` from inspect and download args.
- `toDownloadError`/`toInspectionError` now attach yt-dlp's real error line as
  `AppError.details`.
- Added a distinct classification for `Requested format is not available` →
  `DownloadError` telling the user to re-inspect and pick another format (format ids go
  stale between inspection and download).
- Added shared `ErrorAlert` renderer component that displays string details; replaced the
  five duplicated alert blocks (HomePage, DownloadsPage, SettingsPage, HistorySection).

## Follow-up (new task)

- E-008: modern YouTube extraction increasingly requires a JavaScript runtime
  (deno/node); without one yt-dlp warns that formats may go missing. Consider bundling a
  JS runtime or surfacing a dependency check for it.

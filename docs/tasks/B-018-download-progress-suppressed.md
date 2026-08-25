# B-018: Progress bar not showing during downloads

- **Status:** Done
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/download-progress-suppressed`

## Root Cause (verified empirically)

`buildDownloadArgs` passes `--print after_move:filepath` to capture the destination path.
In yt-dlp, `--print` **implies quiet mode**, which suppresses all `[download]` progress
output on stdout. Result: downloads ran fine and completed, but the app never received
progress lines, so the renderer's progress bar never appeared (status stayed
`downloading` with an empty `progress` object until completion set 100%).

Verified by spawning the bundled binary from Node:

- `--print after_move:filepath` alone → 0 `[download]` lines
- with `--progress` added → full progress line stream, path still printed

## Fix

- Added `--progress` to `buildDownloadArgs` so progress output is emitted even in quiet mode.
- Regression test asserts `--progress` is present whenever `--print` is used.

## Debugging Notes

- Verified live in the dev app via CDP (agent-browser): renderer received only
  `queued → inspecting → downloading` transitions with no percent values before the fix.
- Confirmed the running process command line via `Get-CimInstance Win32_Process` to rule
  out a stale build.

## Follow-up Observations (tracked separately)

- Two identical yt-dlp processes were observed for one job during live testing — worth
  investigating duplicate `execute()` scheduling; may be a dev-mode artifact.
- electron-vite dev did not restart the main process on file change during this session;
  restart manually when changing main code.

# E-001: Throttle download progress IPC broadcasts

- **Status:** Done
- **Priority:** Medium
- **Category:** Enhancement / Performance
- **Branch:** `feature/progress-throttling`

## Source

- `src/main/ipc/index.ts:95-100` — `onUpdate` broadcast per event
- `src/main/services/ytdlp/ytdlp-service.ts:170-175` — one update per `[download]` output line (`--newline` = multiple/sec)

## Problem

Every progress line is broadcast to all windows for every active download — multiple events per second times N downloads. This drives renderer churn (Sidebar re-renders) and B-012's per-tick settings disk reads.

## Approach

- Coalesce progress updates in the main process: send at most one update per download per ~200 ms (or on percent-delta threshold).
- Keep terminal events (completed/failed/cancelled) immediate and unthrottled.
- Optionally flush the latest state immediately when a throttle window closes.

## Acceptance Criteria

- [ ] Broadcast rate bounded regardless of yt-dlp output rate.
- [ ] Progress bar still feels live (≤200 ms latency).
- [ ] Unit test verifying coalescing logic.

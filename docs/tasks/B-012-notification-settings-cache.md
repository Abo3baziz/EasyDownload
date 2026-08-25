# B-012: Notification manager reads settings from disk per progress tick

- **Status:** Open
- **Priority:** Low
- **Category:** Bug / Performance
- **Branch:** `perf/notification-settings-cache`

## Source

- `src/main/ipc/index.ts:95-100` — `onUpdate` fires per progress line
- `src/main/services/notifications/notification-manager.ts:15-31` — awaits full disk read + JSON.parse per invocation
- Related: E-001 (throttle broadcasts at the source)

## Problem

Every unthrottled `[download]` progress line triggers a settings read from disk just to discover notifications are disabled — wasted I/O per event per active download.

## Fix

- Cache settings in memory in `SettingsManager` (single source of truth) and have NotificationManager read the cached value synchronously.
- E-001's throttling also mitigates this; implement both independently.

## Acceptance Criteria

- [ ] Progress ticks no longer trigger disk reads.
- [ ] Settings changes take effect immediately without app restart.
- [ ] Existing notification tests pass.

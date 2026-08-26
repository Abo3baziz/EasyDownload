# E-002: Add concurrency limit/queue for conversions

- **Status:** Done
- **Priority:** Medium
- **Category:** Enhancement
- **Branch:** `feature/conversion-concurrency`

## Source

- `src/main/services/conversion/conversion-manager.ts:156-183` — every `start()` spawns ffmpeg immediately

## Problem

Unlike downloads, conversions have no concurrency limit: N clicks spawn N simultaneous ffmpeg encodes, saturating CPU/disk.

## Approach

- Reuse the download scheduler pattern (or the extracted scheduler from R-002): queue conversions, run up to a configurable limit (default 1–2), report queued status to the renderer.

## Acceptance Criteria

- [ ] Conversions respect a concurrency limit; excess requests are queued with visible "queued" status.
- [ ] Queue drains in order as slots free.
- [ ] Tests cover queuing, completion, cancel of a queued item.

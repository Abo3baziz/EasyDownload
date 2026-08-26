# E-003: Automatic retry for transient network failures

- **Status:** Done
- **Priority:** Low
- **Category:** Enhancement
- **Branch:** `feature/transient-retry`

## Source

- `src/main/services/ytdlp/ytdlp-service.ts` — inspection fails terminally
- `toDownloadError` NetworkError classification

## Resolution

Implemented as part of **F-001** (`feature/playlist-downloads`, merged into main):
downloads that fail with transient network/rate-limit errors (HTTP 403/429/5xx,
connection resets/timeouts) are retried automatically up to four times with escalating
backoff (2s/4s/8s/16s). Download-phase retries reuse resolved media options without
re-inspection; permanent failures are never retried; a `retryCount` field drives a
"Retrying (n)" UI indicator.
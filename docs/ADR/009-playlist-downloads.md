# ADR-009: Playlist Downloads Fan Out into Individual Download Jobs

## Status

Accepted

## Context

Users need to download an entire playlist (for example a YouTube playlist) in one action. The application already has a robust Download Manager that owns the queue, configurable concurrency (FR-012/FR-016), per-video history (FR-013), retry (FR-014), pause/resume, cancellation, and per-video file actions and conversions.

Playlist entries do not share format IDs: each video exposes its own set of formats, so a single concrete format selection cannot be applied verbatim to every entry. Playlists can also contain private, geo-blocked, or otherwise unavailable entries, and can be very large.

Several approaches were considered:

- **Single yt-dlp process per playlist**: one process downloads all entries in sequence with one Download record representing the whole playlist. Simpler, but loses per-video history, per-video retry/actions, and cancelling or pausing affects the entire playlist.
- **Dedicated playlist entity in the Download Manager**: a new first-class playlist download with child jobs and aggregate persistence. Most flexible but a large change to the Download model, statuses, and history persistence.
- **Fan out into existing per-video jobs**: enumerate entries and create one ordinary `Download` per video, tagged with playlist metadata and a quality preset.

## Decision

Playlists fan out into ordinary per-video `Download` jobs, each tagged with optional `playlistId`, `playlistTitle`, `playlistIndex`, `playlistCount`, and a quality `preset`. There is no separate playlist download entity.

- Detection is yt-dlp-based: the Media Service returns a `kind: 'video' | 'playlist'` union based on yt-dlp's `_type`/`entries`, so playlist URLs, video-in-playlist URLs, and playlist-like channel listings all work without URL parsing.
- `downloadPlaylist` enumerates entries via flat playlist inspection (`--dump-single-json --flat-playlist`), sanitizes a `<playlist title> [<playlist id>]` subfolder of the configured directory, and creates/enqueues one tagged job per entry. Entries already completed (by normalized URL) or duplicated within the playlist are skipped and reported.
- Playlist jobs do not carry a concrete format ID at creation. At execution, each job re-inspects its entry, resolves the concrete format from the preset via `resolvePlaylistFormat`, and stores it on the record so retries reuse it. Entries with no matching format fail individually.
- Each entry is an independent job: the existing queue, concurrency limit, history, retry, per-video file actions, pause, and cancel all apply. `cancelPlaylist` cancels all non-terminal jobs sharing the playlist id, and playlist entries do not trigger individual desktop notifications.

## Consequences

Easier:

- Queue, concurrency, history, retry, file actions, conversions, path repair, and pruning are reused unchanged; only optional flat fields were added to the Download record (backward compatible).
- Per-video failures (private/geo-blocked videos) are naturally isolated — one failed entry never blocks the rest.
- Playlist entries persist to `history.json` like any other download and remain actionable after restart.

Harder:

- A playlist of N videos creates N jobs and N history records; very large playlists produce a large queue and history (an acceptable trade-off; the UI shows the entry count up front).
- Re-running a playlist skips entries already completed for any format (compared by normalized URL), so it cannot upgrade an earlier lower-quality download without first deleting the history entry or file.
- Per-entry format resolution happens at download time, so a preset that is unavailable on one video surfaces as that entry's individual failure rather than a pre-flight error.

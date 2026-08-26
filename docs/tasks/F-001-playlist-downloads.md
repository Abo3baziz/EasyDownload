# F-001: Playlist downloads

- **Status:** In Progress
- **Priority:** High
- **Category:** Feature
- **Branch:** `feature/playlist-downloads` (pending work, not yet merged)

## Scope (FR-020)

Detect playlist URLs during inspection and fan out downloads for every entry:

1. **Inspection** — recognize playlist URLs (flat inspection via yt-dlp) and return the
   entry list instead of single-media metadata.
2. **Download fan-out** — create one download job per playlist entry; serialize jobs
   per playlist (one active download per playlist at a time).
3. **Progress** — live aggregate progress across entries plus a progress bar per active
   entry.
4. **Transient retry** — auto-retry transient network failures with backoff; surface the
   retry state in the UI.
5. **UI** — playlist support on Home (inspection + download-all) and Downloads pages.

## Current State of `feature/playlist-downloads`

13 commits implementing the above, including:

- `src/main/services/media/*` — playlist detection during inspection (`normalize.ts`)
- `src/main/services/download/download-manager.ts` — playlist fan-out and per-playlist serialization (+453 lines of tests)
- Renderer: HomePage / DownloadsPage / homeState UI (+ tests)
- Docs already on the branch: `docs/ADR/009-playlist-downloads.md`, REQUIREMENTS FR-020,
  ARCHITECTURE/TESTING/CHANGELOG/PROJECT_PROGRESS updates

## Integration Work Required Before Merge

⚠️ The branch forked from `main` at `4d3221a` and was 25 commits behind. Integration
completed on 2026-08-26:

- [x] Merged latest `main` into the branch (single conflict-resolution pass)
- [x] Resolved `download-manager.ts` conflicts — playlist fan-out coexists with shutdown(), sanitized title variants, NaN-safe concurrency clamp, and cancel/retry fixes
- [x] Applied B-001 PathGuard containment to the new `playlistDownload` IPC channel
- [x] Kept http(s)-only `urlSchema`, throttled broadcasts (E-001), atomic persistence (B-005), and IPC error sanitization (S-002)
- [x] Renderer: HomePage tests wrapped in `DownloadsStateProvider`; api mocks extended with playlist methods
- [x] E-003 transient retry implemented by this branch (task closed as covered)
- [x] Full typecheck + suite green after integration (316 unit / 12 integration / 120 renderer)
- [ ] Manual end-to-end playlist download against live YouTube (deferred — bot-check dependent)

## Acceptance Criteria

- [ ] Pasting a playlist URL inspects to an entry list with aggregate metadata
- [ ] Download-all creates per-entry jobs, serialized per playlist
- [ ] Per-entry and aggregate progress render on the Downloads page
- [ ] Transient failures auto-retry with backoff and show retry state
- [ ] All existing tasks' guarantees hold after integration (path safety, atomic persistence, throttled broadcasts)

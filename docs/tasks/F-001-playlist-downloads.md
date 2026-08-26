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

⚠️ The branch forked from `main` at `4d3221a` and is now **25 commits behind**. Our
completed fixes touch the same files heavily (`download-manager.ts`, IPC layer, schemas,
renderer state). Required work:

- [ ] Rebase onto latest `main` (or merge main into the branch)
- [ ] Resolve conflicts in `download-manager.ts` (path guard interplay, shutdown(),
      concurrency clamp, cancel/retry changes) and `ytdlp-service.ts` (--progress,
      error mappers with details)
- [ ] Fold branch's transient auto-retry into E-003 scope — dedupe with this task or close E-003 when merged
- [ ] Verify new code against B-001 path containment (playlist entry downloads must pass the PathGuard directory check)
- [ ] Reconcile shared schema changes (`src/shared/schemas/index.ts`) with the tightened http(s)-only urlSchema
- [ ] Update renderer state to consume `DownloadsStateProvider` (branch predates it)
- [ ] Full typecheck + test suite green; manual end-to-end playlist download test

## Acceptance Criteria

- [ ] Pasting a playlist URL inspects to an entry list with aggregate metadata
- [ ] Download-all creates per-entry jobs, serialized per playlist
- [ ] Per-entry and aggregate progress render on the Downloads page
- [ ] Transient failures auto-retry with backoff and show retry state
- [ ] All existing tasks' guarantees hold after integration (path safety, atomic persistence, throttled broadcasts)

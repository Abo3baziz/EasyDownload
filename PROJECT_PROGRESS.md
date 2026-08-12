# Project Progress

## Current Status

**Phase:** Implementation — download workflow, history, notifications, FFmpeg service, and media conversion

**Status:** Download execution implemented via the Download Manager (queue, progress, cancellation, retry); video-only formats merge best audio via yt-dlp/FFmpeg; download history persisted locally with clear-history support; desktop notifications implemented for download completion and failure, controlled by the notifications setting; conversion/audio-extraction feature implemented for completed downloads via the Conversion Manager and FFmpeg Service; Home page URL and inspection state persist across page navigation via a renderer-level state provider; downloaded video metadata (thumbnail, duration, resolution, format, codecs, FPS) is captured at download time and persisted with the download record so it survives navigation, renderer reload, and app restart; completed audio extractions are persisted with their metadata so they survive navigation, renderer reload, and app restart, and are displayed inline under their source download; a GitHub Actions release workflow packages the Windows x64 installer and creates a GitHub Release when a version tag (e.g. `v0.1.0`) is pushed

## Completed

- Electron application skeleton: main/preload/renderer architecture with secure window creation and controlled preload API.
- Main process services: Media Service, Download Manager, Process Manager, File Manager, Dependency Manager, and Settings Manager.
- Explicit, validated IPC layer using zod schema validation.
- Renderer shell: Home, Downloads, and Settings pages with dependency/settings UI.
- Build tooling: electron-vite, TypeScript, Vitest, React Testing Library.
- Unit, integration, and renderer tests passing; production build succeeds.
- yt-dlp-based media inspection: dedicated yt-dlp service with safe argument construction, output parsing, and error mapping; normalization into the application media model (FR-002, FR-003, FR-004); Home page media display with thumbnail, metadata, and format labels.
- Build-time yt-dlp bundling: download script fetches the platform binary into `resources/bin/`; runtime resolver locates the bundled binary (packaged or dev tree) with PATH fallback; electron-builder packaging config added (ADR-001).
- Download execution (FR-005, FR-006, FR-007, FR-008, FR-012): Download Manager lifecycle (create → inspect → download → complete/fail/cancel), single-concurrent download queue, cancel with temporary file cleanup, retry with original configuration, and normalized state broadcasting to the renderer.
- yt-dlp download integration: streaming process support with line emission, `--newline` output parsing into normalized progress (percent, size, speed, ETA), download phase detection, and mapped download errors.
- Download progress UI: Downloads page renders live progress (bar, size, speed, ETA) and per-download Cancel / Retry / Open file actions; Home page starts downloads into the configured directory.
- FFmpeg audio merging for video-only formats: the Download Manager detects formats without audio during inspection, requests `-f <id>+bestaudio` with a merge container, and fails early with a clear `DependencyError` when FFmpeg is unavailable; the final merged file path is captured from yt-dlp output.
- Build-time FFmpeg bundling: download script fetches the platform binary into `resources/bin/`; runtime resolver locates the bundled binary (packaged or dev tree) with PATH fallback; the yt-dlp service points post-processing at the bundled FFmpeg via `--ffmpeg-location` (ADR-002).
- FFmpeg audio merging verified end-to-end with the bundled binaries: video-only formats download with `-f <id>+bestaudio`, merge into the requested container, produce a file with an audio stream, and report the final merged path as the download destination.
- Download history persistence (FR-013): History Manager persists terminal downloads (completed/failed/cancelled) to `history.json` in the user data directory; the Download Manager lazy-loads history, persists terminal records on state change, captures final file size, retries history-loaded downloads via reconstructed configuration, and clears history through a `history:clear` IPC channel; Downloads page shows a Clear history button and file size/filename for completed downloads.
- Desktop notifications (FR-015): Notification Manager observes the download update stream and, when enabled in settings, shows OS notifications for download completion and failure; notification behavior is isolated from the core download workflow.
- Dedicated FFmpeg Service: reusable FFmpeg abstraction with merge, convert, and audio-extraction operations; safe argument construction, `-progress` parsing into normalized progress, cancellation support, and mapped application errors; wired into the main process service graph for future features while downloads continue to use yt-dlp's built-in merging.
- Media conversion feature: Conversion Manager runs convert/audio-extraction operations on completed downloads via the FFmpeg Service, derives an output path next to the source (never overwriting it), verifies the source exists, and broadcasts `conversion:state` events; Downloads page offers MP4/WebM conversion and MP3/AAC/Opus/FLAC extraction with progress, cancel, and open-converted-file actions. Verified end-to-end against the bundled FFmpeg binary.
- Home page state persistence: the Home page URL input and inspection results (metadata, thumbnail, formats) are held in a renderer-level `HomeStateProvider` context mounted above the tab navigation, so they survive Home → Downloads → Home and Home → Settings → Home without re-inspecting. Inspection results are cached per normalized URL (via a new shared `normalizeUrl` helper); `Clear` clears the current input/view but keeps the cache so re-entering the same URL restores it, entering a different URL never shows stale data, and switching between previously inspected URLs restores each result.
- Download button state: clicking Download on the Home page immediately switches the format button to a disabled `Downloading` state, tracked per `(url, formatId)` in `HomeStateProvider` via the download update stream. The state survives navigation, prevents duplicate download requests on rapid clicks, disables only the in-progress format, and restores to `Download` on completion or failure.
- Downloaded video metadata and thumbnail persistence: during inspection the Download Manager captures the media thumbnail, duration, and selected-format metadata (resolution, extension, video/audio codecs, FPS) onto the download record, so they persist to `history.json` with the terminal record. The Downloads page shows the persisted thumbnail (with a `No thumbnail` fallback box and graceful handling of load failures) and a metadata section (duration, resolution, format, codecs, FPS, download date) for completed downloads; legacy records without metadata render with fallbacks and remain fully functional.
- Converted audio persistence: completed audio extractions are persisted to `conversions.json` via a reusable `createJsonStore<T>` helper (also used by the History Manager); the Conversion Manager lazy-loads and saves only completed `extractAudio` records, captures the output file size on completion, and clears them via the existing `history:clear` flow. The Downloads page loads persisted conversions on mount and renders them inline under their source download (thumbnail, title, duration, format, file size, date, `Open audio file` action); metadata (title, thumbnail, duration) is passed from the source download when starting an extraction.
- GitHub Actions release workflow: `.github/workflows/release.yml` triggers on version tags (`v*`) only (normal pushes to `main` do not create releases), and on a `windows-latest` runner checks out the repo, sets up Node.js 22 with npm caching, installs from the lockfile (`npm ci`), fails clearly if the tag does not match the `package.json` version (the installer version comes from `package.json`), runs typecheck and tests, packages via the existing `npm run dist:win`, verifies the installer exists, and creates a normal (non-draft, non-prerelease) GitHub Release with auto-generated notes, uploading only the `EasyDownload Setup <version>.exe` installer via the repository `GITHUB_TOKEN` (`contents: write`).

## Current Decisions

- Build tooling: electron-vite (vite 7) with Vitest and React Testing Library.
- IPC payloads validated with zod; handlers return a structured `IpcResult` rather than throwing across IPC.
- Single concurrent download allowed for the MVP; queue support required (FR-012).
- Filename collision default behavior is an implementation decision (FR-017).
- Proxy configuration (FR-018) and application auto-updates (FR-019) deferred to a future version.
- yt-dlp metadata inspection uses `--dump-json --no-playlist --skip-download`; format lists are deduplicated by label and sorted by resolution.
- yt-dlp is bundled at build time into the packaged application; the runtime resolver falls back to PATH when no bundled binary is present (ADR-001). FFmpeg is bundled the same way, and its directory is passed to yt-dlp via `--ffmpeg-location` when present (ADR-002).
- Download progress uses a single `download:state` IPC event carrying the normalized download; the renderer never parses raw yt-dlp output. yt-dlp is launched with argument arrays (never shell strings) and progress is parsed with `--newline`.
- Audio merging for video-only formats is delegated to yt-dlp (`-f <id>+bestaudio`) using the bundled FFmpeg (falling back to PATH); downloads fail early with a clear error when FFmpeg is unavailable (DEP-002).
- Desktop notifications (FR-015) are driven by the download update stream and isolated from the download workflow: the Download Manager is unaware of notifications, and notification failures are swallowed.
- The FFmpeg Service exposes structured operations (merge, convert, extractAudio) with safe argument construction and `-progress` parsing; codecs are a small structured set rather than raw codec argument strings. Download merging remains delegated to yt-dlp post-processing.
- Media conversions run through the FFmpeg Service via a Conversion Manager: the renderer sends only the source file and a structured operation, and the main process derives the output path, so conversions cannot write outside the source's directory or use raw codec argument strings.
- Home page state is persisted in renderer memory via a React context (`HomeStateProvider`) rather than a new state-management library; inspection results are cached keyed by `normalizeUrl` (trim + `new URL(...).toString()`), a conservative normalization that never changes URL meaning. State survives page navigation but is intentionally not persisted across app restarts.
- The Home page format buttons track in-progress downloads per `(url, formatId)` from the download update stream in `HomeStateProvider`; the button shows `Downloading` (disabled) while the download is queued/inspecting/downloading/processing and reverts to `Download` on terminal states. Duplicate clicks are prevented synchronously via a ref-guarded mark.
- Downloaded video metadata is stored as optional flat fields on the download record and written to `history.json` via the existing History Manager (no new persistence system). The thumbnail is persisted as the inspection-provided remote URL (consistent with the Home page) rather than local copies or binary data; records are backward compatible because all new fields are optional and the Downloads page renders fallbacks.
- Converted audio records are persisted as completed `extractAudio` conversions only (failed, cancelled, and video conversions are not stored); output file size is captured at completion time, and records are cleared together with download history via `history:clear`. Persistence reuses the generic `createJsonStore<T>` helper introduced for this feature, mirroring the download-history pattern.
- yt-dlp is invoked with `--encoding utf-8` (inspect and download) so its output is always UTF-8 regardless of the Windows ANSI code page, keeping non-ASCII (e.g. Arabic) titles and destination paths intact; streamed child output is decoded with a `StringDecoder` to avoid corrupting multi-byte characters split across chunks.
- GitHub releases: the release workflow triggers only on version tags (`v*`); the pushed tag is the source of the release version and the workflow fails if it does not match `package.json`'s version (electron-builder derives the installer filename/version from `package.json`). Only the NSIS installer (`EasyDownload Setup <version>.exe`) is uploaded; electron-builder's `latest.yml` and `.exe.blockmap` are not release assets because the app has no auto-update mechanism. The workflow is structured as a single Windows job so a macOS/Linux matrix can be added later.
- Architecture decisions are recorded as ADRs: Electron framework (ADR-003), local-first architecture (ADR-004), yt-dlp integration (ADR-005), FFmpeg integration (ADR-006), Electron security model (ADR-007), and Chrome extension integration constraints (ADR-008). ADR-008 remains Proposed pending the extension's communication-mechanism decision.

## Pending

- [ ] None currently blocking.

## Current Focus

No blocking pending work; the GitHub Actions release workflow is in place (first release requires a version-tag push). Next feature candidates include dependency version detection (FR-019) or the future Chrome extension.

## Important References

- `AGENTS.md` — instructions and workflow for AI agents.
- `docs/REQUIREMENTS.md` — product requirements and functional requirements (FR-001 through FR-019).
- `docs/ARCHITECTURE.md` — system architecture, Electron process model, and services.
- `docs/TESTING.md` — testing strategy and how to run tests.
- `docs/ADR/` — architecture decision records and ADR process.
- `CHANGELOG.md` — historical project changes.

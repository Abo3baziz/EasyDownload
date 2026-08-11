# Project Progress

## Current Status

**Phase:** Implementation — download workflow, history, notifications, FFmpeg service, and media conversion

**Status:** Download execution implemented via the Download Manager (queue, progress, cancellation, retry); video-only formats merge best audio via yt-dlp/FFmpeg; download history persisted locally with clear-history support; desktop notifications implemented for download completion and failure, controlled by the notifications setting; conversion/audio-extraction feature implemented for completed downloads via the Conversion Manager and FFmpeg Service

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
- Architecture decisions are recorded as ADRs: Electron framework (ADR-003), local-first architecture (ADR-004), yt-dlp integration (ADR-005), FFmpeg integration (ADR-006), Electron security model (ADR-007), and Chrome extension integration constraints (ADR-008). ADR-008 remains Proposed pending the extension's communication-mechanism decision.

## Pending

- [ ] None currently blocking.

## Current Focus

No blocking pending work; next feature candidates include dependency version detection (FR-019) or the future Chrome extension.

## Important References

- `AGENTS.md` — instructions and workflow for AI agents.
- `docs/REQUIREMENTS.md` — product requirements and functional requirements (FR-001 through FR-019).
- `docs/ARCHITECTURE.md` — system architecture, Electron process model, and services.
- `docs/TESTING.md` — testing strategy and how to run tests.
- `docs/ADR/` — architecture decision records and ADR process.
- `CHANGELOG.md` — historical project changes.

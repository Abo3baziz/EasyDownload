# Project Progress

## Current Status

**Phase:** Implementation — download execution, progress, and cancellation

**Status:** Download execution implemented via the Download Manager (queue, progress, cancellation, retry); FFmpeg post-processing and desktop notifications pending

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

## Current Decisions

- Build tooling: electron-vite (vite 7) with Vitest and React Testing Library.
- IPC payloads validated with zod; handlers return a structured `IpcResult` rather than throwing across IPC.
- Single concurrent download allowed for the MVP; queue support required (FR-012).
- Filename collision default behavior is an implementation decision (FR-017).
- Proxy configuration (FR-018) and application auto-updates (FR-019) deferred to a future version.
- yt-dlp metadata inspection uses `--dump-json --no-playlist --skip-download`; format lists are deduplicated by label and sorted by resolution.
- yt-dlp is bundled at build time into the packaged application; the runtime resolver falls back to PATH when no bundled binary is present (ADR-001).
- Download progress uses a single `download:state` IPC event carrying the normalized download; the renderer never parses raw yt-dlp output. yt-dlp is launched with argument arrays (never shell strings) and progress is parsed with `--newline`.

## Pending

- [ ] Implement FFmpeg post-processing integration where required.
- [ ] Add desktop notifications wiring (FR-015).
- [ ] Persist download history (FR-013) and file-open of completed downloads.
- [ ] Create ADRs for remaining significant decisions (FFmpeg integration, Electron security, etc.).

## Current Focus

FFmpeg post-processing integration and desktop notifications.

## Important References

- `AGENTS.md` — instructions and workflow for AI agents.
- `docs/REQUIREMENTS.md` — product requirements and functional requirements (FR-001 through FR-019).
- `docs/ARCHITECTURE.md` — system architecture, Electron process model, and services.
- `docs/TESTING.md` — testing strategy and how to run tests.
- `docs/ADR/` — architecture decision records and ADR process.
- `CHANGELOG.md` — historical project changes.

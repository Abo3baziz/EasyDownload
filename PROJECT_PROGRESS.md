# Project Progress

## Current Status

**Phase:** Implementation — media inspection

**Status:** yt-dlp-based media inspection implemented; download execution pending

## Completed

- Electron application skeleton: main/preload/renderer architecture with secure window creation and controlled preload API.
- Main process services: Media Service, Download Manager, Process Manager, File Manager, Dependency Manager, and Settings Manager.
- Explicit, validated IPC layer using zod schema validation.
- Renderer shell: Home, Downloads, and Settings pages with dependency/settings UI.
- Build tooling: electron-vite, TypeScript, Vitest, React Testing Library.
- Unit, integration, and renderer tests passing; production build succeeds.
- yt-dlp-based media inspection: dedicated yt-dlp service with safe argument construction, output parsing, and error mapping; normalization into the application media model (FR-002, FR-003, FR-004); Home page media display with thumbnail, metadata, and format labels.

## Current Decisions

- Build tooling: electron-vite (vite 7) with Vitest and React Testing Library.
- IPC payloads validated with zod; handlers return a structured `IpcResult` rather than throwing across IPC.
- Single concurrent download allowed for the MVP; queue support required (FR-012).
- Filename collision default behavior is an implementation decision (FR-017).
- Proxy configuration (FR-018) and application auto-updates (FR-019) deferred to a future version.
- yt-dlp metadata inspection uses `--dump-json --no-playlist --skip-download`; format lists are deduplicated by label and sorted by resolution.

## Pending

- [ ] Implement download execution, progress, and cancellation via the Download Manager.
- [ ] Implement FFmpeg post-processing integration where required.
- [ ] Define the dependency management and bundling strategy.
- [ ] Add desktop notifications wiring.
- [ ] Create ADRs for significant architecture decisions once the decisions are established.

## Current Focus

Implement download execution, progress, and cancellation via the Download Manager.

## Important References

- `AGENTS.md` — instructions and workflow for AI agents.
- `docs/REQUIREMENTS.md` — product requirements and functional requirements (FR-001 through FR-019).
- `docs/ARCHITECTURE.md` — system architecture, Electron process model, and services.
- `docs/TESTING.md` — testing strategy and how to run tests.
- `docs/ADR/` — architecture decision records and ADR process.
- `CHANGELOG.md` — historical project changes.

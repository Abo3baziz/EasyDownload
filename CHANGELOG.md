# Changelog

## 2026-08-11

### Added

- Download execution (FR-005, FR-006, FR-007, FR-008, FR-012): Download Manager lifecycle with a single-concurrent-download queue, cancellation with temporary file cleanup, and retry using the original configuration.
- yt-dlp download integration: streaming process support with line emission (`startStreaming`), `--newline` progress parsing into normalized progress data (percent, size, speed, ETA), download phase detection, destination capture, and mapped download errors.
- Download progress UI: Downloads page shows live progress bars with size, speed, and ETA, plus per-download Cancel, Retry, and Open file actions; Home page starts downloads for a selected format into the configured directory.
- New `download:retry` IPC channel and renderer `retryDownload` API; consolidated progress/state reporting into a single `download:state` event.
- FFmpeg audio merging for video-only formats: the Download Manager detects formats without audio during inspection and requests `-f <id>+bestaudio` with a merge container; downloads fail early with a clear `DependencyError` when FFmpeg is unavailable; the final merged file path is captured from yt-dlp output.

### Changed

- Download Manager responsibilities and concurrency notes remain per `docs/ARCHITECTURE.md`; example IPC channel list updated with `download:retry`.
- `docs/ARCHITECTURE.md` FFmpeg section notes that MVP audio merging is delegated to yt-dlp using FFmpeg from PATH.

## 2026-08-10

### Added

- Initial project documentation: `AGENTS.md`, `docs/REQUIREMENTS.md`, and `docs/ARCHITECTURE.md`.
- Functional requirements FR-012 through FR-019 covering download queue, history, retry, notifications, settings, filename collision handling, proxy configuration, and dependency updates.
- `docs/TESTING.md` defining the testing strategy.
- `docs/ADR/README.md` defining the ADR process and template.
- `PROJECT_PROGRESS.md` as the current-state progress log.
- `CHANGELOG.md` recording meaningful project history.
- Electron application skeleton with main/preload/renderer architecture, validated IPC layer, and main process services (Media Service, Download Manager, Process Manager, File Manager, Dependency Manager, Settings Manager).
- Renderer shell with Home, Downloads, and Settings pages exposing the controlled preload API.
- Test suite: unit, integration, and renderer tests using Vitest and React Testing Library.
- yt-dlp-based media inspection: dedicated yt-dlp service (safe argument construction, output parsing, error mapping), normalization into the application media model, and shared formatting utilities.
- Home page media display with thumbnail, metadata, and understandable format labels (FR-002, FR-003, FR-004).
- Build-time yt-dlp bundling: `scripts/download-ytdlp.mjs` downloads the platform-specific standalone binary into `resources/bin/`; runtime resolver (`resolveYtDlpBinary`) locates the bundled binary in packaged and dev builds with PATH fallback; electron-builder packaging config with `extraResources` (ADR-001).

### Changed

- Requirement priorities (P1/P2) updated to reference the new functional requirements.
- `AGENTS.md` documentation index expanded; Download Manager responsibilities and concurrency notes updated in `docs/ARCHITECTURE.md`.
- macOS signing and notarization consideration added to `docs/REQUIREMENTS.md`.
- Project progress documentation restructured: `PROJECT_PROGRESS.md` now captures only the current project state; historical changes moved to `CHANGELOG.md`.

### Fixed

- Corrected the requirements document filename to `docs/REQUIREMENTS.md` and reconciled all references.

### Infrastructure

- Initialized the git repository with a `main` branch.
- Added build and development tooling: electron-vite (vite 7), TypeScript, and Vitest with project scripts for typecheck, test, and build.
- Added electron-builder for packaging and `download:yt-dlp` / `dist:<platform>` npm scripts; added `docs/ADR/001-build-time-yt-dlp-bundling.md`.

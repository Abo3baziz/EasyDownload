# Changelog

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

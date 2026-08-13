# Changelog

## 2026-08-13

### Added

- Download file location and existence tracking: the Download Manager now prunes completed downloads whose persisted file path no longer exists on disk whenever the download list is loaded or refreshed (including after an app restart). The full path remains the source of truth on each record, checks run entirely in the main process via `existsSync`, the pruned result is re-persisted to download history, and legacy completed records without a stored path are kept because they cannot be verified.

## 2026-08-13

### Added

- Downloads page navigation sections: the Downloads page now acts as a section selector with navigation cards (Completed, Queue, Cancelled, Failed) showing live download counts. Clicking a card opens a dedicated full-page view for that status (filtered by the existing status model, reusing the same download item card), with a "← Downloads" button back to the selector. Empty section pages show an appropriate empty message, and counts update automatically when statuses change.

## 2026-08-13

### Added

- Open File Location action for completed downloads and converted audio items on the Downloads page. The action uses the persisted file path (`Download.destination` / `Conversion.output`) via a new `file:open-location` IPC channel, verifies the file exists before opening, and opens the OS file manager with the file selected (`shell.showItemInFolder`). Missing or invalid paths fail gracefully with a `FilesystemError` instead of crashing.

## 2026-08-13

### Fixed

- Cancelled download retries now clear stale cancellation and pause markers and recreate per-attempt yt-dlp options, so retry immediately starts a fresh download instead of stalling.

## 2026-08-13

### Added

- Pause, resume, and cancel controls for active downloads. Controls use explicit preload and IPC APIs, target the existing download ID, preserve progress and partial files for yt-dlp `--continue` resume, suppress late progress after cancellation, and keep cancelled jobs terminal with best-effort temporary-file cleanup.

## 2026-08-12

### Infrastructure

- GitHub Actions release workflow (`.github/workflows/release.yml`): when a semantic version tag (e.g. `v0.1.0`) is pushed, a `windows-latest` job checks out the repo, sets up Node.js 22 with npm dependency caching, installs dependencies from the lockfile (`npm ci`), verifies the tag matches the `package.json` version (failing with a clear message otherwise, since the installer version comes from `package.json`), runs typecheck and tests, packages the Windows x64 installer via the existing `npm run dist:win` script, verifies the installer exists, and creates a normal (non-draft, non-prerelease) GitHub Release with auto-generated release notes, uploading only the `EasyDownload Setup <version>.exe` installer. The workflow uses the repository `GITHUB_TOKEN` with `contents: write` permissions; no secrets are required. The design keeps the packaging step isolated so macOS/Linux can be added later.

## 2026-08-12

### Fixed

- Non-ASCII download paths on Windows: yt-dlp writes its streaming output (including the `[download] Destination:` path line) in the Windows ANSI code page rather than UTF-8, so videos with Arabic (or other non-ASCII) titles recorded a garbled destination path that no longer matched the real file and "Open file" failed. yt-dlp is now invoked with `--encoding utf-8` so its output is always UTF-8, and the Process Manager decodes streamed output with a `StringDecoder` so multi-byte characters split across chunks are not corrupted.

## 2026-08-12

### Added

- Converted audio persistence: completed audio extractions (MP3/AAC/Opus/FLAC) are now persisted to a new `conversions.json` file alongside download history, so they survive navigation, renderer reload, and app restart. The Conversion Manager lazy-loads and saves only completed `extractAudio` records (failed, cancelled, and video conversions are not persisted), captures the output file size on completion, and clears them through the existing `history:clear` flow. The Downloads page loads persisted conversions on mount and renders them inline under their source download with thumbnail, title, duration, format, file size, date, and an "Open audio file" action.
- New `conversion:list` IPC channel and renderer `listConversions` API.
- Reusable `createJsonStore<T>` persistence helper in the main process; the History Manager now delegates its load/save logic to it.
- Source metadata (title, thumbnail, duration) is passed from the Downloads page when starting an audio extraction, so persisted converted-audio records display correctly.

## 2026-08-12

### Added

- Downloaded video metadata and thumbnail persistence: the Download Manager now captures the video's thumbnail, duration, and selected-format metadata (resolution, extension, video/audio codecs, FPS) from the inspection result and stores them on the download record, so they are persisted to `history.json` with the terminal record. The Downloads page renders the persisted thumbnail (with a fallback box and graceful handling of load failures) and a metadata section (duration, resolution, format, codecs, FPS, download date) for completed downloads; legacy records without metadata render with fallbacks and remain fully functional.
- New `formatDate` shared helper that formats download timestamps as `YYYY-MM-DD`.

## 2026-08-12

### Added

- Download button state on the Home page: clicking Download immediately changes the format button to a disabled `Downloading` state that persists across page navigation, prevents duplicate download requests on rapid clicks, disables only the format whose download is in progress, and restores to `Download` when the download completes or fails. Download state is tracked per `(url, formatId)` in the existing `HomeStateProvider` via the download update stream.

## 2026-08-12

### Added

- Home page state persistence: Home page state now lives in a renderer-level `HomeStateProvider` context mounted above the tab navigation, so the entered URL and inspection results survive navigating Home → Downloads → Home and Home → Settings → Home without re-inspecting the URL.
- A new `Clear` button clears the current URL input and the active inspection view without deleting the cached inspection result; re-entering the same URL restores the previous metadata and formats, while entering a different URL never displays stale data.
- Inspection results are cached per normalized URL (`Record<normalizedUrl, MediaInfo>`), so switching between previously inspected URLs restores each result; results are always associated with the URL that produced them.
- New `normalizeUrl` helper in `src/shared/utils/url.ts` (trim + `new URL(...).toString()` normalization of host/scheme case and root trailing slash) defines consistent URL comparison. Unit, renderer, and navigation tests added.

## 2026-08-11

### Added

- Media conversion feature: a new Conversion Manager runs post-download conversions through the FFmpeg Service (convert to MP4/WebM, or extract MP3/AAC/Opus/FLAC audio), deriving an output path next to the source (never overwriting it), verifying the source exists, and broadcasting `conversion:state` events with normalized progress. New `conversion:start` / `conversion:cancel` IPC channels and preload APIs; the Downloads page shows per-download conversion controls with progress, cancel, and open-converted-file actions. Unit and renderer tests added; verified end-to-end against the bundled FFmpeg binary.

## 2026-08-11

### Documentation

- Added architecture decision records for the remaining significant decisions: ADR-003 (Electron as the desktop framework), ADR-004 (local-first architecture), ADR-005 (yt-dlp integration), ADR-006 (FFmpeg integration), ADR-007 (Electron security model), and ADR-008 (Chrome extension integration, marked Proposed pending the communication-mechanism decision). The ADR README now includes an index of all records, and `docs/ARCHITECTURE.md` section 39 lists the recorded ADRs.

## 2026-08-11

### Added

- Dedicated FFmpeg Service: reusable FFmpeg abstraction with `merge`, `convert`, and `extractAudio` operations. Safe argument arrays (never shell strings), structured codec options, `-progress pipe:1` parsing into normalized progress, cancellation support, and mapped application errors (`FilesystemError`/`ProcessingError`/`DependencyError`). Wired into the main process service graph; the download workflow continues to use yt-dlp's built-in merging (ADR-002). Unit tests cover argument construction, progress parsing, error mapping, and operation lifecycle.

## 2026-08-11

### Added

- Desktop notifications (FR-015): new Notification Manager in the main process observes the Download Manager update stream and, when notifications are enabled in settings, shows OS notifications for download completion and failure (using the media title, file name, or URL, and the mapped error message on failure). Notification behavior is isolated from the core download workflow: the Download Manager is unaware of notifications and notification failures are swallowed. The existing `notificationsEnabled` setting and Settings page checkbox control the feature.

## 2026-08-11

### Added

- Application icon set: `electron-icon-builder` and `sharp` dev dependencies with an `icon:generate` script that turns a square 1024×1024 source PNG (`resources/logo.png`) into `build/icons/` (Windows `.ico`, macOS `.icns`, and a Linux PNG set); electron-builder config points `win`/`mac`/`linux` at the generated icons, and the main window uses the icon in development. A `scripts/extract-ico-png.mjs` helper extracts the largest embedded PNG from an ICO source and upscales it to the required 1024×1024 source. Verified end-to-end with an unpacked Windows build (`EasyDownload.exe` carries the icon).

## 2026-08-11

### Added

- Download history persistence (FR-013): new History Manager persists terminal downloads (completed/failed/cancelled) as JSON in the user data directory; the Download Manager lazy-loads history into the job list, persists terminal records after each terminal state transition, captures the final file size of completed downloads via an injected `statFile` callback, and retries history-loaded downloads by reconstructing the configuration (format ID and directory) from the persisted record.
- New `history:clear` IPC channel and renderer `clearHistory` API; the Downloads page shows a Clear history button when terminal records exist and displays file name and size for completed downloads.
- Shared `Download` model extended with `formatId` and `fileSize`; unit and renderer tests added for persistence, file size display, retry-from-history, and clear history.

### Changed

- `docs/ARCHITECTURE.md` service list updated with History Manager; Download Storage section documents download history persistence; preload and IPC example lists updated with `clearHistory` / `history:clear`.
- App renamed to **EasyDownload**: package `name` and lockfile updated to `easydownload`, electron-builder `productName` set to `EasyDownload` and `appId` to `com.easydownload.app`, main window title and renderer HTML `<title>` updated, Home page heading and doc titles (`ARCHITECTURE`, `REQUIREMENTS`, `TESTING`) updated accordingly.

## 2026-08-11

### Added

- Download execution (FR-005, FR-006, FR-007, FR-008, FR-012): Download Manager lifecycle with a single-concurrent-download queue, cancellation with temporary file cleanup, and retry using the original configuration.
- yt-dlp download integration: streaming process support with line emission (`startStreaming`), `--newline` progress parsing into normalized progress data (percent, size, speed, ETA), download phase detection, destination capture, and mapped download errors.
- Download progress UI: Downloads page shows live progress bars with size, speed, and ETA, plus per-download Cancel, Retry, and Open file actions; Home page starts downloads for a selected format into the configured directory.
- New `download:retry` IPC channel and renderer `retryDownload` API; consolidated progress/state reporting into a single `download:state` event.
- FFmpeg audio merging for video-only formats: the Download Manager detects formats without audio during inspection and requests `-f <id>+bestaudio` with a merge container; downloads fail early with a clear `DependencyError` when FFmpeg is unavailable; the final merged file path is captured from yt-dlp output.
- Build-time FFmpeg bundling: `scripts/download-ffmpeg.mjs` downloads the platform-specific FFmpeg binary (decompressed from gzip) into `resources/bin/`; runtime resolver `resolveFfmpegBinary` locates the bundled binary in packaged and dev builds with PATH fallback; the yt-dlp service passes the bundled FFmpeg directory via `--ffmpeg-location` (ADR-002).

### Changed

- Download Manager responsibilities and concurrency notes remain per `docs/ARCHITECTURE.md`; example IPC channel list updated with `download:retry`.
- `docs/ARCHITECTURE.md` FFmpeg and Dependency Management sections note that FFmpeg is bundled at build time and passed to yt-dlp via `--ffmpeg-location`; ADR index updated for ADR-002.
- `download:yt-dlp` packaging flow extended with `download:ffmpeg` across the `dist:<platform>` scripts.

### Fixed

- FFmpeg availability check used `--version`, which FFmpeg treats as an error (exit code 8, output on stderr), so the bundled FFmpeg was always reported as unavailable and audio merging failed with a `DependencyError`. The check now uses `-version`, matching how yt-dlp is checked with `--version`; dependency manager unit tests added.

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

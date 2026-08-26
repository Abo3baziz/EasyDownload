# EasyDownload — Desktop App to Download Videos & Audio from Online Sources

## Required Fields

Ready to paste into the Upwork Project form (character limits already enforced):

- **Project Title:** EasyDownload — Desktop App to Download Videos & Audio from Online Sources
- **Role:** Full-Stack Developer — Electron architecture, secure IPC, and React UI
- **Description:** EasyDownload lets anyone save online videos and audio straight to their device — no accounts, no upload-your-link websites, no command line. Paste a URL, preview the title, duration, and every available quality in plain language, then download with a queue, live progress, pause/resume, cancel, and retry. Finished files convert to MP4/MKV or extract audio as MP3/AAC/Opus/FLAC. Built with Electron, React, and TypeScript: a hardened renderer/preload/main boundary with zod-validated IPC, yt-dlp and FFmpeg bundled in the installer, JSON-file persistence, and 326 passing tests.
- **Skills & Deliverables:** Electron, TypeScript, React, Node.js, Software Testing

---

## Text Blocks

### Overview

EasyDownload is a cross-platform desktop application (Windows, macOS, Linux) that makes saving online video and audio to your own device as easy as pasting a link and clicking download. 

It is for anyone who has ever hesitated before pasting a link into a "free download website," or opened a command-line guide full of yt-dlp flags and closed it again. With EasyDownload both problems disappear: your URL is never shipped to a third-party service, and you never touch a terminal.

The headline outcome: paste a URL, preview exactly what you will get — title, thumbnail, duration, and every available quality described in plain language — pick a quality, and watch the download run with live progress, pause/resume, and retry. 

Everything runs on the user's own machine, and the two powerful engines underneath (yt-dlp for downloading, FFmpeg for media processing) are bundled inside the installer, so there is nothing to install, configure, or maintain.

This project is a complete, production-oriented product build: 
1. a security-hardened Electron architecture
2. a non-blocking download engine with enforced concurrency
3.  persistent local history
4. post-download conversion and audio extraction
5.  a release pipeline
6. a real test suite of 326 passing tests

all documented with formal requirements, architecture records, and a testing strategy.

### Problem & Solution

Downloading online media is genuinely awkward for most people, for **three reasons**. 

1. **First**, web-based download services ask you to paste your link into a website, which uploads your URL to a third-party server — a legitimate privacy concern — and typically ships ads, size limits, and flaky downloads.

2. **Second**, the powerful command-line tools (yt-dlp) are intimidating: non-technical users should not have to learn terminal syntax, format selectors, or how to install and configure FFmpeg.

3. **Third**, manual workflows break down on bigger tasks: no queue, no visible progress, no history, and no way to pause a large download and resume it later.

The solution wraps the yt-dlp download engine and FFmpeg media processing behind a desktop GUI that manages the whole lifecycle: 
1. validate the URL before doing anything
2. inspect the media without downloading it: 
    - title
    - thumbnail
    - duration
    - every available quality presented as understandable choices
3. download with a queue
4. live progress
5. pause/resume
6. cancel and retry
7. organize results in a persistent day-grouped history
8. process finished files into other formats. 
    
    The user gets the interface of a modern desktop app, the power of command-line tools, and none of the setup.

The technical heart of the solution is an architecture that treats the external tools as untrusted command-line programs. 

Every yt-dlp and FFmpeg invocation is isolated behind dedicated services that build argument arrays (never shell strings), parse and normalize output, and map failures to typed errors. 

The user interface never touches the download engines or the file system directly: all privileged operations flow through a small, explicit, validated API between the renderer and the main process — a real security boundary, not bureaucracy.

### Key Features & Deliverables

- **URL inspection before downloading** — paste a link and preview the media's title, thumbnail, duration, and every available quality, labeled like "1080p MP4" instead of raw technical format IDs. Users know exactly what they are getting before committing bandwidth or disk space.
- **Download queue with configurable concurrency** — multiple downloads can run at once, bounded by a user-controlled setting (1–10) enforced centrally in the Download Manager. Pausing, cancelling, or failing one download automatically starts the next queued one; large batches become fire-and-forget.
- **Pause, resume, cancel, and retry** — pausing keeps partial files and resumes where it left off (yt-dlp continuation), cancelling cleans up partial files, and retrying restores the original settings — including for downloads re-opened from history after an app restart.
- **Post-download conversion and audio extraction** — completed videos can be converted to MP4 or MKV, or have their audio extracted as MP3/AAC/Opus/FLAC, with live progress, cancellation, and persisted results.
- **Persistent history and inspection records** — completed, failed, and cancelled downloads and every inspected URL survive restarts, with per-entry delete, clear-all, retry, file sizes, thumbnails, and day-grouped lists (Today / Yesterday / date).
- **No duplicate downloads** — starting a download for a video and format that was already completed is rejected with a clear message.
- **Optional desktop notifications** — completion and failure notifications, controllable from settings, so users can do other things and still know when a batch finished.
- **Persistent inspection history** — one entry per URL (re-inspecting refreshes in place) with a rolling 30-day retention window, so past lookups stay one click away without growing forever.
- **Reliable file actions** — "Open file," "Open File Location," and conversion always work by capturing the final file path from the download tool itself, with fallback parsing, on-start verification, and a backfill that repairs legacy records, so every completed download stays actionable.

### Technical Details

**Stack (verified from the repository):** Electron 43.3, React 19.2, TypeScript 7 with `strict: true` across separate node/web tsconfig projects, electron-vite 5 (Vite 7.3) for main/preload/renderer bundling, zod 4.4 for runtime validation, Vitest 4.1 + React Testing Library for tests, electron-builder 26 for packaging (NSIS for Windows, DMG for macOS, AppImage for Linux), and a GitHub Actions release workflow. Node.js 20+.

**Architecture — privileged core, unprivileged UI.** The app is split into three cooperating layers: a React renderer, a minimal preload bridge (`window.mediaDownloader`), and a privileged Electron main process that owns everything risky — spawning programs, filesystem access, native dialogs. The main process is composed of eleven single-purpose services (Download Manager, Media Service, Process Manager, File Manager, Dependency Manager, Settings Manager, History Manager, Inspection History Manager, Notification Manager, FFmpeg Service, Conversion Manager) wired through dependency injection, which is what makes the core unit-testable with mocked dependencies.

**IPC design.** There is no HTTP API and no generic IPC: every operation is its own channel (`download:pause`, `conversion:start`, …) with a defined input and output. Every payload is validated at the boundary by a strict zod schema, and handlers return structured `{ ok: true, data } | { ok: false, error }` results with a typed error taxonomy (`ValidationError`, `DependencyError`, `DownloadError`, `FilesystemError`, …) so the UI displays a useful message, never a stack trace. Long-running operations broadcast normalized state events (percent, size, speed, ETA) to the renderer; raw tool output never leaves the main process.

**Download engine.** The Download Manager is a documented state machine over eight states (queued → inspecting → ready → downloading → processing → completed/failed/cancelled/paused), with a queue and central enforcement of the concurrency setting (1–10), re-read on every queue drain. External tools run as `spawn(executable, args[])` argument arrays — never shell strings — with output parsed in exactly one place per tool. Non-ASCII titles and paths are protected end to end on Windows via `--encoding utf-8` and a `StringDecoder` that keeps multi-byte characters split across chunks intact.

**File path reliability.** The final path is captured from yt-dlp's `--print after_move:filepath`, with `Destination:`/`Merger` line parsing as fallback, on-start filesystem verification, and a history-load backfill that matches a unique file in the download directory — so file actions work for every completed download, including legacy records. The output template embeds the selected format ID so the same video at two qualities produces two distinct files instead of colliding.

**Persistence.** No database: four small JSON files in the OS user-data directory (`history.json`, `inspection-history.json`, `conversions.json`, `settings.json`) owned by main-process stores. Records are backward compatible (features were added as optional fields), deletion is metadata-only (files stay on disk), writes are chained to avoid interleaving, and persistence failures roll back and never break the download workflow.

**Security (verified in source).** `contextIsolation: true`, `nodeIntegration: false`; the preload exposes only the typed bridge and never raw `ipcRenderer`, `shell`, `fs`, `child_process`, `process`, or `require`; new windows are denied (`setWindowOpenHandler` returns `{ action: 'deny' }`) and external links open only via `shell.openExternal`; URLs must parse as `http:`/`https:`; conversions accept only a structured operation and derive the output path next to the source; child processes use safe argument arrays so user input is never executed as a shell command. One documented hardening gap remains: the Chromium sandbox is currently disabled (`sandbox: false`) and is tracked as future work.

**Bundled dependencies.** Build scripts fetch platform binaries into `resources/bin/`; electron-builder packages them as `extraResources`; a runtime resolver finds the bundled binary with a PATH fallback, and yt-dlp is pointed at the bundled FFmpeg via `--ffmpeg-location`. The bundled yt-dlp adds roughly 15–20 MB and FFmpeg roughly 30 MB (uncompressed) to the installer — the deliberate trade-off that removes all setup burden from users.

**Testing.** 326 tests, all passing (verified by running `npm test` on this repository): 222 unit tests (URL validation, format normalization, output/progress parsing, argument construction, state transitions, error mapping, path safety), 10 integration tests (the Process Manager against mocked executables — no live network or real binaries required), and 94 renderer tests (pages, components, navigation flows with React Testing Library). End-to-end tests are not configured — an explicit, honest gap documented in the test script. CI runs typecheck and the full suite on every release.

**Documentation as engineering output.** Requirements (FR-001 to FR-019), architecture, testing strategy, and **eight** Architecture Decision Records (ADR-001 through ADR-008) live alongside the code and explain the major decisions: Electron as the framework, local-first JSON persistence, build-time binary bundling, tool isolation behind dedicated services, the Electron security model, and Chrome extension constraints.

### Results & Impact

Measured, verified outcomes from the repository:

- **326 passing tests** (222 unit / 10 integration / 94 renderer), run offline against mocked executables and enforced in CI — no benchmarks or performance numbers exist in the repository, and none are claimed here.
- **A tag-triggered release pipeline**: GitHub Actions verifies the version tag matches `package.json`, runs typecheck and the full test suite, packages the Windows NSIS installer, and publishes it to a GitHub Release. macOS (DMG) and Linux (AppImage) targets are configured; Windows is the automated release platform.
- **Setup burden eliminated by design**: yt-dlp and FFmpeg are fetched at build time and bundled into the installer, so end users install one file and get a working, offline-capable app with zero configuration.

The reliability engineering outcomes are demonstrated in the test suite rather than in numbers: Windows non-ASCII filename corruption fixed end to end (UTF-8 encoding + chunk-safe decoding); concurrent-download scheduling races handled with explicit guards and a regression test; duplicate outputs eliminated by embedding the format ID in the file template; completed downloads always keeping a verified file path, including self-repairing legacy records; and a dependency check bug (FFmpeg's `--version` returning a non-zero exit code) caught and corrected with unit tests.

### Your Role

I designed, built, and shipped EasyDownload end to end: from product requirements and architecture to the final tested release pipeline. Specifically, I implemented the Electron security architecture (hardened renderer/preload/main boundary, minimal bridge API, validated IPC, safe external-tool integration), the download engine (queue, state machine, concurrency enforcement, pause/resume/cancel/retry, duplicate prevention, reliable file-path capture), the eleven-service main-process backend with JSON-file persistence, the React interface (Home, Downloads sections, History, Settings, collapsible sidebar), the automated test suite, and the GitHub Actions release workflow. I also authored the engineering documentation — requirements, architecture, testing strategy, and eight ADRs — so the project is auditable and maintainable by any developer who picks it up next.

---

## Verification Notes

Ground truth: this document was written from **direct inspection of the repository** (`D:\code\EasyDownload`), with a fresh run of `npm test` on the working tree.

Confirmed directly from the codebase:

- Stack and versions: Electron 43.3, React 19.2, zod 4.4, electron-vite 5 / Vite 7.3, Vitest 4.1, React Testing Library, electron-builder 26, TypeScript `strict: true` in both `tsconfig.node.json` and `tsconfig.web.json`.
- **326 tests passing today** (222 unit + 10 integration + 94 renderer) — from an actual `npm test` run. The case study's `docs/PORTFOLIO.md` states "371 tests (255 unit, 10 integration, 106 renderer)"; the current codebase numbers differ, so the copy above uses the live, verified numbers.
- Security claims: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`, `setWindowOpenHandler` deny + `shell.openExternal`, minimal preload API, zod-validated IPC payloads, `spawn` argument arrays — all verified in `src/main/index.ts`, `src/preload/index.ts`, `src/main/ipc/index.ts`, `src/shared/schemas/index.ts`, `src/main/services/process/process-manager.ts`.
- Download engine: eight-status state machine, central concurrency enforcement (1–10), manual retry, duplicate prevention, file-path capture (`--print after_move:filepath`), backfill — verified in `src/main/services/download/download-manager.ts`.
- yt-dlp integration: `--no-playlist`, `--encoding utf-8`, `--ffmpeg-location`, format-ID-in-filename template, progress parsing — verified in `src/main/services/ytdlp/ytdlp-service.ts`.
- JSON stores named `history.json`, `inspection-history.json`, `conversions.json`, `settings.json` — verified via grep across `src/main/services/`.
- Release workflow (tag-triggered, `windows-latest`, typecheck + tests + `dist:win`, GitHub Release with `.exe`) — verified in `.github/workflows/release.yml`.
- Installer-size notes (~15–20 MB yt-dlp, ~30 MB FFmpeg) — verified in ADR-001 / ADR-002.
- ADR count: the repository contains **eight** ADRs (001–008) plus an ADR README. The case study's "nine records" and its reference to "ADR-009" for playlist downloads are not supported by the repository.

Conflicts with the case study (`docs/PORTFOLIO.md`) — codebase findings override:

- **Playlist downloads are NOT implemented.** The case study lists playlist downloads as a shipped feature (plus a playlist ADR). The codebase invokes yt-dlp with `--no-playlist` for both inspection and download, has no playlist tagging/preset/folder logic anywhere in `src/`, and `docs/REQUIREMENTS.md` explicitly parks playlist downloads in the P2 "Future" tier. All playlist content was therefore **removed** from the portfolio copy rather than falsely claimed.
- **Automatic retry with escalating backoff (2s/4s/8s/16s, up to 4 attempts) is NOT implemented.** The case study claims it; the codebase only has manual user-initiated retry (which reuses the original configuration) plus error classification that maps 403/429/5xx/network failures to a typed `NetworkError`. The copy describes the verified manual retry and error taxonomy, and omits the automatic-backoff claim.
- **Test count and ADR count differ** from the case study (see above). Copy updated to the verified values.

Not verified / honestly omitted:

- No benchmarks exist in the repository, so no performance or throughput numbers are claimed.
- The claim "eleven single-purpose services" matches the documented service list in `PROJECT_PROGRESS.md` / `docs/ARCHITECTURE.md` (eleven services named); it was cross-checked against `src/main/services/` structure.
- The Chromium sandbox gap (`sandbox: false`) is real and documented as future work in ADR-007; it is stated as such in the copy rather than hidden.

## Rationale

- **Audience layering:** the Description opens with the non-technical benefit (save videos locally, no accounts, no command line), moves to the visible feature set, and closes with one compact line of verified technical specifics (Electron + React + TypeScript, zod-validated IPC, bundled yt-dlp/FFmpeg, 326 tests) so both a client skimming for value and a reviewer checking depth find what they need.
- **Claim discipline:** everything in the copy traces to verified source or docs. The two unverifiable case-study features (playlists, automatic retry backoff) were deliberately excluded, and the stale test/ADR counts were corrected — fabricating or repeating them would undermine the portfolio with any technical reviewer.
- **Skills selection:** `Electron`, `TypeScript`, `React`, `Node.js`, and `Software Testing` are all Upwork-recognizable category names directly evidenced by the repository (package.json, the Node main process, the Vitest/RTL suite), chosen over niche names like `yt-dlp`/`FFmpeg`/`zod`/`electron-vite` that don't match Upwork's skill taxonomy as cleanly.
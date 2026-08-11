# ADR-005: yt-dlp Integration

## Status

Accepted

## Context

yt-dlp is the media extraction and download engine. It is a command-line tool with a large and evolving option set, and its output is unstructured text unless flags are chosen carefully. The application must:

- Inspect media metadata and available formats.
- Download selected formats with progress reporting.
- Merge video-only formats with the best available audio.
- Treat URLs, format IDs, and paths as untrusted input (SEC-003, SEC-004).
- Keep yt-dlp integration isolated from UI code.

Two integration strategies were considered:

- **Calling yt-dlp directly from application code** wherever needed. This couples many modules to yt-dlp's CLI, spreads argument construction and output parsing across the codebase, and makes security-sensitive argument handling easy to get wrong.
- **A dedicated yt-dlp service**. All yt-dlp interaction flows through one module that owns argument construction, output parsing, error mapping, progress normalization, and cancellation.

## Decision

Isolate yt-dlp behind a dedicated service.

- The yt-dlp service builds safe argument arrays (never shell strings) and launches yt-dlp through the Process Manager.
- Inspection uses `--dump-json --no-playlist --skip-download` and parses the first JSON line into the application media model.
- Downloads use `--newline` so progress lines can be parsed into normalized progress (percent, size, speed, ETA); phases and the final destination are captured from output lines.
- Failures are mapped to application errors (`UnsupportedMediaError`, `NetworkError`, `ProcessingError`, `ProcessError`, `DependencyError`).
- The service never exposes raw yt-dlp output to the renderer; the renderer receives only normalized data over validated IPC.
- yt-dlp is bundled at build time with PATH fallback (ADR-001), and the bundled FFmpeg directory is passed via `--ffmpeg-location` when present (ADR-002).

## Consequences

Easier:

- A single integration point: changing yt-dlp flags or parsing logic affects one module.
- Security-sensitive argument construction is centralized and testable (SEC-003).
- Renderer code and other services never depend on yt-dlp's command-line syntax.
- Progress and error handling are uniform across inspection and download.

Harder:

- The service must track yt-dlp's output format across versions.
- Adding a new yt-dlp capability requires extending the service and its tests rather than a one-off command call.

# ADR-006: FFmpeg Integration

## Status

Accepted

## Context

FFmpeg is required for media processing such as merging separate video/audio streams, format conversion, and audio extraction (section 13 of `docs/ARCHITECTURE.md`). The application must not assume every download needs FFmpeg, and FFmpeg integration must stay isolated from UI code.

Two integration strategies were considered:

- **Calling FFmpeg ad hoc** wherever processing is needed. Risks duplicated argument construction, inconsistent error handling, and uncontrolled codec flags.
- **A dedicated FFmpeg service** plus, for downloads, delegating merging to yt-dlp's built-in post-processing.

yt-dlp already implements robust stream merging (`-f <id>+bestaudio`) and invokes FFmpeg itself, so re-implementing the same merge for the download workflow would duplicate complex logic. At the same time, direct operations (conversion, audio extraction) belong to an application-owned service rather than being scripted through yt-dlp.

## Decision

Use two complementary FFmpeg integration paths.

- **Download merging (MVP):** when the selected format is video-only, the Download Manager requests `-f <id>+bestaudio` (plus a merge container) and yt-dlp invokes FFmpeg. The bundled FFmpeg directory is passed to yt-dlp via `--ffmpeg-location`, falling back to PATH when no bundled binary is present (ADR-002). Downloads fail early with a clear `DependencyError` when FFmpeg is unavailable (DEP-002).
- **Dedicated FFmpeg Service:** a reusable abstraction over the FFmpeg executable with `merge`, `convert`, and `extractAudio` operations. It builds safe argument arrays, uses a small structured codec option set rather than raw codec argument strings, parses `-progress` output into normalized progress, supports cancellation, and maps failures to application errors.

## Consequences

Easier:

- Download merging stays on yt-dlp's proven post-processing, avoiding duplicated merge logic.
- Direct conversion and audio-extraction features can be built on the FFmpeg Service without touching the download workflow.
- Consistent, tested argument construction and error mapping for direct FFmpeg use.
- Structured codec options prevent arbitrary codec flags from reaching the process.

Harder:

- Two integration surfaces to understand (yt-dlp-managed merging and the FFmpeg Service).
- The FFmpeg Service is currently unused by features; it is wired into the service graph for future use and must be kept aligned with the application's error model.
- FFmpeg availability must be checked before any operation that requires it (DEP-002).

# ADR-002: Build-time FFmpeg Bundling

## Status

Accepted

## Context

The application merges separate video/audio streams for video-only formats by delegating to yt-dlp's built-in post-processing (`-f <id>+bestaudio`), which invokes the FFmpeg executable. Users must be able to use this feature without manually installing FFmpeg.

Several distribution approaches were considered:

- Requiring a system-installed FFmpeg and resolving it through PATH.
- Having the application download and manage FFmpeg at runtime (self-managed).
- Bundling the correct FFmpeg binary into the packaged application at build time.

FFmpeg does not publish a single first-party set of standalone binaries for every platform. We use the `ffmpeg-static` GitHub releases as the binary source, which publishes per-platform static builds (Windows x64, macOS x64/arm64, Linux x64/arm64/arm/ia32) that are already used broadly by the Node.js ecosystem.

## Decision

Bundle the platform-appropriate FFmpeg binary into the application at build time, mirroring ADR-001 for yt-dlp.

- A build script (`scripts/download-ffmpeg.mjs`) downloads the latest `ffmpeg-static` release binary for the current platform and architecture into `resources/bin/` (as a gzip stream decompressed into place to reduce download size).
- electron-builder copies `resources/bin` into the packaged application's resources directory via `extraResources` (shared with the bundled yt-dlp binary).
- At runtime, `resolveFfmpegBinary` locates the bundled binary: `process.resourcesPath/bin/ffmpeg(.exe)` when packaged, or the dev-tree `resources/bin/ffmpeg(.exe)` in development.
- When a bundled binary is present, the yt-dlp service passes its directory to yt-dlp via `--ffmpeg-location` so merging uses the bundled FFmpeg.
- When no bundled binary is present, the application falls back to resolving `ffmpeg` from PATH.

## Consequences

Easier:

- Users get working audio merging without manually installing FFmpeg.
- The application works offline after installation.
- Dependency availability for merging is deterministic for packaged builds.

Harder:

- The FFmpeg binary must be downloaded before each release to stay current (the script is idempotent; use `--force` to refresh).
- Each packaging target must be produced with the correct platform and architecture binary.
- The FFmpeg binary adds roughly 30 MB (Windows/macOS x64, uncompressed) to the installer.
- Windows arm64 has no FFmpeg binary in the current `ffmpeg-static` release; those builds fall back to a system FFmpeg from PATH.
- Bundled binaries are not covered by the application's code signing; on macOS the FFmpeg binary may require additional Gatekeeper handling for signed releases.

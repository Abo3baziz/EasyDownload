# ADR-001: Build-time yt-dlp Bundling

## Status

Accepted

## Context

The application depends on the yt-dlp executable for media inspection and downloading. Users must be able to use the app without manually installing yt-dlp and without a Python runtime.

Several distribution approaches were considered:

- Requiring a system-installed yt-dlp and resolving it through PATH.
- Having the application download and manage yt-dlp at runtime (self-managed).
- Bundling the correct yt-dlp standalone binary into the packaged application at build time.

A runtime self-managed approach downloads binaries on first launch, which requires network access at runtime, complicates offline use, and adds update and integrity handling. Relying on a system install fails for users who cannot or will not install yt-dlp.

yt-dlp publishes standalone binaries for Windows, macOS, and Linux per architecture, so no Python runtime is required.

## Decision

Bundle the platform-appropriate yt-dlp standalone binary into the application at build time.

- A build script (`scripts/download-ytdlp.mjs`) downloads the latest yt-dlp release binary for the current platform and architecture into `resources/bin/`.
- electron-builder copies `resources/bin` into the packaged application's resources directory via `extraResources`.
- At runtime, `resolveYtDlpBinary` locates the bundled binary: `process.resourcesPath/bin/yt-dlp(.exe)` when packaged, or the dev-tree `resources/bin/yt-dlp(.exe)` in development.
- When no bundled binary is present, the application falls back to resolving `yt-dlp` from PATH.

## Consequences

Easier:

- Users get a working application without manually installing yt-dlp or Python.
- The application works offline after installation.
- Dependency availability is deterministic for packaged builds.

Harder:

- The yt-dlp binary must be downloaded before each release to stay current (the script is idempotent; use `--force` to refresh).
- Each packaging target must be produced with the correct platform and architecture binary.
- The binary adds roughly 15-20 MB to the installer.
- Bundled binaries are not covered by the application's code signing; on macOS the yt-dlp binary may require additional Gatekeeper handling for signed releases.

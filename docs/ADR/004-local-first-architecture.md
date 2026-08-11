# ADR-004: Local-First Architecture

## Status

Accepted

## Context

The product must perform downloading locally on the user's device and must remain usable without user accounts, a remote API, a cloud database, or cloud storage (NFR-005). An internet connection is required only to access online media or to update the application and its dependencies.

Several architectures were considered:

- **Cloud-backed downloader**: URLs are sent to a server that downloads and streams media back. This contradicts the local-first product goal, introduces infrastructure and privacy costs, and complicates offline use.
- **Hybrid**: local execution with optional cloud features. Adds complexity and scope beyond the MVP.
- **Local-first**: yt-dlp and FFmpeg run on the user's machine; files land in a user-selected local directory; no remote backend participates in the core download workflow.

The core workflow (inspect → download → process → save) is fully local and does not depend on any server. The future Chrome extension also sends detected media to the desktop application through local communication rather than through a remote service (EXT-002).

## Decision

Adopt a local-first architecture for the core downloader.

- Media inspection, downloading, merging, and file storage all happen on the user's device.
- The application requires no user account, remote API, or cloud backend for core functionality.
- An internet connection is required only for fetching online media and for updating the application or its managed dependencies.
- The download directory is a local, user-controlled path persisted in application settings (FR-009, FR-016).

## Consequences

Easier:

- Works offline after installation, aside from fetching the media itself.
- User content stays on the user's machine (privacy).
- No server infrastructure to build, operate, or secure.
- The future Chrome extension can integrate through local communication (see ADR-008).

Harder:

- Downloads are limited by the local machine's network and disk.
- No cross-device history or sync.
- Distribution must bundle or manage yt-dlp and FFmpeg locally (ADR-001, ADR-002) so the local-first model does not burden the user.

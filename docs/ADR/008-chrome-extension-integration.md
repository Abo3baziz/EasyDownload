# ADR-008: Chrome Extension Integration

## Status

Proposed

## Context

A future Chrome extension will detect downloadable media on web pages and send supported URLs to the desktop application (EXT-001, EXT-002). The extension is explicitly out of scope for the MVP (section 4.1 and section 10 of `docs/REQUIREMENTS.md`), but the architecture must accommodate it without rework.

The extension should act as a **discovery and control layer**, not the download engine: it detects media, presents it to the user, and forwards the selection to the desktop application, which remains responsible for inspection, downloading, and file management (EXT-002).

Several communication mechanisms were considered:

- **Chrome Native Messaging**: a documented, local channel from the extension to a host executable, but it is designed for persistent short-lived host processes and would require the application to run a host during downloads.
- **A local IPC bridge** (named pipe/Unix socket): direct and low-overhead but requires platform-specific plumbing and lifecycle coordination.
- **Controlled localhost communication**: the desktop app listens on a local port and the extension POSTs a validated request; straightforward to implement and test across platforms but must be bound locally and authenticated to avoid abuse by arbitrary local callers.

The exact mechanism is intentionally not finalized (section 29 of `docs/ARCHITECTURE.md`).

## Decision

Defer the Chrome extension implementation but lock in its architectural constraints.

- The extension is a discovery and control layer; all inspection, downloading, and file operations remain in the Electron main process.
- Communication with the desktop application is local-only where possible.
- Requests from the extension must be authenticated/verified so arbitrary local callers cannot trigger privileged operations.
- No unrestricted command execution: the extension sends URLs/selected media, never shell commands.
- No unrestricted filesystem access: the extension cannot read or write arbitrary paths.
- No dependency on a public internet API for the core communication path.
- The final mechanism (Native Messaging, a local IPC bridge, or controlled localhost) will be selected and documented in a separate ADR before implementation.

## Consequences

Easier:

- The existing validated IPC and service boundaries give a natural place to land extension requests.
- Keeping downloads in the Electron process preserves the security model (ADR-007) and the local-first model (ADR-004).

Harder:

- The extension adds an out-of-band attack surface; authentication and local binding must be designed carefully when implemented.
- The communication mechanism decision is still open, so the integration cannot be built yet.
- Browser extension stores may review the extension independently of the desktop application.

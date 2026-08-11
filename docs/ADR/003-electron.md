# ADR-003: Electron as the Desktop Framework

## Status

Accepted

## Context

The application is a cross-platform desktop media downloader that must:

- Run on Windows, macOS, and Linux.
- Manage long-running child processes (yt-dlp, FFmpeg).
- Interact with the operating system (filesystem, dialogs, notifications).
- Provide a rich user interface built with React and TypeScript.
- Perform all downloading locally on the user's device.

Several approaches were considered:

- **Native per-platform apps** (Swift/WinUI/GTK): best platform integration but three separate codebases and high maintenance cost.
- **A web application**: no native process management, filesystem, or notifications; incompatible with the local-first requirement.
- **Tauri**: smaller binaries and a Rust backend, but the backend ecosystem for Node-style tooling and process management differs from the project's chosen stack.
- **Electron**: one codebase across platforms, a Node.js main process capable of spawning and managing child processes, a Chromium renderer for the React UI, native dialogs/notifications, and mature packaging via electron-builder.

Electron also fits the project's requirement that yt-dlp and FFmpeg run locally and be managed by the desktop application (DEP-001, DEP-002).

## Decision

Use Electron as the desktop application framework.

- Electron is responsible for the application lifecycle, secure main/preload/renderer separation, IPC, child process management, filesystem operations, native dialogs, and desktop notifications (section 3.1 of `docs/REQUIREMENTS.md`).
- The React + TypeScript UI runs in the renderer process with a controlled preload API.
- The Node.js main process owns privileged operations and delegates to dedicated services (see `docs/ARCHITECTURE.md` section 9).
- Packaging and distribution use electron-builder (ADR-001 and ADR-002 cover the bundled binaries).

## Consequences

Easier:

- Single codebase across Windows, macOS, and Linux.
- Node.js main process provides a natural fit for managing yt-dlp and FFmpeg subprocesses.
- Rich Chromium renderer supports the React UI and future extension/browser integration work.
- Mature packaging, icon, and distribution tooling.

Harder:

- Larger installers and higher runtime memory use than native or Tauri alternatives.
- The renderer is an unprivileged context by design; all privileged work must flow through the main process, which adds IPC surface area to secure (see ADR-007).
- Electron version upgrades and Chromium security patches must be tracked.

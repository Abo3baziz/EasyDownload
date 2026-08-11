# ADR-007: Electron Security Model

## Status

Accepted

## Context

The renderer runs application content (React) that interacts with privileged main-process services. Following Electron security best practices, the renderer must be treated as an untrusted context: it must not receive unrestricted Node.js, filesystem, or process access, and IPC must expose only explicit, validated operations (SEC-001 through SEC-007).

The alternatives considered were:

- **Relaxed model**: enable `nodeIntegration`, expose raw `ipcRenderer`, or grant the renderer broad access for convenience. This violates the security requirements and dramatically widens the attack surface of any future remote content.
- **Hardened model**: enable context isolation and disable Node integration, expose a minimal preload API, validate every IPC payload, and never execute user input as shell commands.

## Decision

Adopt a hardened, defense-in-depth security model.

- Browser windows use `contextIsolation: true` and `nodeIntegration: false`.
- The preload script exposes only a minimal, explicit API (`window.mediaDownloader`) built on `contextBridge`; it never exposes `ipcRenderer`, `shell`, `fs`, `child_process`, `process`, or `require`.
- IPC uses explicit channels with zod-validated payloads (ER-004) and returns a structured `IpcResult` rather than throwing across IPC.
- External commands are launched with argument arrays, never shell strings; URLs, format IDs, filenames, and paths are treated as untrusted input (SEC-003).
- New windows are denied (`setWindowOpenHandler` returns `{ action: 'deny' }`) and external links open only through `shell.openExternal`.
- The renderer never parses raw yt-dlp or FFmpeg output; the main process normalizes data before sending it over IPC.
- The Chromium sandbox is currently disabled (`sandbox: false`) because the preload is bundled by electron-vite and historically relied on Node support; the bundled preload uses only Electron APIs and is compatible with the sandbox, so enabling it remains a hardening candidate.

## Consequences

Easier:

- Remote or compromised renderer content is isolated from privileged OS and Node access.
- Every privileged operation has an explicit, validated contract, which is straightforward to audit and test.
- Security-sensitive behavior (argument construction, IPC validation, path safety) is unit-tested.

Harder:

- All privileged work must be implemented and routed through the main process; there is no escape hatch for the renderer.
- Preload and IPC surface must be kept minimal and reviewed when new capabilities are added.
- Remaining hardening items are tracked: enabling the Chromium sandbox and adding an explicit `will-navigate` guard.

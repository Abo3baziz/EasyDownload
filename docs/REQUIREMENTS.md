# Requirements — Media Downloader

## 1. Overview

Build a cross-platform desktop media downloader application that runs primarily on the user's device.

The application uses:

* **Electron** for the desktop application shell and native capabilities.
* **React + TypeScript** for the user interface.
* **yt-dlp** as the media extraction and download engine.
* **FFmpeg** for media processing, merging, and conversion where required.

The application must perform downloading locally on the user's machine rather than relying on a remote backend for the core download workflow.

A future Chrome extension will integrate with the desktop application to detect downloadable media on web pages and send supported URLs to the desktop application.

---

# 2. Product Goals

The application should:

1. Allow users to download supported online media directly to their device.
2. Provide a simple and fast desktop user experience.
3. Allow users to inspect available media formats before downloading.
4. Provide download progress and status.
5. Support download queue management.
6. Keep downloaded files and core processing local to the user's machine.
7. Avoid requiring a cloud backend for the core functionality.
8. Provide a clean architecture that can later support a Chrome extension.
9. Manage yt-dlp and FFmpeg dependencies reliably.
10. Support Windows, macOS, and Linux.
11. Be designed for maintainability and future feature expansion.

---

# 3. Technology Requirements

## 3.1 Desktop Framework

The desktop application must use **Electron**.

Electron is responsible for:

* Desktop application lifecycle.
* Native operating-system integration.
* Secure communication between the renderer and main process.
* Process management.
* Filesystem operations.
* Native dialogs.
* Desktop notifications where required.
* Application packaging and distribution.

---

## 3.2 Frontend

The renderer must use:

* React
* TypeScript

The renderer is responsible for:

* User interface.
* User interaction.
* Displaying media metadata.
* Displaying available formats.
* Download progress.
* Download history/status.
* Application settings.

The renderer must not directly execute yt-dlp or FFmpeg.

---

## 3.3 Media Engine

The application must use:

* **yt-dlp** for media extraction and downloading.
* **FFmpeg** for media processing when required.

These tools must be managed by the desktop application.

---

## 3.4 Supported Operating Systems

The application should be designed to support:

* Windows
* macOS
* Linux

Platform-specific functionality must be isolated where possible.

Distribution on macOS must account for application signing and notarization requirements.

---

# 4. Scope

## 4.1 MVP Scope

The first version must support:

* Entering a media URL manually.
* Validating the URL.
* Inspecting the URL using yt-dlp.
* Retrieving media metadata.
* Displaying:

  * title
  * thumbnail
  * duration
  * uploader/channel when available
  * available formats
* Selecting a download format/quality.
* Selecting a local download directory.
* Starting a download.
* Displaying download progress.
* Displaying download status.
* Cancelling an active download.
* Showing completed downloads.
* Opening the downloaded file.
* Opening the containing directory.
* Handling download and extraction errors.
* Running entirely on the user's device.

---

# 5. Functional Requirements

## FR-001 — URL Input

The application must provide an input where the user can enter a media URL.

The application must:

* Accept a valid URL.
* Reject malformed URLs.
* Prevent empty submissions.
* Provide useful validation feedback.

---

## FR-002 — Media Inspection

The application must inspect a submitted URL before downloading.

The inspection process should use yt-dlp to retrieve available metadata and formats.

The application must not start a full download merely because the user requested inspection.

---

## FR-003 — Media Metadata

When available, the application should display:

* Title
* Thumbnail
* Duration
* Uploader/channel
* Source/site
* Available formats
* Video resolution
* Video codec
* Audio codec
* File extension
* Estimated file size when available

The UI must gracefully handle metadata that is unavailable.

---

## FR-004 — Format Selection

The user must be able to select an available format.

The application should provide understandable choices rather than exposing only raw yt-dlp format IDs.

Example:

```text
1080p MP4
720p MP4
480p MP4
Audio
```

Advanced format information may be displayed separately.

---

## FR-005 — Download

The application must allow the user to start a download after selecting a format.

Downloads must execute locally.

The application must not upload the media to a remote server as part of the normal download workflow.

---

## FR-006 — Download Progress

The application must display download progress when yt-dlp provides sufficient information.

Progress may include:

* Percentage
* Downloaded size
* Total size
* Download speed
* Estimated remaining time
* Current status

Example:

```text
Downloading

██████████████░░░░░░ 72%

1.2 GB / 1.7 GB
4.8 MB/s
ETA 01:32
```

---

## FR-007 — Download States

Downloads should have explicit states.

At minimum:

```text
queued
inspecting
downloading
processing
completed
failed
cancelled
```

The UI must clearly distinguish these states.

---

## FR-008 — Cancellation

The user must be able to cancel an active download.

Cancellation must terminate the relevant local download process safely.

The application must avoid leaving unnecessary temporary files after cancellation.

---

## FR-009 — Download Location

The user must be able to select where downloaded files are stored.

The application should provide:

* Default download directory.
* Directory selection.
* Remembered user preference.

---

## FR-010 — File Management

After a successful download, the application should allow the user to:

* Open the downloaded file.
* Open the containing directory.
* View the filename.
* View the file size.
* View the download status.

---

## FR-011 — Error Handling

The application must handle failures gracefully.

Potential failures include:

* Invalid URL.
* Unsupported URL.
* yt-dlp failure.
* FFmpeg failure.
* Network failure.
* Permission failure.
* Insufficient disk space.
* Missing dependency.
* Process termination.
* Invalid format selection.

Errors should provide useful information without exposing unnecessary internal implementation details.

---

## FR-012 — Download Queue

The application must support queueing downloads.

The queue must:

* Allow adding a download while another is active.
* Maintain an ordered queue.
* Allow cancelling a queued download.
* Allow clearing the queue.
* Execute queued downloads automatically once active downloads complete.

The MVP may limit execution to a single concurrent download.

---

## FR-013 — Download History

The application must maintain a history of completed and failed downloads.

History should persist across application restarts.

The application should allow the user to:

* View past downloads.
* View the status of each historical download.
* View filename, file size, source, and destination for completed downloads.
* Retry a failed or cancelled download where supported.
* Clear history.

History storage is an implementation decision and must not require a remote service.

---

## FR-014 — Retry

The application must allow the user to retry a failed or cancelled download.

Retry must reuse the original download configuration.

Retry must not be offered for downloads that are no longer resolvable.

---

## FR-015 — Desktop Notifications

The application may show desktop notifications.

Notifications should cover:

* Download completion.
* Download failure.

Notifications must be optional and user-controllable.

Notification behavior must be isolated from the core download workflow.

---

## FR-016 — Application Settings

The application must provide a settings interface for user preferences.

Settings should include:

* Default download directory.
* Whether desktop notifications are enabled.
* Download concurrency limit where supported.
* Dependency management preferences where applicable.

Settings must be persisted locally.

The download directory preference defined in FR-009 is part of application settings.

---

## FR-017 — Filename Collision Handling

The application must define behavior when a downloaded file would overwrite an existing file.

The application should choose one of:

* Auto-rename the new file.
* Overwrite the existing file.
* Prompt the user before overwriting.

The default behavior is an implementation decision.

The chosen behavior must never write outside the selected download directory.

---

## FR-018 — Proxy / Network Configuration

The application should allow optional proxy configuration for network operations.

Proxy settings must be passed safely to yt-dlp.

Proxy support may be deferred to a future version.

---

## FR-019 — Application and Dependency Updates

The application must be able to detect the version of bundled or managed yt-dlp and FFmpeg dependencies.

The application should support updating managed dependencies.

Application-level auto-updates may be added in a future version.

---

# 6. Electron Architecture Requirements

## ER-001 — Process Separation

The application must follow Electron's process model.

The architecture should separate:

```text
Renderer Process
      |
      | IPC
      v
Preload
      |
      | Controlled API
      v
Main Process
      |
      ├── Download Manager
      ├── yt-dlp Manager
      ├── FFmpeg Manager
      ├── File Manager
      └── Application Services
```

---

## ER-002 — Renderer Restrictions

The renderer must not:

* Execute yt-dlp directly.
* Execute FFmpeg directly.
* Spawn arbitrary operating-system processes.
* Access the filesystem directly.
* Use unrestricted Node.js APIs.

The renderer should communicate with the main process through a controlled API exposed by the preload script.

---

## ER-003 — Preload

The preload script must expose only the APIs required by the renderer.

Example conceptual API:

```text
window.mediaDownloader.inspectUrl()
window.mediaDownloader.startDownload()
window.mediaDownloader.cancelDownload()
window.mediaDownloader.selectDirectory()
window.mediaDownloader.openFile()
window.mediaDownloader.openDirectory()
```

The exact API is an implementation decision and should be documented in the architecture documentation.

---

## ER-004 — IPC

IPC communication must use explicit channels and validated payloads.

Do not expose a generic unrestricted IPC mechanism to the renderer.

Each IPC operation should have a clearly defined purpose and input/output contract.

---

## ER-005 — Main Process

The Electron main process is responsible for privileged operations including:

* Starting yt-dlp.
* Starting FFmpeg.
* Managing child processes.
* Filesystem operations.
* Native dialogs.
* Application-level download management.
* Opening downloaded files.
* Opening directories.
* Communicating with the renderer through controlled IPC.

---

# 7. Security Requirements

## SEC-001 — Context Isolation

Electron security best practices must be enabled.

The application should use:

* `contextIsolation: true`
* `nodeIntegration: false`

The renderer must not receive unrestricted Node.js access.

---

## SEC-002 — Secure Preload API

The preload script must expose a minimal, explicit API.

Do not expose the entire Electron or Node.js API to the renderer.

---

## SEC-003 — Command Injection Protection

Never construct shell commands by directly concatenating user input.

Use safe child-process APIs and argument arrays.

User-controlled URLs, filenames, format IDs, and paths must be treated as untrusted input.

---

## SEC-004 — URL Validation

URLs must be validated before being passed to the download engine.

Validation must not be treated as a complete security boundary.

yt-dlp arguments must still be constructed safely.

---

## SEC-005 — Filesystem Safety

Downloaded filenames and paths must not allow unintended writes outside the selected download directory.

---

## SEC-006 — Electron Navigation

The application should prevent unauthorized navigation of the application window to arbitrary remote websites.

The renderer should load only trusted application content.

---

## SEC-007 — Remote Code

The application must not execute arbitrary remote JavaScript code.

Remote content must not be loaded into privileged Electron contexts.

---

# 8. Dependency Management

## DEP-001 — yt-dlp

The application must be able to determine whether yt-dlp is available.

The architecture should support bundling or managing yt-dlp rather than requiring users to manually configure command-line tools.

---

## DEP-002 — FFmpeg

The application must be able to determine whether FFmpeg is available when media processing requires it.

The architecture should support bundling or managing FFmpeg.

---

## DEP-003 — Platform Dependencies

The application must account for platform-specific executables and behavior.

Conceptually:

```text
Windows
├── yt-dlp executable
└── FFmpeg executable

macOS
├── yt-dlp executable
└── FFmpeg executable

Linux
├── yt-dlp executable
└── FFmpeg executable
```

The exact packaging strategy is an architecture decision.

---

# 9. User Experience Requirements

## UX-001 — Simple Primary Workflow

The main workflow should be:

```text
Enter URL
    ↓
Inspect
    ↓
View Media
    ↓
Choose Format
    ↓
Choose Location
    ↓
Download
    ↓
Track Progress
    ↓
Completed
```

The user should not need to understand yt-dlp commands.

---

## UX-002 — Clear Feedback

Every long-running operation must provide visible feedback.

The user should never be left wondering whether:

* inspection is running
* download is running
* processing is running
* the application is frozen
* the operation failed

---

## UX-003 — Responsive Interface

Long-running yt-dlp and FFmpeg operations must not block the renderer.

The interface must remain responsive while downloads are running.

---

# 10. Future Chrome Extension

The Chrome extension is a future enhancement and must not be implemented as part of the MVP.

## EXT-001 — Media Detection

The extension should eventually detect potentially downloadable media on supported web pages.

It should avoid aggressively scanning irrelevant resources.

---

## EXT-002 — Desktop Integration

The extension should be able to send detected media information to the desktop application.

Conceptually:

```text
Chrome Extension
       |
       | Local communication
       v
Electron Desktop App
       |
       v
Download Manager
       |
       v
yt-dlp
```

The desktop application remains responsible for the actual downloading.

---

## EXT-003 — Extension Security

The extension must not:

* Receive unrestricted filesystem access.
* Execute arbitrary operating-system commands.
* Bypass DRM.
* Bypass authentication controls.
* Bypass paywalls.
* Circumvent technical access controls.

The exact Chrome-to-Electron communication mechanism is an implementation/architecture decision.

---

# 11. Non-Functional Requirements

## NFR-001 — Performance

The application should use reasonable system resources while idle.

Long-running downloads must not freeze the interface.

---

## NFR-002 — Reliability

A failed download must not crash the entire application.

Individual download failures should be isolated from other downloads.

---

## NFR-003 — Maintainability

The codebase must use clear module boundaries.

Responsibilities should not be mixed unnecessarily.

---

## NFR-004 — Cross-Platform Design

The application should support:

* Windows
* macOS
* Linux

Platform-specific behavior should be isolated where possible.

---

## NFR-005 — Local-First

The application should remain usable without:

* User accounts.
* A remote API.
* A cloud database.
* Cloud storage.

An internet connection is required only when accessing online media or updating application/dependency components.

---

# 12. Legal and Platform Considerations

The application must not intentionally implement mechanisms designed to:

* Bypass DRM.
* Bypass authentication.
* Bypass paywalls.
* Circumvent technical access controls.
* Defeat website security mechanisms.

The application should respect applicable laws and the terms of the services from which users download content.

The project should distinguish between:

```text
Downloading technically accessible media
```

and:

```text
Circumventing technical restrictions
```

The latter is outside the project scope.

---

# 13. Out of Scope

The following are explicitly outside the initial scope:

* Cloud-based downloading.
* User accounts.
* Remote download servers.
* Cloud storage.
* Payment systems.
* Social features.
* DRM bypassing.
* Authentication bypassing.
* Paywall bypassing.
* CAPTCHA bypassing.
* Automated scraping intended to circumvent platform protections.
* Mobile applications.
* Chrome extension implementation.
* Remote execution of yt-dlp.

---

# 14. Development Principles

Agents working on this project must:

1. Read `docs/REQUIREMENTS.md` before implementing requirements.
2. Consult architecture documentation before changing architecture.
3. Keep the core downloader local-first.
4. Keep yt-dlp integration isolated from UI code.
5. Keep FFmpeg integration isolated from UI code.
6. Keep Electron main, preload, and renderer responsibilities clearly separated.
7. Never expose unrestricted Node.js APIs to the renderer.
8. Never expose unrestricted IPC to the renderer.
9. Never construct shell commands by concatenating user input.
10. Avoid unnecessary dependencies.
11. Never modify `node_modules` directly.
12. Update relevant documentation whenever requirements or behavior change.
13. Add or update tests when functionality changes.
14. Follow the project's Git and commit conventions.
15. Do not implement future-scope features unless explicitly requested.

---

# 15. Requirement Priority

## P0 — Required for MVP

* Electron application
* React + TypeScript UI
* Secure Electron process architecture
* URL input
* URL validation
* Media inspection
* Metadata display
* Format selection
* Local downloading
* Progress tracking
* Download cancellation
* Download directory selection
* Error handling
* yt-dlp integration
* FFmpeg integration where required
* Safe process management
* Windows support

## P1 — Important

* Linux support
* macOS support
* Download history (FR-013)
* Queue management (FR-012)
* Retry (FR-014)
* Better format selection
* Dependency management
* File management
* Desktop notifications (FR-015)
* Application settings (FR-016)
* Filename collision handling (FR-017)

## P2 — Future

* Chrome extension
* Browser integration
* Extension-to-desktop communication
* Playlist downloads
* Subtitle downloads
* Audio-only downloads
* Advanced presets
* Multi-download concurrency
* Proxy / network configuration (FR-018)
* Application and dependency auto-updates (FR-019)

---

# 16. Source of Truth

This document defines **what the product must do**.

It does not define every implementation detail.

Implementation decisions should be documented separately in architecture and design documentation.

Suggested documentation structure:

```text
docs/
├── REQUIREMENTS.md
├── ARCHITECTURE.md
├── TESTING.md
└── ADR/
```

The agent must consult the relevant documentation before implementing or modifying functionality.

# E-008: Bundle or detect a JavaScript runtime for yt-dlp

- **Status:** Open
- **Priority:** Medium
- **Category:** Enhancement / Reliability
- **Branch:** TBD

## Source

- Discovered during B-017 investigation (2026-08-25)
- yt-dlp warning: "No supported JavaScript runtime could be found. Only deno is enabled by
  default; ... YouTube extraction without a JS runtime has been deprecated, and some
  formats may be missing."
- https://github.com/yt-dlp/yt-dlp/wiki/EJS

## Problem

Current yt-dlp releases expect a JavaScript runtime (deno by default; node/bun possible
via `--js-runtimes`) to solve YouTube's challenges. Without one:

- Some formats may be missing during inspection (users may see stale/unavailable format
  errors at download time).
- Extraction behavior will degrade further as YouTube enforces this.

End users of packaged builds have no guaranteed JS runtime on their machine.

## Options

1. Bundle a lightweight runtime (e.g., deno single binary or quickjs) via
   `extraResources`, next to yt-dlp/ffmpeg, and pass `--js-runtimes deno:<path>`.
2. Detect an installed runtime at startup and add it to the dependency status UI.
3. At minimum, surface the missing-runtime warning to the user instead of swallowing it.

## Acceptance Criteria

- [ ] Packaged app includes or detects a JS runtime for yt-dlp.
- [ ] Dependency check reports its availability alongside yt-dlp/ffmpeg.
- [ ] Downloads no longer depend on the end user's environment having node/deno installed.

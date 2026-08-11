# Testing — EasyDownload

## 1. Purpose

This document defines the testing strategy for the EasyDownload desktop application.

It describes:

* Testing principles.
* Test levels and boundaries.
* Handling of external processes in tests.
* Test fixtures and data.
* Testing tools.
* How to run tests.
* Coverage expectations.

Product behavior is defined in:

```text
docs/REQUIREMENTS.md
```

Technical architecture is defined in:

```text
docs/ARCHITECTURE.md
```

---

## 2. Testing Principles

Testing should follow the application boundaries.

The following principles apply:

1. Test behavior, not implementation details.
2. Keep tests isolated from the UI where possible.
3. Never require a live network connection for the default test suite.
4. Mock external processes such as yt-dlp and FFmpeg rather than relying on real ones.
5. Mock the filesystem where tests should not write real files.
6. Do not rely on internal implementation details that may change.
7. Tests should be deterministic and fast.
8. Errors and failure paths are as important as happy paths.
9. Security-sensitive behavior must be covered by tests.
10. Every functional requirement should be traceable to tests.

---

## 3. Test Levels

### 3.1 Unit Tests

Unit tests target isolated modules and functions.

Cover:

* URL validation.
* Format normalization.
* yt-dlp output parsing.
* FFmpeg argument construction and progress parsing.
* Progress parsing.
* Download state transitions.
* Error mapping.
* Path validation.
* Filename collision handling.

Unit tests must not spawn real external processes or write to the real filesystem.

### 3.2 Integration Tests

Integration tests verify that modules cooperate correctly.

Cover:

* Media Service parsing and normalization.
* Download Manager lifecycle.
* Process Manager argument construction.
* yt-dlp service against a mocked executable.
* FFmpeg service against a mocked executable.
* Filesystem behavior against a temporary directory.
* Dependency Manager detection and version resolution.
* Queue behavior (FR-012).
* History persistence (FR-013).
* Retry behavior (FR-014).
* Settings persistence (FR-016).
* Notification Manager behavior (FR-015).

External executables must be represented by test doubles.

### 3.3 Renderer Tests

Renderer tests verify UI behavior.

Cover:

* Components.
* User interactions.
* State transitions.
* Error display.
* Progress visualization.
* Format selection.

Renderer tests must not access the filesystem or spawn processes.

### 3.4 End-to-End Tests

End-to-end tests verify critical user workflows through the running application.

Critical workflows:

```text
Enter URL
 ↓
Inspect
 ↓
Select format
 ↓
Download
 ↓
Completed
```

```text
Enter URL
 ↓
Inspect
 ↓
Download
 ↓
Cancel
 ↓
Cancelled
```

```text
Download
 ↓
Fail
 ↓
Retry
 ↓
Completed
```

End-to-end tests should run against mocked external processes to remain deterministic.

---

## 4. External Process Handling

yt-dlp and FFmpeg must not be required to run the test suite.

Use test doubles that behave like the real executables:

* A fake yt-dlp executable that emits canned inspection, progress, and completion output.
* A fake yt-dlp executable that emits scripted error output.
* A fake FFmpeg executable with configurable exit behavior.

The fake executables should read scripted scenarios from fixtures.

Real-process tests, when performed, must be manual or opt-in and clearly marked.

---

## 5. Test Fixtures and Data

Fixtures should include:

* Sample yt-dlp JSON metadata output.
* Sample progress output.
* Sample error output.
* Sample format lists.
* Invalid URL examples.
* Malformed output examples.

Fixtures must be version-controlled and small.

---

## 6. Testing Tools

The exact tooling is an implementation decision.

Suggested tooling:

* Unit/integration tests: Vitest.
* Renderer tests: Vitest with React Testing Library.
* End-to-end tests: Playwright.
* Code coverage: Vitest coverage or equivalent.

The tooling may change during implementation.

---

## 7. Running Tests

The project should provide scripts for:

```text
npm test        Run all non-E2E tests
npm run test:unit
npm run test:integration
npm run test:renderer
npm run test:e2e
```

The default test suite must not require a live network connection or real external binaries.

---

## 8. Coverage Expectations

Relevant modules should have meaningful coverage.

Priority areas:

* URL validation.
* Argument construction for external processes.
* Output parsing.
* Download state transitions.
* Error mapping.
* Filesystem path safety.

Coverage numbers alone are not a quality target.

Tests must assert behavior, including failure paths.

---

## 9. Security Testing

Security-sensitive behavior must be tested:

* Command construction must never concatenate user input.
* Renderer must not receive unrestricted IPC.
* Download filenames and paths must remain within the selected download directory.
* IPC payloads must be validated.

Security tests should fail closed if a violation is detected.

---

## 10. Source of Truth

This document defines **how the product is tested**.

It does not define every test case.

The exact strategy and tooling may evolve during implementation.

Before writing tests for a feature, the agent must consult `docs/REQUIREMENTS.md` and `docs/ARCHITECTURE.md`.

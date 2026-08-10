> This document provides AI agents with the context required to understand the project before making changes. Read this file first.

---

# Git Workflow

This project follows **GitHub Flow** with short-lived branches.

The `main` branch must always remain stable and deployable.

## Branching Strategy

Never commit directly to `main`.

Create a new branch for **every piece of work**, including features, bug fixes, refactors, documentation updates, testing work, and chores.

Branch naming conventions:

```text
feature/<feature-name>
bugfix/<issue-name>
refactor/<module-name>
docs/<topic>
test/<module>
chore/<task>
hotfix/<issue-name>
```

## Working on a Task

For every new task:

1. Ensure `main` is up to date.
2. Create a new branch from the latest `main`.
3. Implement only the requested changes.
4. Update documentation if necessary.
5. Update `PROJECT_PROGRESS.md` when implementation status changes.
6. Run relevant tests and checks.
7. If the work is a completed feature, open a Pull Request.
8. Do not open a Pull Request for non-feature work unless explicitly instructed.
9. Do not merge any branch unless explicitly instructed by the user.
10. Delete a feature branch after its Pull Request has been merged.

## Commit Messages

Follow **Conventional Commits**.

### Format

```text
<type>(<scope>): <short description>

<body>
```

### Subject

- Keep the subject concise and specific.
- Use imperative mood.
- Focus on **what changed**, not how it was implemented.
- Do not end the subject with a period.

### Commit Body

Add a commit body when the change is more than a simple one-line change.

The body should be **detailed enough to explain the important changes, but not overly detailed**.

Include:

- The main changes made.
- Important behavior or architectural changes.
- Relevant configuration, database, API, or documentation updates.
- Important decisions or considerations when necessary.

Do **not**:

- List every modified file.
- Explain obvious implementation details.
- Copy large sections of code.
- Turn the commit body into a full technical report.

Aim for **2–5 concise bullet points** when a body is needed.

### General Rule

The commit message should allow someone to understand **what changed and why it matters** without needing to inspect every file, while avoiding unnecessary implementation details.

## Pull Requests

Pull Requests are **only for completed features**.

Each feature Pull Request should:

- Focus on a single feature.
- Include a clear description of the feature and changes.
- Reference related documentation when applicable.
- Update endpoint documentation when endpoints change.
- Update `PROJECT_PROGRESS.md` when implementation status changes.
- Ensure relevant tests pass before opening the PR.
- Target the `main` branch.
- Do not merge the Pull Request unless explicitly instructed by the user.
- Delete the feature branch after the Pull Request has been merged.

Do **not** open Pull Requests for:

- Bug fixes
- Refactors
- Documentation changes
- Testing work
- CI changes
- Chores
- Dependency updates
- `PROJECT_PROGRESS.md` updates

Unless the user explicitly instructs otherwise.

---

# Agent Workflow

Follow this workflow for every task.

## 1. Understand

- Read `AGENTS.md`.
- Read the user's request carefully.
- Identify the task type and affected domain.
- Determine which project documentation is relevant.

## 2. Inspect

- Review the relevant documentation.
- Inspect the existing implementation.
- Inspect relevant tests.
- Identify existing patterns and conventions before making changes.

## 3. Plan

Before making changes:

- Determine the required changes.
- Identify affected files and modules.
- Consider API, database, architecture, security, and testing implications when applicable.
- Keep the plan proportional to the complexity of the task.

## 4. Implement

- Create the appropriate branch.
- Implement only the requested scope.
- Follow the existing architecture and project conventions.
- Avoid unrelated refactoring or changes.

## 5. Validate

After implementation:

- Run the relevant tests and checks.
- Verify type safety, linting, and build requirements when applicable.
- Verify that the implementation satisfies the original request.
- Fix any issues found during validation.

## 6. Document

Update relevant project documentation when the implementation changes:

- API behavior
- Database structure
- Authentication
- Architecture
- Testing procedures
- Operational procedures

Update `PROJECT_PROGRESS.md` when implementation status changes.

## 7. Review

Before committing, verify:

- The requested work is complete.
- No unrelated changes were introduced.
- Existing architecture and conventions are preserved.
- No unintended breaking changes were introduced.
- Required documentation is updated.
- Relevant tests and checks pass.

## 8. Commit

- Create logically grouped commits.
- Follow Conventional Commits.
- Use a concise subject.
- Add a moderate commit body when appropriate.

## 9. Pull Request

- Open a Pull Request only for completed features.
- Do not open Pull Requests for non-feature work unless explicitly instructed.
- Never merge a Pull Request unless explicitly instructed by the user.

---

# Definition of Done

A **feature** is considered complete only when:

- Implementation is complete.
- Code follows the project architecture.
- Validation is implemented.
- Error handling is complete.
- Security considerations are addressed.
- Documentation is updated.
- OpenAPI specification is updated if applicable.
- Tests are added or updated.
- `PROJECT_PROGRESS.md` is updated.
- The feature is ready for a Pull Request.

For **non-feature work**, completion means the requested changes are implemented, relevant tests/checks pass, and required documentation is updated.

---

# Project Documentation

The `docs/` directory contains the project's source-of-truth documentation.

Before implementing or modifying any feature, consult the relevant documentation for the affected domain.

## Documentation Index

### Requirements

Defines the functionality of the media downloader application, including supported features, system behavior, security requirements, and project scope.

- `docs/REQUIREMENTS.md`

### Architecture

Defines the overall system architecture, layering, module boundaries, request flow, and design principles.

- `docs/ARCHITECTURE.md`

### Testing

Defines the testing strategy, test levels, and how tests are run.

- `docs/TESTING.md`

### Architecture Decision Records

Records significant architecture decisions and their rationale.

- `docs/ADR/`

## Documentation Priority

When implementing changes, use the following priority order:

1. User request
2. `AGENTS.md`
3. Relevant document in `docs/`
4. Existing implementation

If documentation and implementation conflict:

- Do **not** guess.
- Preserve existing behavior unless instructed otherwise.
- Report the inconsistency and explain the conflict.

---

# AI Agent Guidelines

When implementing any task:

1. Preserve the existing architecture and established project patterns.
2. Do not bypass established architectural layers.
3. Keep controllers thin and responsibilities clearly separated.
4. Prefer reusable abstractions when appropriate.
5. Maintain consistent naming and existing project conventions.
6. Follow REST conventions and the existing API design.
7. Do not introduce breaking API changes unless explicitly requested.
8. Keep security considerations in mind.
9. Write code that is easy to review and maintain.
10. If uncertain, prefer consistency with the existing codebase.

## Node Modules Integrity

- Never directly edit, modify, or delete files inside `node_modules/`.
- Treat `node_modules/` as generated dependency files managed by the package manager.
- Never rely on manual changes inside `node_modules/` for implementation, testing, or debugging.
- If a dependency needs to be modified, use the package manager's supported patch mechanism or make the appropriate change to `package.json` and the lockfile.
- Do not commit or attempt to commit `node_modules/`.
- Ensure all required changes are reproducible after a clean dependency installation.

## Do Not Do

Never:

- Skip required validation or verification.
- Modify unrelated code or files.
- Mix business logic with unrelated responsibilities.
- Expose internal implementation details or sensitive information.
- Duplicate existing logic when a suitable abstraction already exists.
- Ignore compiler, linter, test, or build errors.
- Disable or weaken existing safety, type-safety, or validation rules without justification.
- Introduce unnecessary complexity.
- Swallow or silently ignore errors.
- Make assumptions when project conventions or documentation provide the answer.
- Rewrite Git history unless explicitly requested.
- Squash unrelated work into a single commit.

---

# Project Progress Tracking

After completing implementation work, update `PROJECT_PROGRESS.md` when the project's implementation status has changed.

Only record work completed during the current response.

Do not mark tasks as completed unless they have been fully implemented and verified.

If architectural or design decisions are made, record them under **Decisions**.

Keep updates concise and avoid repeating unchanged information.

Use the following template:

```md
## Project Progress

### Completed

- ...

### Deliverables

- ...

### Decisions

- ...

### Pending

- ...

### Next Step

- ...
```

The summary should:

- Include only changes made during the current response.
- Be concise (5–10 bullet points total).
- Reflect the current project state accurately.
- Avoid duplicating information already present in `PROJECT_PROGRESS.md`.
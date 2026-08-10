# ADR — Architecture Decision Records

This directory documents significant architecture decisions using Architecture Decision Records (ADRs).

ADRs record the **why** behind architectural decisions.

---

## When to Create an ADR

Create an ADR when a decision is:

* Significant.
* Difficult to reverse.
* Likely to affect future architecture.

Examples include:

* Electron process architecture.
* Local-first architecture.
* yt-dlp integration strategy.
* FFmpeg integration strategy.
* Electron security model.
* Chrome extension communication mechanism.

Not every decision needs an ADR.

Routine implementation choices should be documented in code or in the relevant specification.

---

## Naming

Name ADRs sequentially:

```text
docs/ADR/
├── README.md
└── 001-short-description.md
```

---

## Template

```markdown
# ADR-XXX: <Title>

## Status

<Proposed | Accepted | Deprecated | Superseded by ADR-YYY>

## Context

<The problem and constraints that motivate the decision.>

## Decision

<The chosen approach and why.>

## Consequences

<What becomes easier and what becomes harder as a result.>
```

---

## Process

1. Create the ADR file using the template.
2. Record the decision in `PROJECT_PROGRESS.md` under **Decisions**.
3. Reference the ADR from related documentation where relevant.
4. Update the ADR status if the decision later changes.

---

## Source of Truth

```text
REQUIREMENTS.md  → What the product must do
ARCHITECTURE.md  → How the product is structured
ADR/             → Why significant decisions were made
TESTING.md       → How the product is tested
```

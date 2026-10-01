---
description: Execute an approved plan with tests and quality gates (bounded auto-fix retries).
argument-hint: [plan file; default = most recent in docs/plans/]
---

# /oneshot-poc:implement

Execute the plan (named in **$ARGUMENTS**, else the latest in `docs/plans/`).

## 1. Load & parse
Read the plan, build the task list + dependency graph. Verify every referenced path still
exists; flag drift before writing code.

## 2. Execute (manager–worker)
A **manager (Opus)** breaks the plan into small tasks, each owning a **disjoint set of files**,
and marks real dependencies. **Workers (Sonnet)** implement them — independent tasks in parallel
(each touching only its own files, so no conflict), dependent tasks in order. The **manager
(Opus)** then integrates the pieces, runs the gates, and fixes. Follow the plan exactly — no
unplanned features, nothing outside PoC scope (YAGNI). Honour the project's rules (no secrets,
typed public boundaries, deterministic, structured logging, config over literals).
(Inside `/oneshot-poc:run` this runs in the build-loop workflow, which assigns the Opus manager
and Sonnet worker tiers per agent; standalone, spawn the workers via the Agent tool.)

## 3. Tests
Add tests for new logic — exception paths, edge cases, and any scoring/threshold/state logic.
Hermetic, deterministic, synthetic fixtures (never real secrets/PII). Mock external boundaries.

## 4. Quality gates (bounded retry)
Run lint, type-check, and tests for the affected code. Auto-fix failures, **up to 2 attempts
per gate**. If still failing, stop and report the real output — do not mark done.

## 5. Plan-compliance check
Confirm every plan item shipped; list anything deferred (and why).

## 6. Next
Standalone, offer: `/oneshot-poc:review` · `/oneshot-poc:compound` · `/oneshot-poc:create-pr` · stop.
Inside `/oneshot-poc:run`, **do not stop** — proceed straight to the review phase. Never
commit to the default branch, and never push/PR without explicit approval.

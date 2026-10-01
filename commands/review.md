---
description: Multi-agent review of the current changes — parallel reviewers, classified findings, one verdict.
argument-hint: [target; default = git diff vs the base branch]
---

# /oneshot-poc:review

Review the current changes (**$ARGUMENTS**, else `git diff` vs the base branch).

## 1. Scope
Compute changed files; detect affected areas; read the related plan in `docs/plans/` if any.

## 2. Spawn reviewers in parallel
Launch concurrently with the Agent tool (include one only if its area changed):
- `learnings-researcher` — relevant past solutions & gotchas
- `code-quality-reviewer` — YAGNI, duplication, naming, readability, scope
- `architecture-reviewer` — contracts, reproducibility, boundaries
- `test-reviewer` — coverage gaps on changed lines, weak/again-flaky tests
- `security-reviewer` — secrets, injection, unsafe deserialization, data egress, input validation

## 3. Collect & classify
Merge, de-duplicate, classify **P1** (blocker: broken build, security, data loss, unexplained
output) / **P2** (should-fix: correctness, perf, weak test) / **P3** (nice-to-have). Drop
anything without `file:line` evidence.

## 4. Verdict
Emit one verdict — `APPROVED` / `APPROVED_WITH_COMMENTS` / `CHANGES_REQUIRED` — then the
findings (P1 first). Standalone, offer a menu (auto-fix P1 · show P2/P3 · create-pr · stop).
Inside `/oneshot-poc:run`, **do not stop** — auto-fix P1/P2, loop back to Plan if a finding
needs a design change, else continue to the product-review phase.

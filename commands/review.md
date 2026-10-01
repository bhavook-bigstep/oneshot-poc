---
description: Multi-agent review of the current changes — parallel reviewers, classified findings, one verdict.
argument-hint: [target; default = git diff vs the base branch]
---

# /oneshot-poc:review

Review the current changes (**$ARGUMENTS**, else `git diff` vs the base branch).

> **Narrate each step (IN → DO → OUT).** Open each numbered step with one line of what it got and
> what it will do (`▶ IN … / ▶ DO …`), and close it with one line of what it produced (`✓ OUT …`),
> so intent is scannable without scrolling. Reporting only — inside `/oneshot-poc:run` it adds no pause.

## 1. Scope
Compute changed files; detect affected areas; read the related plan in `docs/plans/` if any.

## 2. Spawn reviewers in parallel (heavy model)
Reviewers do real heavy lifting — running the suite, driving a headless browser, adversarial
judgement — so run them on the **heavy model (Opus)**, not a cheap worker tier. Launch
concurrently with the Agent tool (include one only if its area changed):
- `learnings-researcher` — relevant past solutions & gotchas
- `code-quality-reviewer` — YAGNI, duplication, naming, readability, scope
- `architecture-reviewer` — contracts, reproducibility, boundaries
- `test-reviewer` — coverage gaps on changed lines, weak/again-flaky tests
- `security-reviewer` — secrets, injection, unsafe deserialization, data egress, input validation

## 3. Collect & classify
Merge, de-duplicate, classify **P1** (blocker: broken build, security, data loss, unexplained
output) / **P2** (should-fix: correctness, perf, weak test) / **P3** (nice-to-have). Drop
anything without `file:line` evidence.

## 4. Re-evaluate (triage crucial-vs-defer + route)
You can't fix everything in a PoC. Weigh **all** findings together and decide, in one pass:
- **Which to fix now vs. defer** — keep only what's crucial for the charter to be correct, safe,
  explainable and reproducible; defer polish/nice-to-haves (each with a one-line why, recorded).
  **Every P1 is always fix-now — never defer a contract blocker** (PII/content leak, source
  mutation, uncontrolled egress, unexplained output, non-reproducible run, broken build, security).
- **The route for the crucial set** — the least disruptive that actually resolves it: **fix**
  (local edits), **replan** (plan/design is wrong → re-plan), or **rebrainstorm** (the approach
  is wrong → re-explore).

## 5. Verdict
Emit one verdict — `APPROVED` / `APPROVED_WITH_COMMENTS` / `CHANGES_REQUIRED` — then the crucial
findings (P1 first) + the deferred list + the route. Standalone, offer a menu (apply route ·
show deferred · create-pr · stop). Inside `/oneshot-poc:run`, **do not stop** — act on the route
(fix / replan / rebrainstorm) and continue.

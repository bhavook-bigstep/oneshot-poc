---
description: Capture a solved, non-trivial problem as reusable documentation (the investigation path, not just the fix).
argument-hint: <what was solved>
---

# /oneshot-poc:compound

Capture the learnings from **$ARGUMENTS** so it never has to be re-investigated. Only for
**non-trivial** work.

> **Narrate each step (IN → DO → OUT).** Open each numbered step with one line of what it got and
> what it will do (`▶ IN … / ▶ DO …`), and close it with one line of what it produced (`✓ OUT …`),
> so intent is scannable without scrolling. Reporting only — inside `/oneshot-poc:run` it adds no pause.

## 1. Precondition
Confirm the problem is solved and verified. If still in progress, stop and say so.

## 2. Duplicate check
Search `docs/solutions/` + `INDEX.md`. If a doc exists, update it instead of adding a new one.
Flag any conflict with existing knowledge.

## 3. Capture with the compound-docs skill
Use the `compound-docs` skill: gather problem · root cause · the **investigation path** ·
the fix · key files (`path` — why) · prevention. Classify the category. Validate frontmatter.

## 4. Write & index
Write `docs/solutions/<category>/<slug>.md`; redact any secrets/PII (reference by id/location).
Add a one-line entry to `docs/solutions/INDEX.md`.

## 5. Pattern promotion
If the root cause is a recurring code/process pattern (or a repeat incident), add or strengthen
an entry in `.claude/rules/critical-patterns.md`.

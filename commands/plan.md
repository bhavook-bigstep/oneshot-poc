---
description: Research prior learnings and produce a concrete, reviewable implementation plan.
argument-hint: <what to plan>
---

# /oneshot-poc:plan

Produce a concrete plan for **$ARGUMENTS**.

> **Narrate each step (IN → DO → OUT).** Open each numbered step with one line of what it got and
> what it will do (`▶ IN … / ▶ DO …`), and close it with one line of what it produced (`✓ OUT …`),
> so intent is scannable without scrolling. Reporting only — inside `/oneshot-poc:run` it adds no pause.

## 1. Restate & intake
Goal, inputs, method, output, constraints. If a field is genuinely unclear and changes
scope, ask one question with a recommended default; otherwise assume and proceed.

## 2. Research prior learnings (do NOT skip)
Search `docs/solutions/` + its `INDEX.md`, read `.claude/rules/critical-patterns.md` and the
relevant `CLAUDE.md`. Report what constrains the approach. Optionally use `learnings-researcher`.

## 3. Design the approach
Propose the approach (or 2–3 options with trade-offs for non-trivial work). Check it against
the project's contracts/rules. Tag each key decision CERTAIN / PROBABLE / UNCLEAR.
**Sourcing:** web-search each novel decision and attach a real citation or the verbatim
"No source found — this is an AI-generated idea." Never fabricate.

## 4. Write the plan
Write `docs/plans/YYYY-MM-DD-<slug>-plan.md` with: exact file paths, function/type names,
config keys/thresholds touched, the task dependency graph (what runs in parallel), and the
test cases. Be concrete enough that implementation is mechanical.

## 5. Decision gate
Summarize and offer `/oneshot-poc:implement`. (In a hands-off `/oneshot-poc` run, proceed
without stopping.)

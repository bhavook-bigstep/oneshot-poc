---
description: Explore a problem space and propose 2–4 approaches, each with a real citation or an explicit "no source" disclaimer.
argument-hint: <the problem to explore>
---

# /oneshot-poc:brainstorm

Divergent exploration of **$ARGUMENTS** — options, not a final plan. Keep it in PoC scope.

## 1. Frame
Restate the problem: goal, inputs, constraints, what's explicitly out of scope.

## 2. Research prior art (do NOT skip)
- **Internal:** search `docs/solutions/`, `.claude/rules/critical-patterns.md`, and the
  codebase for anything already known. Use the `learnings-researcher` agent if available.
- **External:** `WebSearch` / `WebFetch` for how others solved this (papers, official docs,
  RFCs, engineering blogs). Mandatory.

## 3. Generate 2–4 approaches
For each: the core idea, why it fits the project's contracts, rough effort, the main risk.
Cover a spread — not four variants of one idea.

## 4. Cite every idea — [BLOCKING]
Each approach carries ONE of:
- a real web-searched source — `Title — publisher — URL (accessed YYYY-MM-DD)` + one line on
  how it supports the idea; never fabricate a URL; or
- the verbatim line: **"No source found — this is an AI-generated idea."**

## 5. Compare & recommend
A short table (approach · effort · risk · source-or-AI). Recommend one; note time-box impact.

## 6. Decide
Capture to `docs/brainstorms/YYYY-MM-DD-<slug>.md` and proceed to `/oneshot-poc:plan`.
(Standalone, you may offer the choice; inside `/oneshot-poc:run`, **do not stop** — continue
straight to the plan phase.)

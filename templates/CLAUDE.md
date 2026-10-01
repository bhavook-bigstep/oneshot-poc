# CLAUDE.md

Guidance for Claude Code working in this repository. **This file says WHY. Rules say WHAT.
Guides say HOW.** They never swap roles.

## Project

| Property | Value |
| --- | --- |
| Project | `<name — one line on what it is>` |
| Stage | `<proof of concept / MVP / …>` |
| Language / stack | `<e.g. Python 3.11 · FastAPI · pytest>` |
| Test runner | `<e.g. pytest>` |
| Source of truth | `<where the authoritative data/config lives>` |

## Compound Engineering

This repo follows the compound loop: **BRAINSTORM → PLAN → IMPLEMENT → REVIEW → COMPOUND**.
Each unit of work should make the next one easier. Before implementing, search
`docs/solutions/` for prior learnings; after solving something non-trivial, capture it with
`/oneshot-poc:compound`. See `AGENTS.md` for the workflow and approval gates.

## Architecture

`<a short map: the main components/modules and how data flows between them. Keep it current —
this is the top of the loading order and everything inherits from it.>`

## System Contracts

State the few invariants that must never be violated — the ones where a breach is a bug of
record, not a style nit. For each: the rule, and WHY it exists. Examples to adapt:

### Contract 1: `<e.g. source data is read-only>`
**WHY:** `<the consequence of breaking it>`

### Contract 2: `<e.g. no secrets or PII leave the approved boundary>`
**WHY:** `<...>`

### Contract 3: `<e.g. every output is explainable / traceable>`
**WHY:** `<...>`

### Contract 4: `<e.g. runs are reproducible — pinned inputs + versioned config + a ledger>`
**WHY:** `<...>`

## Enforcement Rules

Full enforcement lives in `.claude/rules/` (loaded conditionally by area):

| Rule file | Loads when you touch |
| --- | --- |
| `.claude/rules/code-review-checklist.md` | any review |
| `.claude/rules/testing.md` | test files / new logic |
| `.claude/rules/security.md` | secrets, access, external calls |
| `.claude/rules/citations.md` | any new idea/fix/suggestion (always) |
| `.claude/rules/critical-patterns.md` | always (past incidents) |

## Important Instruction Reminders

- Do what was asked; nothing more, nothing less (YAGNI).
- Prefer editing existing files to creating new ones.
- Never commit, push, or open a PR until the user explicitly approves.
- Search `docs/solutions/` before implementing; capture learnings after.

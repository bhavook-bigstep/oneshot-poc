---
description: Scope QA — clarify ambiguities, flag over-scope, and write a provenance-tagged requirements charter (the initial standing) before any building.
argument-hint: <the requirement / goal, or a path to a requirements doc>
---

# /oneshot-poc:scope — scope QA & requirements charter

Turn a raw requirement into a **confirmed, provenance-tagged charter** before any building.
This is the one place up front where you **ask**; the build loop that follows does not. Be
thorough here — a wrong assumption now costs a whole loop later.

## 1. Parse
From **$ARGUMENTS** (the goal or the referenced requirements doc), extract every requirement
and feature into a draft list. Mark each as stated-explicitly vs. implied.

## 2. Ambiguity sweep
For each item, find what is genuinely unclear and would change what you build:
- undefined terms / success criteria ("fast", "secure", "dashboard" — defined how?)
- unspecified stack, UX shape, data sources, auth model, data volumes/scale
- unhandled edge cases, error behaviour, empty/failure states
- what "done" means for this item (its acceptance test)

Collect the real questions; skip anything you can safely default.

## 3. Scope-sanity / over-build check
Flag anything that looks **beyond a PoC** or **suspicious**: production hardening, high
availability, horizontal scale-out, multi-tenancy, full auth/SSO, broad third-party
integrations, premature optimization — or anything **contradictory** in the requirements.
For each flag, propose **in-scope vs. defer-to-production**, with a one-line reason.

## 4. Ask the user (batched, with defaults)
Put the ambiguities (step 2) and the scope flags (step 3) to the user as a **small number of
clear questions, each with a recommended default**. Ask only what changes the build — don't
interrogate. Record the answers verbatim; they become `[explicit]` provenance.

## 5. Write the Requirements Charter — the initial standing
Write `docs/plans/<YYYY-MM-DD>-requirements-charter.md`, starting with a **version line**
(`Charter v1 · <date>`) — it is a **living document**: STUCK answers and gate feedback amend it
(new/changed rows tagged `[explicit – feedback]`, version bumped), and the `acceptance-reviewer`
always checks against the current version. A table, one row per requirement/decision:

| # | Requirement / item | Decision | Provenance | Why (one line) |
|---|--------------------|----------|------------|----------------|

- **Decision:** `In scope` · `Out of scope` · `Deferred (post-PoC)` · `Interpreted as <X>`
- **Provenance** (exactly one tag):
  - `[explicit]` — the user stated it (in the prompt or the QA answers)
  - `[requirement]` — the uploaded requirements state it explicitly
  - `[inferred]` — you concluded it after careful consideration
- **Why:** one line. For `[inferred]`, give the basis ("the goal implies a UI, so a reviewer
  needs a list view"); for `[explicit]`/`[requirement]`, point to what was said.

Close the charter with three short sections:
- **Acceptance checklist** — the testable, in-scope items only. This is the contract the build
  loop and the `acceptance-reviewer` run against.
- **Out of scope / deferred** — with the reason each was cut.
- **Open assumptions** — anything you defaulted that the user didn't confirm, so it's visible.

## 6. Confirm
Show the charter summary and get the user's confirmation (or corrections; fold them in and
re-show). This is the **last interactive step before the autonomous build loop** — once
confirmed, proceed to brainstorm and don't stop until a later gate.

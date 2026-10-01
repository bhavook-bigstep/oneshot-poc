---
description: One-shot a proof of concept — a self-correcting build loop that iterates until every requirement is met, then two human gates (verify the product; approve the demo video).
argument-hint: <the requirement / PoC goal, or a path to a requirements doc>
---

# /oneshot-poc:run — the PoC factory loop

Build the product described in **$ARGUMENTS** to the level of the requirement, iterating with
agents checking the work, and finish with a demo video the user approves. This is a long,
self-correcting loop with **exactly two human gates** (⏸ G and ⏸ H).

> ## RUN WITHOUT INTERRUPTION
> You interact with the user at **exactly three points**: the up-front **scope QA (A2)** where
> you clarify and confirm the charter, and the two gates **⏸ G** (verify the product) and
> **⏸ H** (approve the video). **Everywhere else — the whole build loop B → C → D → E → F —
> runs back-to-back with NO stops, menus, questions, or confirmation prompts.** Finishing one
> phase flows straight into the next; a loop-back (E→C, F→B) re-enters immediately. The
> sub-commands you follow (`/oneshot-poc:brainstorm`, `:plan`, `:implement`, `:review`) end with
> "decision menus / gates" — **ignore those while orchestrating; they apply only standalone.**
> Never pause mid-loop to ask "should I continue?" — the answer is always yes until A2's
> confirmation, a ⏸ gate, or a genuine blocker (an honest, retried gate failure) is reached.

> Keep a task list mirroring the state machine below, but the **authoritative state is the run
> ledger** (`docs/plans/<date>-run-ledger.md`), not memory — read it on entry and after a
> compaction/resume so the loop never loses which requirements are met, which iteration it's in,
> or what was tried. Do not declare "done" until the final user approval (Phase I). If a gate's
> feedback asks for changes, amend the charter and re-enter the loop — never skip to the end. The
> one thing you never do unattended is an outward-facing action (push / PR / send).

## The state machine

```
A REQUIREMENT ─▶ ⏸ A2 SCOPE QA + CHARTER ─▶ B BRAINSTORM ─▶ C PLAN ─▶ D IMPLEMENT ─▶ E CODE REVIEW
                   (clarify · confirm)           ▲             ▲                          │
                                                 │             └──────(problem found)─────┘
                                                 │                                         │ (clean)
                                                 │                                         ▼
                                                 └────(requirements NOT met)──── F PRODUCT REVIEW
                                                                                           │ (all met)
                                                                                           ▼
                                                       ⏸ G VERIFY HANDOFF (user uses it + feedback)
                                                                                           │
                                                 ┌──(feedback: changes)────────────────────┘
                                                 ▼                                          │ (user approves)
                                            (back to B)                                     ▼
                                                                                   ⏸ H DEMO VIDEO (approve)
                                                                                           │
                                                 ┌──(video: changes)───────────────────────┘
                                                 ▼                                          │ (user approves)
                                            (iterate H)                                     ▼
                                                                                        I FINISH
```

## A — Requirement intake
Read **$ARGUMENTS** (or the referenced requirements doc) and parse it into a draft list of
every requirement/feature, marking each explicit vs. implied. If the project isn't
compound-ready (no `CLAUDE.md` + `.claude/rules/`), run `/oneshot-poc:init` first.

## ⏸ A2 — Scope QA & requirements charter (HUMAN — the one up-front gate)
Before building, run `/oneshot-poc:scope`: sweep every requirement for ambiguity, flag
anything **beyond a PoC** or contradictory, and **ask the user** a small batch of clear
questions (each with a recommended default). **Then ALWAYS write the requirements charter as a
real top-level file — `REQUIREMENTS.md` at the repo root** — one row per decision with a
one-line reason and a provenance tag: `[explicit]` (the user said it) · `[requirement]` (the doc
states it explicitly) · `[inferred]` (you concluded it after careful consideration). This file
is mandatory on every run; do not proceed to the build loop until `REQUIREMENTS.md` exists on
disk. Its **acceptance checklist** (the testable, in-scope items) is the contract the rest of
the loop and the `acceptance-reviewer` run against. **Confirm the charter with the user**, fold
in corrections — then proceed; this is the last interaction until ⏸ G.

## B–F — Autonomous build loop (run it as the Workflow engine)
The whole build loop runs as the bundled **deterministic workflow**, so the fan-out, loop
counting, budgets, and resume are enforced in code — not left to drift over a long run. First
confirm `REQUIREMENTS.md` exists (A2 must have written it), and create the **run ledger** from
`${CLAUDE_PLUGIN_ROOT}/templates/run-ledger.md` if missing (`docs/plans/<date>-run-ledger.md`).
Then invoke the **Workflow** tool with:

```
scriptPath: ${CLAUDE_PLUGIN_ROOT}/workflows/oneshot-build-loop.js
args: { charter: "REQUIREMENTS.md", ledger: "<ledger path>", dir: ".",
        maxOuter: 3, maxInner: 2, feedback: <gate feedback on a re-entry; omit the first time> }
```

(Your running `/oneshot-poc:run` is the explicit opt-in to multi-agent orchestration.) It runs
**B Brainstorm → C Plan → [ D Implement → E parallel Review → fix or re-plan ] → F Acceptance**,
looping `E→C` when a finding needs a design change and `F→B` on unmet requirements — with hard
**budgets** (≤`maxOuter` outer, ≤`maxInner` inner) and a **stuck-detector** (identical gaps
across a full outer loop → stop). Every phase reads and appends to the ledger. The acceptance
step drives a headless browser for UI items (the demo-video skill's bundled Playwright). It
returns exactly one of:

- **`{status:'met', items, note}`** — every acceptance item is met; `note` lists any `needs_human`
  items. Capture non-trivial fixes with `/oneshot-poc:compound`, then go to **⏸ G**.
- **`{status:'stuck', stage, blocker, gaps}`** — a budget was hit or the same gaps persisted →
  go to **STUCK** below. **Do NOT keep looping on your own.**

### STUCK — the escape hatch (never spin forever)
When the workflow returns `stuck`, stop the autonomy and escalate to the human: say what was
being built, which acceptance items are unmet, **exactly what was tried**, and the specific
decision you need (usually a scope cut or an approach change). WAIT. Treat the answer as charter
input: **amend the charter** (next section), then re-invoke the workflow with the new `feedback`.

## ⏸ G — Verification handoff (HUMAN GATE)
The product now meets the requirement on paper. **Stop and hand to the user:**
1. A **"please verify" checklist** — the concrete things the user should click/run/check to
   confirm it works for them (mapped to the acceptance items), plus how to start the product.
2. A short note on what was built and anything you couldn't fully self-verify.
Then **urge them to actually use the product and give feedback**, and WAIT.
- **If they report changes / feedback:** **amend the charter first** (see below), then re-invoke
  the build-loop workflow with `feedback: <their changes>` — it iterates B→F against the updated
  charter and returns to G again.
- **If they approve:** proceed to H.

### Living charter (keep the contract current)
The charter is the source of truth; keep it alive. On any STUCK answer or G/H feedback that
changes scope, **before re-entering the loop**: add or modify the affected rows, tag them
`[explicit – feedback]`, bump the charter version, and note the change in the ledger. The
`acceptance-reviewer` always checks against the current charter — a stale charter means the loop
verifies the wrong thing.

## ⏸ H — Demo video (HUMAN GATE)
Only now, with the product approved, create the narrated walkthrough with the **`demo-video`**
skill (understand → plan → record at native resolution with highlight boxes → local voiceover
→ the four review gates → deliver). Start the app on a local/test URL; never record a login or
secrets. Deliver the `.mp4` + transcript, and **WAIT for the user's feedback on the video.**
- **If they want changes:** iterate within H (re-script / re-record / re-voice) — the demo-video
  skill keeps clips for cheap re-masters — then present again and WAIT.
- **If they approve:** proceed to I.

## I — Finish
Summarise: the met acceptance checklist, the gate results, the plan + solution docs, the
committed local branch, and the final video path. Remind the user that pushing / opening a PR
(`/oneshot-poc:create-pr`) is their explicit next step — this loop never pushes on its own.

## Gates & safety (always)
- Commit to a **local feature branch** as you go (never the default branch); **never push,
  open a PR, or send anything** unattended.
- The two ⏸ gates (G, H) are the only points you wait for the user — everywhere else, keep
  iterating autonomously until the exit condition is met.
- Report real gate output; if blocked after honest retries, stop and say so with evidence.

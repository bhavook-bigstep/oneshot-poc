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

> ## NARRATE EVERY NODE (IN → DO → OUT — no exceptions)
> So the user can observe intent without scrolling, **every node** below (Phase 0, A, A2, A3,
> each per-phase build node, STUCK, G, H, I) is bookended with three one-line markers:
> ```
> ▶ IN  <node> — <what this node received: the ledger checkpoint, the charter items, the gate feedback…>
> ▶ DO  <node> — <what it is about to do, in one line>
> … (do the work) …
> ✓ OUT <node> — <what it produced / decided, and the next node it hands to>
> ```
> Print `▶ IN` and `▶ DO` **before** acting, and `✓ OUT` **after**. Keep each to one line and name
> concrete things (phase id, requirement #s, `next_node`, verdict). This is a reporting convention
> only — it never adds a pause: `✓ OUT` of one node flows straight into `▶ IN` of the next inside
> the uninterrupted build loop. The bundled workflow narrates its own nodes the same way via `log()`.

## The state machine

```
Phase 0  RESUME? ── ledger exists & not done ──▶ jump to checkpoint.next_node, skip finished work
   │ (fresh)
   ▼
A Requirement ─▶ ⏸ A2 Scope QA + REQUIREMENTS.md ─▶ A3 Phase plan (split reqs into ordered slices)
                                                              │
                                   ┌──────────── for each phase Pn, in order ───────────┐
                                   ▼                                                      │
                          ┌─ BUILD LOOP (scoped to Pn) ─────────────────────────┐        │
                          │  B Brainstorm → C Plan → [D Implement → E Review] → F Acceptance
                          │        ▲            ▲                        │                │
                          │        │   (gap / design change → re-plan)──┘                │
                          │        └──(gaps persist / churn → re-brainstorm the approach)│
                          └───────────────────│(all Pn items met)──────────────┘         │
                                   next phase ◀┘   (budgets exhausted → ⏸ STUCK: escalate, amend, resume)
                                   └──────────── all phases met ───────────────────────────┘
                                                              │
                                                              ▼
                       ⏸ G VERIFY (user uses it) ─▶ ⏸ H DEMO VIDEO (approve) ─▶ I FINISH
                       (G/H feedback ─▶ amend charter + phase plan ─▶ back into the per-phase loop)
```

## Phase 0 — Resume check (FIRST thing, every run)
Before anything else, look for an existing run ledger (`docs/plans/*-run-ledger.md`). If one
exists and its checkpoint `status` is not `done`, this is a **resume**, not a fresh start:
- Read the **Checkpoint** block and the **Phase plan**. Tell the user in one line where you're
  resuming (`resuming P2 "…", next_node: BUILD`).
- **Jump to `next_node` and skip everything already finished** — don't re-run scope QA if
  `REQUIREMENTS.md` exists, don't re-plan phases if the plan is there, don't rebuild phases
  marked `done`. Continue the per-phase loop from the first phase not `done`.
- Same session + a recorded `workflow_run_id`? Resume that Workflow with `resumeFromRunId` for an
  instant cache hit. Otherwise re-invoke the build-loop workflow fresh — it reads the ledger and
  skips acceptance items already `met`, so no completed work is redone.
If no ledger exists (or it's `done`), start fresh at A.

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

## A3 — Phase plan (split the requirements into ordered slices)
Run `/oneshot-poc:phases`: break the acceptance checklist into a small number of **ordered,
shippable phases** (P1, P2, …; 1–4 items each; foundations first; every item in exactly one
phase). Write them into the ledger's **Phase plan** and tag each requirement row with its phase.
This is what removes the "get everything right in one loop" pressure — the build loop takes **one
phase at a time**, finishes it, then takes the next fresh. Create the run ledger from
`${CLAUDE_PLUGIN_ROOT}/templates/run-ledger.md` here if it doesn't exist.

## B–F — Per-phase build loop (run each slice as the Workflow engine)
Take the phases **one at a time, in order** (skipping any marked `done` on a resume). For **each
phase Pn**, set the checkpoint `active_phase: Pn` + `next_node: BUILD` in the ledger, then invoke
the bundled **deterministic workflow** scoped to that phase — so fan-out, loop counting, budgets,
and resume are enforced in code, and the loop only has to nail *this slice*:

```
scriptPath: ${CLAUDE_PLUGIN_ROOT}/workflows/oneshot-build-loop.js
args: { charter: "REQUIREMENTS.md", ledger: "<ledger path>", dir: ".",
        phase: { id: "P1", title: "…", items: [1, 2] },   // the current slice
        maxOuter: 3, maxInner: 2, maxReplans: 2, maxRebrainstorms: 1,
        feedback: <gate/STUCK feedback on a re-entry; else omit> }
```

(Your running `/oneshot-poc:run` is the explicit opt-in to multi-agent orchestration. **Record the
returned `runId` into the ledger** so a same-session resume can `resumeFromRunId`.) Each phase runs
**B Brainstorm → C Plan → [ D Implement → E parallel Review → re-evaluate → fix / replan / rebrainstorm ] → F Acceptance**
*scoped to that phase's items*. After the parallel reviewers, a **re-evaluator** (one manager) weighs
**all** findings together and decides — because you can't fix everything in a PoC — **which are crucial
to fix now vs. defer**, and **the route** that resolves them. P1 contract blockers (PII/content leak,
source mutation, uncontrolled egress, unexplained output, non-reproducible run, broken build, security)
are **never deferrable** and are forced into the fix set. The route is the three-rung escalation ladder,
so it self-corrects at the right level instead of spinning or over-thinking:
- route **fix** → patch only the crucial set in place → **re-review** (inner loop);
- route **replan** → the plan/design is wrong → **E→C re-plan** (same approach), bounded by `maxReplans`;
- route **rebrainstorm** → the approach is wrong → **F→B re-brainstorm**, bounded by `maxRebrainstorms`;
- an acceptance gap loops to Plan; persistent gaps or re-plan churn escalate to re-brainstorm; the last
  approach still failing → **stuck** (human).

Deferred (non-crucial) findings are recorded in the ledger — nothing is silently dropped. Every node
reads and appends to the ledger. Acceptance drives a headless browser for UI items (the demo-video
skill's bundled Playwright). Per phase it returns exactly one of:

- **`{status:'met', ...}`** — this phase's items are met. **Mark Pn `done`** in the ledger
  (phase plan + requirement rows + iteration log), capture non-trivial fixes with
  `/oneshot-poc:compound`, and **move to the next phase** (set `active_phase` to it, loop back to
  the top of B–F). When **Pn was the last phase**, all requirements are met → go to **All phases
  done** below.
- **`{status:'stuck', stage, blocker, gaps, lastReview, lastAcceptance, trail}`** — a budget was hit
  (`stage: 'budget'`), the approach kept needing rework (`stage: 'design-churn'`), the same gaps
  persisted (`stage: 'acceptance'`), or integration blocked (`stage: 'implement'`). The return
  **always carries diagnostics** — `gaps` (never null), the `trail` of what was tried each loop, the
  `lastAcceptance` matrix (met/partial/missing per item), and `lastReview` findings. → go to **STUCK**
  below and report from those fields. **Do NOT keep looping on your own, and do NOT read the journal
  to reconstruct what happened — the return already has it.**

### All phases done
Every phase is `done`. **If the charter has any visual/UI requirement, now run the UI design loop**
(`/oneshot-poc:ui` → `${CLAUDE_PLUGIN_ROOT}/workflows/ui-design-loop.js`) so the UI is *intentional*,
not just functional — it grounds the look in real references and iterates with a Haiku visual critic
on real screenshots. (Separate top-level workflow — workflows can't nest.) Set the checkpoint
`next_node: VERIFY`, then go to **⏸ G**.

### STUCK — the escape hatch (never spin forever)
When a phase returns `stuck`, set the checkpoint `status: stuck`, stop the autonomy, and escalate
**using the diagnostics in the return** (don't spelunk the journal — it's all in the object):
- **Which phase** and which of its items are unmet — from `lastAcceptance` (met / partial / missing)
  when present; if `lastAcceptance` is null, say so plainly (acceptance never ran — the loop churned
  on design changes), and report the `gaps`/`lastReview` findings instead of inventing a status.
- **Exactly what was tried** — print the `trail` (one line per loop) and the `blocker`.
- **The specific decision you need** — tailor it to `stage`: `design-churn` → the approach keeps
  getting reworked, so propose a concrete simpler approach or a scope cut and ask which; `budget` →
  more iterations vs. cut scope; `acceptance` → the persistent gap and how to close or drop it;
  `implement` → the integration blocker.

WAIT. Treat the answer as charter input: **amend the charter** (and the phase plan if the slice
itself was wrong), then re-invoke the build-loop workflow **for this phase** with the new `feedback`
(and, for a design-churn/budget stuck you judge solvable with more room, a raised `maxOuter`/
`maxReplans`). (Because the ledger is the checkpoint, the user can also just re-run `/oneshot-poc:run`
later and it resumes here.)

## ⏸ G — Verification handoff (HUMAN GATE)
The product now meets the requirement on paper. **Stop and hand to the user:**
1. A **"please verify" checklist** — the concrete things the user should click/run/check to
   confirm it works for them (mapped to the acceptance items), plus how to start the product.
2. A short note on what was built and anything you couldn't fully self-verify.
Then **urge them to actually use the product and give feedback**, and WAIT.
- **If they report changes / feedback:** **amend the charter and the phase plan first** (see
  below) — usually a new phase (or new items on the last phase) for the requested changes — then
  run the per-phase build loop over the new/affected phase(s), and return to G.
- **If they approve:** set `next_node: VIDEO`, proceed to H.

### Living charter + phase plan (keep the contract current)
The charter is the source of truth; keep it and the phase plan alive. On any STUCK answer or G/H
feedback that changes scope, **before re-entering the loop**: add/modify the affected `REQUIREMENTS.md`
rows (tag `[explicit – feedback]`, bump the charter version), reflect them in the ledger's phase
plan (a new phase, or new items on a phase — set its status back to `todo`/`in-progress`), and note
it in the iteration log. The `acceptance-reviewer` always checks the current charter — a stale
charter or phase plan means the loop verifies the wrong thing.

## ⏸ H — Demo video (HUMAN GATE)
Only now, with the product approved, create the narrated walkthrough with the **`demo-video`**
skill (understand → plan → record at native resolution with highlight boxes → local voiceover
→ the four review gates → deliver). Start the app on a local/test URL; never record a login or
secrets. Deliver the `.mp4` + transcript, and **WAIT for the user's feedback on the video.**
- **If they want changes:** iterate within H (re-script / re-record / re-voice) — the demo-video
  skill keeps clips for cheap re-masters — then present again and WAIT.
- **If they approve:** proceed to I.

## I — Finish
Set the checkpoint `status: done` in the ledger. Summarise: the met acceptance checklist (all
phases), the gate results, the plan + solution docs, the committed local branch, and the final
video path. Remind the user that pushing / opening a PR
(`/oneshot-poc:create-pr`) is their explicit next step — this loop never pushes on its own.

## Gates & safety (always)
- Commit to a **local feature branch** as you go (never the default branch); **never push,
  open a PR, or send anything** unattended.
- The two ⏸ gates (G, H) are the only points you wait for the user — everywhere else, keep
  iterating autonomously until the exit condition is met.
- Report real gate output; if blocked after honest retries, stop and say so with evidence.

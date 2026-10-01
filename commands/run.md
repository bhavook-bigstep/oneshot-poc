---
description: One-shot a proof of concept — a self-correcting build loop that iterates until every requirement is met, then two human gates (verify the product; approve the demo video).
argument-hint: <the requirement / PoC goal, or a path to a requirements doc>
---

# /oneshot-poc:run — the PoC factory loop

Build the product described in **$ARGUMENTS** to the level of the requirement, iterating with
agents checking the work, and finish with a demo video the user approves. This is a long,
self-correcting loop with **exactly two human gates** (⏸ G and ⏸ H).

> ## RUN WITHOUT INTERRUPTION
> The internal phases **B → C → D → E → F run back-to-back with NO stops, menus, questions, or
> confirmation prompts.** Finishing one phase flows straight into the next; a loop-back (E→C,
> F→B) re-enters immediately. The sub-commands you follow (`/oneshot-poc:brainstorm`, `:plan`,
> `:implement`, `:review`) end with "decision menus / gates" — **ignore those while orchestrating;
> they apply only when a phase is run standalone.** The **only** points you hand control to the
> user are the two ⏸ gates (G: verify the product, H: approve the video). Everywhere else, keep
> going on your own judgement. Never pause to ask "should I continue?" — the answer is always yes
> until a ⏸ gate or a genuine blocker (an honest, retried gate failure) is reached.

> Keep a task list mirroring the state machine below. Track which requirements are met. Do not
> declare "done" until the final user approval (Phase I). If a gate's feedback asks for changes,
> re-enter the loop — never skip back to the end. The one thing you never do unattended is an
> outward-facing action (push / PR / send).

## The state machine

```
A REQUIREMENT ─▶ B BRAINSTORM ─▶ C PLAN ─▶ D IMPLEMENT ─▶ E CODE REVIEW
                      ▲              ▲                          │
                      │              └──────(problem found)─────┘
                      │                                         │ (clean)
                      │                                         ▼
                      └────(requirements NOT met)──── F PRODUCT REVIEW
                                                                │ (all met)
                                                                ▼
                                            ⏸ G VERIFY HANDOFF (user uses it + feedback)
                                                                │
                                      ┌──(feedback: changes)────┘
                                      ▼                          │ (user approves)
                                 (back to B)                     ▼
                                                        ⏸ H DEMO VIDEO (user approves)
                                                                │
                                      ┌──(video: changes)───────┘
                                      ▼                          │ (user approves)
                                 (iterate H)                     ▼
                                                             I FINISH
```

## A — Requirement
Parse **$ARGUMENTS** (or the referenced doc) into an explicit, numbered **acceptance
checklist**: every feature and requirement the product must satisfy, each testable. Restate
it back. This checklist is the contract the loop runs against and the thing Phase F verifies.
Write it to `docs/plans/<date>-requirements.md`. If the project isn't compound-ready (no
`CLAUDE.md` + `.claude/rules/`), run `/oneshot-poc:init` first.

## B — Brainstorm
`/oneshot-poc:brainstorm` on the hardest parts: 2–4 approaches, each with a real citation or
the verbatim "No source found — this is an AI-generated idea." Pick one; note the trade-off.

## C — Plan
`/oneshot-poc:plan`: a concrete plan tied to the acceptance checklist — exact files/functions/
config, the dependency graph, and the test cases per requirement. Re-enter here (not B) when
Phase E finds an implementation problem.

## D — Implement
`/oneshot-poc:implement`: build it, tests with new logic, run the gates (lint/type/tests),
auto-fix up to 2 attempts per gate. Report real output on failure — never fake a pass.

## E — Code review (agents)
`/oneshot-poc:review`: spawn `learnings-researcher`, `code-quality-reviewer`,
`architecture-reviewer`, `test-reviewer`, `security-reviewer` in parallel. Auto-fix P1/P2.
**If a finding needs a design change, loop back to C (Plan)**; otherwise fix in place and
re-review. Loop until the verdict is clean.

## F — Product review (every requirement met?)
Spawn the `acceptance-reviewer` agent: go through the Phase A checklist item by item against
the actually-built product (read the code, run the app/tests, exercise each feature) and mark
each **met / partial / missing** with evidence. **If anything is partial or missing, loop back
to B (Brainstorm)** for that gap and run B→C→D→E→F again. Only when **every** item is met does
the loop exit to G. Capture non-trivial fixes with `/oneshot-poc:compound`.

## ⏸ G — Verification handoff (HUMAN GATE)
The product now meets the requirement on paper. **Stop and hand to the user:**
1. A **"please verify" checklist** — the concrete things the user should click/run/check to
   confirm it works for them (mapped to the acceptance items), plus how to start the product.
2. A short note on what was built and anything you couldn't fully self-verify.
Then **urge them to actually use the product and give feedback**, and WAIT.
- **If they report changes / feedback:** treat it as new requirement input and re-enter at
  **B (Brainstorm)** — iterate the whole build loop on the feedback, back through F, then G again.
- **If they approve:** proceed to H.

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

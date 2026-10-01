# Run ledger — <goal>

Durable state + **checkpoint log** for a `/oneshot-poc:run`. **Every node reads this first and
updates it when done**, so an interrupted/stopped run can be **resumed from the last checkpoint**
on the next `/oneshot-poc:run`, and a context compaction never loses the thread. Content-free:
status and decisions only, never secrets/PII.

- **Charter:** `REQUIREMENTS.md` (top-level, always present)  ·  **Branch:** `<feature-branch>`

## Checkpoint (resume reads this FIRST)

The single source of truth for "where were we." On a re-run, jump to `next_node` and continue —
do not re-do completed work.

```
status:          in_progress | stuck | awaiting_verify | awaiting_video | done
active_phase:    <phase id, e.g. P2>        # which requirement-phase is being built
next_node:       <A2 | A3 | BUILD | VERIFY | VIDEO | FINISH>
last_completed:  <node just finished>
workflow_run_id: <runId of the last build-loop Workflow, for same-session resume>
updated:         <stamp — set by the agent/human, scripts can't read the clock>
note:            <one line: what's in flight or what the human owes>
```

## Phase plan (requirements split into ordered, shippable slices — from /oneshot-poc:phases)

Each phase is built and verified on its own loop before the next is picked up fresh.

| Phase | Title | Requirements (charter #s) | Status |
|-------|-------|---------------------------|--------|
| P1 | <slice>  | 1, 2 | todo / **in-progress** / done |
| P2 | <slice>  | 3, 4, 5 | todo |

## Requirement status (the acceptance checklist across all phases)

| # | Requirement | Phase | Status | Evidence / note |
|---|-------------|-------|--------|-----------------|
| 1 | <item>      | P1 | todo / in-progress / **met** / partial / missing / needs_human | `file:line` · test · command |

## Iteration log (every move across every node — the resumable trail)

| When (phase · node) | What changed | Result |
|---------------------|--------------|--------|
| P1 · B | chose approach X | cited |
| P1 · D | implemented items 1–2 | gates pass |
| P1 · F | acceptance: item 2 missing | → re-loop |
| P1 · F | all P1 items met | phase P1 done → P2 |

## Open assumptions / deferrals
- <anything defaulted or deferred the user hasn't confirmed>

## Blockers (if stuck)
- <what was tried, why it's stuck, what the human must decide>

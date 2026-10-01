# oneshot-poc

A Claude Code plugin that **one-shots a proof of concept end-to-end** — from a single
hands-off command — using the compound-engineering loop with agents checking the work, and
finishing with a **narrated live demo video**.

```
/oneshot-poc:run  <your PoC goal>
```

runs: **brainstorm → plan → implement → multi-agent review → compound-docs → live demo video →
deliver** — committing to a local branch and stopping before anything outward-facing.

## What's bundled

**Commands** (`/oneshot-poc:<name>`)
- `run` — the hands-off orchestrator (the one command)
- `init` — scaffold a repo for the loop (CLAUDE.md, AGENTS.md, rules, solutions index)
- `scope` — scope QA: clarify ambiguities + over-scope, then write a provenance-tagged requirements charter
- `phases` — split the requirements into ordered, shippable slices, each built + verified on its own loop
- `ui` — grounded UI design: research real web inspiration → apply → iterate with a Haiku visual critic on real screenshots (fixes the generic-LLM look)
- `brainstorm` · `plan` · `implement` · `review` · `compound` · `create-pr` — the loop phases, individually

**Agents** (`@agent-oneshot-poc:<name>`)
- review: `learnings-researcher`, `code-quality-reviewer`, `architecture-reviewer`, `test-reviewer`, `security-reviewer`, `acceptance-reviewer`
- UI: `ui-researcher` (web inspiration → design brief) and `ui-reviewer` (Haiku visual critic on screenshots)

**Skills** (`/oneshot-poc:<name>`)
- `compound-docs` — turn a solved problem into a durable solution doc
- `demo-video` — plan + record a narrated, native-resolution product demo (local voice, no cloud keys)

**Workflow** (`workflows/oneshot-build-loop.js`) — the deterministic engine behind the autonomous
phases (B–F): brainstorm → plan → implement → parallel review → acceptance, with hard iteration
**budgets**, a **stuck-detector** (escalates instead of spinning), and a **run ledger** it reads
and appends to every phase (so a compaction or resume never loses state). The acceptance step
drives a headless browser for UI requirements. `/oneshot-poc:run` invokes it between the human gates.

**Hooks** — a session reminder about the loop, and a post-commit nudge to run `/oneshot-poc:compound`.

## Install

```bash
# Local (no marketplace) — point at this directory
claude plugin install --plugin-dir ./oneshot-poc

# From a marketplace repo (after you push this directory somewhere)
claude plugin marketplace add <owner>/<repo>
claude plugin install oneshot-poc@oneshot-poc

# Direct from GitHub
claude plugin install oneshot-poc --from github --repo <owner>/<repo>
```

Validate before publishing: `claude plugin validate ./oneshot-poc`

## Use

```bash
# New repo: scaffold it first (fills CLAUDE.md contracts from your project)
/oneshot-poc:init

# Then build a PoC end-to-end, hands-off
/oneshot-poc:run a FastAPI link shortener with click analytics and a small dashboard
```

The run delivers: the working code + tests (gates passing), the plan and any solution docs,
a committed local feature branch, and the demo video (`.mp4` + transcript). It never pushes
or opens a PR on its own — use `/oneshot-poc:create-pr` (or `git push`) when you're ready.

### How a run flows (phases + resume)

1. **Scope QA → `REQUIREMENTS.md`.** The one up-front human gate: ambiguities and over-scope
   are confirmed with you, then a provenance-tagged charter is written to the repo root (always).
2. **Phase plan.** `/oneshot-poc:phases` splits the acceptance checklist into a few **ordered,
   shippable slices**. The build loop takes **one slice at a time** — so the loop only has to get
   *this* part right, then takes the next fresh. No "nail everything in one pass" pressure.
3. **Per-phase build loop.** Each slice runs the deterministic engine (brainstorm → plan →
   implement → review → acceptance) until its items pass, then the next slice starts.
4. **Two human gates at the end:** ⏸ verify the product (you use it and give feedback), then
   ⏸ approve the demo video. Feedback amends the charter + phase plan and re-enters the loop.

**Resume / checkpoint.** Every node reads and appends to a **run ledger**
(`docs/plans/*-run-ledger.md`) whose **Checkpoint** block records `active_phase`, `next_node`,
the last-completed step, and the workflow `run_id`. Re-running `/oneshot-poc:run` after an
interruption (or a context compaction) reads that block first, **skips finished phases, and
resumes from the last checkpoint** — same session with a recorded `run_id`, it resumes the
Workflow itself for an instant cache hit; otherwise it re-invokes the engine, which skips
acceptance items already met. Nothing completed is redone.

## Notes

- The demo-video skill installs its own tooling on first use (ffmpeg, a headless browser, and
  a local Kokoro voice) — no API keys, nothing to sign up for. It records on a local/test URL
  and never records a login or puts secrets on screen.
- The bundled rules and CLAUDE.md are generic templates. After `/oneshot-poc:init`, edit the
  contracts in `CLAUDE.md` and prune the rules to fit your project.

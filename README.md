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
- `brainstorm` · `plan` · `implement` · `review` · `compound` · `create-pr` — the loop phases, individually

**Agents** (`@agent-oneshot-poc:<name>`) — spawned in parallel during review
- `learnings-researcher`, `code-quality-reviewer`, `architecture-reviewer`, `test-reviewer`, `security-reviewer`

**Skills** (`/oneshot-poc:<name>`)
- `compound-docs` — turn a solved problem into a durable solution doc
- `demo-video` — plan + record a narrated, native-resolution product demo (local voice, no cloud keys)

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

## Notes

- The demo-video skill installs its own tooling on first use (ffmpeg, a headless browser, and
  a local Kokoro voice) — no API keys, nothing to sign up for. It records on a local/test URL
  and never records a login or puts secrets on screen.
- The bundled rules and CLAUDE.md are generic templates. After `/oneshot-poc:init`, edit the
  contracts in `CLAUDE.md` and prune the rules to fit your project.

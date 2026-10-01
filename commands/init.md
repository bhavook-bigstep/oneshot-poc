---
description: Make a repo compound-ready — scaffold CLAUDE.md, AGENTS.md, the rule set, and the solutions index.
argument-hint: [target directory; default = current repo root]
---

# /oneshot-poc:init

Set up the current project (or **$ARGUMENTS**) for the compound loop. Idempotent — never
overwrite a file that already exists; report what was created vs. skipped.

The plugin ships the starting files under `${CLAUDE_PLUGIN_ROOT}/templates/`. Copy them in,
then fill the placeholders from what you can learn about the repo (stack, test runner,
domain). Create only what's missing:

1. **`CLAUDE.md`** (root) — from `templates/CLAUDE.md`. The architecture + WHY + the system
   contracts for THIS project. Replace the `<...>` placeholders using the repo (README,
   manifests, router, existing code). This is the top of the loading order.
2. **`AGENTS.md`** (root) — from `templates/AGENTS.md`. How to run the compound loop and the
   approval gates. Usually needs no edits.
3. **`.claude/rules/*.md`** — from `templates/rules/`. The enforcement rules (what to do),
   loaded conditionally. Keep the generic ones (code-quality, testing, security, citations,
   critical-patterns); tailor or delete the domain examples that don't apply.
4. **`docs/solutions/INDEX.md`** — from `templates/INDEX.md`. The institutional-memory index
   `/oneshot-poc:compound` appends to.
5. Optionally wire the **hooks** (`hooks/hooks.json` in the plugin already provides the
   SessionStart context + the commit→compound reminder when the plugin is enabled).

After scaffolding, summarise the contracts you wrote so the user can correct them, then
suggest `/oneshot-poc` to build the first PoC.

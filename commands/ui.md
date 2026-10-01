---
description: Design the UI properly — research real web inspiration, apply it, then iterate with a fast visual critic (Haiku screenshots) until it looks intentional, not generic-LLM.
argument-hint: [what the UI is for; defaults to the current charter]
---

# /oneshot-poc:ui — grounded UI design with a visual-QA loop

LLMs default to bland, templated UIs. This fixes that with a mechanism: **ground the look in
real references**, apply it, and **check what it actually looks like** with a cheap multimodal
model in a tight loop — not "the code looks fine," but a screenshot a critic scores.

> **Narrate each step (IN → DO → OUT).** Open each step with one line of what it got and what it
> will do (`▶ IN … / ▶ DO …`), and close it with what it produced (`✓ OUT …`). The workflow itself
> narrates its own nodes (Inspire/Apply/Render/Critique) this way via `log()` — surface those.

It runs as the bundled workflow. Gather the inputs, then invoke the **Workflow** tool:

```
scriptPath: ${CLAUDE_PLUGIN_ROOT}/workflows/ui-design-loop.js
args: {
  task:     "<what the app is — for the inspiration search>",
  brief:    "docs/design/ui-brief.md",
  screens:  [ { "name": "home", "url": "http://127.0.0.1:<port>/" }, ... ],
  startCmd: "<command that starts the app on a local URL, e.g. 'uvicorn app.main:app'>",
  maxRounds: 3
}
```

What it does each round:
1. **Inspire** — the `ui-researcher` agent web-searches real design references for this product
   type and writes a cited **design brief** (`docs/design/ui-brief.md`): direction + named
   references, layout, color tokens, typography, components, and the generic-LLM tells to avoid.
2. **Apply** — a builder (heavy model) applies the brief to the screens.
3. **Render** — start the app and **screenshot** each screen full-page (the bundled Playwright).
4. **Critique** — the `ui-reviewer` agent, on a **small multimodal model (Haiku)**, *looks at*
   the screenshots and scores hierarchy, spacing, typography, contrast, consistency, brief
   adherence, and the "generic-LLM smell" — returning concrete, located fixes.

It loops Apply→Render→Critique until the critic **passes** (intentional, on-brief, no
high-severity issues) or `maxRounds` is hit (then it returns the remaining issues for a human).

## Notes
- First use installs the screenshot tooling via the `demo-video` skill (`setup.sh` — ffmpeg + a
  headless browser); no keys.
- Haiku is deliberate here: it's cheap and fast, so the see-fix-see loop stays tight. Override
  with `args.criticModel` / `args.builderModel` / `args.workerModel` if needed.
- Never screenshot a login screen or anything with secrets on it.

## In `/oneshot-poc:run`
The build loop runs this automatically for any charter requirement with a visual surface —
after the feature works (so there's something to screenshot), as part of making it *good*, not
just functional.

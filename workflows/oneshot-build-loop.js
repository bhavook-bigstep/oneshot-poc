export const meta = {
  name: 'oneshot-build-loop',
  description: 'Autonomous PoC build loop: brainstorm → plan → implement → parallel review → acceptance, looping on gaps until every charter requirement is met or a budget is hit.',
  whenToUse: 'The autonomous engine behind /oneshot-poc:run (phases B–F), between the human scope/verify/video gates. Never runs the human gates itself.',
  phases: [
    { title: 'Brainstorm', detail: 'cited approaches for the open requirements' },
    { title: 'Plan', detail: 'concrete plan tied to the acceptance checklist' },
    { title: 'Implement', detail: 'build + tests + gates (auto-fix)' },
    { title: 'Review', detail: 'parallel reviewers; auto-fix P1/P2' },
    { title: 'Acceptance', detail: 'verify every requirement against the built product' },
  ],
}

// args (from /oneshot-poc:run): {
//   charter:   path to the requirements charter (the acceptance checklist lives here),
//   ledger:    path to the run ledger to read-first / write-after every phase,
//   dir:       project root, maxOuter (default 3), maxInner (default 2),
//   feedback:  optional — gate feedback to fold in this invocation (re-entry),
// }
const A = args || {}
const CHARTER = A.charter || 'REQUIREMENTS.md'
const LEDGER = A.ledger || 'docs/plans/run-ledger.md'
const MAX_OUTER = A.maxOuter || 3
const MAX_INNER = A.maxInner || 2
// Manager–worker tiers: a smart manager (Opus) plans/judges/integrates; cheaper workers
// (Sonnet) do the grunt exploration and implementation. Overridable via args.
const MANAGER = A.managerModel || 'opus'
const WORKER = A.workerModel || 'sonnet'
// Reviewers + acceptance do the heavy lifting (running tests, driving a headless browser,
// adversarial judgement), so they stay on the heavy model. Overridable via args.reviewerModel.
const REVIEWER = A.reviewerModel || 'opus'
const LED = `Read ${LEDGER} first for current state; append your phase's outcome to it when done (requirement-status matrix, phase, iteration, what changed). Never log secrets/PII.`
const RULES = 'Follow the project CLAUDE.md + .claude/rules/ (already injected). Synthetic fixtures only; no secrets; deterministic.'

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          issue: { type: 'string' },
          needsDesignChange: { type: 'boolean' },
        },
        required: ['severity', 'file', 'issue', 'needsDesignChange'],
      },
    },
  },
  required: ['findings'],
}
const IMPL = {
  type: 'object',
  properties: {
    gatesPass: { type: 'boolean' },
    summary: { type: 'string' },
    blocked: { type: 'boolean' },
    blocker: { type: 'string' },
  },
  required: ['gatesPass', 'summary', 'blocked'],
}
const TASKS = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          desc: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          dependsOn: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'desc', 'files'],
      },
    },
  },
  required: ['tasks'],
}
const ACCEPT = {
  type: 'object',
  properties: {
    allMet: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['met', 'partial', 'missing', 'needs_human'] },
          evidence: { type: 'string' },
        },
        required: ['id', 'verdict'],
      },
    },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['allMet', 'items', 'gaps'],
}

const REVIEW_DIMS = [
  ['code-quality', 'YAGNI, scope creep, duplication, naming, readability, dead code'],
  ['architecture', 'system contracts in CLAUDE.md, module/library boundaries, reproducibility'],
  ['tests', 'coverage on changed lines, risk/exception paths, hermetic + deterministic + synthetic fixtures'],
  ['security', 'committed secrets, injection, unsafe deserialization, uncontrolled egress, missing input validation'],
]

phase('Brainstorm')
const focus = A.feedback
  ? `Incorporate this gate feedback as new/changed requirements: ${A.feedback}`
  : 'the open requirements in the charter'
// WORKERS (Sonnet): each explores ONE approach from a distinct angle, in parallel.
const ANGLES = [
  'MVP-first — the simplest design that satisfies the charter',
  'risk-first — attack the hardest / most uncertain parts',
  'robustness-first — edge cases, failure modes, operability',
]
const proposals = (await parallel(
  ANGLES.map((angle, i) => () =>
    agent(
      `Propose ONE approach for ${focus}, from this angle: ${angle}. Charter: ${CHARTER}. Attach a real cited source (web-searched) or the verbatim "No source found — this is an AI-generated idea." Give the core idea, why it fits the charter, rough effort, and the main risk. ${RULES}`,
      { phase: 'Brainstorm', label: `approach:${i + 1}`, model: WORKER },
    ),
  ),
)).filter(Boolean)
// MANAGER (Opus): synthesize — pick the best, graft the strongest ideas, state the trade-off.
await agent(
  `Manager: from these ${proposals.length} candidate approaches, choose the best for the charter, graft the strongest ideas from the others, and state the trade-off and why. Then record the chosen approach in the ledger. Approaches:\n${JSON.stringify(proposals)}\n${LED}`,
  { phase: 'Brainstorm', label: 'manager:synthesize', model: MANAGER },
)

let gaps = null
for (let outer = 1; outer <= MAX_OUTER; outer++) {
  log(`Outer loop ${outer}/${MAX_OUTER}${gaps ? ` — closing gaps: ${gaps.join('; ')}` : ''}`)

  phase('Plan')
  const planTarget = gaps ? `the remaining gaps: ${gaps.join('; ')}` : 'every acceptance item in the charter'
  await agent(
    `Manager: write/revise a concrete plan for ${planTarget}. Charter: ${CHARTER}. Exact files/functions/config, the dependency graph (what can run in parallel on disjoint files), and a test per acceptance item. ${RULES} ${LED}`,
    { phase: 'Plan', label: 'manager:plan', model: MANAGER },
  )

  // inner loop: implement → review → (fix / re-plan / clean)
  let rePlan = false
  for (let inner = 1; inner <= MAX_INNER; inner++) {
    phase('Implement')
    // MANAGER (Opus): break the plan into tasks, each owning a DISJOINT set of files.
    const breakdown = await agent(
      `Manager: read the current plan and ${CHARTER}, and break the implementation into small tasks, each owning a DISJOINT set of files (no two tasks touch the same file). Mark real dependencies in dependsOn; return dependent tasks already in dependency order. ${RULES}`,
      { phase: 'Implement', label: 'manager:decompose', model: MANAGER, schema: TASKS },
    )
    const tasks = (breakdown && breakdown.tasks) || []
    const independent = tasks.filter((t) => !(t.dependsOn && t.dependsOn.length))
    const dependent = tasks.filter((t) => t.dependsOn && t.dependsOn.length)
    const workerPrompt = (t) =>
      `Worker: implement ONLY task "${t.desc}". Touch ONLY these files: ${(t.files || []).join(', ')} — do not edit any other file. Write tests for new logic. ${RULES}`
    // WORKERS (Sonnet): independent tasks in parallel (disjoint files → no conflict)...
    if (independent.length) {
      await parallel(independent.map((t) => () =>
        agent(workerPrompt(t), { phase: 'Implement', label: `impl:${t.id}`, model: WORKER })))
    }
    // ...then dependent tasks sequentially, in the order the manager returned.
    for (const t of dependent) {
      await agent(workerPrompt(t), { phase: 'Implement', label: `impl:${t.id}`, model: WORKER })
    }
    // MANAGER (Opus): integrate the tasks, run the gates, auto-fix, commit.
    const impl = await agent(
      `Manager: integrate all the tasks into a coherent whole against ${CHARTER}. Run the project's gates (lint/type/tests) and auto-fix up to 2 attempts; report REAL results, never fake a pass. Commit to the local feature branch. If the gates can't be made to pass, set blocked=true with a specific blocker. ${LED}`,
      { phase: 'Implement', label: 'manager:integrate', model: MANAGER, schema: IMPL },
    )
    if (impl && impl.blocked) {
      return { status: 'stuck', stage: 'implement', blocker: impl.blocker || impl.summary, outer }
    }

    phase('Review')
    const reviews = (await parallel(
      REVIEW_DIMS.map(([name, scope]) => () =>
        agent(
          `Review ONLY the current git diff for ${name}: ${scope}. ${RULES} Report concrete findings with file:line; set needsDesignChange=true when a fix requires reworking the approach, not a local edit.`,
          { phase: 'Review', label: `review:${name}`, model: REVIEWER, schema: FINDINGS },
        ),
      ),
    )).filter(Boolean)
    const all = reviews.flatMap((r) => r.findings || [])
    const blocking = all.filter((f) => f.severity === 'P1' || f.severity === 'P2')
    if (blocking.length === 0) break // clean → leave inner, go to acceptance

    if (blocking.some((f) => f.needsDesignChange)) {
      rePlan = true
      break // E→C: a design change is needed → re-plan (outer loop re-enters Plan)
    }
    // fix in place, then re-review (next inner iteration)
    await agent(
      `Fix these review findings, then re-run the gates: ${JSON.stringify(blocking)}. ${RULES} ${LED}`,
      { phase: 'Review', label: 'review:fix', model: REVIEWER },
    )
    if (inner === MAX_INNER) log(`Inner review budget reached (${MAX_INNER}); proceeding to acceptance with any residual P2s noted.`)
  }
  if (rePlan) continue // re-plan this outer iteration's work

  phase('Acceptance')
  const acc = await agent(
    `Verify the built product against EVERY acceptance item in ${CHARTER}, item by item. Read the code AND exercise it — run the tests, run the app/CLI, and for UI items drive a headless browser (the oneshot-poc demo-video skill bundles Playwright under its scripts/web — use record-lib or a plain Playwright script to click/assert). Mark each met / partial / missing / needs_human with evidence (file:line, test name, command+result, or the UI assertion). Do NOT perform destructive or outward-facing actions. ${LED}`,
    { phase: 'Acceptance', agentType: 'acceptance-reviewer', model: REVIEWER, schema: ACCEPT },
  )
  if (acc && acc.allMet) {
    return { status: 'met', items: acc.items, outer, note: acc.items.filter((i) => i.verdict === 'needs_human').map((i) => i.id) }
  }
  const newGaps = (acc && acc.gaps) || ['acceptance review returned no structured result']
  // stuck-detector: identical gap set two outer loops running → escalate instead of spinning
  if (gaps && JSON.stringify(gaps.slice().sort()) === JSON.stringify(newGaps.slice().sort())) {
    return { status: 'stuck', stage: 'acceptance', blocker: 'the same gaps persisted across a full outer loop', gaps: newGaps, outer }
  }
  gaps = newGaps
}

return { status: 'stuck', stage: 'budget', blocker: `outer loop budget (${MAX_OUTER}) exhausted`, gaps, outer: MAX_OUTER }

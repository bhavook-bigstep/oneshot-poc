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
let focus = A.feedback
  ? `Incorporate this gate feedback as new/changed requirements: ${A.feedback}`
  : 'the open requirements in the charter'
await agent(
  `Brainstorm 2–4 approaches for ${focus}. Charter: ${CHARTER}. Each approach carries a real cited source or the verbatim "No source found — this is an AI-generated idea." Pick one; note the trade-off. ${LED}`,
  { phase: 'Brainstorm' },
)

let gaps = null
for (let outer = 1; outer <= MAX_OUTER; outer++) {
  log(`Outer loop ${outer}/${MAX_OUTER}${gaps ? ` — closing gaps: ${gaps.join('; ')}` : ''}`)

  phase('Plan')
  const planTarget = gaps ? `the remaining gaps: ${gaps.join('; ')}` : 'every acceptance item in the charter'
  await agent(
    `Write/revise a concrete plan for ${planTarget}. Charter: ${CHARTER}. Exact files/functions/config, dependency graph, and a test per acceptance item. ${RULES} ${LED}`,
    { phase: 'Plan' },
  )

  // inner loop: implement → review → (fix / re-plan / clean)
  let rePlan = false
  for (let inner = 1; inner <= MAX_INNER; inner++) {
    phase('Implement')
    const impl = await agent(
      `Implement the current plan against ${CHARTER}. Write tests for new logic. Run the project's gates (lint/type/tests) and auto-fix up to 2 attempts; report REAL results, never fake a pass. Commit to the local feature branch. ${RULES} ${LED}`,
      { phase: 'Implement', schema: IMPL },
    )
    if (impl && impl.blocked) {
      return { status: 'stuck', stage: 'implement', blocker: impl.blocker || impl.summary, outer }
    }

    phase('Review')
    const reviews = (await parallel(
      REVIEW_DIMS.map(([name, scope]) => () =>
        agent(
          `Review ONLY the current git diff for ${name}: ${scope}. ${RULES} Report concrete findings with file:line; set needsDesignChange=true when a fix requires reworking the approach, not a local edit.`,
          { phase: 'Review', label: `review:${name}`, schema: FINDINGS },
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
      { phase: 'Review', label: 'review:fix' },
    )
    if (inner === MAX_INNER) log(`Inner review budget reached (${MAX_INNER}); proceeding to acceptance with any residual P2s noted.`)
  }
  if (rePlan) continue // re-plan this outer iteration's work

  phase('Acceptance')
  const acc = await agent(
    `Verify the built product against EVERY acceptance item in ${CHARTER}, item by item. Read the code AND exercise it — run the tests, run the app/CLI, and for UI items drive a headless browser (the oneshot-poc demo-video skill bundles Playwright under its scripts/web — use record-lib or a plain Playwright script to click/assert). Mark each met / partial / missing / needs_human with evidence (file:line, test name, command+result, or the UI assertion). Do NOT perform destructive or outward-facing actions. ${LED}`,
    { phase: 'Acceptance', agentType: 'acceptance-reviewer', schema: ACCEPT },
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

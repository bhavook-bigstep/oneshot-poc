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
//   maxReplans: design-change re-plan budget before escalating (default 2),
//   feedback:  optional — gate feedback to fold in this invocation (re-entry),
// }
// Every stuck return carries diagnostics — {gaps, lastReview, lastAcceptance, trail} — so the
// orchestrator reports what was built / tried / unmet without reading the run journal.
const A = args || {}
const CHARTER = A.charter || 'REQUIREMENTS.md'
const LEDGER = A.ledger || 'docs/plans/run-ledger.md'
const MAX_OUTER = A.maxOuter || 3
const MAX_INNER = A.maxInner || 2
// Re-plans (design-change E→C) have their OWN budget, separate from the outer acceptance budget.
// Without this, repeated "needs a design change" findings bounce Plan↔Review and silently drain
// MAX_OUTER before acceptance ever runs — returning a stuck with no gaps to report.
const MAX_REPLANS = A.maxReplans || 2
// Escalation ladder: when PLAN-level refinement can't close the gaps (persistent gaps or design
// churn), the loop re-enters BRAINSTORM to re-think the approach — up to this many times before
// escalating to a human stuck. The approach itself, not just the plan, gets a chance to change.
const MAX_REBRAINSTORMS = A.maxRebrainstorms || 1
// Build ONE phase at a time when a phase is passed (requirements split into slices); otherwise
// the whole charter. Scoping keeps each loop focused — nail this slice, then take the next fresh.
const PHASE = A.phase || null
const SCOPE = PHASE
  ? `phase ${PHASE.id} "${PHASE.title}" (ONLY charter items ${(PHASE.items || []).join(', ')}; ignore items belonging to other phases)`
  : 'the charter'
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

// Node narration: every node logs IN/DO before acting and OUT after — so the run is observable in
// the progress narrator without digging into transcripts (mirrors IN→DO→OUT in /oneshot-poc:run).
// Brainstorm is a FUNCTION so the escalation ladder can re-enter it mid-loop when the approach
// itself (not just the plan) proves wrong.
const ANGLES = [
  'MVP-first — the simplest design that satisfies the charter',
  'risk-first — attack the hardest / most uncertain parts',
  'robustness-first — edge cases, failure modes, operability',
]
async function runBrainstorm(focusText) {
  phase('Brainstorm')
  log(`▶ IN  Brainstorm — focus: ${focusText}`)
  log(`▶ DO  Brainstorm — ${ANGLES.length} workers (${WORKER}) explore distinct angles → manager (${MANAGER}) synthesises one approach`)
  // WORKERS (Sonnet): each explores ONE approach from a distinct angle, in parallel.
  const proposals = (await parallel(
    ANGLES.map((angle, i) => () =>
      agent(
        `Propose ONE approach for ${focusText}, from this angle: ${angle}. Charter: ${CHARTER}. Attach a real cited source (web-searched) or the verbatim "No source found — this is an AI-generated idea." Give the core idea, why it fits the charter, rough effort, and the main risk. ${RULES}`,
        { phase: 'Brainstorm', label: `approach:${i + 1}`, model: WORKER },
      ),
    ),
  )).filter(Boolean)
  // MANAGER (Opus): synthesize — pick the best, graft the strongest ideas, state the trade-off.
  await agent(
    `Manager: from these ${proposals.length} candidate approaches, choose the best for the charter, graft the strongest ideas from the others, and state the trade-off and why. Then record the chosen approach in the ledger. Approaches:\n${JSON.stringify(proposals)}\n${LED}`,
    { phase: 'Brainstorm', label: 'manager:synthesize', model: MANAGER },
  )
  log(`✓ OUT Brainstorm — chosen approach recorded from ${proposals.length} candidate(s) → hand to Plan`)
}

// Diagnostics carried into every stuck return, so the orchestrator can report what happened
// (met/partial/missing + what was tried) WITHOUT reading the journal. Never return a bare null.
let gaps = null
let lastReview = null     // the blocking findings from the most recent review
let lastAccept = null     // the most recent acceptance matrix (items + verdicts)
let designToFix = null    // design-change findings to resolve on the next re-plan
let rePlans = 0           // re-plans on a design change, within the current approach
const trail = []          // one line per loop outcome — the "what was tried" record

// Escalation ladder (approach loop): a small gap re-enters PLAN (inner outer loop); a persistent
// gap or design churn re-enters BRAINSTORM here to re-think the approach; still failing → stuck.
const MAX_APPROACHES = 1 + MAX_REBRAINSTORMS
const initialFocus = A.feedback
  ? `Incorporate this gate feedback as new/changed requirements: ${A.feedback}`
  : `the open requirements in ${SCOPE}`
let escalate = null // non-null → re-brainstorm with this context on the next approach

for (let approach = 1; approach <= MAX_APPROACHES; approach++) {
  await runBrainstorm(approach === 1 ? initialFocus
    : `The previous approach did not get ${SCOPE} to pass (${escalate}). Explore a DIFFERENT approach — not a tweak of the last one — reusing only what demonstrably worked.`)
  // reset per-approach state — a new approach gets fresh plan/build/verify attempts
  gaps = null; rePlans = 0; designToFix = null; escalate = null
  let reBrainstorm = false

  for (let outer = 1; outer <= MAX_OUTER; outer++) {
    log(`Approach ${approach}/${MAX_APPROACHES} · outer ${outer}/${MAX_OUTER}${gaps ? ` — closing gaps: ${gaps.join('; ')}` : ''}`)

    phase('Plan')
  const planTarget = designToFix
    ? `REWORK the approach to resolve these design-change findings, then cover ${SCOPE}: ${designToFix.map((f) => f.issue).join('; ')}`
    : gaps ? `the remaining gaps: ${gaps.join('; ')}` : `every acceptance item in ${SCOPE}`
  designToFix = null // consumed into this plan
  log(`▶ IN  Plan (outer ${outer}/${MAX_OUTER}) — target: ${planTarget}`)
  log(`▶ DO  Plan — manager (${MANAGER}) writes/revises a concrete plan: files, dep graph, a test per acceptance item`)
  await agent(
    `Manager: write/revise a concrete plan for ${planTarget}. Charter: ${CHARTER}. Exact files/functions/config, the dependency graph (what can run in parallel on disjoint files), and a test per acceptance item. ${RULES} ${LED}`,
    { phase: 'Plan', label: 'manager:plan', model: MANAGER },
  )
  log(`✓ OUT Plan — plan written to the ledger → hand to Implement`)

  // inner loop: implement → review → (fix / re-plan / clean)
  let rePlan = false
  for (let inner = 1; inner <= MAX_INNER; inner++) {
    phase('Implement')
    log(`▶ IN  Implement (outer ${outer}, inner ${inner}/${MAX_INNER}) — the current plan for ${SCOPE}`)
    log(`▶ DO  Implement — manager (${MANAGER}) decomposes into disjoint-file tasks → workers (${WORKER}) build → manager integrates + runs gates`)
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
      log(`✓ OUT Implement — BLOCKED: ${impl.blocker || impl.summary} → return stuck`)
      return { status: 'stuck', stage: 'implement', blocker: impl.blocker || impl.summary, outer }
    }
    log(`✓ OUT Implement — ${tasks.length} task(s) integrated, gates ${impl && impl.gatesPass ? 'PASS' : 'reported'} → hand to Review`)

    phase('Review')
    log(`▶ IN  Review (outer ${outer}, inner ${inner}) — the current git diff`)
    log(`▶ DO  Review — ${REVIEW_DIMS.length} reviewers (${REVIEWER}) in parallel: ${REVIEW_DIMS.map(([n]) => n).join(', ')}`)
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
    lastReview = blocking
    if (blocking.length === 0) {
      log(`✓ OUT Review — clean (no P1/P2 across ${all.length} finding(s)) → hand to Acceptance`)
      break // clean → leave inner, go to acceptance
    }

    if (blocking.some((f) => f.needsDesignChange)) {
      const design = blocking.filter((f) => f.needsDesignChange)
      rePlans++
      trail.push(`outer ${outer}: re-plan #${rePlans} on design change — ${design.map((f) => f.issue).join('; ')}`)
      // Re-plan churn guard: if design changes keep forcing E→C past the budget, PLAN-level rework
      // isn't working — re-think the whole approach (re-brainstorm) if budget remains, else stuck.
      if (rePlans > MAX_REPLANS) {
        if (approach < MAX_APPROACHES) {
          escalate = `the approach kept needing rework (design-change findings: ${design.map((f) => f.issue).join('; ')})`
          trail.push(`approach ${approach}: design churn after ${rePlans - 1} re-plan(s) → re-brainstorm`)
          log(`✓ OUT Review — design churn; re-plan budget (${MAX_REPLANS}) spent → RE-BRAINSTORM the approach`)
          reBrainstorm = true
          break // leave inner; the guard after the outer loop leaves the approach to re-brainstorm
        }
        log(`✓ OUT Review — design churn and no approaches left → return stuck with findings`)
        return {
          status: 'stuck', stage: 'design-churn',
          blocker: `the approach kept needing rework across ${MAX_APPROACHES} approach(es) — re-planned ${rePlans - 1}× without reaching acceptance`,
          gaps: design.map((f) => f.issue), findings: design, lastReview, lastAcceptance: lastAccept, trail, outer,
        }
      }
      designToFix = design // the next Plan reworks the approach to resolve these
      log(`✓ OUT Review — ${blocking.length} blocker(s), design change (re-plan ${rePlans}/${MAX_REPLANS}) → re-plan (E→C)`)
      rePlan = true
      break // E→C: a design change is needed → re-plan (outer loop re-enters Plan)
    }
    // fix in place, then re-review (next inner iteration)
    log(`✓ OUT Review — ${blocking.length} blocker(s), fixable in place → fix then re-review`)
    await agent(
      `Fix these review findings, then re-run the gates: ${JSON.stringify(blocking)}. ${RULES} ${LED}`,
      { phase: 'Review', label: 'review:fix', model: REVIEWER },
    )
    if (inner === MAX_INNER) log(`Inner review budget reached (${MAX_INNER}); proceeding to acceptance with any residual P2s noted.`)
  }
  if (reBrainstorm) break // the approach is wrong → leave the outer loop to re-brainstorm
  if (rePlan) continue // re-plan this outer iteration's work

  phase('Acceptance')
  log(`▶ IN  Acceptance — the built product vs. every acceptance item in ${SCOPE}`)
  log(`▶ DO  Acceptance — acceptance-reviewer (${REVIEWER}) reads + exercises each item (tests, CLI, headless browser for UI)`)
  const acc = await agent(
    `Verify the built product against EVERY acceptance item in ${SCOPE} (from ${CHARTER}), item by item. Read the code AND exercise it — run the tests, run the app/CLI, and for UI items drive a headless browser (the oneshot-poc demo-video skill bundles Playwright under its scripts/web — use record-lib or a plain Playwright script to click/assert). Mark each met / partial / missing / needs_human with evidence (file:line, test name, command+result, or the UI assertion). Do NOT perform destructive or outward-facing actions. ${LED}`,
    { phase: 'Acceptance', agentType: 'acceptance-reviewer', model: REVIEWER, schema: ACCEPT },
  )
  lastAccept = acc
  if (acc && acc.allMet) {
    const needsHuman = acc.items.filter((i) => i.verdict === 'needs_human').map((i) => i.id)
    log(`✓ OUT Acceptance — ALL MET for ${SCOPE}${needsHuman.length ? ` (needs_human: ${needsHuman.join(', ')})` : ''} → return met`)
    return { status: 'met', items: acc.items, outer, note: needsHuman }
  }
  const newGaps = (acc && acc.gaps && acc.gaps.length) ? acc.gaps : ['acceptance review returned no structured gap list']
  trail.push(`outer ${outer}: acceptance not met — ${newGaps.join('; ')}`)
  // Persistent-gap detector: identical gaps across a full outer loop means PLAN-level refinement
  // isn't closing them → re-think the approach (re-brainstorm) if budget remains, else stuck.
  if (gaps && JSON.stringify(gaps.slice().sort()) === JSON.stringify(newGaps.slice().sort())) {
    if (approach < MAX_APPROACHES) {
      escalate = `the same gaps persisted across a full plan/build/verify loop: ${newGaps.join('; ')}`
      trail.push(`approach ${approach}: gaps persisted → re-brainstorm`)
      log(`✓ OUT Acceptance — same gaps persisted → RE-BRAINSTORM the approach`)
      reBrainstorm = true
      break // leave the outer loop to re-brainstorm
    }
    log(`✓ OUT Acceptance — same gaps persisted and no approaches left → return stuck`)
    return { status: 'stuck', stage: 'acceptance', blocker: 'the same gaps persisted across approaches', gaps: newGaps, lastReview, lastAcceptance: acc, trail, outer }
  }
    log(`✓ OUT Acceptance — not met; ${newGaps.length} gap(s): ${newGaps.join('; ')} → loop back to Plan`)
    gaps = newGaps
  } // end outer loop

  if (reBrainstorm) continue // the approach was wrong → re-brainstorm (next approach iteration)

  // Outer budget spent for THIS approach without a re-brainstorm trigger → re-think the approach
  // if one remains; otherwise fall through to the final (genuine) budget stuck.
  if (approach < MAX_APPROACHES) {
    escalate = `${MAX_OUTER} plan/build/verify loops didn't close the gaps: ${(gaps || []).join('; ') || '(no gap list — likely design churn)'}`
    trail.push(`approach ${approach}: outer budget (${MAX_OUTER}) exhausted → re-brainstorm`)
    log(`Approach ${approach} exhausted its outer budget → RE-BRAINSTORM the approach`)
    continue
  }
} // end approach loop

// All approaches spent. NEVER return a bare null: fall back to acceptance gaps → unresolved design
// findings → last review findings, so the stuck is always actionable without reading the journal.
const finalGaps = gaps
  || (designToFix && designToFix.length ? designToFix.map((f) => f.issue) : null)
  || (lastReview && lastReview.length ? lastReview.map((f) => `${f.severity} ${f.file || ''}: ${f.issue}`) : null)
  || ['budget exhausted before acceptance produced a gap list — likely repeated re-plans; see trail']
const blocker = `exhausted ${MAX_APPROACHES} approach(es) × ${MAX_OUTER} loops without meeting ${SCOPE}`
log(`✓ OUT build-loop — ${blocker} → return stuck (${finalGaps.length} gap(s))`)
return { status: 'stuck', stage: 'budget', blocker, gaps: finalGaps, lastReview, lastAcceptance: lastAccept, trail, outer: MAX_OUTER }

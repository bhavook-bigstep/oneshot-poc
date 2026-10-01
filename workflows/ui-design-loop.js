export const meta = {
  name: 'ui-design-loop',
  description: 'Ground the UI in real web inspiration, apply it, then iterate — screenshot the UI and critique it with a fast multimodal model (Haiku) — until it looks intentional and on-brief.',
  whenToUse: 'For any PoC with a visual surface, to avoid the generic-LLM default look. Invoked by /oneshot-poc:ui and by the build loop for UI requirements.',
  phases: [
    { title: 'Inspire', detail: 'web research → a cited design brief' },
    { title: 'Apply', detail: 'build/restyle the screens to the brief' },
    { title: 'Render', detail: 'start the app + screenshot each screen' },
    { title: 'Critique', detail: 'Haiku looks at the screenshots and scores them' },
  ],
}

// args (from /oneshot-poc:ui or the build loop): {
//   task:     what the app is (for the researcher),
//   brief:    design-brief path (default docs/design/ui-brief.md),
//   screens:  [{ name, url }] to screenshot,
//   startCmd: shell command that starts the app on a local URL,
//   references: optional — user-provided inspiration to anchor the look (sites/brands/products,
//              URLs, screenshots, or a style in words). The researcher treats these as the PRIMARY
//              direction and web-searches to complement/validate them.
//   maxRounds (default 3), builderModel (default 'opus'), criticModel (default 'haiku'),
//   workerModel (default 'sonnet') }
const A = args || {}
const TASK = A.task || 'the application'
const BRIEF = A.brief || 'docs/design/ui-brief.md'
const SCREENS = A.screens || []
const START = A.startCmd || ''
const REFERENCES = (A.references || '').toString().trim()
const MAX = A.maxRounds || 3
const BUILDER = A.builderModel || 'opus' // UI implementation — heavy model, LLMs are weak here
const CRITIC = A.criticModel || 'haiku' // fast multimodal visual check
const WORKER = A.workerModel || 'sonnet' // mechanical rendering
const RULES = 'Follow the project CLAUDE.md + .claude/rules/. Never screenshot a login screen or secrets.'

const SHOTS = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: { screen: { type: 'string' }, path: { type: 'string' } },
        required: ['screen', 'path'],
      },
    },
    error: { type: 'string' },
  },
  required: ['shots'],
}
const CRIT = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'integer' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          screen: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'med', 'low'] },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'problem', 'fix'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
  },
  required: ['pass', 'score', 'issues'],
}

// Node narration: each node logs IN / DO before acting and OUT after — matches the IN→DO→OUT
// convention in /oneshot-poc:run so the UI loop is observable in the progress narrator.
// 1. INSPIRE — ground the look in real references (worker), write the design brief.
phase('Inspire')
log(`▶ IN  Inspire — app: ${TASK}; ${SCREENS.length} screen(s)${REFERENCES ? ' · user references provided' : ' · no user references (web only)'}`)
log(`▶ DO  Inspire — ui-researcher (${WORKER}) ${REFERENCES ? 'starts from the user references, then web-searches to complement' : 'web-searches real references'} → writes the design brief to ${BRIEF}`)
const refNote = REFERENCES
  ? `The user provided these references to anchor the look — treat them as the PRIMARY direction, extract their concrete design language (layout, color, type, components), and web-search to complement and validate (never override) them: ${REFERENCES}. `
  : ''
await agent(
  `${refNote}Find real web design inspiration for ${TASK} and write the design brief to ${BRIEF} (direction + named references, layout, color tokens, typography, components, do/don't, cited sources). ${REFERENCES ? 'Record which parts of the brief come from the user references vs. web research. ' : ''}${RULES}`,
  { phase: 'Inspire', agentType: 'ui-researcher', model: WORKER },
)
log(`✓ OUT Inspire — design brief written to ${BRIEF} → start the apply/render/critique rounds`)

// 2. Iterate: apply → render → Haiku critique.
let lastIssues = null
for (let round = 1; round <= MAX; round++) {
  phase('Apply')
  const fixNote = lastIssues && lastIssues.length
    ? ` Fix these issues from the last visual review: ${JSON.stringify(lastIssues)}.`
    : ''
  log(`▶ IN  Apply (round ${round}/${MAX}) — the brief ${BRIEF}${lastIssues && lastIssues.length ? ` + ${lastIssues.length} issue(s) from last critique` : ''}`)
  log(`▶ DO  Apply — builder (${BUILDER}) builds/restyles the screens to the brief`)
  await agent(
    `Apply the design brief ${BRIEF} to the UI — build/restyle the screens to match the direction, layout, color and type tokens.${fixNote} ${RULES}`,
    { phase: 'Apply', label: `apply:r${round}`, model: BUILDER },
  )
  log(`✓ OUT Apply (round ${round}) — screens restyled → hand to Render`)

  phase('Render')
  log(`▶ IN  Render (round ${round}) — ${SCREENS.length} screen(s), start: \`${START || '(none)'}\``)
  log(`▶ DO  Render — worker (${WORKER}) starts the app + full-page screenshots each screen with Playwright`)
  const rendered = await agent(
    `Start the app with: \`${START}\` (in the background) and wait until it is ready. Then screenshot each screen ${JSON.stringify(SCREENS)} FULL-PAGE with the bundled Playwright (the oneshot-poc demo-video skill ships it under skills/demo-video/scripts/web; or \`npx playwright\`). Save each PNG to .oneshot/ui/round-${round}/<name>.png and return {shots:[{screen,path}]}. Stop the app afterwards. If it won't start or render, return an empty shots array with an error. ${RULES}`,
    { phase: 'Render', label: `render:r${round}`, model: WORKER, schema: SHOTS },
  )
  const shots = (rendered && rendered.shots) || []
  if (!shots.length) {
    lastIssues = [{ severity: 'high', problem: `could not render the UI (${(rendered && rendered.error) || 'unknown'})`, fix: 'make the app start and the screens load, then re-render' }]
    log(`✓ OUT Render (round ${round}) — FAILED: ${(rendered && rendered.error) || 'no screenshots'} → retry Apply next round`)
    continue
  }
  log(`✓ OUT Render (round ${round}) — ${shots.length} screenshot(s) captured → hand to Critique`)

  phase('Critique')
  log(`▶ IN  Critique (round ${round}) — ${shots.length} screenshot(s) vs. the brief`)
  log(`▶ DO  Critique — ui-reviewer (${CRITIC}, multimodal) looks at each screenshot and scores it`)
  const crit = await agent(
    `Look at these UI screenshots and score them against the design brief ${BRIEF}. READ each image path: ${JSON.stringify(shots)}. Be specific and decisive about real visual problems.`,
    { phase: 'Critique', label: `critique:r${round}`, agentType: 'ui-reviewer', model: CRITIC, schema: CRIT },
  )
  const nIssues = crit && crit.issues ? crit.issues.length : 0
  if (crit && crit.pass) {
    log(`✓ OUT Critique (round ${round}) — PASS (score ${crit.score}) → return pass`)
    return { status: 'pass', round, score: crit.score, strengths: crit.strengths || [] }
  }
  log(`✓ OUT Critique (round ${round}) — score ${crit ? crit.score : '?'}, ${nIssues} issue(s) → loop back to Apply`)
  lastIssues = (crit && crit.issues) || []
}

log(`✓ OUT ui-design-loop — ${MAX} round(s) done without a pass → return needs_work (${(lastIssues || []).length} remaining)`)
return { status: 'needs_work', rounds: MAX, remaining: lastIssues || [] }

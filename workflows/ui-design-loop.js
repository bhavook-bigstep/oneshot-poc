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
//   maxRounds (default 3), builderModel (default 'opus'), criticModel (default 'haiku'),
//   workerModel (default 'sonnet') }
const A = args || {}
const TASK = A.task || 'the application'
const BRIEF = A.brief || 'docs/design/ui-brief.md'
const SCREENS = A.screens || []
const START = A.startCmd || ''
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

// 1. INSPIRE — ground the look in real references (worker), write the design brief.
phase('Inspire')
await agent(
  `Find real web design inspiration for ${TASK} and write the design brief to ${BRIEF} (direction + named references, layout, color tokens, typography, components, do/don't, cited sources). ${RULES}`,
  { phase: 'Inspire', agentType: 'ui-researcher', model: WORKER },
)

// 2. Iterate: apply → render → Haiku critique.
let lastIssues = null
for (let round = 1; round <= MAX; round++) {
  phase('Apply')
  const fixNote = lastIssues && lastIssues.length
    ? ` Fix these issues from the last visual review: ${JSON.stringify(lastIssues)}.`
    : ''
  await agent(
    `Apply the design brief ${BRIEF} to the UI — build/restyle the screens to match the direction, layout, color and type tokens.${fixNote} ${RULES}`,
    { phase: 'Apply', label: `apply:r${round}`, model: BUILDER },
  )

  phase('Render')
  const rendered = await agent(
    `Start the app with: \`${START}\` (in the background) and wait until it is ready. Then screenshot each screen ${JSON.stringify(SCREENS)} FULL-PAGE with the bundled Playwright (the oneshot-poc demo-video skill ships it under skills/demo-video/scripts/web; or \`npx playwright\`). Save each PNG to .oneshot/ui/round-${round}/<name>.png and return {shots:[{screen,path}]}. Stop the app afterwards. If it won't start or render, return an empty shots array with an error. ${RULES}`,
    { phase: 'Render', label: `render:r${round}`, model: WORKER, schema: SHOTS },
  )
  const shots = (rendered && rendered.shots) || []
  if (!shots.length) {
    lastIssues = [{ severity: 'high', problem: `could not render the UI (${(rendered && rendered.error) || 'unknown'})`, fix: 'make the app start and the screens load, then re-render' }]
    log(`UI round ${round}: render failed — ${(rendered && rendered.error) || 'no screenshots'}`)
    continue
  }

  phase('Critique')
  const crit = await agent(
    `Look at these UI screenshots and score them against the design brief ${BRIEF}. READ each image path: ${JSON.stringify(shots)}. Be specific and decisive about real visual problems.`,
    { phase: 'Critique', label: `critique:r${round}`, agentType: 'ui-reviewer', model: CRITIC, schema: CRIT },
  )
  log(`UI round ${round}: score ${crit ? crit.score : '?'}, ${crit && crit.issues ? crit.issues.length : 0} issues`)
  if (crit && crit.pass) return { status: 'pass', round, score: crit.score, strengths: crit.strengths || [] }
  lastIssues = (crit && crit.issues) || []
}

return { status: 'needs_work', rounds: MAX, remaining: lastIssues || [] }

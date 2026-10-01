// example-web-demo.mjs — the DEFAULT web walkthrough pattern: native-res capture,
// highlight boxes, voice-only (no captions). Copy the SHAPE; replace the SELECTORS
// and NARRATION with the app you're demoing.
//
//   PLAYWRIGHT_CORE=$(npm root -g)/playwright/node_modules/playwright-core/index.mjs \
//     DEMO_BASE_URL=https://test.example.com \
//     node my-demo.mjs ~/demo-chrome-profile ./out record
//
//   FAST=1 ...node my-demo.mjs ...   → ~20s validation run: exercises every selector
//                                       and writes the authoritative cue text, no long holds.
//
// What makes it read as a demo:
//   - d.box(sel) before a line, d.unbox() after → a crimson box on what you're explaining
//   - d.say(text, ms) logs a cue for the voice track (no caption drawn unless captions:true)
//   - verify the app advanced (waitForSelector) before moving on; d.abort() if not
import { open } from './record-lib.mjs'

const [profile, outDir, mode] = process.argv.slice(2)
if (!profile || !outDir) { console.error('usage: my-demo.mjs <profile> <out-dir> [record]'); process.exit(1) }
const BASE = process.env.DEMO_BASE_URL
if (!BASE) { console.error('set DEMO_BASE_URL (a test/UAT environment, never production)'); process.exit(1) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// af_heart ≈ 18 chars/s; small tail because captions are off. FAST skips the holds.
const CPS = 18, TAIL = 450
const FAST = !!process.env.FAST
const hold = t => FAST ? 40 : Math.round(t.length / CPS * 1000) + TAIL

// dsf:2 → native/Retina 4K. captions:false → voice only (flip if the user wants captions).
const d = await open({ profile, outDir, record: mode === 'record', url: BASE + '/',
                       width: 1920, height: 1080, dsf: 2, captions: false })
await d.page.waitForSelector('YOUR_FIRST_STABLE_SELECTOR', { timeout: 20000 })
await d.overlays(); await sleep(400)

async function line (t) { await d.say(t, hold(t)); await d.hide(); await sleep(110) }
async function explain (sel, t) { await d.box(sel); await line(t); await d.unbox(); await sleep(110) }

// ---- Intro: say what this is and the problem it solves, before touching anything ----
await line('Let me give you a quick walkthrough of <PRODUCT> and the problem it solves.')
await explain('SELECTOR_FOR_THE_KEY_THING', 'Here is the core idea, pointed at the thing on screen.')

// ---- Walk the sections; box each as you define it ----
await d.click('SELECTOR_FOR_A_TAB_OR_NAV')
await d.page.waitForSelector('SELECTOR_THAT_PROVES_IT_LOADED', { timeout: 10000 })
await explain('SELECTOR_FOR_A_TAB_OR_NAV', 'This section is for X. Here is what the user sees and can do.')

// ---- Open one real record and explain it; box the parts you name ----
await d.click('SELECTOR_FOR_A_LIST_ROW')
await d.page.waitForSelector('SELECTOR_IN_THE_DETAIL_VIEW', { timeout: 10000 })
await d.overlays(); await sleep(300)
await explain('SELECTOR_FOR_THE_DETAIL_TABLE', 'On the left is A, on the right is B, compared field by field.')
await explain('SELECTOR_FOR_THE_ACTION_BUTTONS', 'These are the actions: what each does and why they exist.')

// ---- Demonstrate an action AND show the change it caused ----
await d.box('SELECTOR_FOR_THE_PRIMARY_BUTTON'); await line('I click the primary action.'); await d.unbox()
await d.click('SELECTOR_FOR_THE_PRIMARY_BUTTON'); await sleep(500)
await d.box('SELECTOR_FOR_THE_THING_THAT_CHANGED')      // e.g. a count that ticked up, a new status
await line('And watch: this updates, so the change is visible, not just described.')
await d.unbox()

// verify a real end-state before trusting the take
if (!await d.page.locator('SELECTOR_PROVING_SUCCESS').isVisible().catch(() => false)) {
  await d.abort('the action did not take — not shipping this take')
}

// ---- Recap ----
await line('So that is <PRODUCT>: what it does, and how it fits together.')
await sleep(1200)

await d.finish('demo.srt')   // writes demo.srt + demo.cues.txt next to the video

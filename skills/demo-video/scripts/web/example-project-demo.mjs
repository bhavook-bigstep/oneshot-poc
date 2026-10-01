// Worked example from a real project (a "create a project" wizard). The selectors and
// names are that app's - replace them. What to copy is the SHAPE: say/hide/click, verify, abort.
// Copy this as the starting point for a new web demo.
//
//   node example-project-demo.mjs <chrome-profile-dir> <out-dir> [record]
//
// The profile dir must already hold a logged-in session - log in once by hand
// with headless:false, then reuse it. Recording a login is both slow and a
// credential leak.
//
// Shape that matters:
//   - say() narrates, hide() clears the caption, and both stamp the SRT
//   - re-call overlays() after every navigation or the cursor disappears
//   - verify the app actually advanced before continuing, and abort() if not:
//     a take that silently failed halfway is worse than no take
import { open } from './record-lib.mjs'

const [profile, outDir, mode] = process.argv.slice(2)
if (!profile || !outDir) {
  console.error('usage: example-project-demo.mjs <profile> <out-dir> [record]')
  process.exit(1)
}

const BASE = process.env.DEMO_BASE_URL
if (!BASE) { console.error('set DEMO_BASE_URL to the app URL (a test/UAT environment, never production)'); process.exit(1) }
const NAME = process.env.DEMO_PROJECT_NAME || 'Konkan District Football Ground'
const ALIAS = 'KDFG-' + Date.now().toString().slice(-4)
const CLIENT = 'Konkan Sports Council'
const TEMPLATE = 'Football Ground — Standard Build'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const d = await open({
  profile, outDir, record: mode === 'record', url: `${BASE}/projects`,
})

await d.say('Creating a new project', 1900); await d.hide()
await sleep(120)
await d.say('Projects bring the client and template together', 1600); await d.hide()

await d.click('button:has-text("New project")')
await d.page.waitForSelector('#clientId', { timeout: 15000 })
await d.overlays(); await sleep(700); await d.hide()

await d.say('Step 1 — choose the client', 900)
await d.pick('#clientId', CLIENT); await sleep(400); await d.hide()

await d.say('Then the template we built earlier', 1500)
await d.pick('#templateId', TEMPLATE); await sleep(600); await d.hide()

await d.say('Name the project and set the start date', 900)
await d.retype('#name', NAME, 20)
await d.retype('#aliasName', ALIAS, 22)
const [dx, dy] = await d.at('#startDate')
await d.moveTo(dx, dy); await d.ripple()
await d.page.fill('#startDate', '2026-10-01')
await sleep(900); await d.hide()
await d.say('The end date comes from the template', 1600); await d.hide()

await d.retype('#budget', '7500000', 16)
await d.pick('#gstBranchId', 'Maharashtra — 27AAECS1234F1ZV')
await sleep(300); await d.hide()

await d.say('Contact details auto-fill from the client', 1600); await d.hide()
await d.retype('#clientPoc', 'Anjali Deshmukh', 16)
await d.retype('#contactNumber', '9738434234', 14)
await sleep(300); await d.hide()

await d.say('Set the site location and geofence', 900)
await d.retype('#siteLandmark', 'Near Konkan Sports Complex', 12)
await d.retype('#siteCity', 'Ratnagiri', 14)
await d.retype('#siteState', 'Maharashtra', 12)
await d.retype('#sitePinCode', '415612', 14)
await d.retype('#googleMapsLink', '16.9902, 73.3120', 12)
await d.retype('#fenceRadiusMeters', '500', 14)
await sleep(300); await d.hide()

await d.say('And the billing address', 800)
await d.retype('#billingStreet', '12 Station Road', 12)
await d.retype('#billingCity', 'Ratnagiri', 14)
await d.retype('#billingState', 'Maharashtra', 12)
await d.retype('#billingPinCode', '415612', 14)
await sleep(300); await d.hide()

await d.click('button:has-text("Next")'); await sleep(2200); await d.overlays()
if (!await d.page.locator('#team-project_manager').isVisible().catch(() => false)) {
  await d.abort('blocked on step 1')
}

await d.say('Step 2 — assign the project team', 1000)
await d.retype('#team-project_manager', 'QA', 60)
await sleep(1500)
const opt = d.page.locator('#team-project_manager-listbox [role="option"]').first()
const ob = await opt.boundingBox().catch(() => null)
if (ob) { await d.moveTo(Math.round(ob.x + ob.width / 2), Math.round(ob.y + ob.height / 2)); await d.ripple() }
await opt.click(); await sleep(900); await d.hide()
await d.say('Pick the project manager from the list', 1500); await d.hide()

// The wizard has a variable number of steps depending on the template, so walk
// forward until the expected control appears rather than counting clicks.
for (let i = 0; i < 3; i++) {
  if (await d.page.locator('button:has-text("Add phase")').first().isVisible().catch(() => false)) break
  await d.click('button:has-text("Next")'); await sleep(2200); await d.overlays()
}
await d.say('Step 3 — our template’s phases are already here', 2400); await d.hide()

for (let i = 0; i < 3; i++) {
  if (await d.page.locator('button:has-text("Create Project")').first().isVisible().catch(() => false)) break
  await d.click('button:has-text("Next")'); await sleep(2300); await d.overlays()
}
await d.say('Step 4 — review the full setup', 2200); await d.hide()

await d.say('Create the project', 800); await d.hide()
await d.click('button:has-text("Create Project")')
await d.page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {})
if (!/\/projects\/[0-9a-f-]{36}/.test(d.page.url())) {
  await d.abort('project was not created — not shipping this take')
}
await sleep(900); await d.overlays()
await d.say('Project created and ready for work orders', 2500); await d.hide()
await sleep(1100)

await d.finish('demo.srt')

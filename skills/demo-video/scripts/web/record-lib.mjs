// record-lib.mjs — the reusable half of a web demo recording.
//
// Playwright records a silent WebM; everything that makes it read as a demo is
// injected into the page: a synthetic cursor, a click ripple, an optional caption
// bar, and a highlight box that glides onto whatever is being explained.
//
//   import { open } from './record-lib.mjs'
//   const d = await open({ profile, outDir, record:true, url:'...', dsf:2, captions:false })
//   await d.say('Step 1 - choose the client', 900)   // logs a cue for TTS timing
//   await d.box('.tab.active'); await d.say('This is the queue', 1800); await d.unbox()
//   await d.click('button:has-text("Next")')
//   await d.finish('demo.srt')
//
// DEFAULTS (the configuration this skill standardised on):
//   - dsf: 2         native/Retina capture (video is width*dsf x height*dsf, razor sharp)
//   - captions:false narration is voice-only unless the user asks for on-screen captions
//   - headless:true  no window pops; recordVideo still captures everything
//   - a crimson highlight box replaces "hover the cursor and hope they notice"

import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function resolvePlaywright () {
  if (process.env.PLAYWRIGHT_CORE) return process.env.PLAYWRIGHT_CORE
  try { return createRequire(import.meta.url).resolve('playwright-core') } catch {}
  try { return createRequire(import.meta.url).resolve('playwright') } catch {}
  const roots = [process.env.HOME + '/.npm/_npx']
  try { roots.push(execSync('npm root -g').toString().trim()) } catch {}
  for (const root of roots) {
    for (const sub of ['playwright/node_modules/playwright-core/index.mjs', 'playwright-core/index.mjs']) {
      const p = path.join(root, sub); if (fs.existsSync(p)) return p
    }
    for (const d of fs.existsSync(root) ? fs.readdirSync(root) : []) {
      const p = path.join(root, d, 'node_modules/playwright-core/index.mjs')
      if (fs.existsSync(p)) return p
    }
  }
  throw new Error('playwright-core not found - set PLAYWRIGHT_CORE to its index.mjs (e.g. $(npm root -g)/playwright/node_modules/playwright-core/index.mjs)')
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function open ({ profile, outDir, record = false, url,
                              width = 1280, height = 720, headless = true,
                              dsf = 2, captions = false, highlightColor = '#b61a37' }) {
  const { chromium } = await import(resolvePlaywright())
  const ctx = await chromium.launchPersistentContext(profile, {
    headless, viewport: { width, height },
    // --force-device-scale-factor drives the VIDEO capture at hi-DPI. The context
    // `deviceScaleFactor` option does NOT — it renders the page into the top-left and
    // leaves the rest of the frame grey. The flag is the one that actually works.
    args: ['--no-first-run', '--no-default-browser-check', '--hide-crash-restore-bubble',
      ...(dsf !== 1 ? [`--force-device-scale-factor=${dsf}`, '--high-dpi-support=1'] : [])],
    recordVideo: record ? { dir: outDir, size: { width: width * dsf, height: height * dsf } } : undefined,
  })
  const page = ctx.pages()[0] || await ctx.newPage()
  const cues = []
  let cx = width / 2, cy = height / 2
  let t0 = Date.now()

  // Re-injected after every navigation: a page load wipes the overlays.
  async function overlays () {
    await page.evaluate(([w, h, showCap, hlc]) => {
      if (document.getElementById('demo-cursor')) return
      const cur = document.createElement('div')
      cur.id = 'demo-cursor'
      cur.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24">' +
        '<path d="M5 2 L5 19 L9.5 14.5 L12.5 21.5 L15.5 20 L12.5 13.5 L19 13 Z" ' +
        'fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
      Object.assign(cur.style, {
        position: 'fixed', left: 0, top: 0, zIndex: 2147483647, pointerEvents: 'none',
        transition: 'transform .16s cubic-bezier(.22,.61,.36,1)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.45))',
        transform: `translate(${w / 2}px,${h / 2}px)`,
      })
      document.body.appendChild(cur)

      const ring = document.createElement('div')
      ring.id = 'demo-click'
      Object.assign(ring.style, {
        position: 'fixed', left: 0, top: 0, width: '34px', height: '34px',
        marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%',
        border: '3px solid #2f7cf6', zIndex: 2147483646, pointerEvents: 'none',
        opacity: 0, transform: `translate(${w / 2}px,${h / 2}px) scale(.4)`,
      })
      document.body.appendChild(ring)

      // highlight box — glides onto whatever is being explained
      const hl = document.createElement('div')
      hl.id = 'demo-hl'
      Object.assign(hl.style, {
        position: 'fixed', left: '0', top: '0', width: '0', height: '0',
        border: '3px solid ' + hlc, borderRadius: '8px',
        boxShadow: '0 0 0 4px ' + hlc + '24', background: hlc + '0d',
        zIndex: 2147483645, pointerEvents: 'none', opacity: 0,
        transition: 'all .22s cubic-bezier(.22,.61,.36,1)',
      })
      document.body.appendChild(hl)

      if (showCap) {
        const cap = document.createElement('div')
        cap.id = 'demo-cap'
        Object.assign(cap.style, {
          position: 'fixed', left: '50%', bottom: '34px',
          transform: 'translateX(-50%)', maxWidth: '78%', padding: '12px 22px',
          borderRadius: '10px', background: 'rgba(12,16,24,.9)', color: '#fff',
          zIndex: 2147483647, font: '600 19px/1.4 -apple-system,Segoe UI,Roboto,sans-serif',
          textAlign: 'center', pointerEvents: 'none', opacity: 0,
          transition: 'opacity .25s ease', boxShadow: '0 6px 24px rgba(0,0,0,.35)',
        })
        document.body.appendChild(cap)
      }
    }, [width, height, captions, highlightColor]).catch(() => {})
  }

  function closeCue () { const l = cues[cues.length - 1]; if (l && l.end == null) l.end = Date.now() - t0 }

  const d = {
    page, ctx, cues, overlays,

    // Logs a cue for TTS timing. Shows a caption only when captions:true.
    async say (text, ms) {
      closeCue()
      cues.push({ start: Date.now() - t0, end: null, text })
      if (captions) {
        let ok = await page.evaluate(t => {
          const c = document.getElementById('demo-cap'); if (!c) return false
          c.textContent = t; c.style.opacity = '1'; return c.textContent === t
        }, text).catch(() => false)
        if (!ok) { await overlays(); await page.evaluate(t => { const c = document.getElementById('demo-cap'); if (c) { c.textContent = t; c.style.opacity = '1' } }, text).catch(() => {}) }
      }
      await sleep(ms)
    },
    async hide () {
      closeCue()
      if (captions) await page.evaluate(() => { const c = document.getElementById('demo-cap'); if (c) c.style.opacity = '0' }).catch(() => {})
    },

    // draw / glide the highlight box onto an element (or raw box), and clear it
    async box (sel) {
      const el = page.locator(sel).first()
      await el.waitFor({ state: 'visible', timeout: 8000 })
      await el.scrollIntoViewIfNeeded().catch(() => {})
      await sleep(120)
      const b = await el.boundingBox(); if (!b) return
      await page.evaluate(([x, y, w, h]) => {
        const r = document.getElementById('demo-hl'); if (!r) return
        r.style.left = (x - 6) + 'px'; r.style.top = (y - 6) + 'px'
        r.style.width = (w + 12) + 'px'; r.style.height = (h + 12) + 'px'; r.style.opacity = '1'
      }, [b.x, b.y, b.width, b.height]).catch(() => {})
    },
    async unbox () { await page.evaluate(() => { const r = document.getElementById('demo-hl'); if (r) r.style.opacity = '0' }).catch(() => {}) },

    // Eased glide, because a cursor that teleports reads as a bug, not a demo.
    async moveTo (x, y) {
      const steps = 12
      for (let i = 1; i <= steps; i++) {
        const k = 1 - Math.pow(1 - i / steps, 3)
        const nx = cx + (x - cx) * k, ny = cy + (y - cy) * k
        await page.mouse.move(nx, ny)
        await page.evaluate(([a, b]) => { const c = document.getElementById('demo-cursor'); if (c) c.style.transform = `translate(${a}px,${b}px)` }, [nx, ny]).catch(() => {})
        await sleep(9)
      }
      cx = x; cy = y
    },
    async ripple () {
      await page.evaluate(([a, b]) => {
        const r = document.getElementById('demo-click'); if (!r) return
        r.style.transition = 'none'; r.style.transform = `translate(${a}px,${b}px) scale(.4)`; r.style.opacity = '.9'
        requestAnimationFrame(() => { r.style.transition = 'transform .4s ease-out, opacity .4s ease-out'; r.style.transform = `translate(${a}px,${b}px) scale(1.5)`; r.style.opacity = '0' })
      }, [cx, cy]).catch(() => {})
    },

    async at (sel) {
      const el = typeof sel === 'string' ? page.locator(sel).first() : sel
      await el.waitFor({ state: 'visible', timeout: 15000 })
      await el.scrollIntoViewIfNeeded().catch(() => {})
      await sleep(110)
      const b = await el.boundingBox()
      return [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)]
    },
    async click (sel) {
      const [x, y] = await d.at(sel)
      await d.moveTo(x, y); await d.ripple(); await sleep(120)
      await (typeof sel === 'string' ? page.locator(sel).first() : sel).click()
    },
    // Clears first: pre-filled inputs otherwise append instead of replacing.
    async retype (sel, val, delay = 14) {
      const [x, y] = await d.at(sel)
      await d.moveTo(x, y); await d.ripple()
      await page.locator(sel).first().click(); await sleep(60)
      await page.fill(sel, ''); await sleep(60)
      await page.locator(sel).first().type(val, { delay })
    },
    async pick (sel, label) {
      const [x, y] = await d.at(sel)
      await d.moveTo(x, y); await d.ripple(); await sleep(110)
      await page.selectOption(sel, { label }); await sleep(300)
    },
    async errors () {
      return page.evaluate(() => [...document.querySelectorAll('p,span,div')]
        .filter(e => e.offsetParent !== null && e.children.length === 0 && /\S/.test(e.textContent) &&
          /rgb\((2[0-5][0-9]|1[89][0-9]),\s*([0-5]?[0-9]),/.test(getComputedStyle(e).color))
        .map(e => e.textContent.trim().slice(0, 90)).slice(0, 6))
    },
    async abort (why) { console.log('ABORT: ' + why + ' :: ' + JSON.stringify(await d.errors())); await ctx.close(); process.exit(3) },
    resetClock () { t0 = Date.now() },

    async finish (srtName = 'demo.srt') {
      const ms = Date.now() - t0
      const video = page.video()
      await ctx.close()
      cues.forEach(c => { if (c.end == null) c.end = ms })
      const pad = (n, w = 2) => String(n).padStart(w, '0')
      const ts = m => `${pad(Math.floor(m / 3600000))}:${pad(Math.floor(m / 60000) % 60)}:${pad(Math.floor(m / 1000) % 60)},${pad(m % 1000, 3)}`
      const srt = path.join(outDir, srtName)
      fs.writeFileSync(srt, cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n'))
      const log = srt.replace(/\.srt$/, '.cues.txt')
      fs.writeFileSync(log, cues.map(c => `${(c.start / 1000).toFixed(2)}|${c.text}`).join('\n') + '\n')
      const out = { durationMs: ms, cues: cues.length, srt, cueLog: log, video: video ? await video.path() : null }
      console.log(JSON.stringify(out, null, 2))
      return out
    },
  }

  if (url) {
    await page.goto(url, { waitUntil: 'networkidle' })
    await sleep(1600)
    await overlays()
    await sleep(400)
    // DO NOT reset t0 here — recordVideo starts at launch, so the video already
    // contains the first-load time; restarting the clock shifts the whole track early.
  }
  return d
}

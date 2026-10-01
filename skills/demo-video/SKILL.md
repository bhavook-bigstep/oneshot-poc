---
name: demo-video
description: Plan and produce narrated product demo / training videos for ANY web or mobile application — understand the project (codebase, docs, live app), decide what to show, then explore the UI, write the script, and record a real walkthrough at native/Retina resolution with a highlight box on whatever is being explained, a natural local voiceover, and optional on-screen captions. Use when asked to create demo videos, walkthroughs, training clips, tutorial or screen-recording videos of a product, or to re-master existing ones.
---

# Demo videos for any project

Scripts live next to this file in `scripts/` — refer to them as `$SKILL/scripts/...`, where
`$SKILL` is this skill's base directory.

The job has four phases. **Do not start recording until Phases 1 and 2 are done.** Most bad demo
videos come from narrating an app you don't understand, not from bad recording.

```
Phase 1  Understand the project   →  PROJECT_BRIEF.md
Phase 2  Plan the videos          →  VIDEO_PLAN.md   (user approves)
Phase 3  Make each video          →  discover → script → rehearse → record → post → 4 gates
Phase 4  Deliver                  →  files + notes + test-data list
```

Keep the brief and plan in a `demo-videos/` folder in the project (or wherever the user wants
output). Re-read them at the start of every session.

**Work autonomously.** From a request as small as "make a demo of X", drive the whole thing
yourself: open the app, explore the screens involved, decide what to navigate and what to say,
write the script, record, and deliver. Ask the user as little as possible — ideally only the two
things you genuinely can't derive: **(1) whether they want on-screen captions** (default: no
captions, voice only), and the environment URL if it isn't obvious. Everything else — the voice,
the TTS setup, the recorder, the resolution, the highlight boxes — this skill configures on its
own with the defaults below. Nothing to sign up for, no keys to paste.

**The standard configuration (defaults — use these unless the user asks otherwise):**
- **Native/Retina capture.** Record web at `dsf: 2` so the video is 2× (e.g. 1920×1080 → 3840×2160
  4K), razor-sharp on a Retina screen. Never upscale in post.
- **Highlight box, not just a cursor.** A crimson box glides onto whatever you're explaining (a
  tab, a table, a button). The cursor is only for actual clicks. `d.box(sel)` / `d.unbox()`.
- **Voice = Kokoro `af_heart`** (a natural local neural voice) at speed 1.0, via
  `$SKILL/scripts/voice/tts_kokoro.py`, which installs itself on first run. This is the default;
  prefer it over any cloud TTS unless the user names a specific cloud voice.
- **Captions off by default.** Turn them on only if the user says yes.

---

## Setup (first use — make the skill self-sufficient)

Before the first recording on a machine, make sure the tools are present. This skill ships a
self-setup script that installs and verifies everything:

```bash
bash $SKILL/setup.sh            # install + verify (ffmpeg, espeak-ng, python/pillow, node/playwright/chromium)
bash $SKILL/setup.sh --check    # verify only, install nothing
```

- Run `setup.sh --check` at the start of a demo job; if anything is missing (or a `node`/`ffmpeg`
  command later fails with "not found"), run `bash $SKILL/setup.sh` and continue. It's idempotent.
- The **voice needs no setup step** — `tts_kokoro.py` builds its own venv and downloads the model
  on first synth (under `~/.cache/demo-video-tts`). To pre-warm it, `bash $SKILL/setup.sh --warm-voice`.
- macOS installs via Homebrew, Linux via apt. Nothing here needs an API key or an account.

---

## Phase 0 — Safety rules (apply throughout)

1. **Record on a test / UAT / staging environment, never production.** Many apps save drafts,
   send emails or notify phones as you click; on production those are real and often permanent.
   Only use production for a final take if the user explicitly asks.
2. **Never record a login and never put credentials on screen.** The user signs in themselves
   (a browser profile you reuse, or a phone that's already signed in). Never ask for, store or
   type passwords in scripts or files.
3. **Before scripting a flow you haven't recorded, do one step by hand** and check whether it
   saved anything.
4. **Find the one-shot actions first** (approvals, sign-offs, submissions that can only happen
   once, anything that locks a record). Pick a record you can afford to spend, rehearse only up
   to the step before it, and do it once in the real take.
5. **Rehearse on a different record than you record on** — a rehearsal does the same writes and
   uses up the state the take needs.
6. **Don't press anything that emails, messages, charges or notifies real people** unless that is
   the point of the demo and the user agreed.
7. **Check every frame for secrets before delivering**: tokens in URLs (activation / reset links),
   the browser's saved-password dropdown, real people's emails or phone numbers, API keys, internal
   admin URLs. Crop or cut, then re-check the whole video — spot checks miss things.
8. **Keep a list of every test record you create** and hand it over at the end.

---

## Phase 1 — Understand the project

Goal: a **`PROJECT_BRIEF.md`** good enough that someone new could narrate the product correctly.
Derive everything you can yourself; ask the user only for what only they can know.

### 1a. From the codebase (if you have it)

Read, in this order — skim, don't read everything:

| Look at | To learn |
| --- | --- |
| `README*`, `CLAUDE.md`, `AGENTS.md`, `docs/` | what the product is, who uses it, how to run it |
| package manifests (`package.json`, `pubspec.yaml`, `build.gradle`, …) | web framework, mobile tech (React Native / Flutter / native), test tools |
| the web router / route table | **every screen that exists** — this is your module list |
| sidebar / navigation / menu components | the names users actually see, and their order |
| roles, permissions, capability matrices, auth guards | **who sees what** — this drives the role × module plan |
| status enums, state machines, workflow services | lifecycles to demo end-to-end (draft → submitted → approved …) |
| i18n / locale / strings files | exact on-screen wording and the product's own terminology |
| env examples / deploy config | environment URLs (**never copy secrets**) |
| seed / fixture data | what demo data exists and what it's called |
| notification / email / cron code | which actions notify people or run on a schedule (danger list) |

Useful quick scans: `grep -rn "path:" <router>`, find the role list / enum, find components named
`*Sidebar*`, `*Nav*`, `*Menu*`.

### 1b. From the live app (always — code and reality differ)

With the user's session, walk the app **read-only**:
- **Web:** open the app with Playwright, snapshot the navigation, visit each top-level screen and
  list its tabs, sections, buttons and dialogs. Don't click Save / Submit / Delete / Send.
- **Mobile:** with a signed-in Android phone on USB, use `$SKILL/scripts/android/lib.sh`
  (`dump`, `has`, `onscreen`) to list each screen's controls.
- Note which screens have real data to show, and which are empty.
- Note anything that differs from the code or docs — the live app wins.

### 1c. Ask the user (short, one round, only what you can't derive)

Keep this minimal — the defaults above cover voice, resolution, boxes and TTS. Ask only:

- **Captions?** yes / no (default no — voice only). This is the one toggle worth always asking.
- Which **environment URL** to record on (confirm it isn't production), if it isn't obvious from
  the project, and how they'll sign in (they sign in themselves — never record a login).
- Anything **off-limits** (screens, data, clients' names), and where to **save** the output if
  not `demo-videos/`.

Only ask the rest when it actually matters for this request: audience/tone, a specific voice or
language other than the default, terminology rules, or which modules come first. Don't turn a
one-line request into a questionnaire.

### 1d. Write `PROJECT_BRIEF.md`

```markdown
# <Product> — demo brief
## Product in one paragraph
## Audience, language, voice
## Surfaces            (Web: URL · Mobile: app id / platform)
## Roles               (name as shown in the UI · what each role does · web / mobile / both)
## Modules             (from nav + routes — name, one line on what it's for, which roles use it)
## Key lifecycles      (states and who moves them)
## Glossary & terminology rules   (say X, never Y)
## Environment & accounts          (test env URL; which role logs in where — NO passwords)
## Danger list         (actions that email / notify / charge / can't be undone / create drafts)
## Demo data           (records to use; one-shot records reserved for which video)
## Open questions
```

Show the brief to the user and fix anything they correct.

---

## Phase 2 — Plan the videos

Build a **module × role matrix** from the brief, then turn it into a video list. Group related
features into one video rather than one video per button (e.g. "Manage templates" covers create +
edit + versions). One video should tell one story in roughly **1–3 minutes**.

`VIDEO_PLAN.md`:

| # | Title | Role(s) | Surface | Story (start → end) | Data needed | One-shot? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W01 | Sign in and forgot password | All web roles | Web | … | throwaway account | no | planned |
| M03 | Approve a submitted task | Manager | Mobile | … | a submitted task | **yes** | blocked: no data |

Mark what's blocked (missing data, feature not built, needs a role you don't have) instead of
guessing. **Get the user's OK on the plan before recording.** Update status as you go.

---

## Phase 3 — Make each video

### 3.1 Conventions (defaults — the brief's rules override them)

- **File name:** `Title - Roles.mp4`, e.g. `Approve a submitted task - Manager, Admin.mp4`.
  Roles comma-separated; never `/` (illegal in file names). No build suffixes in delivered files.
- **Resolution:** record web at `dsf: 2` → native/Retina (2× the viewport, e.g. 3840×2160). The
  layout still matches a normal browser at the CSS viewport width; only the pixel density doubles.
- **Highlight box:** put a box on whatever you name (`d.box(sel)` before the line, `d.unbox()`
  after). Box the element the sentence is about — a tab while defining it, the compare table for
  "left is X, right is Y", the buttons while explaining them, the thing that *changed* after an
  action (e.g. a count that ticked up) so the change is seen, not just heard. Cursor = clicks only.
- **Captions:** OFF by default (voice only). If the user wants them, pass `captions:true` to the
  recorder; web captions burn in live (bottom), mobile captions render in post (top).
- **Role card:** open with a plain card **"Logged in as <Role>"**; add one at every user switch.
  2 seconds, hard cut. For a single-role, no-login app a short title card is optional.
- **Terminology:** use the product's own words from the UI and the brief's glossary.

### 3.2 Discover the flow

Walk this one flow and dump the real controls: IDs / test IDs, labels, custom dropdowns,
confirmation dialogs (copy their **exact** wording and button text — often CAPS), what appears
after save, where the page navigates. Confirm the data you'll show exists.

### 3.3 Write the narration

- **Full explanatory sentences, not stage directions.** ❌ "Click save." ✅ "Saving sends the plan to
  the engineer, so nothing reaches their phone until this step." Fragments also make TTS sound
  robotic. **60–90 characters per line.**
- **Open by setting the scene**: the first two lines say what this feature is and why it exists.
  Never start mid-story ("Now this same request…").
- **Only narrate what is visible at that moment.** The most common defect is describing a tile
  still below the fold, a column scrolled off to the right, or a filter not yet clicked.
- **Never claim what you haven't verified** — a button that doesn't exist, a "automatic" rule you
  didn't check in the code, a number you didn't read off the screen.
- **Time each line from its length:** `hold = characters ÷ chars_per_second + tail`. The default
  voice `af_heart` runs ≈ **18 chars/s** at speed 1.0; a small **0.3–0.45 s** tail keeps gaps tight
  when captions are off. (If captions are burned in, use a larger tail so they don't vanish
  mid-word.) Because you generate the voice yourself, a clip that slightly overruns its slot is
  fixed by `destagger.py` — no re-record.

### 3.4 Record

**Web (Playwright)** — copy a starter from `$SKILL/scripts/web/`: `example-web-demo.mjs` (the
default highlight-box walkthrough pattern) or `example-project-demo.mjs` (form-filling / wizard
flow). Copy the *shape*, not the selectors.

```bash
PLAYWRIGHT_CORE=$(npm root -g)/playwright/node_modules/playwright-core/index.mjs \
  DEMO_BASE_URL=https://test.example.com node my-demo.mjs ~/demo-chrome-profile ./out record
```
- `open({profile, outDir, record, url, dsf:2, captions:false})` returns `d` with:
  - `d.say(text, ms)` — logs a cue for TTS timing (draws a caption only when `captions:true`)
  - `d.box(sel)` / `d.unbox()` — glide the highlight box onto an element / clear it
  - `d.click(sel)`, `d.retype(sel, val)`, `d.pick(sel, label)` — cursor-animated interactions
  - `d.page` (the Playwright page), `d.overlays()` (re-inject after a full navigation), `d.abort()`
- Runs **headless** and still captures video; no window pops. `dsf:2` gives native/Retina 4K.
- Build a fast self-check: gate the timed narration behind `if (process.env.FAST)` with tiny holds,
  so one ~20 s `FAST=1` run validates every selector and click before the real take. The `FAST`
  run also writes the authoritative cue text, which you can voice **in parallel** with the real
  record (same deterministic flow → same cue order → clips align by index).
- The profile must already be signed in for apps with a login — run once with `{headless:false}`
  and no `record` so the user can sign in by hand; the session is reused. Never record a login.
- After each step, **verify** the app moved on (wait for a selector / text) and abort if not.
- Before narrating or boxing something, it's scrolled into view; at `dsf:2` the whole record
  usually fits in one view, so prefer a viewport (e.g. 1920×1080) where it does — no scrolling.

**Mobile (Android via adb)** — copy `$SKILL/scripts/android/example-profile-demo.sh`:

```bash
export DEMO_TMP=./out; source "$SKILL/scripts/android/lib.sh"
rec_start 175
cue "First line of narration"; sleep 4.1
tapv "Work orders" || die "no Work orders tile"; sleep 3
onscreen "Pending" || die "Pending filter not visible"
…
sleep 7; rec_stop out/raw.mp4
```
- Helpers: `tapv "Text"`, `tapdesc "desc"`, `tapid <resource-id>` (best for buttons), `typev`,
  `has "Exact text"`, `onscreen "Text"` / `need_visible "Text" [scrolls]`, `scroll_to`,
  `swipe_down`, `dump`, `die`.
- `has` is **exact match** and passes for things scrolled off-screen — use `onscreen` for
  anything you narrate.
- **Android caps a recording at 180 s** — keep takes ≤ ~170 s; split longer flows into segments.
- **Leave ~7 s after the last line** before `rec_stop` (the device drops the tail while finalising).
- Hide the keyboard with `KEYCODE_BACK`, never `KEYCODE_ESCAPE` (that closes the dialog and loses
  the typed text).
- iOS isn't covered by these scripts; screen-record on the device and use the post pipeline.

### 3.5 Post-process — mobile

```bash
V=$SKILL/scripts/voice
ffmpeg -i raw.mp4 -vf fps=15 -fps_mode cfr -c:v libx264 -crf 20 -pix_fmt yuv420p -an cfr.mp4
#   several segments: CFR each, then  printf "file 'a.mp4'\nfile 'b.mp4'\n" > l.txt &&
#   ffmpeg -f concat -safe 0 -i l.txt -c copy joined.mp4   — add segment A's length to B's cue times
python3 $V/tighten.py cues.txt cfr.mp4 tight.mp4 tight_cues.txt            # cut dead air
python3 $V/titlecard.py splice tight.mp4 tight_cues.txt carded.mp4 cues2.txt \
        --card "0:Logged in as <Role>"                                   # BEFORE voice/captions
python3 $V/tts_kokoro.py cues2.txt tts t --dry-run                         # free timing check
python3 $V/tts_kokoro.py cues2.txt tts t                                   # default voice af_heart
python3 $V/trimlead.py tts t <number-of-cues> trim                         # trim silent starts
python3 $V/destagger.py cues2.txt trim t final_cues.txt final.srt          # fix overlaps, no API
python3 $V/build-track.py final.srt trim t track.wav                       # auto-levels to -1.5 dBFS
python3 $V/render-captions.py final_cues.txt carded.mp4 capped.mp4 --position top
bash    $V/mux.sh capped.mp4 track.wav "Title - Roles.mp4"
```

### 3.6 Post-process — web

The recorder writes a WebM + `demo.cues.txt` + `demo.srt`. Transcode, voice (default Kokoro
`af_heart`), place the track, mux. Captions (if enabled) are already burned in by the recorder,
so there's no `render-captions` step on web.

```bash
V=$SKILL/scripts/voice
# 1) transcode the WebM to CFR mp4 at its native size (keep 4K if dsf:2)
ffmpeg -i rec/page*.webm -vf fps=15 -fps_mode cfr -c:v libx264 -crf 21 -pix_fmt yuv420p -an raw.mp4
# 2) voice — the default, self-installing local voice (no key). Reuse clips across re-records.
python3 $V/tts_kokoro.py rec/demo.cues.txt tts t            # default voice af_heart, speed 1.0
python3 $V/trimlead.py tts t <n> trim                       # trim silent starts
# 3) with captions OFF there are no timings to protect, so destagger fixes any clip overlaps
python3 $V/destagger.py rec/demo.cues.txt trim t final_cues.txt final.srt
python3 $V/build-track.py final.srt trim t track.wav        # auto-levels to -1.5 dBFS
bash    $V/mux.sh raw.mp4 track.wav "Title - Roles.mp4"
```

- **Voice generation is the long pole.** Run it in the background while you transcode the video,
  then converge — roughly halves the post time.
- **Re-records reuse the clips.** The narration text doesn't change, so keep the Kokoro clips and
  only rebuild the track against the new recording's `demo.srt` (destagger + build-track). No
  re-synthesis needed for a resolution or timing change.
- Add role/title cards with `titlecard.py splice` on the raw video + cue log **before** voicing.
- If captions ARE on, they're burned live by the recorder at the recorded cue times, so **don't**
  destagger the video timing — only shift audio clips, and keep holds ≥ clip length.

### 3.7 Voice — Kokoro `af_heart` (the default)

**Default: `$SKILL/scripts/voice/tts_kokoro.py`** — a local neural voice that sounds natural, needs
no key and no sign-up, and installs itself on first run (private venv + model under
`~/.cache/demo-video-tts`, then instant). This is the standard; use it unless the user asks for a
specific cloud voice.

```bash
python3 $V/tts_kokoro.py <cues> <out-dir> <prefix>       # default voice af_heart, speed 1.0, en-us
python3 $V/tts_kokoro.py <cues> <out-dir> <prefix> --voice bm_george --speed 1.1
```
- Writes `<prefix>N.wav` (1-indexed) + `cues.srt` — identical interface to `tts.py`, so
  trimlead / destagger / build-track are unchanged.
- **Default voice `af_heart`** ≈ 18 chars/s at speed 1.0 (Kokoro's most natural, A-graded). Other
  good picks: female `af_bella`, `af_sarah`; male `am_michael`, `am_adam`, British `bm_george`.
  Speed 1.0 is the most natural; only nudge to ~1.1–1.2 to fit a tight edit.
- Time each caption from the voice's rate: `hold = chars ÷ 18 + tail`. Because you generate the
  voice yourself, a clip that slightly overruns is fixed by `destagger.py`, not a re-record.

**Optional cloud voice (only if the user asks):** `$SKILL/scripts/voice/tts.py` uses Sarvam
`bulbul:v3` (env `SARVAM_API_KEY` or `~/.demo_tts_key`, `chmod 600`, never commit it); speakers
like `priya`/`shreya`, `--lang en-IN`/`hi-IN`. For true studio quality, swap in a cloud provider
(ElevenLabs / OpenAI TTS) by editing a copy of `tts.py`; everything downstream works from the wav
files + SRT, so only the synth call changes.

---

## The four review gates — every video, in order

A later gate can't catch an earlier gate's mistakes. Never deliver a video checked once at the end.

1. **Watch the picture.** Did every action happen? Right screen? Whole record in view (no
   below-the-fold)? Sample a few frames and check each quadrant is painted — a grey region means
   the hi-DPI capture went wrong (see Gotchas).
2. **Check the frame at each cue against the line.** One frame per cue (full height — cropped
   thumbnails create false alarms):
   `ffmpeg -ss <cue_time+1.3> -i video.mp4 -frames:v 1 -vf scale=760:-1 frame.png`
   Is the **highlight box on the element the line is about**? (And if captions are on, do the words
   match what's visible?) A native-pixel crop (`crop=1600:400:1360:360`, no scaling) confirms
   text is genuinely sharp, not upscaled.
3. **Add the audio.**
4. **Review everything together.** At each cue the spoken line matches the picture, and no line is
   silent:
   `ffmpeg -hide_banner -ss <cue_time+0.4> -t 0.7 -i final.mp4 -af volumedetect -f null - 2>&1 | grep max_volume`
   Below about −30 dB = silent → long lead-in (`trimlead.py`) or missing clip. Don't use
   `silencedetect` or `-v error` for this check.

---

## Gotchas

| Symptom | Fix |
| --- | --- |
| Video looks soft on a Retina screen | Record at `dsf:2` (native 2×), never upscale in post. 1080p on a 4K panel is blurry. |
| Half the 4K frame is grey (only top-left painted) | The Playwright context `deviceScaleFactor` option does NOT drive `recordVideo` — it renders into the top-left and pads the rest grey. Use the `--force-device-scale-factor=<dsf>` browser flag instead (record-lib.mjs already does when `dsf>1`). |
| Highlight box on the wrong element / stale position | `d.box(sel)` reads the box after `scrollIntoViewIfNeeded`; call it once the element is settled, and `d.unbox()` before moving on so it doesn't linger on the next screen. |
| Kokoro fails on a word / setup errors | First run installs a venv + model under `~/.cache/demo-video-tts` and needs `espeak-ng` (auto-installed via brew/apt). If offline, the model download can't complete — run once online. |
| Choppy video / dropped frames | Screen captures are variable-rate: `-fps_mode passthrough`, or convert to CFR first |
| Voice too quiet / too hot / inconsistent loudness | `build-track.py` peak-normalises the finished track to −1.5 dBFS by default (lifts a quiet voice, guards clipping). Pass `--target <dBFS>` to change it, `--no-normalize` to keep raw levels. |
| Voice 3 dB too quiet | Mono→stereo via `aformat` loses 3 dB; `build-track.py` uses `pan` already |
| Caption appears, voice a second late | Silent lead-in — `trimlead.py` |
| Lines overlap after TTS | Clip lengths vary per render — `destagger.py`, don't re-render |
| End of video cut off | Never `-shortest` the mux; voice legitimately ends first |
| Mobile take stops / file missing at ~180 s | Android limit — split into segments; `rec_stop` says where the file is |
| Script taps the wrong thing | Stale UI dump — `lib.sh` retries; prefer `tapid` for buttons |
| Narrated tile not visible in video | Used `has` instead of `onscreen`, or didn't scroll + assert |
| Web voice several seconds ahead of picture | Cue clock started late — `record-lib.mjs` keeps one clock from launch; don't reset it |
| Role card flashes the previous screen | Tighten segments separately, join, then splice cards |
| "Verification failed" but the action worked | Match on meaning (field changed / state changed), not exact formatted text like "1,85,000" vs "₹1.9 L" |
| Last line feels rushed | Hold ~6 s of picture after the final cue |

---

## Phase 4 — Deliver

- [ ] `Title - Roles.mp4`, terminology per the brief
- [ ] Native/Retina resolution (`dsf:2`); every frame quadrant painted (no grey); text sharp
- [ ] Highlight box lands on the element each line is about
- [ ] Captions present only if the user asked for them
- [ ] Role/title card at the start and at every user switch (optional for single-role no-login apps)
- [ ] All four gates passed
- [ ] No secrets or personal data in any frame
- [ ] Peak below −1 dBFS; every line audible
- [ ] Silent version + `.srt` + transcript kept; per-line voice clips kept (re-mastering is free)
- [ ] `VIDEO_PLAN.md` status updated; test records you created listed for cleanup
- [ ] New lessons about this project added to `PROJECT_BRIEF.md`

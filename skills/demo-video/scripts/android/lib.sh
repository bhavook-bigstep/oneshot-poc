# lib.sh - adb helpers for Android demo recording. Source it, don't run it.
#
#   DEMO_TMP=/path/to/scratch; source lib.sh
#
# Everything here reads the live UI hierarchy before acting, so a script fails
# loudly on the step that actually broke instead of tapping empty screen and
# recording a silent wrong take. Functions return non-zero when the target is
# not on screen - always check, or wrap in die().
#
# Bash 3.2 compatible (that is what macOS ships): no mapfile, no associative
# arrays.

DEMO_TMP="${DEMO_TMP:-${TMPDIR:-/tmp}/demo-video}"
mkdir -p "$DEMO_TMP"

# --- reading the screen ------------------------------------------------------

dump(){ # refresh the cached UI hierarchy
  # `uiautomator dump` fails silently while a window is animating or a camera
  # preview owns the surface, and then LEAVES THE PREVIOUS FILE IN PLACE -- so a
  # naive read returns the screen before last and every assertion built on it is
  # a lie. Delete first, retry, and fail loudly rather than serve stale XML.
  local i
  rm -f "$DEMO_TMP/d.xml"
  for i in 1 2 3 4 5; do
    adb shell rm -f /sdcard/d.xml >/dev/null 2>&1
    adb shell uiautomator dump /sdcard/d.xml >/dev/null 2>&1
    adb pull /sdcard/d.xml "$DEMO_TMP/d.xml" >/dev/null 2>&1
    [ -s "$DEMO_TMP/d.xml" ] && return 0
    sleep 0.6
  done
  echo "WARNING: could not read the screen after 5 attempts" >&2
  return 1
}

_find(){ # _find <attr> <value> -> "x y" of the tappable centre, or empty
  python3 - "$DEMO_TMP/d.xml" "$1" "$2" <<'PY'
import sys, re, xml.etree.ElementTree as ET
path, attr, want = sys.argv[1], sys.argv[2], sys.argv[3]
best = None
try:
    root = ET.parse(path).getroot()
except Exception:
    sys.exit(0)
for n in root.iter('node'):
    if (n.get(attr) or '').strip() != want:
        continue
    b = re.findall(r'\d+', n.get('bounds') or '')
    if len(b) < 4:
        continue
    c = ((int(b[0]) + int(b[2])) // 2, (int(b[1]) + int(b[3])) // 2)
    # a clickable node wins outright; otherwise keep the first match as a
    # fallback, because labels are often a non-clickable child of the target
    if n.get('clickable') == 'true':
        best = c
        break
    if best is None:
        best = c
print(f'{best[0]} {best[1]}' if best else '')
PY
}

has(){      dump; [ -n "$(_find text "$1")" ]; }          # has <exact text>
has_desc(){ dump; [ -n "$(_find content-desc "$1")" ]; }  # has_desc <exact desc>

# --- acting on the screen ----------------------------------------------------

tapv(){ # tapv <exact text>
  dump; local c; c="$(_find text "$1")"
  [ -z "$c" ] && { echo "NOT FOUND (text): $1" >&2; return 1; }
  adb shell input tap $c
}

tapdesc(){ # tapdesc <exact content-desc>
  dump; local c; c="$(_find content-desc "$1")"
  [ -z "$c" ] && { echo "NOT FOUND (desc): $1" >&2; return 1; }
  adb shell input tap $c
}

tapid(){ # tapid <resource-id> - taps a control by its testID
  # Preferred over tapv/tapdesc for buttons: a label can be a child node whose
  # centre sits outside the touch target, and hardcoded coordinates break the
  # moment a longer phase name rewraps the layout.
  dump
  local xy; xy=$(_find resource-id "$1")
  [ -z "$xy" ] && { echo "NOT FOUND (id): $1" >&2; return 1; }
  adb shell input tap $xy
}

typev(){ # typev <text> - types into the focused field
  # The text is evaluated by the DEVICE shell, so ; & | ( ) $ ` etc. must not
  # reach it unquoted -- a semicolon silently truncated the string and ran the
  # remainder as a command. Single-quote for the remote shell and escape any
  # embedded single quotes; spaces still have to be %s for `input text`.
  local esc
  esc=$(printf '%s' "$1" | sed "s/'/'\\\\''/g; s/ /%s/g")
  adb shell "input text '$esc'"
}

swipe_up(){   for i in $(seq 1 ${1:-1}); do adb shell input swipe 540 600 540 1900 260; sleep 0.5; done; }
swipe_down(){ for i in $(seq 1 ${1:-1}); do adb shell input swipe 540 1800 540 600 500; sleep 0.6; done; }

scroll_to(){ # scroll_to <text> [max-swipes] - scroll down until it is on screen
  local target="$1" max="${2:-6}" i
  for i in $(seq 1 "$max"); do
    has "$target" && return 0
    swipe_down 1
  done
  has "$target"
}

# --- narration ---------------------------------------------------------------
# cue() stamps the caption against the video clock, so the cue log feeds
# voice/tts.py directly and the captions cannot drift from the picture.

cue_init(){ CUES="${1:-$DEMO_TMP/cues.txt}"; : > "$CUES"; }
clock_start(){ T0=$(python3 -c 'import time;print(time.time())'); }
cue(){ python3 -c "import time;print(f'{time.time()-$T0:.2f}|$1')" >> "$CUES"; }

die(){ echo "ABORTED: $1" >&2; adb shell pkill -INT screenrecord 2>/dev/null; exit 9; }

# --- recording ---------------------------------------------------------------

rec_start(){ # rec_start [seconds] [device-path]
  REC_LIMIT="${1:-170}"; REC_PATH="${2:-/sdcard/demo.mp4}"
  adb shell screenrecord --time-limit "$REC_LIMIT" --size 720x1560 \
      --bit-rate 6000000 "$REC_PATH" &
  REC_PID=$!
  sleep 2.5          # screenrecord needs a moment before the clock is honest
  clock_start
}

rec_stop(){ # rec_stop <local-out.mp4>
  # Every step here is guarded. Under `set -e` a bare `wait` on a screenrecord
  # that already exited (it self-terminates at its --time-limit, max 180s on
  # Android) returns non-zero and killed the caller BEFORE the pull -- the take
  # was stranded on the device with an empty log and no error.
  # screenrecord needs time to flush and finalise the MP4 after SIGINT, and
  # whatever it has not written yet is simply lost -- two M10 takes came back
  # 4-6s short and dropped their final cue, with exit 0 and no warning. Give it
  # room to settle, and ALWAYS leave several seconds of tail slack after your
  # last say() so the loss lands on dead air instead of narration.
  adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
  wait "$REC_PID" 2>/dev/null || true
  sleep 4
  if ! adb pull "$REC_PATH" "$1" >/dev/null 2>&1; then
    echo "pull failed - the take may still be at $REC_PATH on the device" >&2
    return 1
  fi
  adb shell rm "$REC_PATH" >/dev/null 2>&1 || true
  local dur; dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null)
  echo "recorded: $1 (${dur}s)"
  # screenrecord silently truncates at the cap; say so rather than shipping a
  # take whose last minute is missing.
  if [ -n "$dur" ] && [ -n "$REC_LIMIT" ]; then
    python3 - "$dur" "$REC_LIMIT" <<'PYEOF' || true
import sys
d, lim = float(sys.argv[1]), float(sys.argv[2])
if d >= lim - 1.5:
    print(f"WARNING: recording hit the {lim:.0f}s cap - the take is truncated. "
          f"Split it into segments (screenrecord maxes out at 180s).")
PYEOF
  fi
}

# --- visibility --------------------------------------------------------------
# has() only proves a node exists in the hierarchy. A ScrollView keeps its
# off-screen children in that hierarchy, so has() happily passes for a tile
# sitting below the fold -- M16 narrated three phases and a risk tile the
# viewer could not see, and every guard went green. onscreen() checks the
# node's BOUNDS fall inside the visible viewport, which is what "the viewer
# can see it" actually means. Use it for anything the narration names.

SCREEN_W="${SCREEN_W:-1080}"
SCREEN_H="${SCREEN_H:-2340}"
SAFE_TOP="${SAFE_TOP:-90}"      # status bar
SAFE_BOT="${SAFE_BOT:-2180}"    # nav bar

onscreen(){ # onscreen <exact text> - true only if fully inside the viewport
  dump
  python3 - "$DEMO_TMP/d.xml" "$1" "$SAFE_TOP" "$SAFE_BOT" "$SCREEN_W" <<'PY'
import sys, re, xml.etree.ElementTree as ET
path, want, top, bot, w = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
try:
    root = ET.parse(path).getroot()
except Exception:
    sys.exit(1)
for n in root.iter('node'):
    if (n.get('text') or '').strip() != want:
        continue
    b = [int(x) for x in re.findall(r'\d+', n.get('bounds') or '')]
    if len(b) < 4:
        continue
    x1, y1, x2, y2 = b[:4]
    if x2 <= x1 or y2 <= y1:      # zero-size node = not laid out
        continue
    if y1 >= top and y2 <= bot and x1 >= 0 and x2 <= w:
        sys.exit(0)
sys.exit(1)
PY
}

need_visible(){ # need_visible <text> [max-scrolls] - scroll until truly visible
  local t="$1" max="${2:-6}" i
  for i in $(seq 1 "$max"); do
    onscreen "$t" && return 0
    swipe_down 1
  done
  onscreen "$t"
}

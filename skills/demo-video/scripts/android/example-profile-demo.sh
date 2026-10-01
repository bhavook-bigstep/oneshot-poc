#!/bin/bash
# Worked example: the Profile screen demo (shipped as 05-android-profile-demo).
# Copy this as the starting point for a new Android demo.
#
#   DEMO_TMP=/tmp/demo-video ./example-profile-demo.sh out.mp4
#
# The shape that matters, in order:
#   1. RESET to a known state before recording - never assume where the app is.
#   2. Start recording, then start the clock.
#   3. Alternate cue() narration with verified taps.
#   4. die() on anything unexpected, so a broken take is never shipped.
#   5. Stop, pull, and print the cue log for voice/tts.py.
set -uo pipefail
cd "$(dirname "$0")"
source ./lib.sh
OUT="${1:-$DEMO_TMP/profile_raw.mp4}"
cue_init

hindi_on(){ has "प्रोफ़ाइल"; }
close_sheet(){ tapv "Close sheet" 2>/dev/null || adb shell input tap 540 700; sleep 2; }

# --- 1. reset to a known state ----------------------------------------------
adb get-state >/dev/null 2>&1 || die "no device attached"
if hindi_on; then scroll_to "English" >/dev/null && tapv "English"; sleep 2.5; fi
has "Take photo" && close_sheet
has "PERSONAL DETAILS" || swipe_up 6
has "PERSONAL DETAILS" || { tapdesc "Profile"; sleep 4; swipe_up 6; }
has "PERSONAL DETAILS" || die "could not reach the Profile screen"
swipe_up 4; sleep 1.2

# --- 2. record ---------------------------------------------------------------
rec_start 170 /sdcard/p.mp4

cue "Ye hai aapka Profile screen"; sleep 3.5

tapv "Change photo" || die "Change photo not found"; sleep 2.0
has "Take photo" || die "photo sheet did not open"
cue "Photo badalne ke do option hain — Take photo ya Choose from gallery"; sleep 5.5
close_sheet
has "Take photo" && die "photo sheet did not close"
has "PERSONAL DETAILS" || die "left the Profile screen"

cue "Apna naam yahan se edit kar sakte hain"; sleep 4.5
cue "Phone number bhi aap khud update kar sakte hain"; sleep 4.5
cue "Email, Employee ID aur Role sirf Admin change kar sakta hai"; sleep 5.0

scroll_to "CHANGE PASSWORD" || die "password section not reachable"; sleep 1.0
cue "Password badalne ke liye purana password daaliye"; sleep 4.0
cue "Phir naya password aur usko confirm kijiye"; sleep 4.5
cue "Yaad rakhiye — password badalte hi baaki sab devices se logout ho jayega"; sleep 5.5

scroll_to "APP LANGUAGE" || die "language section not reachable"; sleep 1.0
cue "App ki bhasha — English ya Hindi"; sleep 3.5
tapv "हिन्दी" || die "Hindi option not found"; sleep 2.5
hindi_on || die "UI did not switch to Hindi"
cue "Hindi choose karte hi poora app Hindi mein badal jaata hai"; sleep 4.0

swipe_up 4; sleep 1.2
cue "Upar scroll karke dekhiye — saari screen Hindi mein hai"; sleep 6.0

scroll_to "English" || die "language section not reachable (2)"; sleep 1.0
tapv "English" || die "English option not found"; sleep 2.5
hindi_on && die "UI is still in Hindi"
cue "Wapas English par aa gaye"; sleep 3.5

cue "Appearance se theme chuniye — System, Light ya Dark"; sleep 3.0
tapv "Dark"; sleep 2.5
tapv "System"; sleep 2.0
cue "Storage batata hai app kitni jagah le raha hai"; sleep 4.0
cue "Aur sabse neeche Sign out — isse aap app se bahar nikal jaate hain"; sleep 5.5
sleep 6.0   # let the last line breathe before the picture stops

# --- 3. collect --------------------------------------------------------------
rec_stop "$OUT" || die "could not pull the recording"
echo "--- cue log ($CUES) ---"; cat "$CUES"
echo
echo "next: voice/tts.py $CUES <tts-dir> h"
echo "      voice/build-track.py <tts-dir>/cues.srt <tts-dir> h track.wav"
echo "      voice/mux.sh $OUT track.wav final-voiced.mp4"

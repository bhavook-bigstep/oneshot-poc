#!/usr/bin/env bash
# Self-setup for the demo-video skill. Idempotent — safe to run any time.
# Installs and verifies every dependency so the skill "just works" afterwards.
#
#   bash setup.sh                # install + verify all deps
#   bash setup.sh --warm-voice   # also pre-download the local voice model (~350 MB)
#   bash setup.sh --check        # verify only, install nothing
#
# macOS uses Homebrew; Linux uses apt. The voice (Kokoro) sets up its own venv +
# model on first use, so it needs no system install beyond python3 + espeak-ng.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
CHECK_ONLY=0; WARM=0
for a in "$@"; do [ "$a" = "--check" ] && CHECK_ONLY=1; [ "$a" = "--warm-voice" ] && WARM=1; done

b(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "  \033[32m✓\033[0m %s\n" "$1"; }
no(){ printf "  \033[31m✗\033[0m %s\n" "$1"; }
warn(){ printf "  \033[33m!\033[0m %s\n" "$1"; }
MISSING=0

have(){ command -v "$1" >/dev/null 2>&1; }
pkg(){ # pkg <brew-name> <apt-name>
  if [ "$CHECK_ONLY" = 1 ]; then return 1; fi
  case "$OS" in
    Darwin) have brew || { warn "Homebrew not found — install from https://brew.sh then re-run"; return 1; }; brew install "$1" ;;
    Linux)  sudo apt-get update -y >/dev/null 2>&1; sudo apt-get install -y "$2" ;;
    *) warn "unsupported OS $OS — install $1 manually"; return 1 ;;
  esac
}

b "demo-video setup ($OS)"

# --- core (always needed) ---
if have ffmpeg && have ffprobe; then ok "ffmpeg / ffprobe"; else no "ffmpeg"; pkg ffmpeg ffmpeg && ok "ffmpeg installed" || MISSING=1; fi
if have python3; then ok "python3 ($(python3 --version 2>&1 | awk '{print $2}'))"; else no "python3"; pkg python python3 || MISSING=1; fi
if have espeak-ng; then ok "espeak-ng (voice phonemizer)"; else no "espeak-ng"; pkg espeak-ng espeak-ng && ok "espeak-ng installed" || MISSING=1; fi
if python3 -c "import PIL" 2>/dev/null; then ok "pillow (frame checks)"; else
  if [ "$CHECK_ONLY" = 1 ]; then no "pillow"; MISSING=1; else
    python3 -m pip install --user -q pillow 2>/dev/null || pip3 install -q pillow 2>/dev/null
    python3 -c "import PIL" 2>/dev/null && ok "pillow installed" || { no "pillow"; MISSING=1; }
  fi
fi

# --- web recording (node + playwright + chromium) ---
if have node; then ok "node ($(node --version))"; else no "node"; pkg node nodejs || MISSING=1; fi
if have npm; then
  if npm ls -g playwright >/dev/null 2>&1; then ok "playwright (global)"; else
    if [ "$CHECK_ONLY" = 1 ]; then no "playwright"; MISSING=1; else npm i -g playwright >/dev/null 2>&1 && ok "playwright installed" || { no "playwright"; MISSING=1; }; fi
  fi
  if ls "$HOME/Library/Caches/ms-playwright/"chromium* >/dev/null 2>&1 || ls "$HOME/.cache/ms-playwright/"chromium* >/dev/null 2>&1; then
    ok "chromium (playwright)"
  else
    if [ "$CHECK_ONLY" = 1 ]; then no "chromium"; MISSING=1; else npx playwright install chromium >/dev/null 2>&1 && ok "chromium installed" || { no "chromium"; MISSING=1; }; fi
  fi
else no "npm (web videos need it)"; fi

# --- mobile recording (optional) ---
have adb && ok "adb (mobile videos — optional)" || warn "adb not found — only needed for MOBILE app videos (brew install --cask android-platform-tools)"

# --- local voice: self-installs on first synth; optionally warm it now ---
if [ "$WARM" = 1 ] && [ "$CHECK_ONLY" != 1 ]; then
  b "warming the local voice (one-time ~350 MB model download)…"
  tmp="$(mktemp -d)"; printf '0.00|Setup complete.\n' > "$tmp/c.cues.txt"
  if python3 "$HERE/scripts/voice/tts_kokoro.py" "$tmp/c.cues.txt" "$tmp/out" t >/dev/null 2>&1; then ok "voice ready (Kokoro af_heart)"; else warn "voice will finish setting up on first use"; fi
  rm -rf "$tmp"
else
  ok "voice (Kokoro af_heart) — self-installs on first use, no key needed"
fi

echo
if [ "$MISSING" = 0 ]; then b "✅ Ready. Ask Claude Code: \"make a demo video of <X>\"."; else
  b "⚠  Some dependencies are missing above. Re-run without --check, or install them, then re-run."; exit 1
fi

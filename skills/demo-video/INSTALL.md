# Install the demo-video skill

## 1. Add the skill to Claude Code
Copy the `demo-video` folder into your Claude Code skills directory:

    mkdir -p ~/.claude/skills
    cp -R demo-video ~/.claude/skills/demo-video

Then restart Claude Code (or run `/reload-plugins`).

## 2. Let it set itself up
Everything else is automatic. On the first demo it runs its own setup; you can also run it directly:

    bash ~/.claude/skills/demo-video/setup.sh

That installs/verifies ffmpeg, espeak-ng, python + pillow, and (for web videos)
node + Playwright + Chromium — via Homebrew on macOS or apt on Linux. Add
`--warm-voice` to pre-download the voice model, or `--check` to verify only.

The **voice is free and local** (Kokoro `af_heart`) and installs itself on first
use — no API key, no account. Mobile videos additionally need the Android
platform tools (`brew install --cask android-platform-tools`).

## 3. Use it — just ask
In any project, tell Claude Code what you want:

    "Make a demo video of the checkout flow"
    "Record a walkthrough of this dashboard"
    "Create a tutorial video for the new feature"

Claude studies the project, explores the UI, writes the script, records it at
native/Retina resolution with highlight boxes and a natural voiceover, and
delivers the file. It asks only what it can't derive — mainly whether you want
on-screen captions. For apps with a login, it opens a browser once so you can
sign in yourself (it never records a login).

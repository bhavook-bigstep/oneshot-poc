#!/usr/bin/env python3
"""Default voice for demo videos: Kokoro (a local neural TTS that sounds natural).

    tts_kokoro.py <cues> <out-dir> <prefix> [--voice V] [--speed S] [--lang CODE] [--dry-run]

Drop-in replacement for tts.py: writes <out-dir>/<prefix>N.wav (1-indexed) AND
<out-dir>/cues.srt, so everything downstream (trimlead / destagger / build-track)
is unchanged. No API key, nothing to sign up for, runs offline after first setup.

SELF-CONFIGURING: on first run it creates a private venv, installs `kokoro-onnx`
+ `soundfile`, downloads the model (~350 MB), and ensures `espeak-ng`. Then it
re-execs itself inside that venv. Subsequent runs start instantly. Everything
lives under ~/.cache/demo-video-tts so projects stay clean.

DEFAULT VOICE: af_heart (Kokoro's most natural, A-graded). Other good picks:
  female  af_bella  af_sarah        male  am_michael  am_adam  bm_george (British)
Run at speed 1.0 for the most natural delivery; nudge to ~1.1-1.2 only to fit a
tight edit. This is the configuration the skill standardised on — prefer it over
any cloud TTS unless the user explicitly asks for a specific cloud voice.
"""
import os
import re
import subprocess
import sys
import urllib.request

HOME = os.path.join(os.path.expanduser("~"), ".cache", "demo-video-tts")
VENV = os.path.join(HOME, "kokoro-venv")
VPY = os.path.join(VENV, "bin", "python")
MODEL = os.path.join(HOME, "kokoro-v1.0.onnx")
VOICES = os.path.join(HOME, "voices-v1.0.bin")
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"


def _log(m):
    print(f"[tts_kokoro] {m}", file=sys.stderr, flush=True)


def _ensure_espeak():
    from shutil import which
    if which("espeak-ng"):
        return
    if sys.platform == "darwin" and which("brew"):
        _log("installing espeak-ng via brew (one-time)…")
        subprocess.run(["brew", "install", "espeak-ng"], check=False)
    elif which("apt-get"):
        subprocess.run(["sudo", "apt-get", "install", "-y", "espeak-ng"], check=False)
    if not which("espeak-ng"):
        _log("WARNING: espeak-ng not found; Kokoro may fail on some words. "
             "Install it (brew install espeak-ng / apt-get install espeak-ng).")


def _download(url, dest):
    _log(f"downloading {os.path.basename(dest)} (one-time)…")
    tmp = dest + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)


def _bootstrap_and_reexec():
    """Create the venv + model on first run, then re-exec inside the venv."""
    os.makedirs(HOME, exist_ok=True)
    if not os.path.exists(VPY):
        _log("first-time setup: creating venv…")
        subprocess.run([sys.executable, "-m", "venv", VENV], check=True)
        subprocess.run([VPY, "-m", "pip", "install", "-q", "--upgrade", "pip"], check=False)
        _log("installing kokoro-onnx + soundfile…")
        subprocess.run([VPY, "-m", "pip", "install", "-q", "kokoro-onnx", "soundfile"], check=True)
    if not os.path.exists(MODEL):
        _download(BASE + "kokoro-v1.0.onnx", MODEL)
    if not os.path.exists(VOICES):
        _download(BASE + "voices-v1.0.bin", VOICES)
    _ensure_espeak()
    env = dict(os.environ, KOKORO_READY="1")
    os.execve(VPY, [VPY, os.path.abspath(__file__), *sys.argv[1:]], env)


def _load_cues(path):
    cues = []
    for ln in open(path, encoding="utf-8"):
        ln = ln.rstrip("\n")
        if not ln.strip():
            continue
        parts = ln.split("|")
        start = float(parts[0]) if re.match(r"^-?\d", parts[0]) else 0.0
        text = parts[1] if len(parts) > 1 else parts[0]
        cues.append((start, text))
    return cues


def _srt_ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _run(argv):
    import soundfile as sf
    from kokoro_onnx import Kokoro

    voice, speed, lang, dry = "af_heart", 1.0, "en-us", False
    rest = []
    it = iter(argv)
    for a in it:
        if a == "--voice":
            voice = next(it)
        elif a == "--speed":
            speed = float(next(it))
        elif a == "--lang":
            lang = next(it)
        elif a == "--dry-run":
            dry = True
        else:
            rest.append(a)
    if len(rest) != 3:
        sys.exit("usage: tts_kokoro.py <cues> <out-dir> <prefix> [--voice V] [--speed S] [--lang CODE]")
    cuefile, outdir, prefix = rest
    os.makedirs(outdir, exist_ok=True)
    cues = _load_cues(cuefile)
    if not cues:
        sys.exit(f"no cues in {cuefile}")

    k = None if dry else Kokoro(MODEL, VOICES)
    durs = []
    for i, (start, text) in enumerate(cues, 1):
        path = os.path.join(outdir, f"{prefix}{i}.wav")
        if dry:
            dur = len(text) / 18.0 / speed  # af_heart ≈ 18 chars/s at speed 1.0
        else:
            samples, sr = k.create(text, voice=voice, speed=speed, lang=lang)
            sf.write(path, samples, sr)
            dur = len(samples) / sr
        durs.append(dur)
        print(f"  {i:2d}: {dur:5.2f}s  at {start:6.2f}  {text[:48]}")

    srt = os.path.join(outdir, "cues.srt")
    with open(srt, "w", encoding="utf-8") as f:
        for i, (start, text) in enumerate(cues):
            end = cues[i + 1][0] if i + 1 < len(cues) else start + durs[i]
            f.write(f"{i + 1}\n{_srt_ts(start)} --> {_srt_ts(end)}\n{text}\n\n")
    print(f"voice={voice} speed={speed} -> {len(cues)} clips + {srt}")


if __name__ == "__main__":
    if os.environ.get("KOKORO_READY") != "1":
        _bootstrap_and_reexec()
    else:
        _run(sys.argv[1:])

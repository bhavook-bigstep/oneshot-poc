#!/usr/bin/env python3
"""Push cue start times later just enough that no spoken line runs into the next.

    destagger.py <cues.txt> <tts-dir> <prefix> <out-cues.txt> <out.srt> [--gap S]

TTS clip lengths vary between renders of the same text, so a cue log that fit
last time can overlap this time. Re-rendering to chase it is whack-a-mole: each
render reshuffles which window is tight. This instead takes the clips as given
and slides starts forward (cascading), which costs no API calls and keeps
caption and voice locked to each other because both are written from the result.

A cue is never moved earlier, so nothing drifts ahead of the action it narrates.
"""
import argparse
import pathlib
import subprocess
import sys


def dur(p):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip()
    return float(out)


def ts(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cues")
    ap.add_argument("tts_dir")
    ap.add_argument("prefix")
    ap.add_argument("out_cues")
    ap.add_argument("out_srt")
    ap.add_argument("--gap", type=float, default=0.18)
    a = ap.parse_args()

    cues = []
    for ln in pathlib.Path(a.cues).read_text().splitlines():
        ln = ln.strip()
        if ln and "|" in ln:
            t, txt = ln.split("|", 1)
            cues.append([float(t), txt])

    d = [dur(pathlib.Path(a.tts_dir) / f"{a.prefix}{i + 1}.wav") for i in range(len(cues))]

    moved, prev_end = 0, 0.0
    for i, c in enumerate(cues):
        if c[0] < prev_end + a.gap:
            c[0] = prev_end + a.gap
            moved += 1
        prev_end = c[0] + d[i]

    pathlib.Path(a.out_cues).write_text(
        "".join(f"{c[0]:.2f}|{c[1]}\n" for c in cues))
    srt = []
    for i, c in enumerate(cues):
        srt.append(f"{i + 1}\n{ts(c[0])} --> {ts(c[0] + d[i])}\n{c[1]}\n")
    pathlib.Path(a.out_srt).write_text("\n".join(srt))

    print(f"{len(cues)} cues, moved {moved}, ends {prev_end:.2f}s")


if __name__ == "__main__":
    sys.exit(main())

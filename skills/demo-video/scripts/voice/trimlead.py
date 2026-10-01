#!/usr/bin/env python3
"""Trim leading silence from TTS clips so each voice starts on its caption.

Sarvam occasionally renders a clip with up to 1.3s of silence before the first
word (M16 cue 3 did exactly that). The clip is fine and build-track.py is happy,
but the caption appears a full second before anything is heard, and the
per-cue audibility check reads the cue as silent -- which looks like a missing
clip and sends you hunting the wrong bug.

Trimming only ever shortens a clip, so it cannot create a new overlap.

    trimlead.py <in-dir> <prefix> <n> <out-dir> [--thresh 0.15] [--air 0.08]
"""
import subprocess, sys, re, shutil, os

def lead_in(path):
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-i', path,
         '-af', 'silencedetect=noise=-50dB:d=0.1', '-f', 'null', '-'],
        capture_output=True, text=True).stderr
    start = re.search(r'silence_start: (-?[\d.]+)', out)
    end = re.search(r'silence_end: ([\d.]+)', out)
    # only a silence that begins at the very top of the clip is a lead-in
    if start and end and abs(float(start.group(1))) < 0.05:
        return float(end.group(1))
    return 0.0

def main(argv):
    thresh, air = 0.15, 0.08
    for flag, name in (('--thresh', 'thresh'), ('--air', 'air')):
        if flag in argv:
            i = argv.index(flag)
            val = float(argv[i + 1]); del argv[i:i + 2]
            if name == 'thresh': thresh = val
            else: air = val
    if len(argv) != 4:
        sys.exit(__doc__)
    src, prefix, n, dst = argv[0], argv[1], int(argv[2]), argv[3]
    os.makedirs(dst, exist_ok=True)
    trimmed = 0
    for i in range(1, n + 1):
        f = os.path.join(src, f'{prefix}{i}.wav')
        o = os.path.join(dst, f'{prefix}{i}.wav')
        lead = lead_in(f)
        if lead > thresh:
            ss = max(0.0, lead - air)   # leave a little air so nothing clips
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ss:.3f}',
                            '-i', f, '-c', 'copy', o], check=True)
            print(f'{i:3d} trimmed {ss:.2f}s')
            trimmed += 1
        else:
            shutil.copy(f, o)
    print(f'{trimmed} of {n} clips trimmed -> {dst}')

if __name__ == '__main__':
    main(sys.argv[1:])

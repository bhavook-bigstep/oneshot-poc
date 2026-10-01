#!/usr/bin/env python3
"""Assemble a voice track from an SRT and one TTS clip per cue.

    build-track.py <cues.srt> <wav-dir> <prefix> <out.wav> [total-seconds]
                   [--target <dBFS>] [--no-normalize] [--strict]

Clip N (for cue N) is read from <wav-dir>/<prefix>N.wav and placed at that
cue's SRT start time on a silent bed (levels untouched at mix time, amix
normalize=0). The finished track is then peak-normalised to a consistent level
(default -1.5 dBFS) so loudness doesn't depend on the TTS engine or the wording
— this both lifts a quiet voice (e.g. Kokoro) and guards against clipping.
Pass --no-normalize to keep raw levels. Overlaps are reported but not fixed: if
a clip runs past the next cue's start the two voices collide, so shorten the
line or widen the gap (or run destagger.py) and re-run.
Exit 2 = a clip is missing; exit 3 = an overlap was found and --strict was set.
"""
import os, re, subprocess, sys

def dur(path):
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path])
    return float(out.strip())

def peak_db(path):
    out = subprocess.run(['ffmpeg', '-i', path, '-af', 'astats', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    peaks = re.findall(r'Peak level dB:\s*(-?[\d.]+|-inf)', out)
    vals = [float(p) for p in peaks if p != '-inf']
    return max(vals) if vals else float('-inf')

def srt_starts(path):
    starts = []
    for line in open(path, encoding='utf-8'):
        m = re.match(r'\s*(\d\d):(\d\d):(\d\d),(\d\d\d)\s*-->', line)
        if m:
            h, mm, s, ms = (int(g) for g in m.groups())
            starts.append(h * 3600 + mm * 60 + s + ms / 1000)
    return starts

def main(argv):
    strict = '--strict' in argv
    normalize = '--no-normalize' not in argv
    target = -1.5
    if '--target' in argv:
        i = argv.index('--target'); target = float(argv[i + 1]); del argv[i:i + 2]
    argv = [a for a in argv if a not in ('--strict', '--no-normalize')]
    if not 4 <= len(argv) <= 5:
        sys.exit(__doc__)
    srt, wavdir, prefix, out = argv[:4]
    total = float(argv[4]) if len(argv) == 5 else None

    starts = srt_starts(srt)
    if not starts:
        sys.exit(f'no cues found in {srt}')

    clips, overlaps, end = [], [], 0.0
    for i, start in enumerate(starts):
        f = os.path.join(wavdir, f'{prefix}{i + 1}.wav')
        if not os.path.exists(f):
            sys.exit((2, f'missing clip for cue {i + 1}: {f}')[1])
        d = dur(f)
        end = start + d
        if i + 1 < len(starts) and end > starts[i + 1] + 1e-3:
            overlaps.append((i + 1, round(end - starts[i + 1], 2)))
        clips.append((f, start, d))

    for cue, by in overlaps:
        print(f'WARN: cue {cue} runs {by}s into cue {cue + 1}', file=sys.stderr)
    if overlaps and strict:
        sys.exit(3)

    total = total if total is not None else end

    args = ['ffmpeg', '-v', 'error', '-y',
            '-f', 'lavfi', '-t', f'{total:.3f}', '-i', 'anullsrc=r=44100:cl=stereo']
    parts, mix = [], '[0:a]'
    for i, (f, start, _) in enumerate(clips):
        args += ['-i', f]
        ms = int(round(start * 1000))
        # pan, not aformat: aformat's mono->stereo matrix is energy-preserving
        # and costs 3.01 dB. pan copies the mono channel to both at unity.
        parts.append(f'[{i + 1}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,'
                     f'adelay={ms}|{ms}[d{i}]')
        mix += f'[d{i}]'
    parts.append(f'{mix}amix=inputs={len(clips) + 1}:normalize=0:'
                 f'dropout_transition=0,atrim=0:{total:.3f}[out]')

    args += ['-filter_complex', ';'.join(parts), '-map', '[out]',
             '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', out]
    subprocess.run(args, check=True)

    # clipping guard: the first cut of this series shipped a track hard-clipped
    # at 0 dBFS, so always measure the result rather than trusting the mix.
    peak = peak_db(out)
    if normalize and peak != float('-inf'):
        # peak-normalise to the target: lifts a quiet voice, and pulls a hot one
        # back below 0 so nothing clips. Content- and engine-independent.
        gain = target - peak
        tmp = out + '.norm.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-af', f'volume={gain:.2f}dB',
                        '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', tmp], check=True)
        os.replace(tmp, out)
        peak = peak_db(out)
    print(f'track: {out}  cues={len(clips)}  duration={dur(out):.3f}'
          f'  overlaps={len(overlaps)}  peak={peak:.2f} dBFS')
    if peak > -0.1:
        print(f'WARN: track peaks at {peak:.2f} dBFS - it is clipping. '
              f'Lower the clip gain or re-render the loud lines.', file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1:])

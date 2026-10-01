#!/usr/bin/env python3
"""Compress dead air in a demo recording so narration paces it, not typing.

    tighten.py <cues.txt> <video.mp4> <out.mp4> <out-cues.txt> [--rate R] [--tail S] [--gap S]

The inverse of pad.py. For each cue window it keeps `speech + tail` seconds at
1x and speeds up whatever is left (slow adb typing, screen loads, camera warm-up)
so the window ends `gap` seconds after the line finishes. Screen recordings are
silent, so only video is retimed.

Defaults: rate 17 chars/sec (shreya Hinglish), tail 1.2s, gap 1.5s, max 10x.
"""
import os, subprocess, sys, tempfile

MAX_SPEED = 10.0

def dur(p):
    return float(subprocess.check_output(
        ['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())

def main(argv):
    rate, tail, gap = 17.0, 1.2, 1.5
    for flag, name in (('--rate','rate'), ('--tail','tail'), ('--gap','gap')):
        if flag in argv:
            i = argv.index(flag); val = float(argv[i+1]); del argv[i:i+2]
            if name == 'rate': rate = val
            elif name == 'tail': tail = val
            else: gap = val
    if len(argv) != 4: sys.exit(__doc__)
    cuefile, video, out, outcues = argv

    cues = []
    for l in open(cuefile, encoding='utf-8'):
        if '|' in l:
            t, x = l.split('|', 1); cues.append([float(t), x.strip()])
    total = dur(video)
    tmp = tempfile.mkdtemp(prefix='tight-')
    parts, newstarts, cursor = [], [], 0.0

    for i, (t, txt) in enumerate(cues):
        end = cues[i+1][0] if i+1 < len(cues) else total
        window = end - t
        speech = len(txt)/rate + 0.55
        keep = min(window, speech + tail)
        rest = window - keep
        newstarts.append(cursor)

        seg = f'{tmp}/k{i:03d}.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{t:.3f}','-to',f'{t+keep:.3f}',
                        '-i',video,'-an','-c:v','libx264','-preset','medium','-crf','20',
                        '-pix_fmt','yuv420p',seg], check=True)
        parts.append(seg); cursor += keep

        if rest > gap + 0.2:
            speed = min(MAX_SPEED, rest / gap)
            newlen = rest / speed
            fast = f'{tmp}/f{i:03d}.mp4'
            subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{t+keep:.3f}','-to',f'{end:.3f}',
                            '-i',video,'-an','-vf',f'setpts=PTS/{speed:.4f}',
                            '-c:v','libx264','-preset','medium','-crf','20',
                            '-pix_fmt','yuv420p',fast], check=True)
            parts.append(fast); cursor += newlen
        elif rest > 0:
            seg2 = f'{tmp}/r{i:03d}.mp4'
            subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{t+keep:.3f}','-to',f'{end:.3f}',
                            '-i',video,'-an','-c:v','libx264','-preset','medium','-crf','20',
                            '-pix_fmt','yuv420p',seg2], check=True)
            parts.append(seg2); cursor += rest

    lst = f'{tmp}/list.txt'
    open(lst,'w').write(''.join(f"file '{p}'\n" for p in parts))
    subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',lst,
                    '-c','copy','-movflags','+faststart', out], check=True)
    with open(outcues,'w',encoding='utf-8') as f:
        for ns,(_,txt) in zip(newstarts, cues): f.write(f'{ns:.2f}|{txt}\n')
    print(f'{video} {total:.1f}s -> {out} {dur(out):.1f}s '
          f'({100*(1-dur(out)/total):.0f}% shorter), {len(cues)} cues')

if __name__ == '__main__':
    main(sys.argv[1:])

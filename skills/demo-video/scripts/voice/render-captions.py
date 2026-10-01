#!/usr/bin/env python3
"""Burn captions onto a demo recording, and write the matching SRT.

    render-captions.py <cues.txt> <video.mp4> <out.mp4> [--position top|bottom] [--size N]

<cues.txt> is the `seconds|text` cue log the recorders emit. Each caption shows
from its own cue until the next one, capped at MAX_ON_SCREEN.

This ffmpeg build has no libass and no drawtext, so the caption bar is drawn
with PIL and composited with the plain `overlay` filter.

--position defaults to `top`. Most mobile apps anchor their primary buttons,
validation banners and toasts to the bottom of the screen, so a caption there
covers the very thing it is describing. Use `bottom` only for a surface that
keeps its important content up top.
"""
import os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

MAX_ON_SCREEN = 5.5
FONT_PATH = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
PAD_X, PAD_Y, RADIUS, MARGIN = 26, 18, 14, 122

def probe(video, *entries):
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', ':'.join(entries), '-of', 'default=nw=1', video],
        text=True)
    return dict(l.split('=', 1) for l in out.strip().splitlines())

def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        trial = f'{cur} {w}'.strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'

def main(argv):
    pos, size_override = 'top', None
    if '--position' in argv:
        i = argv.index('--position'); pos = argv[i + 1]; del argv[i:i + 2]
    if '--size' in argv:
        i = argv.index('--size'); size_override = int(argv[i + 1]); del argv[i:i + 2]
    if len(argv) != 3:
        sys.exit(__doc__)
    cuefile, video, out = argv

    meta = probe(video, 'stream=width,height', 'format=duration')
    W, H = int(meta['width']), int(meta['height'])
    total = float(meta['duration'])
    # W/24 suits a portrait phone capture (720 wide -> 30px); a 1280-wide web
    # recording needs ~25px, so pass --size explicitly there.
    size = size_override if size_override else max(22, round(W / 24))
    font = ImageFont.truetype(FONT_PATH, size)

    cues = []
    for line in open(cuefile, encoding='utf-8'):
        if '|' in line:
            t, txt = line.split('|', 1)
            cues.append((float(t), txt.strip()))
    if not cues:
        sys.exit(f'no cues in {cuefile}')

    tmp = tempfile.mkdtemp(prefix='caps-')
    measure = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    spans = []
    for i, (start, text) in enumerate(cues):
        end = min(cues[i + 1][0] if i + 1 < len(cues) else total,
                  start + MAX_ON_SCREEN)
        lines = wrap(measure, text, font, int(W * 0.86) - 2 * PAD_X)
        lh = size + 10
        box_w = int(max(measure.textlength(l, font=font) for l in lines)) + 2 * PAD_X
        box_h = lh * len(lines) + 2 * PAD_Y - 10
        img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        x0 = (W - box_w) // 2
        y0 = MARGIN if pos == 'top' else H - MARGIN - box_h
        d.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], RADIUS,
                            fill=(12, 16, 24, 235))
        for n, line in enumerate(lines):
            lw = measure.textlength(line, font=font)
            d.text(((W - lw) / 2, y0 + PAD_Y + n * lh), line, font=font,
                   fill=(255, 255, 255, 255))
        img.save(f'{tmp}/cap{i:03d}.png')
        spans.append((start, end, text))

    srt = os.path.splitext(out)[0] + '.srt'
    with open(srt, 'w', encoding='utf-8') as f:
        for i, (s, e, t) in enumerate(spans, 1):
            f.write(f'{i}\n{ts(s)} --> {ts(e)}\n{t}\n\n')

    args = ['ffmpeg', '-v', 'error', '-stats', '-y', '-i', video]
    for i in range(len(spans)):
        args += ['-i', f'{tmp}/cap{i:03d}.png']
    parts, prev = [], '0:v'
    for i, (a, b, _) in enumerate(spans):
        parts.append(f"[{prev}][{i + 1}:v]overlay=0:0:"
                     f"enable='between(t,{a:.3f},{b:.3f})'[v{i + 1}]")
        prev = f'v{i + 1}'
    # fps_mode passthrough matters: these screen captures are variable frame
    # rate, and letting the filtergraph renegotiate drops most of the frames.
    args += ['-filter_complex', ';'.join(parts), '-map', f'[{prev}]',
             '-map', '0:a?', '-fps_mode', 'passthrough',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
             '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out]
    subprocess.run(args, check=True)

    before = probe(video, 'stream=nb_frames').get('nb_frames')
    after = probe(out, 'stream=nb_frames').get('nb_frames')
    print(f'\n{out}  {len(spans)} captions  frames {before} -> {after}')
    if before != after:
        print(f'WARN: frame count changed ({before} -> {after}) - check for '
              f'dropped frames', file=sys.stderr)
    print(f'srt: {srt}')

if __name__ == '__main__':
    main(sys.argv[1:])

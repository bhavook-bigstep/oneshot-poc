#!/usr/bin/env python3
"""Render a white interstitial card ("Logged in as Project Manager") and splice
it into a demo at a given point.

Two roles:
  render  - make a standalone card clip matching a video's geometry/fps
  splice  - cut a video at N seconds and insert cards, re-timing the cue log

A card is a hard cut, not a crossfade: the viewer needs to *read* it, and a fade
eats a third of a 2s card. Cards are CFR and share the source's pixel format so
the concat demuxer joins them without a re-encode surprise.

Usage:
  titlecard.py render "Logged in as Project Manager" out.mp4 --like src.mp4
  titlecard.py splice src.mp4 cues.txt out.mp4 out_cues.txt \
      --card 0:"Logged in as Project Manager" --card 51.5:"Now logged in as Site Engineer"
"""
import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

FONTS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
]
BG = (250, 250, 249)      # warm off-white, not a blown-out 255 that flares on a phone screen
FG = (24, 24, 27)
ACCENT = (37, 99, 235)


def font(size):
    for path in FONTS:
        if pathlib.Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate,pix_fmt", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), round(int(num) / int(den)), s["pix_fmt"]


def wrap(draw, text, fnt, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=fnt) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_card(text, w, h, subtitle=None):
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)

    size = max(28, int(w / 16))
    fnt = font(size)
    margin = int(w * 0.10)
    lines = wrap(d, text, fnt, w - 2 * margin)
    while sum(size + 14 for _ in lines) > h * 0.4 and size > 20:
        size -= 2
        fnt = font(size)
        lines = wrap(d, text, fnt, w - 2 * margin)

    lh = size + 14
    total = lh * len(lines)
    y = (h - total) / 2
    for ln in lines:
        d.text(((w - d.textlength(ln, font=fnt)) / 2, y), ln, font=fnt, fill=FG)
        y += lh

    # a short rule under the text: gives the card a deliberate, designed look
    # rather than reading as a dropped frame
    rw = int(w * 0.14)
    ry = y + int(size * 0.5)
    d.rounded_rectangle([(w - rw) / 2, ry, (w + rw) / 2, ry + max(3, size // 12)],
                        radius=4, fill=ACCENT)

    if subtitle:
        sf = font(max(16, int(size * 0.42)))
        sy = ry + size * 0.9
        for ln in wrap(d, subtitle, sf, w - 2 * margin):
            d.text(((w - d.textlength(ln, font=sf)) / 2, sy), ln, font=sf,
                   fill=(113, 113, 122))
            sy += sf.size + 8
    return img


def render_clip(text, out, like, seconds, subtitle=None):
    w, h, fps, pix = probe(like)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        draw_card(text, w, h, subtitle).save(tf.name)
        png = tf.name
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(fps),
         "-t", str(seconds), "-i", png,
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", pix, "-r", str(fps), "-an", str(out)], check=True)
    pathlib.Path(png).unlink(missing_ok=True)
    return w, h, fps, pix


def read_cues(path):
    cues = []
    for ln in pathlib.Path(path).read_text().splitlines():
        ln = ln.strip()
        if not ln or "|" not in ln:
            continue
        t, txt = ln.split("|", 1)
        cues.append((float(t), txt))
    return cues


def splice(src, cues_path, out, out_cues, cards, seconds):
    """Insert cards at the given source timestamps.

    Every cue at or after a card's insertion point shifts later by the card's
    duration -- otherwise the narration would keep playing over the card and
    then run ahead of the picture for the rest of the video.
    """
    w, h, fps, pix = probe(src)
    cards = sorted(cards, key=lambda c: c[0])
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="titlecard-"))
    parts, prev = [], 0.0

    for i, (at, text) in enumerate(cards):
        if at > prev:
            seg = tmp / f"body{i}.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src),
                            "-ss", str(prev), "-to", str(at),
                            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                            "-pix_fmt", pix, "-r", str(fps), "-an", str(seg)],
                           check=True)
            parts.append(seg)
        card = tmp / f"card{i}.mp4"
        render_clip(text, card, src, seconds)
        parts.append(card)
        prev = at

    tail = tmp / "tail.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ss", str(prev),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-pix_fmt", pix, "-r", str(fps), "-an", str(tail)], check=True)
    parts.append(tail)

    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", str(lst), "-c:v", "libx264", "-preset", "medium",
                    "-crf", "20", "-pix_fmt", pix, "-r", str(fps), "-an",
                    "-movflags", "+faststart", str(out)], check=True)

    shifted = []
    for t, txt in read_cues(cues_path):
        shift = sum(seconds for at, _ in cards if at <= t)
        shifted.append((t + shift, txt))
    pathlib.Path(out_cues).write_text(
        "".join(f"{t:.2f}|{txt}\n" for t, txt in shifted))

    print(f"{out}  +{len(cards)} cards ({len(cards) * seconds:.1f}s)  "
          f"cues -> {out_cues}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render")
    r.add_argument("text")
    r.add_argument("out")
    r.add_argument("--like", required=True, help="video to match geometry/fps")
    r.add_argument("--subtitle")
    r.add_argument("--seconds", type=float, default=2.0)

    s = sub.add_parser("splice")
    s.add_argument("src")
    s.add_argument("cues")
    s.add_argument("out")
    s.add_argument("out_cues")
    s.add_argument("--card", action="append", required=True,
                   metavar="SECONDS:TEXT", help="repeatable")
    s.add_argument("--seconds", type=float, default=2.0)

    a = ap.parse_args()
    if a.cmd == "render":
        render_clip(a.text, a.out, a.like, a.seconds, a.subtitle)
        print(a.out)
    else:
        cards = []
        for c in a.card:
            at, text = c.split(":", 1)
            cards.append((float(at), text))
        splice(a.src, a.cues, a.out, a.out_cues, cards, a.seconds)


if __name__ == "__main__":
    sys.exit(main())

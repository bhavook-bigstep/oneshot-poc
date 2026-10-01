#!/usr/bin/env python3
"""Render one voice clip per cue, and write the SRT that matches them.

    tts.py <cues> <out-dir> <prefix> [--dry-run] [--speaker X] [--pace P] [--lang CODE]

<cues> is either the `seconds|text` cue log that the Android recorder emits,
or a JSON array of {"start": 0.4, "text": "...", "pace": 1.05}.

The cue file is the single source of truth: this writes <out-dir>/<prefix>N.wav
AND <out-dir>/cues.srt from the same list, so captions can never drift out of
sync with the audio. Feed that SRT to build-track.py.

--dry-run costs no API calls. It estimates each line's length and reports which
cues would overlap the next, which is what you want before paying for a render.

Needs a Sarvam key: env SARVAM_API_KEY, or the file ~/.demo_tts_key (chmod 600).
Defaults can be set with env DEMO_TTS_SPEAKER / DEMO_TTS_LANG / DEMO_TTS_MODEL.
Language codes: en-IN, hi-IN, bn-IN, ta-IN, te-IN, kn-IN, ml-IN, mr-IN, gu-IN, pa-IN, od-IN.
"""
import json, os, re, subprocess, sys, urllib.error, urllib.request, base64

API = 'https://api.sarvam.ai/text-to-speech'
MODEL = os.environ.get('DEMO_TTS_MODEL', 'bulbul:v3')
SPEAKER = os.environ.get('DEMO_TTS_SPEAKER', 'priya')
LANG = os.environ.get('DEMO_TTS_LANG', 'en-IN')
KEYFILE = os.path.expanduser(os.environ.get('DEMO_TTS_KEY_FILE', '~/.demo_tts_key'))

def api_key():
    k = os.environ.get('SARVAM_API_KEY')
    if k:
        return k.strip()
    if not os.path.exists(KEYFILE):
        sys.exit(f'No TTS key: set SARVAM_API_KEY or put the key in {KEYFILE} (chmod 600)')
    return open(KEYFILE).read().strip()

def load_cues(path):
    raw = open(path, encoding='utf-8').read().strip()
    if raw.startswith('['):
        return [(float(c['start']), c['text'], float(c.get('pace', 1.0)))
                for c in json.loads(raw)]
    cues = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or '|' not in line:
            continue
        t, text = line.split('|', 1)
        cues.append((float(t), text.strip(), 1.0))
    return cues

def dur(path):
    return float(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path]).strip())

def synth(text, pace, path, speaker, lang=LANG):
    body = json.dumps({'text': text, 'model': MODEL, 'speaker': speaker,
                       'target_language_code': lang,
                       'output_audio_codec': 'wav', 'pace': pace}).encode()
    key = api_key()
    req = urllib.request.Request(API, data=body, headers={
        'api-subscription-key': key, 'Content-Type': 'application/json'})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        sys.exit(f'TTS failed for "{text[:40]}": {e.code} {e.read()[:200]}')
    a = d.get('audios') or d.get('audio')
    a = a[0] if isinstance(a, list) else a
    open(path, 'wb').write(base64.b64decode(a))
    return dur(path)

def srt_ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'

def main(argv):
    dry = '--dry-run' in argv
    argv = [a for a in argv if a != '--dry-run']
    speaker, pace_mul, lang = SPEAKER, 1.0, LANG
    if '--lang' in argv:
        i = argv.index('--lang'); lang = argv[i + 1]; del argv[i:i + 2]
    for flag, setter in (('--speaker', 'speaker'), ('--pace', 'pace')):
        if flag in argv:
            i = argv.index(flag)
            val = argv[i + 1]; del argv[i:i + 2]
            if setter == 'speaker': speaker = val
            else: pace_mul = float(val)
    if len(argv) != 3:
        sys.exit(__doc__)
    cuefile, outdir, prefix = argv
    os.makedirs(outdir, exist_ok=True)
    cues = load_cues(cuefile)
    if not cues:
        sys.exit(f'no cues in {cuefile}')

    durs = []
    for i, (start, text, pace) in enumerate(cues, 1):
        path = os.path.join(outdir, f'{prefix}{i}.wav')
        if dry:
            # Measured over demos 05-07: median 17 chars/sec at pace 1.0.
            # We deliberately use the slow p10 (13.5) so the dry run
            # over-predicts length and over-warns about overlaps.
            d = len(text) / 13.5 / (pace * pace_mul)
        else:
            d = synth(text, pace * pace_mul, path, speaker, lang)
        durs.append(d)
        print(f'  {i:2d}: {d:5.2f}s  at {start:6.2f}  {text[:48]}')

    clashes = [(i + 1, round(cues[i][0] + durs[i] - cues[i + 1][0], 2))
               for i in range(len(cues) - 1)
               if cues[i][0] + durs[i] > cues[i + 1][0] + 1e-3]
    for cue, by in clashes:
        print(f'WARN: cue {cue} runs {by}s into cue {cue + 1}', file=sys.stderr)

    srt = os.path.join(outdir, 'cues.srt')
    with open(srt, 'w', encoding='utf-8') as f:
        for i, (start, text, _) in enumerate(cues):
            end = cues[i + 1][0] if i + 1 < len(cues) else start + durs[i]
            f.write(f'{i + 1}\n{srt_ts(start)} --> {srt_ts(end)}\n{text}\n\n')

    kind = 'estimated' if dry else 'rendered'
    print(f'{kind} {len(cues)} cues -> {outdir}/{prefix}N.wav'
          f'  ends {cues[-1][0] + durs[-1]:.2f}s  overlaps={len(clashes)}')
    print(f'srt: {srt}')

if __name__ == '__main__':
    main(sys.argv[1:])

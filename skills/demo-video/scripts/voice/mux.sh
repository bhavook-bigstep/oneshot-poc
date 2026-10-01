#!/bin/bash
# mux.sh <video.mp4> <track.wav> <out.mp4>
#
# Lays the voice track over a silent screen recording. Video is copied, not
# re-encoded; audio becomes 128k stereo AAC. The output keeps the VIDEO's
# duration (-shortest is deliberately NOT used: a track that ends before the
# video is normal, and we never want the picture cut to match the audio).
set -euo pipefail
VID="$1"; TRK="$2"; OUT="$3"

dur(){ ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
vd=$(dur "$VID"); td=$(dur "$TRK")
python3 -c "
import sys
v,t=$vd,$td
if t > v + 0.25:
    sys.exit('ERROR: voice track (%.2fs) is longer than the video (%.2fs) - '
             'the last lines would be cut. Trim cues or extend the recording.' % (t,v))
print('video %.2fs  track %.2fs  tail %.2fs' % (v,t,v-t))
"

ffmpeg -v error -y -i "$VID" -i "$TRK" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -ar 44100 -ac 2 \
  -movflags +faststart "$OUT"

echo "muxed: $OUT  $(dur "$OUT")s  peak $(ffmpeg -i "$OUT" -af astats -f null - 2>&1 \
  | grep 'Peak level' | tail -1 | awk '{print $NF}') dBFS"

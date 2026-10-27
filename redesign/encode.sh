#!/usr/bin/env bash
# fal's originals (redesign/raw/, from media.mjs) → the site's loops and posters (media/).
# Each loop plays forward then back (a ping-pong, so it never jumps), AV1 first, H.264 for the rest; the poster is the
# loop's first frame, the still a person without motion sees.
# Run: FFMPEG=<an ffmpeg with libaom-av1, libx264 and libwebp> redesign/encode.sh
set -euo pipefail
cd "$(dirname "$0")/.."
FFMPEG=${FFMPEG:-ffmpeg}
mkdir -p media
for name in ink seal archive; do
  src=redesign/raw/$name.mp4
  chain="[0:v]scale=1600:-2:flags=lanczos,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]"
  "$FFMPEG" -v error -y -i "$src" -filter_complex "$chain" -map "[v]" -an -c:v libaom-av1 -crf 42 -b:v 0 -cpu-used 6 -row-mt 1 -pix_fmt yuv420p -movflags +faststart "media/$name.av1.mp4"
  "$FFMPEG" -v error -y -i "$src" -filter_complex "$chain" -map "[v]" -an -c:v libx264 -crf 28 -preset slow -profile:v high -pix_fmt yuv420p -movflags +faststart "media/$name.mp4"
  "$FFMPEG" -v error -y -i "$src" -vf "scale=1600:-2:flags=lanczos" -frames:v 1 -q:v 5 "media/$name.jpg"
  # The poster is the first paint (the largest one on a wide screen): small before sharp.
  "$FFMPEG" -v error -y -i "$src" -vf "scale=1440:-2:flags=lanczos" -frames:v 1 -c:v libwebp -quality 50 "media/$name.webp"
done
ls -la media

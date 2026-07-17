#!/usr/bin/env bash
# Normalize raw device photos into the format src/assets/devices/ expects:
# square 800×800 WebP, device centered with padding, background preserved
# (manufacturer press shots are already white/transparent).
#
# Usage:
#   scripts/normalize-device-images.sh <raw-dir> [out-dir]
#
# Every image in <raw-dir> must already be named by its image_key
# (e.g. signia-pure-ix.png) — see src/assets/devices/MANIFEST.md for the key
# list. Output defaults to src/assets/devices/.
#
# Requires ImageMagick (magick or convert on PATH). No npm dependencies.
set -euo pipefail

RAW_DIR="${1:?usage: normalize-device-images.sh <raw-dir> [out-dir]}"
OUT_DIR="${2:-$(dirname "$0")/../src/assets/devices}"
SIZE=800
PAD=40  # transparent margin so shells don't touch the edge

if command -v magick >/dev/null 2>&1; then IM=magick
elif command -v convert >/dev/null 2>&1; then IM=convert
else echo "ImageMagick not found (need 'magick' or 'convert')" >&2; exit 1; fi

mkdir -p "$OUT_DIR"
inner=$((SIZE - 2 * PAD))
count=0

shopt -s nullglob nocaseglob
for f in "$RAW_DIR"/*.{png,jpg,jpeg,webp}; do
  key="$(basename "${f%.*}")"
  out="$OUT_DIR/$key.webp"
  # -trim cuts dead margin, then fit inside the padded square on transparency.
  "$IM" "$f" -trim +repage \
    -resize "${inner}x${inner}>" \
    -background none -gravity center -extent "${SIZE}x${SIZE}" \
    -quality 90 "$out"
  echo "  $key.webp"
  count=$((count + 1))
done

echo "Normalized $count image(s) into $OUT_DIR"
[ "$count" -eq 0 ] && echo "(nothing matched — are files named <image_key>.<ext>?)" >&2
exit 0

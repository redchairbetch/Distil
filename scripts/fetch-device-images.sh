#!/usr/bin/env bash
# Download device photos listed in scripts/device-image-sources.tsv into a raw
# folder, then normalize them into src/assets/devices/ via
# normalize-device-images.sh (ImageMagick).
#
# Run this on a machine with open internet access — the Claude Code cloud
# sandbox's egress policy blocks the manufacturer CDNs, which is why the
# downloads aren't committed already.
#
# Usage:
#   scripts/fetch-device-images.sh            # download + normalize
#   scripts/fetch-device-images.sh --raw-only # download only, skip normalize
#
# After it finishes, eyeball src/assets/devices/*.webp (a few sources are
# lifestyle shots — see MANIFEST.md), delete any that look wrong, and commit.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
TSV="$DIR/device-image-sources.tsv"
RAW="$DIR/../.device-images-raw"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

mkdir -p "$RAW"
ok=0; fail=0
while IFS=$'\t' read -r key url; do
  [ -z "$key" ] && continue
  case "$key" in \#*) continue ;; esac
  path="${url%%\?*}"
  ext="jpg"
  case "$path" in
    *.png) ext="png" ;; *.webp) ext="webp" ;; *.jpeg) ext="jpeg" ;;
    *.ashx) ext="png" ;;
  esac
  out="$RAW/$key.$ext"
  if curl -fsSL --max-time 60 -A "$UA" -o "$out" "$url"; then
    echo "  ok   $key"
    ok=$((ok + 1))
  else
    echo "  FAIL $key  ($url)" >&2
    rm -f "$out"
    fail=$((fail + 1))
  fi
done < "$TSV"

echo "Downloaded $ok, failed $fail (raw files in $RAW)"

if [ "${1:-}" != "--raw-only" ] && [ "$ok" -gt 0 ]; then
  "$DIR/normalize-device-images.sh" "$RAW"
  echo "Review src/assets/devices/*.webp, remove any lifestyle/wrong shots, then commit."
fi

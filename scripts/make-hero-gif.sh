#!/usr/bin/env bash
# Render the current example trip across several basemaps and stitch an animated
# GIF — a "same trip, many looks" hero. Reproducible anywhere Deno + ffmpeg run
# (e.g. a container). Renders reuse `deno task render` (which starts its own Vite).
#
#   scripts/make-hero-gif.sh
#   STYLES="stamen watercolor natgeo opentopo ocean" OUT=docs/hero-demo.gif scripts/make-hero-gif.sh
#
# Stadia styles (stamen/watercolor) need VITE_STADIA_API_KEY, else they fall back.

set -euo pipefail

STYLES=${STYLES:-"stamen watercolor natgeo opentopo ocean"}
OUT=${OUT:-docs/hero-demo.gif}
SECS=${SECS:-1.6}     # seconds per basemap
WIDTH=${WIDTH:-1000}  # output width (px); height auto
FRAMES_DIR=output/demo

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
mkdir -p "$FRAMES_DIR" "$(dirname "$OUT")"
rm -f "$FRAMES_DIR"/frame-*.png

# 1) render each basemap → output/demo-<style>.png
# shellcheck disable=SC2086
deno task render --out demo $STYLES

# 2) order them into a numbered frame sequence
i=0
for s in $STYLES; do
  src="output/demo-$s.png"
  [ -f "$src" ] || { echo "missing render: $src" >&2; exit 1; }
  cp "$src" "$(printf '%s/frame-%02d.png' "$FRAMES_DIR" "$i")"
  i=$((i + 1))
done
[ "$i" -ge 2 ] || { echo "need >= 2 frames for a GIF (got $i)" >&2; exit 1; }

# 3) two-pass palette for a clean GIF
fps=$(awk "BEGIN{printf \"%.4f\", 1/$SECS}")
pal=$(mktemp -t hero-pal-XXXX).png
ffmpeg -y -framerate "$fps" -i "$FRAMES_DIR/frame-%02d.png" \
  -vf "scale=${WIDTH}:-1:flags=lanczos,palettegen=stats_mode=full" "$pal" >/dev/null 2>&1
ffmpeg -y -framerate "$fps" -i "$FRAMES_DIR/frame-%02d.png" -i "$pal" \
  -lavfi "scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$OUT" >/dev/null 2>&1
rm -f "$pal"

bytes=$(wc -c < "$OUT" | tr -d ' ')
echo "✓ wrote $OUT  ($i frames · ${SECS}s each · ${WIDTH}px · $((bytes / 1024)) KB)"

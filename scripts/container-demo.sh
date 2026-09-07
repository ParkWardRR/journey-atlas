#!/usr/bin/env bash
# Runs INSIDE a Node + Chromium container (e.g. the Playwright image) to produce
# the animated hero GIF from a clean checkout — the containerised demo of the tool.
#
#   docker run --rm -v "$PWD":/work -w /work -e JA_NO_SANDBOX=1 \
#     mcr.microsoft.com/playwright:v1.63.0-jammy bash scripts/container-demo.sh
#
# Expects the trip source + .env (optional Stadia key) present in the mount.

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# Use IPv4 explicitly: Node's fetch resolves "localhost" to ::1 first, but Vite
# binds 127.0.0.1 — the mismatch makes the reachability probe time out.
export URL="${URL:-http://127.0.0.1:5173}"

echo "▸ node $(node -v) · $(npm -v)"
echo "▸ installing ffmpeg…"
apt-get update -qq >/dev/null && apt-get install -y -qq ffmpeg >/dev/null
echo "▸ npm ci…"
npm ci --no-audit --no-fund >/dev/null
echo "▸ building example trip…"
node scripts/build-trip.mjs trips/adriatic-crossing.yaml
echo "▸ rendering basemaps + stitching GIF…"
OUT="${OUT:-output/hero-demo.gif}" STYLES="${STYLES:-stamen watercolor natgeo opentopo ocean}" \
  bash scripts/make-hero-gif.sh

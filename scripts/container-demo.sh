#!/usr/bin/env bash
# Runs INSIDE a Chromium container (e.g. the Playwright image) to produce the
# animated hero GIF from a clean checkout — the containerised demo of the tool.
# Deno is fetched on the fly, so the image only needs to ship the browser.
#
#   docker run --rm -v "$PWD":/work -w /work -e JA_NO_SANDBOX=1 \
#     mcr.microsoft.com/playwright:v1.63.0-jammy bash scripts/container-demo.sh
#
# Expects the trip source + .env (optional Stadia key) present in the mount.

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# Use IPv4 explicitly: fetch resolves "localhost" to ::1 first, but Vite binds
# 127.0.0.1 — the mismatch makes the reachability probe time out.
export URL="${URL:-http://127.0.0.1:5173}"

echo "▸ installing ffmpeg + Deno…"
apt-get update -qq >/dev/null && apt-get install -y -qq ffmpeg unzip >/dev/null
export DENO_INSTALL="/root/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
command -v deno >/dev/null || curl -fsSL https://deno.land/install.sh | sh -s v2.x >/dev/null
echo "▸ deno $(deno --version | head -1)"
echo "▸ deno install…"
deno install >/dev/null
echo "▸ building example trip…"
deno task build:trip trips/adriatic-crossing.yaml
echo "▸ rendering basemaps + stitching GIF…"
OUT="${OUT:-output/hero-demo.gif}" STYLES="${STYLES:-stamen watercolor natgeo opentopo ocean}" \
  bash scripts/make-hero-gif.sh

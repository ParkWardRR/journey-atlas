#!/usr/bin/env bash
# CI/CD for journey-atlas — runs on the Mac mini via OrbStack, never on
# GitHub-hosted runners. Builds the reproducible ci/Dockerfile image once and
# runs the pipeline inside it against the checked-out tree (bind-mounted).
#
#   ci/orb-ci.sh check   # deno lint + unit tests + static build + Go byte-parity
#   ci/orb-ci.sh gif     # regenerate docs/hero-demo.gif (Zig verify + render)
#   ci/orb-ci.sh all     # check, then gif   (default)
#
# Requires OrbStack (its `docker`) on PATH. Everything else lives in the image.
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE="${1:-all}"
IMAGE="${IMAGE:-journey-atlas-ci}"

# OrbStack puts `docker` on the login-shell PATH (~/.orbstack/bin). A launchd
# self-hosted runner runs non-login, so add it explicitly.
export PATH="$HOME/.orbstack/bin:$PATH"
command -v docker >/dev/null || { echo "docker (OrbStack) not found on PATH" >&2; exit 1; }

echo "▸ building $IMAGE via OrbStack…"
docker build -q -t "$IMAGE" ci/ >/dev/null

# run a script inside the image with the working tree mounted at /work
run() { docker run --rm -v "$PWD":/work -w /work "$IMAGE" bash -lc "$1"; }

check() {
  echo "▸ check — lint · tests · build · native byte-parity (Go + Zig)"
  run '
    set -euo pipefail
    deno install
    deno lint
    deno task test
    deno task build
    ( cd cli-go && go build -o journey-atlas . )
    ( cd cli-zig && zig build )
    GO=./cli-go/journey-atlas
    ZIG=./cli-zig/zig-out/bin/journey-atlas-verify
    fail=0

    # build parity: Go `build` must be byte-identical to the Deno build for every trip
    shopt -s nullglob
    for f in trips/*.yaml trips/*.json; do
      deno task build:trip "$f" >/dev/null
      cp src/lib/journey.json /tmp/n.json
      $GO build --out /tmp/g.json "$f" >/dev/null
      diff -q /tmp/n.json /tmp/g.json >/dev/null || { echo "✗ build parity: $f"; fail=1; }
      $GO validate "$f" >/dev/null
    done
    deno task build:trip trips/adriatic-crossing.yaml >/dev/null   # restore default journey.json

    # native-CLI parity: verify-gps / correlate / gpx must match the Deno scripts byte-for-byte.
    # (correlate exits 1 when a POI is NO-GPS, so guard the captures under `set -e`.)
    d() { diff <(eval "$1") <(eval "$2") >/dev/null || { echo "✗ $3 parity"; fail=1; }; }
    d "deno task verify-gps data/example-gps.csv 2>/dev/null" "$GO verify-gps data/example-gps.csv 2>/dev/null" "Go verify-gps"
    d "$ZIG data/example-gps.csv 2>/dev/null"                 "$GO verify-gps data/example-gps.csv 2>/dev/null" "Zig verify-gps"
    d "deno task correlate data/example-gps.csv data/example-track.gpx 2>/dev/null || true" \
      "$GO correlate data/example-gps.csv data/example-track.gpx 2>/dev/null || true" "Go correlate"
    d "deno task gpx data/example-track.gpx 2>/dev/null"        "$GO gpx data/example-track.gpx 2>/dev/null"        "Go gpx (YAML)"
    d "deno task gpx data/example-track.gpx --json 2>/dev/null" "$GO gpx data/example-track.gpx --json 2>/dev/null" "Go gpx (JSON)"

    [ "$fail" = 0 ] && echo "✓ check passed (lint, tests, static build, Go + Zig byte-parity)"
    exit "$fail"
  '
}

gif() {
  echo "▸ gif — regenerate docs/hero-demo.gif (simulation: Zig verify + Playwright render + ffmpeg)"
  run '
    set -euo pipefail
    deno install
    deno run -A scripts/make-demo-gif.mjs
  '
  echo "✓ docs/hero-demo.gif updated"
}

case "$STAGE" in
  check) check ;;
  gif)   gif ;;
  all)   check; gif ;;
  *) echo "usage: ci/orb-ci.sh [check|gif|all]" >&2; exit 1 ;;
esac

#!/usr/bin/env bash
# One-time: register this Mac (the mini) as a self-hosted GitHub Actions runner
# for journey-atlas, labelled `orbstack`, and install it as a launchd service so
# the CI workflow runs here — never on GitHub-hosted runners.
#
#   # on a box with `gh` + repo admin (e.g. your laptop):
#   RUNNER_TOKEN=$(gh api -X POST repos/ParkWardRR/journey-atlas/actions/runners/registration-token --jq .token)
#   # then, on the mini:
#   REPO=ParkWardRR/journey-atlas RUNNER_TOKEN=<token> ci/setup-self-hosted-runner.sh
#
# SECURITY: journey-atlas is a PUBLIC repo. Self-hosted runners must not execute
# untrusted fork pull requests, so the workflow triggers on push / manual only.
# Keep it that way, and only register this on a machine you're happy to run
# repo code on.
set -euo pipefail

REPO="${REPO:-ParkWardRR/journey-atlas}"
LABELS="${LABELS:-self-hosted,macos,orbstack}"
DIR="${DIR:-$HOME/actions-runner}"
VER="${RUNNER_VERSION:-2.319.1}"

arch=arm64; [ "$(uname -m)" = x86_64 ] && arch=x64

# Prefer an explicit RUNNER_TOKEN; fall back to `gh` if it's installed here.
if [ -z "${RUNNER_TOKEN:-}" ]; then
  command -v gh >/dev/null || { echo "set RUNNER_TOKEN=… (no gh on this box to mint one)" >&2; exit 1; }
  RUNNER_TOKEN="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"
fi

mkdir -p "$DIR"; cd "$DIR"
if [ ! -x ./config.sh ]; then
  echo "▸ downloading runner v${VER} (osx-${arch})…"
  curl -fsSL -o runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${VER}/actions-runner-osx-${arch}-${VER}.tar.gz"
  tar xzf runner.tar.gz && rm runner.tar.gz
fi

echo "▸ registering with ${REPO} (labels: ${LABELS})…"
./config.sh --unattended --url "https://github.com/${REPO}" --token "$RUNNER_TOKEN" \
  --name "$(hostname -s)-orbstack" --labels "$LABELS" --replace

echo "▸ installing + starting the launchd service…"
./svc.sh install
./svc.sh start
./svc.sh status || true
echo "✓ self-hosted runner online — CI now runs here via OrbStack"

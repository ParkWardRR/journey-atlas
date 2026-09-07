# Reproducible CI/CD image for journey-atlas, run via OrbStack on the Mac mini —
# nothing runs on GitHub-hosted runners. It carries the whole toolchain the
# pipeline needs in one place:
#   • Deno 2      — the script pipeline + the Vite/SvelteKit static build
#   • Go 1.24     — the native CLI and its byte-parity check
#   • Zig 0.16    — the native verify-gps used by the hero walkthrough
#   • Chromium    — Playwright poster render (from the base image)
#   • ffmpeg      — stitching the hero GIF
FROM mcr.microsoft.com/playwright:v1.63.0-jammy

ARG DENO_VERSION=v2.9.6
ARG GO_VERSION=1.24.0
ARG ZIG_VERSION=0.16.0

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ffmpeg curl ca-certificates xz-utils unzip git \
 && rm -rf /var/lib/apt/lists/*

# Deno (into /usr/local so it's on PATH for every shell)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s ${DENO_VERSION}

# Go + Zig, arch-aware (arm64 on the mini; x86_64 elsewhere)
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      arm64) go_a=arm64; zig_a=aarch64;; \
      amd64) go_a=amd64; zig_a=x86_64;; \
      *) echo "unsupported arch: $arch" >&2; exit 1;; \
    esac; \
    curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${go_a}.tar.gz" | tar -xz -C /usr/local; \
    curl -fsSL "https://ziglang.org/download/${ZIG_VERSION}/zig-${zig_a}-linux-${ZIG_VERSION}.tar.xz" | tar -xJ -C /opt; \
    ln -s "/opt/zig-${zig_a}-linux-${ZIG_VERSION}/zig" /usr/local/bin/zig
ENV PATH=/usr/local/go/bin:${PATH}

# Headless Chromium must drop the sandbox inside a container; the render scripts
# opt in when this is set. Loopback is pinned to IPv4 to match Vite's bind.
ENV JA_NO_SANDBOX=1 \
    URL=http://127.0.0.1:5173

WORKDIR /work

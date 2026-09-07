# 🗺️ journey-atlas — Roadmap

A living plan for where `journey-atlas` is headed. Nothing here is a promise — it's a
direction, and every item is grounded in the code as it stands today. PRs that pull items
forward are welcome; grab one and open an issue to claim it.

**Status:** ✅ shipped · 🚧 in progress · 🔭 planned · 💡 idea
**Guiding constraints (see [Non-goals](#non-goals-)):** static, keyless-first, no tracking, data-driven.

---

## Shipped ✅

**Core pipeline**
- **YAML/JSON → validated → poster PNG.** `build-trip.mjs` compiles a trip against
  [`schema/journey.schema.json`](schema/journey.schema.json) into `src/lib/journey.json`;
  `render.mjs` drives headless Chromium and screenshots the fixed 1600×1200 `#journey-card`.
- **15 basemaps, 4 road palettes,** with graceful Stadia-key fallback to keyless look-alikes.
- **Native CLIs**, each **byte-for-byte identical** to the Deno script it mirrors:
  [`cli-go/`](cli-go/) (**Go**) does `validate` · `doctor` · `build`; [`cli-zig/`](cli-zig/)
  (**Zig 0.16**) does `verify-gps`. Zero-dependency companions for the browser-free commands.
- **Deno 2 toolchain.** The whole script pipeline runs on **Deno 2** — tasks in `deno.json`
  with **least-privilege permissions**, built-in `deno lint`, one `deno.lock`, and no Node/npm
  install step (npm deps are resolved on demand).
- **Self-hosted CI/CD on a Mac mini, via OrbStack.** No GitHub-hosted runners: a self-hosted
  runner on the mini hands the whole pipeline to a reproducible OrbStack container
  (`ci/Dockerfile` — Deno + Go + Zig + Chromium + ffmpeg). `ci/orb-ci.sh check` runs
  lint + tests + build + Go byte-parity; `ci/orb-ci.sh gif` re-renders the hero GIF in the
  same container (`ci/setup-self-hosted-runner.sh` registers the runner).
- **Unit tests** (`deno task test`) — the shared great-circle/polyline maths (`scripts/lib/geo.mjs`,
  deduped from four scripts) and the schema compile/validate helpers, covered by `deno test`
  and gated in CI.

**Rendering & authoring tooling**
- **Multi-trip render, no collisions** — `deno task render:all` builds + renders every `trips/*.yaml`
  to `output/samples/` with per-trip names; single `render` now **starts/stops Vite itself**
  (no second terminal) and takes `--out`.
- **Trip-doctor** (`deno task doctor`) — plausibility lint beyond schema: coordinate ranges,
  likely-swapped lat/lon, `totalMiles` vs summed `roadStats`, drive classes vs legend,
  degenerate ferries, insets off the 1600×1200 canvas.
- **CI on every push** — the self-hosted OrbStack job schema-validates every trip, runs the
  doctor and unit tests, builds the static site, and diffs the Go CLI's `build` output against
  the Deno build for byte-parity.

**Map features**
- **POI categories** (`poiKinds` + `pois[].kind`) — tagged sights get a coloured/emoji marker
  and a caption line.
- **Auto-declutter** — a POI shown inside a blow-up inset is not redrawn on the main map.
- **Wide two-column distance legend.**
- **Elevation profiles** — `fetch-elevation.mjs` (keyless Open-Meteo) → `elevation[]`; an
  interactive area chart (peak, climb, crosshair tooltip) on `/trip`.

**Import & data helpers**
- **GPX / KML import** (`deno task gpx`) — a recorded track → paste-ready `drives[]` fragment.
- **Real weather** (`fetch-weather.mjs`) and **GPS truth-check** (`verify-gps.mjs`).
- **POI correlation** (`deno task correlate`) — pool a corpus of GPX/KML/CSV tracks and
  find the nearest recorded point for every POI (which file, distance, OK/~near/NO-GPS),
  with a per-file breakdown. Shares the track readers with `verify-gps`/`gpx-import`
  (`scripts/lib/tracks.mjs`) and is covered by `deno test`.

**Web experience**
- **Interactive `/trip`** — big Leaflet map, itinerary, sights, ferries, weather grid, road
  breakdown, elevation chart.
- **`/gallery`** — a themed card grid of every trip with rendered thumbnails.
- **Four curated themes** (Daylight · Night · Vintage · Minimal), persisted, system-aware,
  **no theme flash** (pre-paint), with keyless-Stadia labelling in the basemap picker.
- **Static build** — `deno task build` prerenders `/`, `/trip` and `/gallery` via `adapter-static`.

---

## Near-term 🔭 — natural next steps

- **Elevation on the poster too.** The profile is `/trip`-only today; add it to the 1600×1200
  poster (a corner sparkline or a slim strip under the legend).
- **Deep-linkable + exportable web UI.** `?theme=&style=&roads=` URL state and a "Download
  poster PNG" button that reuses the render path.
- **Weather, wired in.** Let `build-trip` optionally call `fetch-weather` and populate
  `weather[]` from `stays[]` dates + coordinates automatically (same pattern as elevation).
- **Round out the native CLIs.** The Go binary still lacks `verify-gps` (now in Zig) and neither
  covers `gpx-import`/`correlate`; port the remaining pure scripts so a single native toolchain
  matches the Deno pipeline end-to-end.
- **Zig parity in the OrbStack CI.** `ci/orb-ci.sh check` already covers Go byte-parity; add a
  step that builds the Zig binary and diffs `verify-gps` output against the Deno script too.
- **Auto-commit the regenerated hero.** Wire `ci/orb-ci.sh gif` into a `workflow_dispatch` (or
  a `[gif]`-tagged push) that opens a PR / pushes the refreshed `docs/hero-demo.gif` — the
  render already runs in the container, so this is just plumbing + an image-layer cache.
- **Accessibility pass.** Keyboard-navigable map controls, focus states, alt text,
  reduced-motion, and a WCAG-AA contrast check across all four themes.

## Mid-term 🔭 — less hand-authoring

The biggest remaining authoring cost is hand-typing `drives[].segs[].line[]` coordinate lists.

- **Auto-routing + road classification.** Optional script to snap stop-to-stop legs to real
  roads and infer `cls` (motorway/a/b/minor) instead of drawing polylines by hand.
- **Units & i18n.** mi/km and °C/°F toggles; localizable UI strings.
- **Elevation-aware extras.** Per-leg climb/descent, steepest-grade callouts.

## Long-term 💡 — bigger bets

- **In-browser trip editor.** Edit the YAML live with schema-backed autocomplete and a
  map-click coordinate picker (kills the hardest part of authoring); download the result.
- **Print/PDF keepsake booklet.** Multi-page export — cover, per-day spreads, photo slots —
  beyond the single poster.
- **Geotagged-photo integration.** Drop photos on the map; auto-place as POIs from EXIF GPS.
- **Pluggable basemaps.** A tile-provider registry so a new basemap is config, not a code edit.

---

## Non-goals 🚫

- **No accounts, servers, tracking, or telemetry** — it stays a static, run-it-yourself tool.
- **No bundled paid keys** — keyless-first, with graceful fallbacks when a key is absent.
- **No lock-in** — plain YAML/JSON in, plain PNG/HTML out; every input is human-readable.

---

_Have an idea or want to own an item? Open an issue or a PR — small, focused PRs preferred._

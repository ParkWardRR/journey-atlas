# 🗺️ journey-atlas — Roadmap

A living plan for where `journey-atlas` is headed. Nothing here is a promise — it's a
direction, and every item is grounded in the code as it stands today. PRs that pull items
forward are welcome; grab one and open an issue to claim it.

**Status:** ✅ shipped · 🚧 in progress · 🔭 planned · 💡 idea
**Guiding constraints (see [Non-goals](#non-goals-)):** static, keyless-first, no tracking, data-driven.

---

## Where we are today ✅

- **YAML/JSON → validated → poster PNG.** `build-trip.mjs` compiles a trip against
  [`schema/journey.schema.json`](schema/journey.schema.json) into `src/lib/journey.json`;
  `render.mjs` drives headless Chromium and screenshots the fixed 1600×1200 `#journey-card`.
- **15 basemaps, 4 road palettes,** with graceful Stadia-key fallback to keyless look-alikes.
- **Helper scripts:** `fetch-weather.mjs` (Open-Meteo archive), `verify-gps.mjs` (CSV track truth-check).
- **11 starter trips** in [`trips/`](trips/), each rendered into the README gallery.
- **Interactive `/trip` web UI + 4 themes + static build** — landing via PR #1 (Daylight ·
  Night · Vintage · Minimal, persisted, system light/dark aware).

---

## Near-term 🔭 — remove the sharp edges

These target friction that exists *right now* in the pipeline.

- **Multi-trip build & render, no collisions.** Today `build-trip.mjs` always writes the one
  `src/lib/journey.json` and `render.mjs` always writes `output/journey-<style>.png`, so
  rendering the whole `trips/` folder means a manual build→render→rename loop (we hit exactly
  this producing the README gallery). Add `render.mjs --trip <file> --out <name>` and a
  `render:all` that walks `trips/*.yaml` and names outputs per-trip automatically.
- **One-command render.** `render.mjs` requires the dev server already running in another
  terminal. Have it spawn/`await` a `vite preview` (or a static server on `build/`) itself, so
  `npm run render` works from a clean checkout with no second terminal.
- **CI on every PR.** There is no `.github/` yet. Add a GitHub Action that (a) validates every
  `trips/*.yaml` against the schema, (b) runs `npm run build`, and (c) optionally renders one
  trip headless as a smoke test. Fail the PR on a bad coordinate or schema drift.
- **A schema-lint / trip-doctor script.** Beyond raw JSON-Schema validation, warn on
  *plausible-but-wrong* data: stays/POIs in the sea, ferry endpoints on land, `totalMiles`
  far from the summed `roadStats`, insets whose pixel circle falls off the 1600×1200 canvas.
- **Multi-trip gallery / index page.** Build every file in `trips/` into a static index that
  lists all journeys with thumbnails, linking to each `/trip` page.

## Mid-term 🔭 — less hand-authoring

The biggest authoring cost is hand-typing `drives[].segs[].line[]` coordinate lists.

- **GPX / KML import.** `verify-gps.mjs` already reads a CSV track; extend the family to turn a
  recorded GPX/KML directly into `drives[]` (with `verify-gps` confirming stays/POIs were real).
- **Auto-routing + road classification.** Optional script to snap stop-to-stop legs to real
  roads and infer `cls` (motorway/a/b/minor) instead of drawing polylines by hand.
- **Weather, wired in.** `fetch-weather.mjs` prints a paste-ready array today; let `build-trip`
  optionally call it and populate `weather[]` from `stays[]` dates + coordinates automatically.
- **Deep-linkable + exportable web UI.** `?theme=&style=&roads=` URL state and a "Download
  poster PNG" button that reuses the existing render path.
- **Accessibility pass.** Keyboard-navigable map controls, focus states, alt text,
  reduced-motion, and a WCAG-AA contrast check across all four themes.
- **Units & i18n.** mi/km and °C/°F toggles; localizable UI strings.

## Long-term 💡 — bigger bets

- **In-browser trip editor.** Edit the YAML live with schema-backed autocomplete and a
  map-click coordinate picker (kills the hardest part of authoring); download the result.
- **Print/PDF keepsake booklet.** Multi-page export — cover, per-day spreads, photo slots —
  beyond the single poster.
- **Geotagged-photo integration.** Drop photos on the map; auto-place as POIs from EXIF GPS.
- **Pluggable basemaps.** A tile-provider registry so a new basemap is config, not a code edit.
- **Elevation profile** section under the map for drives with elevation data.

---

## Non-goals 🚫

- **No accounts, servers, tracking, or telemetry** — it stays a static, run-it-yourself tool.
- **No bundled paid keys** — keyless-first, with graceful fallbacks when a key is absent.
- **No lock-in** — plain YAML/JSON in, plain PNG/HTML out; every input is human-readable.

---

_Have an idea or want to own an item? Open an issue or a PR — small, focused PRs preferred._

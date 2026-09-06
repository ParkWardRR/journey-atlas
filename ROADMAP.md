# 🗺️ journey-atlas — Roadmap

A living plan for where `journey-atlas` is headed. Nothing here is a promise; it's a
direction. PRs that pull items forward are welcome.

Status legend: ✅ done · 🚧 in progress · 🔭 planned · 💡 idea

---

## Recently shipped ✅

- **Interactive web UI** at `/trip` — responsive, browsable page (big interactive map,
  itinerary timeline, sights, ferries, weather grid, road-class breakdown).
- **Curated themes** — Daylight · Night · Vintage · Minimal, persisted to `localStorage`,
  system light/dark aware, each with a default basemap + road palette (overridable).
- **Static site build** — `npm run build` prerenders `/` (poster) **and** `/trip` via
  `@sveltejs/adapter-static`; hosts as plain files.
- YAML trip framework + JSON Schema, Stadia-key fallback, print-ready 1600×1200 PNG poster.

## Near-term 🔭

- **Multi-trip gallery** — build every file in `trips/` into an index page + one static
  page per trip; landing page lists all journeys with thumbnails.
- **Share/export from the web UI** — "Download poster PNG" button that reuses the render
  pipeline; deep-linkable `?theme=&style=&roads=` URL state.
- **CI** — GitHub Action to validate every `trips/*.yaml` against the schema and run the
  static build on each PR.
- **Accessibility pass** — keyboard-navigable map controls, focus states, alt text,
  reduced-motion honoring, WCAG-AA contrast check across all four themes.

## Mid-term 🔭

- **GPX / KML import** — turn a recorded track directly into `drives[]` (pairs with the
  existing `verify-gps.mjs`).
- **Auto-routing helper** — optional script to snap stop-to-stop legs to real roads and
  classify them (motorway/a/b/minor) instead of hand-drawing `line[]`.
- **Elevation profile** — a small elevation chart section under the map.
- **More themes + custom theme** — user-defined palette/font via a theme editor; export as
  a shareable theme token file.
- **i18n** — localizable UI strings and unit toggles (mi/km, °C/°F).

## Long-term 💡

- **In-browser trip editor** — edit `journey.yaml` live with schema-backed autocomplete and
  a map-click coordinate picker; download the result.
- **Print/PDF booklet** — multi-page keepsake (cover, per-day spreads, photo slots).
- **Photo integration** — drop geotagged photos onto the map as POIs automatically.
- **Basemap plugins** — pluggable tile-provider registry so new basemaps are config, not code.

## Non-goals 🚫

- No accounts, servers, tracking, or telemetry — it stays a static, run-it-yourself tool.
- No bundling of paid API keys; keyless-first with graceful fallbacks.

---

_Have an idea or want to own an item? Open an issue or a PR._

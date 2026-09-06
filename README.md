<h1 align="center">🗺️ journey-atlas</h1>

<p align="center">
  <em>Turn one JSON file into a print-ready keepsake map of a road trip —<br>
  driving route, ferries, overnight stays, sights, weather and zoomed-in blow-ups —<br>
  rendered over any of 15 beautiful basemaps.</em>
</p>

<p align="center">
  <a href="./LICENSE.md"><img alt="License: Blue Oak 1.0.0" src="https://img.shields.io/badge/license-Blue%20Oak%201.0.0-2563eb"></a>
  <img alt="SvelteKit" src="https://img.shields.io/badge/SvelteKit-5-ff3e00?logo=svelte&logoColor=white">
  <img alt="Leaflet" src="https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white">
  <img alt="Playwright" src="https://img.shields.io/badge/render-Playwright-2ead33?logo=playwright&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white">
  <br>
  <img alt="Basemaps" src="https://img.shields.io/badge/basemaps-15-4b3ba6">
  <img alt="Output" src="https://img.shields.io/badge/output-1600×1200%20PNG-e8a01e">
  <img alt="API key" src="https://img.shields.io/badge/API%20key-optional-1f9a5f">
  <img alt="Dependencies" src="https://img.shields.io/badge/runtime%20deps-just%20Leaflet-0e9488">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen">
  <br>
  <img alt="Stars" src="https://img.shields.io/github/stars/ParkWardRR/journey-atlas?style=social">
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/ParkWardRR/journey-atlas">
  <img alt="Issues" src="https://img.shields.io/github/issues/ParkWardRR/journey-atlas">
  <img alt="Repo size" src="https://img.shields.io/github/repo-size/ParkWardRR/journey-atlas">
  <img alt="Made with" src="https://img.shields.io/badge/made%20with-☕%20%2B%20🗺️-fef3c7">
</p>

<p align="center"><img src="docs/hero-watercolor.png" alt="Adriatic Crossing — Stamen Watercolor" width="100%"></p>

---

## What is this?

`journey-atlas` renders a single, poster-quality **road-trip map** (1600×1200 PNG) from a plain
`journey.json`. You describe *where you drove, sailed, slept and stopped* — it draws:

- 🛣️ the **driving route**, coloured and sized by road class (motorway → single-track)
- ⛴️ **ferry crossings** as dashed sea-legs, numbered and listed in a table
- 🛏️ **overnight stays** as numbered pins with a hotel badge (+ the hotel name in blow-ups)
- 📍 **sights / POIs** that auto-label only where they fit (no clutter)
- 🔍 **magnified blow-up insets** for fiddly island/city detail, with a numbered key
- 🌦️ a **daily weather** table (fetch real history from [Open-Meteo](https://open-meteo.com/))
- ✍️ an optional **hand-note callout** and an **"onward journey"** tag that arcs off the edge
- 🧭 direction-of-travel chevrons, a distance legend, and a tiny basemap credit

Everything is data-driven. Swap the JSON, get a different trip. Swap `?style=`, get a different look.

> The example in this repo is a **fictional** *Italy → Albania (by ferry) → Sofia* route —
> handy for seeing every feature at once.

## Gallery

| Stamen Watercolor | OpenTopoMap |
|---|---|
| ![watercolor](docs/hero-watercolor.png) | ![opentopo](docs/hero-opentopo.png) |
| **Esri Ocean** | **Stamen Terrain** |
| ![ocean](docs/hero-ocean.png) | ![stamen](docs/hero-stamen.png) |

## Quick start

```bash
git clone https://github.com/ParkWardRR/journey-atlas
cd journey-atlas
npm install

# 1) preview live in the browser
npm run dev            # → http://localhost:5173/?style=opentopo&roads=signage&blowups=1

# 2) render PNGs (dev server must be running in another terminal)
npm run render                  # all keyless basemaps → output/
npm run render -- watercolor    # just one
```

Query params: `?style=<basemap>&roads=<palette>&blowups=1`.

## The data file — `src/lib/journey.json`

| key | what it is |
|---|---|
| `title`, `subtitle` | headline + one-liner under it |
| `totalMiles` | number shown in the distance legend |
| `drives[]` | `{ label, segs: [{ cls, line: [[lat,lon]…] }] }` — `cls` ∈ `motorway \| a \| b \| minor` |
| `ferries[]` | `{ num, short, vessel, size, dur, a:[lat,lon], b:[lat,lon] }` |
| `stays[]` | `{ area, hotel, lat, lon, dates }` — numbered pins in trip order |
| `pois[]` | `{ name, lat, lon }` — auto-labelled sights |
| `roadStats[]` | `{ cls, label, mi }` legend rows |
| `weather[]` | `{ d, icon, where, t }` (+ `weatherMonth`) |
| `insets[]` | blow-ups: `{ title, center:[lat,lon], zoom, cx, cy, r, poiKm, capMode? }` |
| `note` | optional callout: `{ anchor:[lat,lon], tip:[lat,lon], title, sub }` |
| `finale` | optional off-edge tag: `{ from:[lat,lon], dx, label }` |

`cx/cy/r` are pixel coordinates on the 1600×1200 canvas — where the blow-up circle sits.
`capMode: "vert"` tucks its caption vertically beside the bubble.

## Helper scripts

**Real historical weather** — no key, from the Open-Meteo archive:

```bash
node scripts/fetch-weather.mjs data/weather-input.json
# → prints a ready-to-paste `weather` array (real °C/°F + emoji per day/place)
```

**GPS truth-check** — make sure every stay/POI is a place you actually went, by
comparing against a GPS track (e.g. one pulled from your geotagged photos):

```bash
node scripts/verify-gps.mjs data/example-gps.csv
# stay   Bari                        0.00 km   OK
# poi    Rila Monastery            118.7  km   NO-GPS   ← drop it, you were never there
```

The CSV just needs `latitude` and `longitude` columns.

## Basemaps

`?style=` picks the tiles. All work with **no API key** except the four Stadia styles.

| Keyless | Needs a key (Stadia) |
|---|---|
| `topo` · `natgeo` · `imagery` · `street` · `terrain` · `gray` (Esri) | `watercolor` (Stamen Watercolor) |
| `ocean` (Esri Ocean) | `stamen` (Stamen Terrain) |
| `opentopo` (OpenTopoMap) | `outdoors` (Stadia Outdoors) |
| `osm` · `hot` · `cyclosm` (OpenStreetMap family) | `smooth` (Alidade Smooth) |

For the Stadia styles, grab a free key at [stadiamaps.com](https://stadiamaps.com/) and:

```bash
cp .env.example .env
# then set VITE_STADIA_API_KEY=your-key
```

Road-colour palettes via `?roads=`: `cobalt` (default) · `signage` · `berry` · `ember`.

## How it renders

The map is a normal SvelteKit page ([`src/routes/+page.svelte`](src/routes/+page.svelte)) that draws
onto a fixed 1600×1200 card with [Leaflet](https://leafletjs.com/). `scripts/render.mjs` drives a
headless Chromium ([Playwright](https://playwright.dev/)), waits for tiles to settle
(`window.__mapReady`), and screenshots `#journey-card`. No servers, no accounts, no tracking.

## Credits

Basemap tiles © their providers (Esri, OpenStreetMap contributors, OpenTopoMap, CyclOSM, Stadia
Maps / Stamen Design). Weather from [Open-Meteo](https://open-meteo.com/). Built with
[SvelteKit](https://kit.svelte.dev/), [Leaflet](https://leafletjs.com/) and
[Playwright](https://playwright.dev/). Respect each tile provider's usage policy for anything beyond
personal renders.

## License

[Blue Oak Model License 1.0.0](./LICENSE.md) — permissive, plain-language, do-what-you-like.

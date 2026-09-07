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

<p align="center"><img src="docs/hero-stamen.png" alt="Adriatic Crossing — Stamen Terrain" width="100%"></p>
<p align="center"><sub>Above: the bundled fictional example on <b>Stamen Terrain</b> (a Stadia Maps basemap — <a href="#basemaps">free key, optional</a>).</sub></p>

---

## What is this?

`journey-atlas` renders a single, poster-quality **road-trip map** (1600×1200 PNG) from a plain
`journey.json`. You describe *where you drove, sailed, slept and stopped* — it draws:

- 🛣️ the **driving route**, coloured and sized by road class (motorway → single-track)
- ⛴️ **ferry crossings** as dashed sea-legs, numbered and listed in a table
- 🛏️ **overnight stays** as numbered pins with a hotel badge (+ the hotel name in blow-ups)
- 📍 **sights / POIs** that auto-label only where they fit — with optional **categories** (give a set of POIs their own colour + emoji marker)
- 🔍 **magnified blow-up insets** for fiddly island/city detail, with a numbered key; anything shown in a blow-up is **not repeated** on the main map (auto-declutter)
- 🌦️ a **daily weather** table (fetch real history from [Open-Meteo](https://open-meteo.com/))
- ✍️ an optional **hand-note callout** and an **"onward journey"** tag that arcs off the edge
- 🧭 direction-of-travel chevrons, a distance legend, and a tiny basemap credit

Everything is data-driven. Swap the JSON, get a different trip. Swap `?style=`, get a different look.

> The example in this repo is a **fictional** *Italy → Albania (by ferry) → Sofia* route —
> handy for seeing every feature at once.

## Gallery — same trip, four basemaps

| Stamen Terrain _(Stadia)_ | Stamen Watercolor _(Stadia)_ |
|---|---|
| ![stamen](docs/hero-stamen.png) | ![watercolor](docs/hero-watercolor.png) |
| **OpenTopoMap** _(keyless)_ | **Esri Ocean** _(keyless)_ |
| ![opentopo](docs/hero-opentopo.png) | ![ocean](docs/hero-ocean.png) |

## Quick start

```bash
git clone https://github.com/ParkWardRR/journey-atlas
cd journey-atlas
npm install

# 1) preview live in the browser
npm run dev
#   http://localhost:5173/         the print poster (what render screenshots)
#   http://localhost:5173/trip     the interactive, themed web UI

# 2) render PNGs — no second terminal: if nothing is serving the app,
#    render starts (and stops) Vite for you.
npm run render                  # all keyless basemaps → output/
npm run render -- watercolor    # just one
npm run render:all              # build + render EVERY trips/*.yaml → output/samples/
```

Poster query params: `?style=<basemap>&roads=<palette>&blowups=1`.

## Interactive web UI & themes

`/trip` is a responsive, browsable page built from the same trip file: a big
**interactive map** (zoom / pan, clickable stay pins, sights and ferries) followed by an
itinerary timeline, sights, ferry list, daily-weather grid and a distance-by-road breakdown.

| Daylight | Night |
|---|---|
| ![Daylight theme](docs/web-daylight.png) | ![Night theme](docs/web-night.png) |
| **Vintage** | **Minimal** |
| ![Vintage theme](docs/web-vintage.png) | ![Minimal theme](docs/web-minimal.png) |


Pick from four **curated themes** — **Daylight**, **Night**, **Vintage** and **Minimal** — in the
header. The choice is remembered (localStorage) and defaults to your system light/dark preference.
Each theme also sets a sensible default **basemap** and **road palette**, both overridable from the
dropdowns beside it (Night applies a dark-map tile filter over any basemap).

**`/gallery`** is the index of every route in [`trips/`](trips/) — a themed card grid with each
trip's rendered map thumbnail (the committed `docs/trips/*.png` from `npm run render:all`), its
distance and stay / ferry / sight counts, linking to the full-size map. `npm run build:index`
regenerates `src/lib/trips-index.json` (it also runs automatically before every build).

It's a static build — `npm run build` prerenders `/`, `/trip` **and** `/gallery` into `build/` with
`@sveltejs/adapter-static`, so the whole thing hosts as plain files with no server. Swap
`trips/*.yaml`, rebuild, and the poster, the trip page and the gallery all update from the same data.

## Authoring a trip

Trips live in [`trips/`](trips/) as **readable YAML** you (or an agent) fill in, in the order you'd
tell the story. A build step validates it against a **JSON Schema** and compiles it to the machine
file the map renders:

```bash
# edit trips/adriatic-crossing.yaml, then:
npm run build:trip -- trips/adriatic-crossing.yaml
#  → validates against schema/journey.schema.json
#  → writes src/lib/journey.json   (errors point at the exact bad field)
npm run dev        # see it
```

**Ten ready-to-tune starter routes** ship in [`trips/`](trips/) — each with real ferry crossings,
overnight bases, sights and a distance legend, ready to refine. The maps below were rendered
straight from those YAMLs on **Stamen Terrain** (`npm run build:trip -- trips/<file>` then
`npm run render -- stamen`):

### Starter routes gallery

| Norway — Kystriksveien | Scotland — Outer Hebrides |
|---|---|
| ![Norway Kystriksveien](docs/trips/01-norway-kystriksveien.png) | ![Scotland Outer Hebrides](docs/trips/02-scotland-outer-hebrides.png) |
| **New Zealand — Cook Strait** | **Iceland — Westfjords** |
| ![New Zealand grand drive](docs/trips/03-new-zealand-grand-drive.png) | ![Iceland Westfjords](docs/trips/04-iceland-westfjords.png) |
| **BC — Sunshine Coast & Island** | **Alaska — Prince William Sound** |
| ![BC Sunshine Coast](docs/trips/05-bc-sunshine-coast-island.png) | ![Alaska Prince William Sound](docs/trips/06-alaska-prince-william-sound.png) |
| **Tasmania — Island Loop** | **Croatia — Dalmatian Islands** |
| ![Tasmania island loop](docs/trips/07-tasmania-island-loop.png) | ![Croatia Dalmatian islands](docs/trips/08-croatia-dalmatian-islands.png) |
| **Greece — Ionian & Peloponnese** | **Patagonia — Tierra del Fuego** |
| ![Greece Ionian Peloponnese](docs/trips/09-greece-ionian-peloponnese.png) | ![Patagonia Tierra del Fuego](docs/trips/10-patagonia-tierra-del-fuego.png) |

| # | Route | Region | Ferry crossings |
|---|---|---|---|
| 01 | [Kystriksveien](trips/01-norway-kystriksveien.yaml) — Steinkjer → Bodø → Lofoten | Norway | 5 |
| 02 | [Outer Hebrides](trips/02-scotland-outer-hebrides.yaml) | Scotland | 4 |
| 03 | [Cook Strait Crossing](trips/03-new-zealand-grand-drive.yaml) — Wellington → Fiordland | New Zealand | 1 |
| 04 | [Westfjords](trips/04-iceland-westfjords.yaml) | Iceland | 1 |
| 05 | [Sunshine Coast & Island](trips/05-bc-sunshine-coast-island.yaml) | British Columbia | 4 |
| 06 | [Prince William Sound](trips/06-alaska-prince-william-sound.yaml) | Alaska | 2 |
| 07 | [Island Loop](trips/07-tasmania-island-loop.yaml) | Tasmania | 1 |
| 08 | [Dalmatian Loop](trips/08-croatia-dalmatian-islands.yaml) — Split → Dubrovnik | Croatia | 5 |
| 09 | [Ionian & Peloponnese](trips/09-greece-ionian-peloponnese.yaml) | Greece | 4 |
| 10 | [Tierra del Fuego](trips/10-patagonia-tierra-del-fuego.yaml) | Patagonia | 1 |

Prefer JSON? Point the same command at a `.json` file — it's accepted too. Both are validated by
[`schema/journey.schema.json`](schema/journey.schema.json), which also gives **live autocomplete +
inline docs** in VS Code (the example's `$schema` key wires it up automatically).

### The shape

| key | what it is |
|---|---|
| `title`, `subtitle` | headline + one-liner under it |
| `totalMiles` | number shown in the distance legend |
| `stays[]` | `{ area, hotel, lat, lon, dates }` — numbered pins, in trip order |
| `pois[]` | `{ name, lat, lon, kind? }` — auto-labelled sights; `kind` references `poiKinds` |
| `poiKinds` | optional categories: `{ swim: { color, emoji } }` — tagged POIs get that marker + a caption line |
| `ferries[]` | `{ num, short, vessel, size, dur, a:[lat,lon], b:[lat,lon] }` |
| `drives[]` | `{ label, segs:[{ cls, line:[[lat,lon]…] }] }` — `cls` ∈ `motorway \| a \| b \| minor` |
| `roadStats[]` | `{ cls, label, mi }` legend rows |
| `weather[]` | `{ d, icon, where, t }` (+ `weatherMonth`) — see the weather script below |
| `elevation[]` | `{ mi, m }` route elevation profile — see the elevation script below |
| `insets[]` | blow-ups: `{ title, center:[lat,lon], zoom, cx, cy, r, poiKm, capMode? }` |
| `note` | optional callout: `{ anchor:[lat,lon], tip:[lat,lon], title, sub }` |
| `finale` | optional off-edge tag: `{ from:[lat,lon], dx, label }` |

Every coordinate is `[latitude, longitude]`. For insets, `cx/cy/r` are **pixels** on the 1600×1200
canvas (place the circle over empty sea/space — a leader line links it back); `capMode: "vert"`
tucks the caption vertically beside the bubble.

### Let an agent draft it

The schema is small and self-describing, so an LLM can fill it from a plain itinerary. Try:

> Here is `schema/journey.schema.json` and my itinerary: *"Flew into Bari, overnight ferry to
> Durrës, then drove Tirana → Ohrid → Skopje → Sofia over a week…"*. Produce a
> `trips/my-trip.yaml` that validates against the schema. Use `[lat, lon]` coordinates, put
> overnight bases in `stays` in order, sights in `pois`, and add a couple of `insets` over
> empty sea. Don't invent places I didn't mention.

Then `npm run build:trip -- trips/my-trip.yaml && npm run dev`.

## Helper scripts

**Trip doctor** — plausibility lint beyond raw schema validation. Flags coordinates out of
range or clearly swapped, inset circles that fall off the 1600×1200 canvas, a `totalMiles`
that disagrees with the summed `roadStats`, drive road-classes missing from the legend, and
degenerate/absurd ferry legs. Exits non-zero on hard errors, so it doubles as a CI gate:

```bash
npm run doctor -- trips/*.yaml
# ✓ trips/01-norway-kystriksveien.yaml  — clean
# ⚠ trips/adriatic-crossing.yaml
#     warn   road class "b" is in the legend but never driven
```

**Real historical weather** — no key, from the Open-Meteo archive:

```bash
node scripts/fetch-weather.mjs data/weather-input.json
# → prints a ready-to-paste `weather` array (real °C/°F + emoji per day/place)
```

**Elevation profile** — real terrain along the route, no key, from the Open-Meteo
elevation API. It samples the `drives[]` polyline evenly, fetches each point's
elevation, and prints a paste-ready `elevation` array; the `/trip` page then draws an
interactive area chart (peak, total climb, crosshair tooltip) under the map:

```bash
npm run elevation -- trips/01-norway-kystriksveien.yaml   # → paste-ready elevation[]
npm run elevation -- my-trip.json --samples 60            # denser profile
```

**GPS truth-check** — make sure every stay/POI is a place you actually went, by
comparing against a GPS track (e.g. one pulled from your geotagged photos):

```bash
node scripts/verify-gps.mjs data/example-gps.csv
# stay   Bari                        0.00 km   OK
# poi    Rila Monastery            118.7  km   NO-GPS   ← drop it, you were never there
```

The CSV just needs `latitude` and `longitude` columns.

**GPX / KML import** — turn a recorded track into a paste-ready `drives[]` fragment instead of
hand-typing coordinate polylines. The track is simplified (Douglas–Peucker) to a sane number of
points, the length becomes `totalMiles`, and any waypoints become `pois[]`:

```bash
npm run gpx -- data/example-track.gpx --cls b       # → YAML fragment on stdout
npm run gpx -- track.kml --tol 120 --json           # coarser, as JSON
```

GPX carries no road class, so the whole leg gets one `--cls` (default `minor`) — split it into
`segs` by hand where the road actually changes. Paste the fragment into your trip, then
`npm run doctor` and `npm run build:trip`.

## Basemaps

`?style=` picks the tiles. All work with **no API key** except the four Stadia styles.

| Keyless | Needs a key (Stadia) |
|---|---|
| `topo` · `natgeo` · `imagery` · `street` · `terrain` · `gray` (Esri) | `watercolor` (Stamen Watercolor) |
| `ocean` (Esri Ocean) | `stamen` (Stamen Terrain) |
| `opentopo` (OpenTopoMap) | `outdoors` (Stadia Outdoors) |
| `osm` · `hot` · `cyclosm` (OpenStreetMap family) | `smooth` (Alidade Smooth) |

The four Stadia styles (including the **Stamen Terrain** hero above) need a **free, optional** key.
Fork the repo and it still renders with zero setup — request a Stadia style with no key and it
**gracefully falls back** to a keyless look-alike (e.g. `stamen`/`watercolor`/`outdoors` →
`opentopo`, `smooth` → `gray`) and logs a note. To get the real Stadia tiles, grab a free key at
[stadiamaps.com](https://stadiamaps.com/):

```bash
cp .env.example .env          # then set VITE_STADIA_API_KEY=your-key
```

The key is read from the environment only — it is **never committed** (`.env` is git-ignored).

Road-colour palettes via `?roads=`: `cobalt` (default) · `signage` · `berry` · `ember`.

## How it renders

The map is a normal SvelteKit page ([`src/routes/+page.svelte`](src/routes/+page.svelte)) that draws
onto a fixed 1600×1200 card with [Leaflet](https://leafletjs.com/). `scripts/render.mjs` drives a
headless Chromium ([Playwright](https://playwright.dev/)), waits for tiles to settle
(`window.__mapReady`), and screenshots `#journey-card` — starting and stopping its own Vite
server when one isn't already running. No accounts, no tracking.

## Credits

Basemap tiles © their providers (Esri, OpenStreetMap contributors, OpenTopoMap, CyclOSM, Stadia
Maps / Stamen Design). Weather from [Open-Meteo](https://open-meteo.com/). Built with
[SvelteKit](https://kit.svelte.dev/), [Leaflet](https://leafletjs.com/) and
[Playwright](https://playwright.dev/). Respect each tile provider's usage policy for anything beyond
personal renders.

## Where this is going

The bigger picture is a **files-in, map-out pipeline**: drop in geotagged photos, a GPX track and an
itinerary spreadsheet, and get the finished website + posters with no manual coordinate work. The
render half exists today; the input adapters are next — see **[ROADMAP.md](ROADMAP.md)**.

## License

[Blue Oak Model License 1.0.0](./LICENSE.md) — permissive, plain-language, do-what-you-like.

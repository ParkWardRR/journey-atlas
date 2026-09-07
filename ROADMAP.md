# Roadmap

The goal: **drop in the raw files a trip leaves behind — and get back a finished map.**
No manual coordinate-wrangling, no hand-drawn routes. Everything a journey scatters across your
devices becomes one validated `journey.json`, which renders to an interactive website and
print-ready PNGs over 15 basemaps.

## The pipeline

```
  geotagged photos (EXIF GPS + time) ┐
  GPX / KML tracks                   │
  itinerary spreadsheet (xlsx / csv) ├─▶  extract & normalise  ─▶  trips/*.yaml
  booking notes, plans, place lists  │        (per-file readers)      │  validate
  existing route / journey.json      ┘                                ▼
                                                            schema/journey.schema.json
                                                                     │  build-trip
                                                                     ▼
                                                              src/lib/journey.json
                                                                     │  render
                                                          ┌──────────┴───────────┐
                                                          ▼                      ▼
                                                    interactive site        PNG posters
                                                     (SvelteKit)          (15 basemaps)
```

Each stage is a **small, single-purpose script that reads one file type and emits the next
artifact.** Because every hand-off is a plain file (CSV → YAML → JSON → PNG), the whole chain runs
unattended and any stage can be swapped, re-run, or driven by tooling. Nothing needs a human in the
loop except deciding what looks good.

## Stages

| # | Stage | Reads | Emits | Status |
|---|-------|-------|-------|--------|
| 1 | **Photo-GPS extractor** | geotagged photos (EXIF `GPSLatitude`, `DateTimeOriginal`) | a GPS-points CSV (lat/lon/time) | planned |
| 2 | **GPX / KML importer** | `.gpx` / `.kml` tracks | route polylines → `drives[]` | planned |
| 3 | **Itinerary parser** | Excel / CSV / Numbers | `stays[]`, `pois[]`, dates, hotels | planned |
| 4 | **Weather fetch** | locations + dates | `weather[]` (real history, °C/°F, icons) | ✅ `scripts/fetch-weather.mjs` |
| 5 | **GPS truth-check** | `journey.json` + a GPS track | flags points you were never near | ✅ `scripts/verify-gps.mjs` |
| 6 | **Trip compiler** | `trips/*.yaml` (or `.json`) | validated `src/lib/journey.json` | ✅ `scripts/build-trip.mjs` + JSON Schema |
| 7 | **Renderer** | `journey.json` | website + PNGs | ✅ `scripts/render.mjs` |
| — | **Orchestrator** | a folder of raw trip files | the finished map, end to end | planned |

Stages 4–7 exist today; 1–3 and the orchestrator are next.

## Proven on a real trip

The renderer isn't a toy — it was built and hardened producing an actual 10-day keepsake map, which
drove these features (all in the current release):

- **Route by road class**, ferries as dashed sea-legs, numbered overnight stays with hotel badges,
  auto-labelled sights that only place where they fit
- **Magnified blow-up insets** with a numbered key, hotel names, and a leader line back to the spot
- **Declutter** — a point shown inside a blow-up is *not* repeated on the main map
- **POI categories** (`poiKinds`) — tag sights with a `kind` for their own coloured/emoji marker and
  a caption line (e.g. beaches, wineries, a themed trail)
- **Real daily weather** from the Open-Meteo archive, per day/location — with a manual override for
  when a coarse reanalysis grid undersells a city heatwave
- **GPS truth-check** so the map only shows places the photos prove you went
- Hand-note callouts, an "onward journey" tag that arcs off the edge, direction-of-travel chevrons,
  a wide two-column distance legend, 15 basemaps and 4 road palettes

## Next

- **Input adapters** (stages 1–3) so a trip can start from photos + a GPX + a spreadsheet instead of
  hand-authored YAML
- **Route snapping** — turn sparse GPS/photo points into road-following polylines
- **One-command orchestrator** — point it at a folder of raw files and get `journey.json` + renders
- **Inset auto-placement** — suggest blow-up circles over empty sea/space automatically
- **More categories & palettes**, and an optional printable multi-page atlas

Contributions to any stage welcome — each is an isolated script with a plain-file interface.

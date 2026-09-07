# journey-atlas (Go CLI) — prototype

A small, dependency-light **native** companion to the Deno scripts, for the parts of
the pipeline that are pure data-in / exit-code-out (no browser, no map render):

| command | mirrors | what it does |
|---|---|---|
| `journey-atlas validate <trip…>` | `scripts/build-trip.mjs` (validation half) | schema-validate each trip against `schema/journey.schema.json` |
| `journey-atlas doctor <trip…>` | `scripts/trip-doctor.mjs` | plausibility lint: coordinate ranges, likely-swapped lat/lon, `totalMiles` vs summed `roadStats`, drive classes vs legend, degenerate ferries, insets off the 1600×1200 canvas |
| `journey-atlas build <trip>` | `scripts/build-trip.mjs` | validate, then compile to `src/lib/journey.json` (`--out` to redirect) |
| `journey-atlas verify-gps <track.csv> [okKm]` | `scripts/verify-gps.mjs` | check every stay/POI in `src/lib/journey.json` against the nearest GPS point |
| `journey-atlas correlate [flags] <track…>` | `scripts/correlate-poi.mjs` | pool GPX/KML/CSV tracks and find the nearest recorded point per POI (`--trip`, `--km`, `--stays`, `--json`) |
| `journey-atlas gpx <track.gpx\|kml> [flags]` | `scripts/gpx-import.mjs` | recorded track → paste-ready `drives[]` fragment (`--cls`, `--tol`, `--json`) |
| `journey-atlas version` | — | print version |

All accept **YAML or JSON** trips (JSON is valid YAML, so one path handles both) and
exit **non-zero on any hard error** (warn-only is still `0`), so they drop straight into CI.

## Build & run

```bash
cd cli-go
go build -o journey-atlas .

# from the repo root so the default --schema path resolves:
./cli-go/journey-atlas validate trips/*.yaml
./cli-go/journey-atlas doctor   trips/*.yaml
./cli-go/journey-atlas build    trips/01-norway-kystriksveien.yaml   # → src/lib/journey.json
./cli-go/journey-atlas build --out /tmp/j.json trips/adriatic-crossing.yaml
```

```bash
# the GPS / import commands, from the repo root:
./cli-go/journey-atlas verify-gps data/example-gps.csv
./cli-go/journey-atlas correlate  data/example-gps.csv data/example-track.gpx
./cli-go/journey-atlas gpx        data/example-track.gpx --cls b
```

`build` and `doctor` flags come **before** the file (Go stdlib convention); the GPS
commands take positional args + `--flags` like their scripts. **Every** command is
**byte-for-byte identical** to the Deno script it mirrors — `build` (key order, `$schema`
first, no HTML escaping), `doctor`/`verify-gps`/`correlate` (UTF-16-aware column padding),
and `gpx` (2-space YAML with `[ lat, lon ]` flow pairs). The OrbStack CI diffs all of them.

## Status

Covers the whole pure, browser-free pipeline: `validate`, `doctor`, `build`, `verify-gps`,
`correlate`, and `gpx`. Only the browser/network scripts stay Deno-only (`render`,
`weather`/`elevation`). Dependencies:
[`santhosh-tekuri/jsonschema`](https://github.com/santhosh-tekuri/jsonschema) (draft 2020-12)
and `gopkg.in/yaml.v3`.

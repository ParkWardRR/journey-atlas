# journey-atlas (Go CLI) — prototype

A small, dependency-light **native** companion to the Node scripts, for the parts of
the pipeline that are pure data-in / exit-code-out (no browser, no map render):

| command | mirrors | what it does |
|---|---|---|
| `journey-atlas validate <trip…>` | `scripts/build-trip.mjs` (validation half) | schema-validate each trip against `schema/journey.schema.json` |
| `journey-atlas doctor <trip…>` | `scripts/trip-doctor.mjs` | plausibility lint: coordinate ranges, likely-swapped lat/lon, `totalMiles` vs summed `roadStats`, drive classes vs legend, degenerate ferries, insets off the 1600×1200 canvas |
| `journey-atlas version` | — | print version |

Both accept **YAML or JSON** trips (JSON is valid YAML, so one path handles both) and
exit **non-zero on any hard error** (warn-only is still `0`), so they drop straight into CI.

## Build & run

```bash
cd cli-go
go build -o journey-atlas .

# from the repo root so the default --schema path resolves:
./cli-go/journey-atlas validate trips/*.yaml
./cli-go/journey-atlas doctor   trips/*.yaml
./cli-go/journey-atlas --schema schema/journey.schema.json validate my-trip.json
```

Output matches the Node `trip-doctor` line-for-line, so you can swap either in.

## Status

**Prototype.** Covers `validate` + `doctor`. Not yet ported: `build` (writing
`src/lib/journey.json`), weather fetch, and GPX/KML import — those stay in Node for now.
Dependencies: [`santhosh-tekuri/jsonschema`](https://github.com/santhosh-tekuri/jsonschema)
(draft 2020-12) and `gopkg.in/yaml.v3`.

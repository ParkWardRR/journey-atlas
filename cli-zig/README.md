# journey-atlas (Zig CLI) — prototype

A tiny, **zero-dependency** native companion to the Node scripts, in the same spirit
as [`cli-go/`](../cli-go) — but for the *other* browser-free script the Go port
doesn't cover yet: the GPS sanity check.

| command | mirrors | what it does |
|---|---|---|
| `journey-atlas-verify <track.csv> [okKm]` | `scripts/verify-gps.mjs` | for every stay + POI in `src/lib/journey.json`, report the great-circle distance to the nearest point in a real GPS track (CSV with `latitude`/`longitude` columns) and an `OK` / `~near` / `NO-GPS` verdict |

Output is **byte-for-byte identical** to `scripts/verify-gps.mjs` on the same inputs
(same haversine constants, same `toFixed(2)` / `padEnd` / `padStart` column layout,
Unicode-aware padding so accented place names line up), and it exits `1` on a usage
or I/O error — so you can swap either implementation into CI.

## Build & run

Requires **Zig 0.16**. Written against the post-"Writergate" std: the new
`main(init: std.process.Init)` entrypoint, the `Io`-threaded file API, and the
`{f}` custom-formatter protocol.

```bash
cd cli-zig
zig build                       # → zig-out/bin/journey-atlas-verify
# or a one-off optimized binary:
zig build-exe src/main.zig -O ReleaseFast -femit-bin=journey-atlas-verify

# run from the repo root so the fixed src/lib/journey.json path resolves:
./cli-zig/zig-out/bin/journey-atlas-verify data/example-gps.csv
./cli-zig/zig-out/bin/journey-atlas-verify my-track.csv 1    # tighter "OK" threshold (km)

# or drive it through the build system:
zig build run -- data/example-gps.csv 3
```

The whole program allocates from the process arena (`init.arena`), which is freed in
one shot on exit — no manual frees, and the debug allocator reports no leaks.

## Status

**Prototype.** Covers `verify-gps`. Complements `cli-go/` (`validate`, `doctor`,
`build`); between the two, the only Node scripts still without a native port are the
ones that genuinely need a browser or the network: `render`/`render-all` (Playwright),
`fetch-weather`/`fetch-elevation` (HTTP), and `gpx-import` (XML).

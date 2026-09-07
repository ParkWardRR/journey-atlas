// Correlate a whole corpus of recorded GPS tracks against a trip's POIs: pool
// every point from every GPX / KML / CSV file, then for each POI report the
// nearest recorded point — how far, which file it came from, and an
// OK / ~near / NO-GPS verdict. The many-files, POI-centric companion to
// verify-gps (which checks one CSV against stays + POIs).
//
//   deno task correlate data/*.gpx data/*.csv
//   deno task correlate --trip trips/adriatic-crossing.yaml tracks/*.gpx
//   deno task correlate --km 2 --stays --json my-tracks/*.csv
//
//   --trip <file>   correlate a trip file's POIs (default: src/lib/journey.json)
//   --km <n>        "OK" distance threshold in km (default 3)
//   --stays         also correlate overnight stays, not just POIs
//   --json          emit a JSON array instead of the table
//
// Track waypoints (GPX <wpt>, KML Point Placemarks) are pooled alongside the
// track points, so a labelled photo location counts as a recorded position too.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { readTrip } from './lib/build.mjs';
import { nearestPoint, readTrack, verdict } from './lib/tracks.mjs';

// Parse flags in one pass; `--trip`/`--km` take a value, `--stays`/`--json` are
// booleans, and every remaining bare argument is a track file.
let tripFile = null, okKm = 3, withStays = false, asJson = false;
const files = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--trip') tripFile = argv[++i];
  else if (a === '--km') okKm = Number(argv[++i]);
  else if (a === '--stays') withStays = true;
  else if (a === '--json') asJson = true;
  else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(1); }
  else files.push(a);
}

if (!files.length) {
  console.error('usage: deno task correlate [--trip <file>] [--km 3] [--stays] [--json] <track.gpx|kml|csv> …');
  process.exit(1);
}

// ── reference POIs (+ optional stays) ────────────────────────────────────────
const trip = tripFile
  ? readTrip(tripFile)
  : JSON.parse(readFileSync(new URL('../src/lib/journey.json', import.meta.url), 'utf8'));

const targets = [
  ...(trip.pois || []).map((p) => ({ kind: 'poi', name: p.name, lat: p.lat, lon: p.lon })),
  ...(withStays ? (trip.stays || []).map((s) => ({ kind: 'stay', name: s.area, lat: s.lat, lon: s.lon })) : []),
];
if (!targets.length) {
  console.error(`✗ no ${withStays ? 'stays/POIs' : 'POIs'} found in ${tripFile || 'src/lib/journey.json'}`);
  process.exit(1);
}

// ── pool every recorded point across every file, tagged with its source ──────
const points = [];
const perFile = new Map();
for (const file of files) {
  const tag = basename(file);
  let n = 0;
  let parsed;
  try {
    parsed = readTrack(file);
  } catch (err) {
    console.error(`✗ ${tag}: ${err.message}`);
    process.exit(1);
  }
  for (const [lat, lon] of parsed.track) { points.push({ lat, lon, file: tag }); n++; }
  for (const w of parsed.pois) { points.push({ lat: w.lat, lon: w.lon, file: tag }); n++; }
  perFile.set(tag, { points: n, hits: 0 });
}
if (!points.length) {
  console.error(`✗ no usable GPS points across ${files.length} file(s)`);
  process.exit(1);
}

// ── correlate each target to its nearest pooled point ────────────────────────
const rows = targets.map((t) => {
  const { km, point } = nearestPoint([t.lat, t.lon], points);
  const file = point?.file ?? null;
  if (file) perFile.get(file).hits++;
  return { kind: t.kind, name: t.name, km: Math.round(km * 100) / 100, file, verdict: verdict(km, okKm) };
});

// ── output ───────────────────────────────────────────────────────────────────
if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const totalPts = points.length;
  console.log(
    `Correlating ${targets.length} ${withStays ? 'stays/POIs' : 'POIs'} against `
    + `${totalPts} points from ${files.length} file(s)   OK threshold: ${okKm} km\n`,
  );
  for (const r of rows) {
    console.log(
      `${r.kind.padEnd(4)} ${r.name.padEnd(24)} ${r.km.toFixed(2).padStart(8)} km   `
      + `${r.verdict.padEnd(7)} ${r.file ?? ''}`.trimEnd(),
    );
  }
  const ok = rows.filter((r) => r.verdict === 'OK').length;
  const near = rows.filter((r) => r.verdict === '~near').length;
  const miss = rows.filter((r) => r.verdict === 'NO-GPS').length;
  console.log(`\n${ok} OK · ${near} ~near · ${miss} NO-GPS`);
  console.log('\nnearest-source breakdown:');
  for (const [tag, { points: n, hits }] of perFile) {
    console.log(`  ${tag.padEnd(28)} ${String(n).padStart(6)} pts   nearest for ${hits} target(s)`);
  }
}

process.exit(rows.some((r) => r.verdict === 'NO-GPS') ? 1 : 0);

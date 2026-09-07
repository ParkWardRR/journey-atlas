// Turn a recorded GPS track (GPX or KML) into a paste-ready `drives[]` fragment
// for a journey — so you don't hand-type coordinate polylines. Pairs with
// verify-gps.mjs (which truth-checks stays/POIs against the same kind of track).
//
//   deno task gpx track.gpx                 # → YAML fragment on stdout
//   deno task gpx track.kml --cls a         # road class for the leg
//   deno task gpx track.gpx --tol 120       # simplify tolerance (metres)
//   deno task gpx track.gpx --json          # emit JSON instead of YAML
//
// GPX has no notion of road class, so every simplified leg gets one class (--cls,
// default "minor"); split it into segs by hand where the road actually changes.
// Track waypoints (GPX <wpt>, KML Point Placemarks) become `pois[]`.

import { Document, visit, isScalar } from 'yaml';
import { haversineMeters, simplify } from './lib/geo.mjs';
import { readTrack } from './lib/tracks.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const asJson = args.includes('--json');
const cls = opt('cls', 'minor');
const tolM = Number(opt('tol', 60));

if (!file) {
  console.error('usage: deno task gpx <track.gpx|track.kml> [--cls minor] [--tol 60] [--json]');
  process.exit(1);
}
if (!['motorway', 'a', 'b', 'minor'].includes(cls)) {
  console.error(`--cls must be one of: motorway, a, b, minor (got "${cls}")`);
  process.exit(1);
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// ---- parse ----------------------------------------------------------------

const { track, pois } = readTrack(file);
if (track.length < 2) {
  console.error(`✗ no usable track found in ${file} (need at least 2 points; found ${track.length})`);
  process.exit(1);
}

// ---- distance + simplify --------------------------------------------------

const totalMetres = track.reduce((s, p, i) => (i ? s + haversineMeters(track[i - 1], p) : 0), 0);
const miles = Math.round(totalMetres / 1609.344);
const simplified = simplify(track, tolM).map(([la, lo]) => [round6(la), round6(lo)]);

// ---- emit -----------------------------------------------------------------

const fragment = {
  totalMiles: miles,
  drives: [{ label: 'Recorded track', segs: [{ cls, line: simplified }] }],
  roadStats: [{ cls, label: 'Recorded track', mi: miles }],
  ...(pois.length ? { pois: pois.map((p) => ({ name: p.name, lat: round6(p.lat), lon: round6(p.lon) })) } : {}),
};

console.error(
  `${file}: ${track.length} track pts → ${simplified.length} kept `
  + `(tol ${tolM} m) · ${miles} mi · ${pois.length} waypoint(s) → pois\n`
);

if (asJson) {
  console.log(JSON.stringify(fragment, null, 2));
} else {
  // render [lat, lon] coordinate pairs inline (flow), like the hand-written trips
  const doc = new Document(fragment);
  visit(doc, { Seq(_key, node) { if (node.items.every(isScalar)) node.flow = true; } });
  console.log(String(doc).trimEnd());
}

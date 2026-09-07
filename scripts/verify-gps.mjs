// Sanity-check every point in journey.json against a real GPS track (e.g. one
// extracted from geotagged trip photos), so the map only shows places you were.
//
//   deno task verify-gps data/example-gps.csv
//   deno task verify-gps my-track.csv 3      # custom "OK" threshold (km)
//
// The CSV must have `latitude` and `longitude` columns (a header row).
// For every stay + POI it reports the distance to the nearest GPS point and an
// OK / ~near / NO-GPS verdict, so you can drop or relocate anything unbacked.

import { readFileSync } from 'node:fs';
import { haversineKm as km } from './lib/geo.mjs';

const csvFile = process.argv[2];
const OKKM = Number(process.argv[3] || 3);
if (!csvFile) { console.error('usage: deno task verify-gps <track.csv> [okKm]'); process.exit(1); }

const data = JSON.parse(readFileSync(new URL('../src/lib/journey.json', import.meta.url), 'utf8'));

function parseCsv(txt) {
  const lines = txt.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const la = head.indexOf('latitude'), lo = head.indexOf('longitude');
  if (la < 0 || lo < 0) throw new Error('CSV needs `latitude` and `longitude` columns');
  const pts = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const lat = parseFloat(c[la]), lon = parseFloat(c[lo]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) pts.push([lat, lon]);
  }
  return pts;
}

const track = parseCsv(readFileSync(csvFile, 'utf8'));
const nearest = (p) => track.reduce((m, g) => Math.min(m, km(p, g)), Infinity);
const verdict = (d) => (d <= OKKM ? 'OK' : d <= OKKM * 2.5 ? '~near' : 'NO-GPS');

const check = (label, name, lat, lon) => {
  const d = nearest([lat, lon]);
  console.log(`${label.padEnd(6)} ${name.padEnd(24)} ${d.toFixed(2).padStart(7)} km   ${verdict(d)}`);
};

console.log(`Track: ${csvFile} (${track.length} points)   OK threshold: ${OKKM} km\n`);
console.log('=== STAYS ===');
data.stays.forEach((s) => check('stay', s.area, s.lat, s.lon));
console.log('\n=== POIS ===');
data.pois.forEach((p) => check('poi', p.name, p.lat, p.lon));

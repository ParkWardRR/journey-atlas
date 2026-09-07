// Build an elevation profile for a trip's driving route and print a paste-ready
// `elevation` array for the trip — real terrain from the free Open-Meteo
// Elevation API (no key). Pairs with the elevation chart on the /trip page.
//
//   deno task elevation trips/01-norway-kystriksveien.yaml
//   deno task elevation my-trip.json --samples 60
//
// It concatenates every drives[].segs[].line[] into one route, samples N points
// evenly by distance (interpolating along the polyline), fetches their elevation,
// and prints `elevation: [{ mi, m }]` (cumulative miles + metres). One HTTP call.

import { readTrip } from './lib/build.mjs';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--')) || 'trips/adriatic-crossing.yaml';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const SAMPLES = Math.max(2, Math.min(100, Number(opt('samples', 48)))); // Open-Meteo caps ~100/req

const trip = readTrip(src);

// ── flatten drives into one route polyline (drop repeated seam points) ──
const route = [];
for (const d of trip.drives ?? []) {
  for (const s of d.segs ?? []) {
    for (const p of s.line ?? []) {
      const last = route[route.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) route.push([p[0], p[1]]);
    }
  }
}
if (route.length < 2) {
  console.error(`✗ ${src}: need at least 2 drive coordinates to profile (found ${route.length})`);
  process.exit(1);
}

const R = 6371000; // metres
const metres = (a, b) => {
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// cumulative distance (metres) at each vertex
const cum = [0];
for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + metres(route[i - 1], route[i]));
const totalM = cum[cum.length - 1];

// interpolate a [lat, lon] at a target cumulative distance
function at(targetM) {
  if (targetM <= 0) return route[0];
  if (targetM >= totalM) return route[route.length - 1];
  let i = 1;
  while (i < route.length && cum[i] < targetM) i++;
  const t = (targetM - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return [route[i - 1][0] + t * (route[i][0] - route[i - 1][0]),
          route[i - 1][1] + t * (route[i][1] - route[i - 1][1])];
}

const samples = Array.from({ length: SAMPLES }, (_, k) => {
  const distM = (totalM * k) / (SAMPLES - 1);
  const [lat, lon] = at(distM);
  return { mi: Math.round((distM / 1609.344) * 10) / 10, lat, lon };
});

const url = 'https://api.open-meteo.com/v1/elevation'
  + `?latitude=${samples.map((s) => s.lat.toFixed(5)).join(',')}`
  + `&longitude=${samples.map((s) => s.lon.toFixed(5)).join(',')}`;

const res = await fetch(url);
if (!res.ok) { console.error(`✗ Open-Meteo elevation API: HTTP ${res.status}`); process.exit(1); }
const { elevation } = await res.json();
if (!Array.isArray(elevation) || elevation.length !== samples.length) {
  console.error('✗ unexpected elevation response'); process.exit(1);
}

const out = samples.map((s, i) => ({ mi: s.mi, m: Math.round(elevation[i]) }));
const ms = out.map((o) => o.m);
const gain = out.reduce((g, o, i) => g + (i ? Math.max(0, o.m - out[i - 1].m) : 0), 0);
console.error(
  `${src}: ${route.length} route pts · ${SAMPLES} samples · ${out[out.length - 1].mi} mi · `
  + `${Math.min(...ms)}–${Math.max(...ms)} m · +${Math.round(gain)} m climb\n`
);
console.log('elevation:');
for (const o of out) console.log(`  - { mi: ${o.mi}, m: ${o.m} }`);

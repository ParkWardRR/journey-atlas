// Plausibility lint for a trip — beyond raw JSON-Schema validation. Catches data
// that's schema-valid but almost certainly wrong: coordinates out of range or
// clearly swapped, inset circles that fall off the 1600×1200 canvas, totalMiles
// that disagrees with the summed roadStats, drive road-classes missing from the
// legend, and degenerate/absurd ferry legs.
//
//   deno task doctor trips/adriatic-crossing.yaml
//   deno task doctor trips/*.yaml         # lint many at once
//
// Exit code: 0 if every file is clean or warn-only, 1 if any ERROR is found.

import { readTrip, validateTrip } from './lib/build.mjs';
import { haversineKm as km, median } from './lib/geo.mjs';

const CANVAS_W = 1600, CANVAS_H = 1200;

// Collect every [lat,lon] in the trip with a human label, for range/outlier checks.
function allPoints(t) {
  const pts = [];
  (t.stays || []).forEach((s, i) => pts.push([`stays[${i}] ${s.area}`, [s.lat, s.lon]]));
  (t.pois || []).forEach((p, i) => pts.push([`pois[${i}] ${p.name}`, [p.lat, p.lon]]));
  (t.ferries || []).forEach((f, i) => { pts.push([`ferries[${i}].a`, f.a]); pts.push([`ferries[${i}].b`, f.b]); });
  (t.drives || []).forEach((d, i) => (d.segs || []).forEach((s, j) =>
    (s.line || []).forEach((pt, k) => pts.push([`drives[${i}].segs[${j}].line[${k}]`, pt]))));
  (t.insets || []).forEach((n, i) => pts.push([`insets[${i}] ${n.title}`, n.center]));
  return pts.filter(([, c]) => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite));
}

function lint(src) {
  const errors = [], warns = [];
  let trip;
  try { trip = readTrip(src); } catch (e) { return { errors: [`unreadable: ${e.message}`], warns: [] }; }

  const schema = validateTrip(trip);
  if (!schema.ok) {
    for (const e of schema.errors) errors.push(`schema: ${e.instancePath || '(root)'} ${e.message}`);
    return { errors, warns }; // don't second-guess a schema-invalid file
  }

  const pts = allPoints(trip);

  // 1) coordinate ranges
  for (const [label, [lat, lon]] of pts) {
    if (lat < -90 || lat > 90) errors.push(`${label}: latitude ${lat} out of [-90,90]`);
    if (lon < -180 || lon > 180) errors.push(`${label}: longitude ${lon} out of [-180,180]`);
  }

  // 2) likely swapped lat/lon or fat-finger: points far from the trip's own centre
  if (pts.length >= 3) {
    const cLat = median(pts.map(([, c]) => c[0]));
    const cLon = median(pts.map(([, c]) => c[1]));
    for (const [label, c] of pts) {
      const d = km([cLat, cLon], c);
      if (d > 3000) warns.push(`${label}: ${Math.round(d)} km from the trip centre — swapped lat/lon or a typo?`);
    }
  }

  // 3) totalMiles vs summed roadStats
  const summed = (trip.roadStats || []).reduce((n, r) => n + (r.mi || 0), 0);
  if (summed > 0 && trip.totalMiles > 0) {
    const off = Math.abs(summed - trip.totalMiles) / trip.totalMiles;
    if (off > 0.15) warns.push(`totalMiles ${trip.totalMiles} vs summed roadStats ${summed} (${Math.round(off * 100)}% apart)`);
  }

  // 4) drive road-classes must appear in the legend, and vice versa
  const driveCls = new Set((trip.drives || []).flatMap((d) => (d.segs || []).map((s) => s.cls)));
  const legendCls = new Set((trip.roadStats || []).map((r) => r.cls));
  for (const c of driveCls) if (!legendCls.has(c)) warns.push(`road class "${c}" is driven but missing from roadStats legend`);
  for (const c of legendCls) if (!driveCls.has(c)) warns.push(`road class "${c}" is in the legend but never driven`);

  // 5) ferries: endpoints must differ and be a believable crossing
  (trip.ferries || []).forEach((f, i) => {
    if (!f.a || !f.b) return;
    const d = km(f.a, f.b);
    if (d === 0) errors.push(`ferries[${i}] ${f.short || ''}: start and end are identical`);
    else if (d > 500) warns.push(`ferries[${i}] ${f.short || ''}: ${Math.round(d)} km crossing — unusually long, check a/b`);
  });

  // 6) insets: the pixel circle must sit on the 1600×1200 canvas
  (trip.insets || []).forEach((n, i) => {
    const tag = `insets[${i}] ${n.title || ''}`;
    if (n.cx - n.r < 0 || n.cx + n.r > CANVAS_W || n.cy - n.r < 0 || n.cy + n.r > CANVAS_H)
      warns.push(`${tag}: circle (cx ${n.cx}, cy ${n.cy}, r ${n.r}) spills off the ${CANVAS_W}×${CANVAS_H} canvas`);
    if (n.zoom != null && (n.zoom < 1 || n.zoom > 20)) warns.push(`${tag}: zoom ${n.zoom} looks off (expect ~5–16)`);
  });

  return { errors, warns };
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: deno task doctor <trip.yaml> [more…]'); process.exit(1); }

let bad = 0;
for (const src of files) {
  const { errors, warns } = lint(src);
  if (!errors.length && !warns.length) { console.log(`✓ ${src}  — clean`); continue; }
  console.log(`${errors.length ? '✗' : '⚠'} ${src}`);
  for (const e of errors) console.log(`    ERROR  ${e}`);
  for (const w of warns) console.log(`    warn   ${w}`);
  if (errors.length) bad++;
}
process.exit(bad ? 1 : 0);

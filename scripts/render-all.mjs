// Build AND render every trip in trips/ into output/samples/, one PNG per trip —
// no manual build→render→rename loop, no filename collisions.
//
//   npm run render:all                 # stamen for every trips/*.yaml|json
//   npm run render:all -- opentopo     # a different basemap
//   npm run render:all -- --glob 'trips/0*.yaml' ocean
//
// Starts its own server (once) and reuses it across all trips, then stops it.

import { readdirSync, mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { buildTrip, summarize } from './lib/build.mjs';
import { ensureServer } from './lib/server.mjs';
import { withBrowser, shoot } from './lib/shoot.mjs';

const BASE = process.env.URL || 'http://localhost:5173';
const ROADS = process.env.ROADS || 'signage';
const OUT = 'output/samples';
mkdirSync(OUT, { recursive: true });

// args: [--glob <dir-or-nothing>] [style]
const args = process.argv.slice(2);
let style = 'stamen';
let dir = 'trips';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir') { dir = args[++i]; continue; }
  style = args[i];
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml') || f.endsWith('.json'))
  .sort()
  .map((f) => join(dir, f));

if (!files.length) { console.error(`no trips found in ${dir}/`); process.exit(1); }
console.log(`Rendering ${files.length} trip(s) on "${style}" → ${OUT}/\n`);

const server = await ensureServer(BASE);
let ok = 0, failed = 0;
try {
  await withBrowser(async (context) => {
    for (const file of files) {
      const name = basename(file, extname(file));
      try {
        const trip = buildTrip(file);           // rewrites src/lib/journey.json
        const outPath = `${OUT}/${name}.png`;
        await shoot(context, { base: server.url, style, roads: ROADS, outPath });
        console.log(`✓ ${name.padEnd(32)} ${summarize(trip)}`);
        ok++;
      } catch (err) {
        const detail = err.errors ? err.errors.map((e) => e.message).join('; ') : err.message;
        console.error(`✗ ${name.padEnd(32)} ${detail}`);
        failed++;
      }
    }
  });
} finally {
  await server.stop();
}

console.log(`\nDone: ${ok} rendered${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);

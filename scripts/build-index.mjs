// Compile every trip in trips/ into src/lib/trips-index.json — the metadata the
// /gallery page lists (title, subtitle, a few stats, and whether a rendered
// thumbnail exists in docs/trips/). Run after adding or editing trips:
//
//   deno task build:index
//
// The thumbnails themselves are the committed renders in docs/trips/<slug>.png
// (produce them with `deno task render:all`); this only records which exist.

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTrip } from './lib/build.mjs';

const dir = 'trips';
const outPath = fileURLToPath(new URL('../src/lib/trips-index.json', import.meta.url));

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml') || f.endsWith('.json'))
  .sort();

const index = files.map((f) => {
  const slug = basename(f, extname(f));
  const t = readTrip(join(dir, f));
  return {
    slug,
    title: t.title ?? slug,
    subtitle: t.subtitle ?? '',
    totalMiles: t.totalMiles ?? 0,
    stays: (t.stays ?? []).length,
    ferries: (t.ferries ?? []).length,
    pois: (t.pois ?? []).length,
    thumb: existsSync(join('docs', 'trips', `${slug}.png`)) ? `${slug}.png` : null,
    src: `trips/${f}`,
  };
});

writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n');
const withThumb = index.filter((t) => t.thumb).length;
console.log(`✓ ${index.length} trips → src/lib/trips-index.json  (${withThumb} with thumbnails)`);

// Render the current trip (src/lib/journey.json) to PNG(s) with headless Chromium.
//
//   deno task render                    # every keyless basemap → output/
//   deno task render watercolor         # just one style
//   deno task render --out hero stamen  # write output/hero-stamen.png
//   URL=http://localhost:5173 deno task render
//
// No second terminal needed: if nothing is serving the app, we start `vite dev`
// ourselves and stop it when done. Stadia styles (watercolor, stamen, outdoors,
// smooth) need VITE_STADIA_API_KEY; without it they fall back to keyless tiles.

import { mkdirSync } from 'node:fs';
import { ensureServer } from './lib/server.mjs';
import { withBrowser, shoot, KEYLESS, ALL } from './lib/shoot.mjs';

const BASE = process.env.URL || 'http://localhost:5173';
const OUT = 'output';
const ROADS = process.env.ROADS || 'signage';
mkdirSync(OUT, { recursive: true });

// args: [--out <prefix>] [style ...]   — default set is the keyless basemaps
const args = process.argv.slice(2);
let prefix = 'journey';
const styles = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') { prefix = args[++i]; continue; }
  styles.push(args[i]);
}
const wanted = styles.length ? styles : KEYLESS;
const unknown = wanted.filter((s) => !ALL.includes(s));
if (unknown.length) console.warn(`⚠ unknown basemap(s): ${unknown.join(', ')} — will try anyway`);

const server = await ensureServer(BASE);
try {
  await withBrowser(async (context) => {
    for (const style of wanted) {
      const outPath = `${OUT}/${prefix}-${style}.png`;
      await shoot(context, { base: server.url, style, roads: ROADS, outPath })
        .then((p) => console.log(`wrote ${p}`))
        .catch((e) => console.error(`FAILED ${style}: ${e.message}`));
    }
  });
} finally {
  await server.stop();
}

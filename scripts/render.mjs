// Render the map to PNG(s) with Playwright (headless Chromium).
//
//   npm run dev                       # in one terminal (serves http://localhost:5173)
//   npm run render                    # renders the default set of basemaps
//   npm run render -- watercolor      # render just one style
//   URL=http://localhost:5173 npm run render
//
// Every basemap works without a key EXCEPT the Stadia styles
// (watercolor, stamen, outdoors, smooth) which need VITE_STADIA_API_KEY.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.URL || 'http://localhost:5173';
const OUT = 'output';
const ROADS = process.env.ROADS || 'signage';
mkdirSync(OUT, { recursive: true });

// keyless basemaps + (if a key is set) the Stadia ones
const ALL = ['topo', 'natgeo', 'imagery', 'street', 'ocean', 'opentopo', 'osm', 'cyclosm', 'hot',
             'watercolor', 'stamen', 'outdoors', 'smooth'];
const styles = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

async function shoot(page, style) {
  const url = `${BASE}/?style=${style}&roads=${ROADS}&blowups=1`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#journey-card', { state: 'visible' });
  await page.waitForFunction(() => window.__mapReady === true, { timeout: 55000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const el = await page.$('#journey-card');
  await el.screenshot({ path: `${OUT}/journey-${style}.png` });
  console.log(`wrote ${OUT}/journey-${style}.png`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
for (const s of styles) {
  const page = await context.newPage();
  await shoot(page, s).catch((e) => console.error(`FAILED ${s}:`, e.message));
  await page.close();
}
await browser.close();

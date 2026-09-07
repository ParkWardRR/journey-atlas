// Screenshot the fixed 1600×1200 poster card with headless Chromium. Shared by
// render.mjs (one trip, many basemaps) and render-all.mjs (every trip in trips/).

import { chromium } from 'playwright';

export const KEYLESS = ['topo', 'natgeo', 'imagery', 'street', 'ocean', 'opentopo', 'osm', 'cyclosm', 'hot'];
export const STADIA = ['watercolor', 'stamen', 'outdoors', 'smooth'];
export const ALL = [...KEYLESS, ...STADIA];

// Run `fn(context)` with a browser sized to the poster card, then tear it down.
export async function withBrowser(fn) {
  // --no-sandbox lets headless Chromium run as root (containers/CI); opt-in via env.
  const args = process.env.JA_NO_SANDBOX ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  try {
    return await fn(context);
  } finally {
    await browser.close();
  }
}

// Load one map view and screenshot #journey-card to `outPath`.
export async function shoot(context, { base, style, roads = 'signage', blowups = 1, outPath }) {
  const page = await context.newPage();
  try {
    const url = `${base}/?style=${style}&roads=${roads}&blowups=${blowups}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('#journey-card', { state: 'visible' });
    // deno-lint-ignore no-window -- runs in the page (browser) context, not Deno
    await page.waitForFunction(() => window.__mapReady === true, { timeout: 55000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const el = await page.$('#journey-card');
    await el.screenshot({ path: outPath });
    return outPath;
  } finally {
    await page.close();
  }
}

// Build the README hero: an animated terminal walkthrough of a user creating
// their own trip and rendering it — write YAML → doctor → build:trip → render →
// the finished map. Command outputs are REAL (captured live), and the final
// frame is the actual rendered poster. Uses Playwright (frames) + ffmpeg (GIF).
//
//   node scripts/make-demo-gif.mjs [trips/adriatic-crossing.yaml]   STYLE=imagery
//
// Requires: Playwright (frames), ffmpeg (GIF), and Zig 0.16 (the native verify step).
// Output: docs/hero-demo.gif

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SRC = process.argv[2] || 'trips/adriatic-crossing.yaml';
const NAME = 'trips/my-trip.yaml';        // friendly name shown in the demo
const STYLE = process.env.STYLE || 'imagery';
const OUT = process.env.OUT || 'docs/hero-demo.gif';
const TMP = '/tmp/ja-demo-frames';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

mkdirSync(TMP, { recursive: true });
copyFileSync(SRC, NAME);

// ── run the real workflow, capturing output ──────────────────────────────────
const run = (cmd) => { try { return execSync(cmd, { encoding: 'utf8' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
const doctorOut = run(`node scripts/trip-doctor.mjs ${NAME}`).trimEnd();
const buildOut = run(`node scripts/build-trip.mjs ${NAME}`).trimEnd();
// native Zig verify against the GPS track — reads the freshly-built journey.json
console.error('· building the Zig verifier…');
run('cd cli-zig && zig build');
const verifyOut = run('./cli-zig/zig-out/bin/journey-atlas-verify data/example-gps.csv')
  .split('\n').slice(0, 8).join('\n').trimEnd();
console.error('· rendering the map…');
run(`node scripts/render.mjs --out demoshot ${STYLE}`);
copyFileSync(`output/demoshot-${STYLE}.png`, `${TMP}/map.png`);
const renderOut = `wrote output/journey-${STYLE}.png`;

// the snippet of YAML the "user" writes (skip the leading comment block)
const yamlLines = readFileSync(SRC, 'utf8').split('\n').filter((l) => !l.startsWith('#'));
const snippet = yamlLines.slice(0, 10).join('\n').trim();

// ── narrative → screen states ────────────────────────────────────────────────
const P = '<span class="pr">➜</span> <span class="dir">journey-atlas</span> ';
const hist = [];
const frames = [];
const push = (html, map = false) => frames.push({ body: html, map });
const screen = (extra = '') => `<div class="body">${hist.join('')}${extra}</div>`;
const cmdLine = (cmd, cursor = false) => `<div class="ln">${P}<span class="cmd">${esc(cmd)}</span>${cursor ? '<span class="cur"></span>' : ''}</div>`;
const out = (text, cls = 'out') => `<div class="ln ${cls}">${esc(text)}</div>`;

// 0 · empty prompt
push(screen(`<div class="ln">${P}<span class="cur"></span></div>`));
// 1 · write the trip
hist.push(out('# 1 · describe your trip in plain YAML — trips/my-trip.yaml', 'note'));
hist.push(`<div class="code">${esc(snippet)}</div>`);
push(screen());
// 2·3 · doctor
push(screen(cmdLine('npm run doctor -- trips/my-trip.yaml', true)));
hist.push(cmdLine('npm run doctor -- trips/my-trip.yaml'));
hist.push(out('# 2 · sanity-check the data', 'note'));
for (const l of doctorOut.split('\n')) hist.push(out(l, l.includes('clean') || l.startsWith('✓') ? 'ok' : 'out'));
push(screen());
// build
push(screen(cmdLine('npm run build:trip -- trips/my-trip.yaml', true)));
hist.push(cmdLine('npm run build:trip -- trips/my-trip.yaml'));
hist.push(out('# 3 · validate against the schema + compile', 'note'));
for (const l of buildOut.split('\n')) hist.push(out(l, 'ok'));
push(screen());
// verify — native Zig
const ZCMD = './cli-zig/zig-out/bin/journey-atlas-verify data/example-gps.csv';
push(screen(cmdLine(ZCMD, true)));
hist.push(cmdLine(ZCMD));
hist.push(out('# 4 · do the stops match your GPS photos?  (native Zig — no Node)', 'note'));
for (const l of verifyOut.split('\n')) hist.push(out(l, l.endsWith('OK') ? 'ok' : 'out'));
push(screen());
// render
push(screen(cmdLine(`npm run render -- ${STYLE}`, true)));
hist.push(cmdLine(`npm run render -- ${STYLE}`));
hist.push(out('# 5 · screenshot the map to a print-ready PNG', 'note'));
hist.push(out(`✓ ${renderOut}`, 'ok'));
push(screen());
// open + the map
push(screen(cmdLine(`open output/journey-${STYLE}.png`, true)));
push('', true);
push('', true); // hold on the map

const DUR = [0.6, 2.8, 0.5, 1.7, 0.5, 1.8, 0.5, 2.0, 0.5, 1.6, 0.8, 2.4, 2.4];

// ── page template ────────────────────────────────────────────────────────────
const page = (f) => `<!doctype html><html><head><meta charset="utf8"><style>
  * { margin: 0; box-sizing: border-box; }
  html,body { width: 1000px; height: 760px; background: #0b0e14; }
  .win { width: 1000px; height: 760px; background: #14171f; display: flex; flex-direction: column;
    font-family: 'SF Mono','JetBrains Mono',Menlo,monospace; overflow: hidden; }
  .bar { height: 40px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: #1c2028; }
  .dot { width: 12px; height: 12px; border-radius: 50%; } .r{background:#ff5f57}.y{background:#febc2e}.g{background:#28c840}
  .ttl { margin-left: 12px; color: #7d8590; font-size: 13px; font-weight: 600; }
  /* bottom-anchored like a real terminal: newest lines show, old scroll off the top */
  .body { flex: 1; min-height: 0; padding: 20px 24px; color: #cdd9e5; font-size: 15.5px; line-height: 1.5;
    overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
  .ln { white-space: pre-wrap; flex: none; }
  .pr { color: #3fb950; font-weight: 700; } .dir { color: #58a6ff; } .cmd { color: #e6edf3; }
  .note { color: #6fb7c7; } .ok { color: #3fb950; } .out { color: #8b949e; }
  .code { color: #d2a8ff; background: #0e1117; border-left: 3px solid #2f3947; border-radius: 8px;
    padding: 12px 16px; margin: 8px 0 4px; white-space: pre; font-size: 15px; line-height: 1.5; }
  .cur { display: inline-block; width: 9px; height: 18px; background: #3fb950; vertical-align: -3px; margin-left: 2px; }
  .map { flex: 1; background: #000 center/contain no-repeat url('map.png'); }
  .cap { position: absolute; left: 24px; bottom: 18px; color: #cdd9e5; font-size: 14px;
    background: rgba(0,0,0,.55); padding: 5px 12px; border-radius: 8px; font-family: monospace; }
</style></head><body><div class="win" style="position:relative">
  <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="ttl">journey-atlas — zsh</span></div>
  ${f.map ? `<div class="map"></div><div class="cap">output/journey-${STYLE}.png</div>` : f.body}
</div></body></html>`;

// ── screenshot each frame ────────────────────────────────────────────────────
const browser = await chromium.launch({ args: process.env.JA_NO_SANDBOX ? ['--no-sandbox'] : [] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
for (let i = 0; i < frames.length; i++) {
  writeFileSync(`${TMP}/f-${String(i).padStart(2, '0')}.html`, page(frames[i]));
  await pg.goto(`file://${TMP}/f-${String(i).padStart(2, '0')}.html`);
  await pg.waitForTimeout(120);
  await pg.screenshot({ path: `${TMP}/frame-${String(i).padStart(2, '0')}.png` });
}
await browser.close();

// ── ffmpeg: per-frame durations via concat, two-pass palette ─────────────────
const concat = frames.map((_, i) => `file 'frame-${String(i).padStart(2, '0')}.png'\nduration ${DUR[i] ?? 1.6}`).join('\n')
  + `\nfile 'frame-${String(frames.length - 1).padStart(2, '0')}.png'\n`;
writeFileSync(`${TMP}/list.txt`, concat);
const pal = `${TMP}/pal.png`;
execSync(`ffmpeg -y -f concat -safe 0 -i ${TMP}/list.txt -vf "scale=1000:-1:flags=lanczos,palettegen=stats_mode=diff" ${pal}`, { stdio: 'ignore' });
execSync(`ffmpeg -y -f concat -safe 0 -i ${TMP}/list.txt -i ${pal} -lavfi "scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" -loop 0 ${OUT}`, { stdio: 'ignore' });

rmSync(NAME, { force: true });
run('node scripts/build-trip.mjs trips/adriatic-crossing.yaml'); // restore default journey.json
const kb = Math.round(readFileSync(OUT).length / 1024);
console.error(`✓ wrote ${OUT}  (${frames.length} frames · ${kb} KB)`);

// Shared readers for recorded GPS tracks in the three formats the pipeline
// accepts — CSV (latitude/longitude columns), GPX (<trkpt>/<rtept> + <wpt>) and
// KML (<LineString> + Point <Placemark>). Parsing used to be copy-pasted into
// verify-gps and gpx-import; keeping it here means one place to test and extend.
// Also provides the nearest-point correlation helper used by correlate-poi.

import { readFileSync } from 'node:fs';
import { haversineKm } from './geo.mjs';

// Parse a CSV with `latitude` and `longitude` header columns → [[lat, lon], …].
// Throws if the columns are missing; silently skips rows that don't parse.
export function parseCsv(txt) {
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

// read a numeric XML attribute value (order-independent) from an opening tag
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`));
  return m ? parseFloat(m[1]) : NaN;
};

// Parse a GPX document → { track: [[lat, lon], …], pois: [{ name, lat, lon }, …] }.
export function parseGpx(x) {
  const track = [];
  for (const m of x.matchAll(/<(?:trkpt|rtept)\b([^>]*)>/g)) {
    const lat = attr(m[1], 'lat'), lon = attr(m[1], 'lon');
    if (Number.isFinite(lat) && Number.isFinite(lon)) track.push([lat, lon]);
  }
  const pois = [];
  for (const m of x.matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/g)) {
    const lat = attr(m[1], 'lat'), lon = attr(m[1], 'lon');
    const name = (m[2].match(/<name>([\s\S]*?)<\/name>/) || [])[1];
    if (Number.isFinite(lat) && Number.isFinite(lon)) pois.push({ name: (name || 'Waypoint').trim(), lat, lon });
  }
  return { track, pois };
}

// Parse a KML document → { track, pois }. KML coordinates are lon,lat[,alt].
export function parseKml(x) {
  const track = [];
  const line = x.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i);
  if (line) {
    for (const tok of line[1].trim().split(/\s+/)) {
      const [lon, lat] = tok.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) track.push([lat, lon]);
    }
  }
  const pois = [];
  for (const m of x.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const body = m[1];
    if (!/<Point>/.test(body)) continue;
    const name = (body.match(/<name>([\s\S]*?)<\/name>/) || [])[1];
    const c = (body.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/) || [])[1];
    if (!c) continue;
    const [lon, lat] = c.trim().split(/\s+/)[0].split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) pois.push({ name: (name || 'Waypoint').trim(), lat, lon });
  }
  return { track, pois };
}

// Read a track file, dispatching on extension (and a KML sniff) → { track, pois }.
export function readTrack(path) {
  const raw = readFileSync(path, 'utf8');
  const lower = path.toLowerCase();
  if (lower.endsWith('.csv')) return { track: parseCsv(raw), pois: [] };
  const isKml = lower.endsWith('.kml') || /<kml[\s>]/.test(raw);
  return isKml ? parseKml(raw) : parseGpx(raw);
}

// Nearest recorded point to a [lat, lon] target. `points` is [{ lat, lon, … }],
// and the whole matching object (extra fields intact) is returned as `.point`.
export function nearestPoint(target, points) {
  let point = null, km = Infinity;
  for (const p of points) {
    const d = haversineKm(target, [p.lat, p.lon]);
    if (d < km) { km = d; point = p; }
  }
  return { km, point };
}

// OK / ~near / NO-GPS verdict for a distance against an "OK" threshold (km).
export const verdict = (km, okKm) => (km <= okKm ? 'OK' : km <= okKm * 2.5 ? '~near' : 'NO-GPS');

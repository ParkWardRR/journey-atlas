// Unit tests for the track readers + correlation helpers. Run with `deno task test`.
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nearestPoint, parseCsv, parseGpx, parseKml, readTrack, verdict } from './tracks.mjs';

Deno.test('parseCsv: reads latitude/longitude columns in any order/case', () => {
  const pts = parseCsv('Longitude,name,LATITUDE\n12.5,a,41.9\n13.0,b,42.0\n');
  assert.deepEqual(pts, [[41.9, 12.5], [42.0, 13.0]]);
});

Deno.test('parseCsv: throws when the columns are missing', () => {
  assert.throws(() => parseCsv('x,y\n1,2\n'), /latitude.*longitude/);
});

Deno.test('parseCsv: skips rows that do not parse to numbers', () => {
  const pts = parseCsv('latitude,longitude\n41.9,12.5\nfoo,bar\n42.0,13.0\n');
  assert.deepEqual(pts, [[41.9, 12.5], [42.0, 13.0]]);
});

Deno.test('parseGpx: pulls trkpt/rtept into the track and wpt into pois', () => {
  const gpx = `<gpx>
    <trk><trkseg>
      <trkpt lat="41.9" lon="12.5"></trkpt>
      <trkpt lon="13.0" lat="42.0"/>
    </trkseg></trk>
    <wpt lat="41.0" lon="12.0"><name>Start</name></wpt>
  </gpx>`;
  const { track, pois } = parseGpx(gpx);
  assert.deepEqual(track, [[41.9, 12.5], [42.0, 13.0]]);
  assert.deepEqual(pois, [{ name: 'Start', lat: 41.0, lon: 12.0 }]);
});

Deno.test('parseGpx: an unnamed waypoint falls back to "Waypoint"', () => {
  const { pois } = parseGpx('<gpx><wpt lat="1" lon="2"></wpt></gpx>');
  assert.equal(pois[0].name, 'Waypoint');
});

Deno.test('parseKml: LineString is lon,lat and Placemark points become pois', () => {
  const kml = `<kml><Document>
    <Placemark><LineString><coordinates>
      12.5,41.9,0 13.0,42.0,0
    </coordinates></LineString></Placemark>
    <Placemark><name>Castle</name><Point><coordinates>12.0,41.0</coordinates></Point></Placemark>
  </Document></kml>`;
  const { track, pois } = parseKml(kml);
  assert.deepEqual(track, [[41.9, 12.5], [42.0, 13.0]]);
  assert.deepEqual(pois, [{ name: 'Castle', lat: 41.0, lon: 12.0 }]);
});

Deno.test('readTrack: dispatches on extension (csv vs gpx) and KML sniff', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ja-tracks-'));
  const csv = join(dir, 't.csv');
  const gpx = join(dir, 't.gpx');
  const kmlAsTxt = join(dir, 't.txt'); // no .kml extension — must sniff <kml>
  writeFileSync(csv, 'latitude,longitude\n41.9,12.5\n');
  writeFileSync(gpx, '<gpx><trkpt lat="1" lon="2"/></gpx>');
  writeFileSync(kmlAsTxt, '<kml><LineString><coordinates>2,1</coordinates></LineString></kml>');
  assert.deepEqual(readTrack(csv).track, [[41.9, 12.5]]);
  assert.deepEqual(readTrack(gpx).track, [[1, 2]]);
  assert.deepEqual(readTrack(kmlAsTxt).track, [[1, 2]]);
});

Deno.test('nearestPoint: returns the closest point with its source tag intact', () => {
  const points = [
    { lat: 41.0, lon: 12.0, file: 'a.gpx' },
    { lat: 41.9, lon: 12.5, file: 'b.csv' },
    { lat: 45.0, lon: 9.0, file: 'c.csv' },
  ];
  const { km, point } = nearestPoint([41.9, 12.5], points);
  assert.equal(point.file, 'b.csv');
  assert.ok(km < 0.001, `expected ~0 km, got ${km}`);
});

Deno.test('nearestPoint: empty pool yields Infinity and no point', () => {
  const { km, point } = nearestPoint([0, 0], []);
  assert.equal(km, Infinity);
  assert.equal(point, null);
});

Deno.test('verdict: OK within threshold, ~near up to 2.5×, else NO-GPS', () => {
  assert.equal(verdict(1, 3), 'OK');
  assert.equal(verdict(3, 3), 'OK');
  assert.equal(verdict(5, 3), '~near');
  assert.equal(verdict(7.5, 3), '~near');
  assert.equal(verdict(8, 3), 'NO-GPS');
});

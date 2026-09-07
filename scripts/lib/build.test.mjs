// Unit tests for the trip compile/validate helpers. Run with `deno task test`.
// Exercises the real schema wiring in build.mjs against the shipped trips.
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readTrip, summarize, validateTrip } from './build.mjs';

Deno.test('validateTrip: a shipped trip passes the schema', () => {
  const trip = readTrip('trips/adriatic-crossing.yaml');
  const { ok, errors } = validateTrip(trip);
  assert.equal(ok, true, `expected valid, got: ${JSON.stringify(errors)}`);
  assert.deepEqual(errors, []);
});

Deno.test('validateTrip: a missing required field is rejected', () => {
  const trip = readTrip('trips/adriatic-crossing.yaml');
  delete trip.title; // title is required by the schema
  const { ok, errors } = validateTrip(trip);
  assert.equal(ok, false);
  assert.ok(errors.length > 0, 'expected at least one schema error');
});

Deno.test('validateTrip: a wrong-typed field is rejected', () => {
  const trip = readTrip('trips/adriatic-crossing.yaml');
  trip.totalMiles = 'not-a-number';
  const { ok } = validateTrip(trip);
  assert.equal(ok, false);
});

Deno.test('readTrip: parses YAML and JSON to the same shape', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ja-trip-'));
  const obj = { title: 'T', subtitle: 'S', totalMiles: 10 };
  const yamlPath = join(dir, 't.yaml');
  const jsonPath = join(dir, 't.json');
  writeFileSync(yamlPath, 'title: T\nsubtitle: S\ntotalMiles: 10\n');
  writeFileSync(jsonPath, JSON.stringify(obj));
  assert.deepEqual(readTrip(yamlPath), obj);
  assert.deepEqual(readTrip(jsonPath), obj);
});

Deno.test('summarize: counts stays, sights and drives', () => {
  const trip = { stays: [{}, {}], pois: [{}, {}, {}], drives: [{}] };
  assert.equal(summarize(trip), '2 stays, 3 sights, 1 drives');
});

Deno.test('summarize: tolerates missing arrays', () => {
  assert.equal(summarize({}), '0 stays, 0 sights, 0 drives');
});

Deno.test('every shipped trip validates', () => {
  const trips = [...Deno.readDirSync('trips')]
    .filter((e) => e.isFile && /\.(ya?ml|json)$/.test(e.name))
    .map((e) => e.name)
    .sort();
  assert.ok(trips.length >= 10, `expected the starter routes, found ${trips.length}`);
  for (const name of trips) {
    const { ok, errors } = validateTrip(readTrip(join('trips', name)));
    assert.equal(ok, true, `${name} failed schema: ${JSON.stringify(errors)}`);
  }
});

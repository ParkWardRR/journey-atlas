// Unit tests for the shared geo helpers. Run with `deno task test`.
import { strict as assert } from 'node:assert';
import { haversineKm, haversineMeters, median, perpDistMeters, simplify } from './geo.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: |${a} - ${b}| > ${tol}`);

Deno.test('haversineKm: identical points are zero', () => {
  assert.equal(haversineKm([41.9, 12.5], [41.9, 12.5]), 0);
});

Deno.test('haversineKm: one degree of latitude ≈ 111.19 km', () => {
  near(haversineKm([0, 0], [1, 0]), 111.19, 0.2, 'one degree lat');
});

Deno.test('haversineKm: London → Paris ≈ 343 km', () => {
  const london = [51.5074, -0.1278], paris = [48.8566, 2.3522];
  near(haversineKm(london, paris), 343, 3, 'London→Paris');
});

Deno.test('haversineKm: symmetric', () => {
  const a = [40.0, -3.0], b = [43.5, 1.2];
  assert.equal(haversineKm(a, b), haversineKm(b, a));
});

Deno.test('haversineMeters is ~1000× the km value', () => {
  const a = [45.1, 7.7], b = [45.9, 8.9];
  near(haversineMeters(a, b) / haversineKm(a, b), 1000, 1e-6, 'm/km ratio');
});

Deno.test('median: odd count picks the middle', () => {
  assert.equal(median([3, 1, 2]), 2);
});

Deno.test('median: even count averages the two middles', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

Deno.test('median: does not mutate its input', () => {
  const input = [5, 1, 3];
  median(input);
  assert.deepEqual(input, [5, 1, 3]);
});

Deno.test('perpDistMeters: a point on the segment is distance 0', () => {
  const d = perpDistMeters([0, 1], [0, 0], [0, 2], 0);
  near(d, 0, 1e-6, 'on-segment');
});

Deno.test('perpDistMeters: ~1° north of an E–W segment ≈ 111 km', () => {
  const d = perpDistMeters([1, 1], [0, 0], [0, 2], 0);
  near(d, 111320, 500, 'perp off segment');
});

Deno.test('simplify: fewer than 3 points is returned unchanged', () => {
  const pts = [[0, 0], [1, 1]];
  assert.deepEqual(simplify(pts, 10), pts);
});

Deno.test('simplify: collinear points collapse to the two endpoints', () => {
  const line = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]];
  assert.deepEqual(simplify(line, 50), [[0, 0], [0, 4]]);
});

Deno.test('simplify: always keeps first and last point', () => {
  const pts = [[0, 0], [0.001, 1], [-0.001, 2], [0, 3]];
  const out = simplify(pts, 1);
  assert.deepEqual(out[0], pts[0]);
  assert.deepEqual(out[out.length - 1], pts[pts.length - 1]);
});

Deno.test('simplify: a sharp detour beyond tolerance is preserved', () => {
  // a spike ~1° (~111 km) off the line, tolerance 10 km → must be kept
  const pts = [[0, 0], [1, 1], [0, 2]];
  const out = simplify(pts, 10_000);
  assert.equal(out.length, 3);
});

Deno.test('simplify: a tiny wiggle under tolerance is dropped', () => {
  // ~0.0001° (~11 m) off the line, tolerance 100 m → drop the middle
  const pts = [[0, 0], [0.0001, 1], [0, 2]];
  assert.deepEqual(simplify(pts, 100), [[0, 0], [0, 2]]);
});

// Shared great-circle + polyline helpers used across the pipeline scripts.
// These were copy-pasted (byte-for-byte) into trip-doctor, verify-gps, gpx-import
// and fetch-elevation; keeping one implementation means one place to test and one
// place to fix. The maths is unchanged, so the native Go/Zig ports stay in parity.

const R_KM = 6371;       // mean Earth radius, kilometres
const R_M = 6_371_000;   // mean Earth radius, metres
const RAD = Math.PI / 180;

// Haversine great-circle distance between two [lat, lon] points, in radius units.
function haversine(a, b, R) {
  const dLat = (b[0] - a[0]) * RAD, dLon = (b[1] - a[1]) * RAD;
  const la1 = a[0] * RAD, la2 = b[0] * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Great-circle distance in kilometres / metres.
export const haversineKm = (a, b) => haversine(a, b, R_KM);
export const haversineMeters = (a, b) => haversine(a, b, R_M);

// Median of a list of numbers (does not mutate the input).
export function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Local planar projection (metres) of a [lat, lon] about a reference latitude —
// good enough for perpendicular-distance tests over a single track.
const proj = (p, lat0) => [p[1] * 111320 * Math.cos(lat0 * RAD), p[0] * 111320];

// Perpendicular distance (metres) from point p to segment a–b, about lat0.
export function perpDistMeters(p, a, b, lat0) {
  const P = proj(p, lat0), A = proj(a, lat0), B = proj(b, lat0);
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(P[0] - A[0], P[1] - A[1]);
  let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy));
}

// Douglas–Peucker line simplification (iterative), with a metres tolerance.
// Always keeps the first and last point; returns a subset of the input array.
export function simplify(points, tolMeters) {
  if (points.length < 3) return points;
  const lat0 = points[0][0];
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDistMeters(points[i], points[lo], points[hi], lat0);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tolMeters && idx !== -1) { keep[idx] = true; stack.push([lo, idx], [idx, hi]); }
  }
  return points.filter((_, i) => keep[i]);
}

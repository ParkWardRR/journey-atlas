// Compile a trip (YAML or JSON) into src/lib/journey.json — the file the map
// renders — after validating it against schema/journey.schema.json.
//
//   node scripts/build-trip.mjs trips/adriatic-crossing.yaml
//   node scripts/build-trip.mjs my-trip.json
//
// Humans (or their agents) edit the readable source in trips/; this makes the
// machine file. Errors point at the exact field that's wrong.

import { buildTrip, summarize } from './lib/build.mjs';

const src = process.argv[2] || 'trips/adriatic-crossing.yaml';

try {
  const trip = buildTrip(src);
  console.log(`✓ ${src} → src/lib/journey.json  (${summarize(trip)})`);
} catch (err) {
  if (err.errors) {
    console.error(`\n✗ ${src} is not a valid trip:\n`);
    for (const e of err.errors) console.error(`  • ${e.instancePath || '(root)'} ${e.message}`);
    console.error('\nSee schema/journey.schema.json for the full shape.\n');
  } else {
    console.error(`\n✗ ${err.message}\n`);
  }
  process.exit(1);
}

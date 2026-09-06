// Compile a trip (YAML or JSON) into src/lib/journey.json — the file the map
// renders — after validating it against schema/journey.schema.json.
//
//   node scripts/build-trip.mjs trips/adriatic-crossing.yaml
//   node scripts/build-trip.mjs my-trip.json
//
// Humans (or their agents) edit the readable source in trips/; this makes the
// machine file. Errors point at the exact field that's wrong.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const src = process.argv[2] || 'trips/adriatic-crossing.yaml';
const outPath = fileURLToPath(new URL('../src/lib/journey.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../schema/journey.schema.json', import.meta.url));

const raw = readFileSync(src, 'utf8');
const trip = src.endsWith('.json') ? JSON.parse(raw) : parseYaml(raw);

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

if (!validate(trip)) {
  console.error(`\n✗ ${src} is not a valid trip:\n`);
  for (const e of validate.errors) console.error(`  • ${e.instancePath || '(root)'} ${e.message}`);
  console.error('\nSee schema/journey.schema.json for the full shape.\n');
  process.exit(1);
}

// write with the editor-autocomplete pointer first (drop any incoming one)
delete trip.$schema;
const out = { $schema: '../../schema/journey.schema.json', ...trip };
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`✓ ${src} → src/lib/journey.json  (${trip.stays.length} stays, ${trip.pois.length} sights, ${(trip.drives || []).length} drives)`);

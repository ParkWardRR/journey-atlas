// Shared trip-compile logic: read a trip (YAML or JSON), validate it against
// schema/journey.schema.json, and write src/lib/journey.json — the file the map
// renders. Used by build-trip.mjs (CLI) and render-all.mjs (batch).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const outPath = fileURLToPath(new URL('../../src/lib/journey.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../../schema/journey.schema.json', import.meta.url));

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

// Parse a trip file into an object (no validation). Throws on unreadable input.
export function readTrip(src) {
  const raw = readFileSync(src, 'utf8');
  return src.endsWith('.json') ? JSON.parse(raw) : parseYaml(raw);
}

// Validate a parsed trip; returns { ok, errors } where errors are AJV errors.
export function validateTrip(trip) {
  return validate(trip) ? { ok: true, errors: [] } : { ok: false, errors: validate.errors };
}

// Compile a trip file to src/lib/journey.json. Returns the parsed trip on success.
// Throws an Error (with .errors when it's a schema failure) otherwise.
export function buildTrip(src, { write = true } = {}) {
  const trip = readTrip(src);
  const { ok, errors } = validateTrip(trip);
  if (!ok) {
    const err = new Error(`${src} is not a valid trip`);
    err.errors = errors;
    throw err;
  }
  if (write) {
    delete trip.$schema; // rewrite the editor-autocomplete pointer ourselves
    const out = { $schema: '../../schema/journey.schema.json', ...trip };
    writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  }
  return trip;
}

// Human-readable one-liner for a compiled trip (shared by the CLI + batch runner).
export function summarize(trip) {
  return `${(trip.stays || []).length} stays, ${(trip.pois || []).length} sights, `
    + `${(trip.drives || []).length} drives`;
}

/**
 * CHECK 3.105 — η πύλη του ενός γραφέα του εδάφους της αγγελίας (ADR-920 §12).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο. Μ1–Μ12 = κάθε κριτήριο κοκκινίζει σε δικό του fixture, δίπλα σε fixture-δίδυμα
 * που ΔΕΝ πρέπει να κοκκινίσουν — τα ψευδώς θετικά που ΜΕΤΡΗΘΗΚΑΝ στο δέντρο (σώμα απάντησης της πόρτας · `'media'`
 * της γνωστοποίησης · destructuring · `terrain` του BIM · `terrain: null` · σχόλιο που ονομάζει τις κλήσεις).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING, REGISTRY_FILE } = require('../check-listing-terrain-authority');

const BINDER = 'src/services/listings/public-listing-terrain-projection.ts';
const LINK = 'src/lib/listings/public-listing-migrations-21-30.ts';
const DOOR = 'src/app/api/properties/[id]/terrain/route.ts'; // πραγματική γραμμή `refresh` του MATERIAL_DOORS
const EXEMPT_DOOR = 'src/server/listing-material/material-supersession.ts'; // πραγματική γραμμή `exempt`
const BAKE = 'src/services/listings/public-shelf-terrain-bake.ts';
const REASON = 'Ο ψήστης του ραφιού: το μόνο σημείο όπου το στιγμιότυπο γίνεται δημόσια bytes.';

const registryWith = (over = {}) => ({
  binder: BINDER,
  sourceRefName: 'LISTING_TERRAIN_SOURCE_REF',
  judgeFunction: 'readStoredTerrain',
  schemaLinks: { [LINK]: 'Κρίκος 26: περνά το αποθηκευμένο από τον κριτή, ποτέ δεν παράγει έδαφος.' },
  sourceRecordBuilders: ['buildPublishedTerrainFileRecord'],
  derivers: ['buildListingTerrainSnapshot', 'listingTerrainCardOf'],
  derivationHome: 'src/lib/terrain/',
  derivationOwners: { [DOOR]: REASON, [BAKE]: REASON },
  ...over,
});

const HEALTHY = {
  [BINDER]: `export const LISTING_TERRAIN_SOURCE_REF = 'property-terrain:measured';
export function withPublishedTerrain(listing, t) {
  if (t === null) return { ...listing, terrain: null };
  return { ...listing, terrain: { provenance: 'measured', value: t.card, at: t.at, sourceRef: LISTING_TERRAIN_SOURCE_REF } };
}`,
  [LINK]: `export const link = { apply: (doc) => ({ ...doc, terrain: readStoredTerrain(doc.terrain) }) };`,
  [DOOR]: `export const door = { recordOf: (_u, birth) => buildPublishedTerrainFileRecord(birth) };
export function read(source) { const built = buildListingTerrainSnapshot(source);
  return { terrain: { stats: built.snapshot.stats, contourIntervalM: 1 } }; }`,
  [BAKE]: `export function bake(raw, d) { const built = buildListingTerrainSnapshot(raw); return listingTerrainCardOf(built.snapshot, d); }`,
  // Δίδυμα που ΔΕΝ είναι έδαφος αγγελίας — καθένα μετρήθηκε στο πραγματικό δέντρο.
  'src/lib/listings/listing-disclosure.ts': `export const D = { terrain: 'media' };`,
  'src/services/listings/shelf.ts': `// withPublishedTerrain(…) · buildListingTerrainSnapshot(…) · terrain: { provenance } — σχόλιο, όχι κώδικας
export function f(s) { const { terrain: terrainSources } = s; return { terrain: [] , other: terrainSources, x: { terrain: null } }; }`,
  'src/subapps/dxf-viewer/bim/terrain-layer.ts': `export const layer = { terrain: { visible: true, opacity: 0.5 } };`,
  'src/lib/terrain/publication/listing-terrain-card.ts': `export function listingTerrainCardOf(s, d) { return { s, d }; }
export const again = (s) => buildListingTerrainSnapshot(s);`,
};

function world(overrides = {}, registry = registryWith()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lta-'));
  const codeFiles = [];
  for (const [rel, text] of Object.entries({ ...HEALTHY, ...overrides })) {
    if (text === null) continue;
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
    codeFiles.push(abs);
  }
  return measure({ root, codeFiles, registry });
}

const blockingStates = (result) => result.findings.filter((f) => BLOCKING.includes(f.state)).map((f) => f.state).sort();

describe('Μ0 — πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  it('καμία μπλοκάρουσα παραβίαση · ο binder, ο κρίκος, η πόρτα και οι παραγωγοί μετρήθηκαν', () => {
    const result = measure();
    expect(blockingStates(result)).toEqual([]);
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', REGISTRY_FILE), 'utf8'));
    expect(result.tally[STATES.BINDER]).toBe(1);
    expect(result.tally[STATES.SCHEMA_LINK]).toBe(Object.keys(registry.schemaLinks).length);
    expect(result.tally[STATES.DERIVATION_OWNER]).toBe(Object.keys(registry.derivationOwners).length);
    // Χωρίς ΖΩΝΤΑΝΗ πόρτα πηγής, το «πράσινο» του Κ2 θα σήμαινε «δεν κοίταξα».
    expect(result.tally[STATES.DOOR]).toBeGreaterThanOrEqual(1);
  });
});

describe('fixtures', () => {
  it('υγιής κόσμος ⇒ πράσινο (σώμα απάντησης · `media` · destructuring · BIM · `null` · σχόλιο ΔΕΝ είναι έδαφος αγγελίας)', () => {
    const result = world();
    expect(blockingStates(result)).toEqual([]);
    expect(result.tally[STATES.BINDER]).toBe(1);
    expect(result.tally[STATES.DOOR]).toBe(1);
    expect(result.tally[STATES.DERIVATION_OWNER]).toBe(2);
  });

  it('Μ1 Κ1 — δεύτερος γραφέας με ωμό URL ⇒ ⛔', () => {
    const result = world({ 'src/services/listings/rogue.ts': `export const f = (l, url) => ({ ...l, terrain: { provenance: 'measured', value: { url } } });` });
    expect(blockingStates(result)).toEqual([STATES.SECOND_WRITER]);
  });

  it('Μ2 Κ1 — …και κρυμμένος πίσω από `as` / παρενθέσεις ⇒ ⛔', () => {
    const result = world({ 'src/services/listings/rogue.ts': `export const f = (l) => ({ ...l, 'terrain': ({ provenance: 'declared', value: l.v } as T) });` });
    expect(blockingStates(result)).toEqual([STATES.SECOND_WRITER]);
  });

  it('Μ3 Κ1 — ο δείκτης προέλευσης χρησιμοποιείται έξω από τον binder ⇒ ⛔', () => {
    const result = world({ 'src/services/listings/rogue.ts': `import { LISTING_TERRAIN_SOURCE_REF } from './p';
export const attr = { sourceRef: LISTING_TERRAIN_SOURCE_REF };` });
    expect(blockingStates(result)).toEqual([STATES.SECOND_WRITER]);
  });

  it('Μ4 Κ1 — ο κριτής ως γραφέας σε αδήλωτο αρχείο ⇒ ⛔', () => {
    const result = world({ 'src/lib/listings/other-migration.ts': `export const m = (doc) => ({ ...doc, terrain: readStoredTerrain(doc.x) });` });
    expect(blockingStates(result)).toEqual([STATES.UNDECLARED_LINK]);
  });

  it('Μ5 Κ1 — binder που δεν γράφει πια έδαφος ⇒ ⛔ (όχι «0 = πράσινο»)', () => {
    expect(blockingStates(world({ [BINDER]: 'export const withPublishedTerrain = (l) => l;' }))).toEqual([STATES.SILENT_DECLARATION]);
  });

  it('Μ6 Κ1 — κρίκος που δεν περνά πια από τον κριτή ⇒ ⛔', () => {
    expect(blockingStates(world({ [LINK]: 'export const link = { apply: (doc) => doc };' }))).toEqual([STATES.SILENT_DECLARATION]);
  });

  it('Μ7 Κ2 — πηγή εδάφους γεννιέται έξω από πόρτα του MATERIAL_DOORS ⇒ ⛔', () => {
    const result = world({ 'src/app/api/properties/[id]/terrain-v2/route.ts': `export const r = (b) => buildPublishedTerrainFileRecord(b);` });
    expect(blockingStates(result)).toEqual([STATES.SOURCE_OUTSIDE_DOOR]);
  });

  it('Μ8 Κ2 — …ή σε γραμμή `exempt` (εξαίρεση ≠ επαναπροβολή) ⇒ ⛔', () => {
    const result = world({ [EXEMPT_DOOR]: `export const r = (b) => buildPublishedTerrainFileRecord(b);` });
    expect(blockingStates(result)).toEqual([STATES.SOURCE_OUTSIDE_DOOR]);
  });

  it('Μ9 Κ3 — τρίτος παραγωγός στιγμιοτύπου έξω από τον πυρήνα ⇒ ⛔', () => {
    const result = world({ 'src/components/listing-detail/terrain/preview.ts': `export const p = (s) => buildListingTerrainSnapshot(s);` });
    expect(blockingStates(result)).toEqual([STATES.STRAY_DERIVATION]);
  });

  it('Μ10 Κ4 — δηλωμένος παραγωγός που δεν παράγει πια ⇒ ⛔ νεκρή γραμμή', () => {
    expect(blockingStates(world({ [BAKE]: 'export const bake = () => null;' }))).toEqual([STATES.SILENT_DECLARATION]);
  });

  it('Μ11 Κ4 — δήλωση χωρίς πραγματικό λόγο ⇒ ⛔', () => {
    const registry = registryWith({ derivationOwners: { [DOOR]: REASON, [BAKE]: 'ψήνει' } });
    expect(blockingStates(world({}, registry))).toEqual([STATES.NO_REASON]);
  });

  it('Μ12 — δηλωμένο αρχείο που δεν υπάρχει ⇒ ⛔ source-drift', () => {
    expect(blockingStates(world({ [LINK]: null }))).toEqual([STATES.SOURCE_DRIFT]);
  });
});

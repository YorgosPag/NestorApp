/**
 * CHECK 3.112 — η πύλη του ενός γραφέα της δημόσιας βιτρίνας (ADR-923 §5.13).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο. Οι υπόλοιπες = κάθε κρίση κοκκινίζει σε δικό της fixture, δίπλα σε δίδυμα που ΔΕΝ
 * πρέπει να κοκκινίσουν (σχόλιο που ονομάζει τα σύμβολα · ο ορισμός του συμβόλου · άλλη συλλογή).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING, REGISTRY_FILE } = require('../check-public-catalog-authority');

const WRITER = 'src/server/catalog/public/writer.ts';
const REASON = 'Ο ένας γραφέας: έγγραφο και αναθεώρηση στην ίδια συναλλαγή.';

const registryWith = (over = {}) => ({
  guards: [
    { kind: 'member', name: 'COLLECTIONS.PUBLIC_CATALOG_MODELS', owners: { [WRITER]: REASON } },
    { kind: 'call', name: 'projectPublicModel', owners: { [WRITER]: REASON } },
  ],
  ...over,
});

const HEALTHY = {
  [WRITER]: `export const ref = (db) => db.collection(COLLECTIONS.PUBLIC_CATALOG_MODELS);
export const doc = (input) => projectPublicModel(input);`,
  'src/subapps/catalog/public/project-public-model.ts': `// projectPublicModel(input) · COLLECTIONS.PUBLIC_CATALOG_MODELS — σχόλιο, όχι χρήση
export function projectPublicModel(input) { return input; }`,
  'src/server/other.ts': `export const other = (db) => db.collection(COLLECTIONS.PUBLIC_LISTINGS);`,
};

function worldWith(files, registry) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-3-112-'));
  const codeFiles = Object.entries({ ...HEALTHY, ...files }).map(([rel, text]) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
    return abs;
  });
  fs.writeFileSync(path.join(root, REGISTRY_FILE), JSON.stringify(registry));
  return { root, codeFiles };
}

const blockers = (result) => result.findings.filter((finding) => BLOCKING.includes(finding.state));
const measured = (files, registry = registryWith()) => measure({ ...worldWith(files, registry), registry });

describe('CHECK 3.112', () => {
  it('Μ0: πράσινη στο πραγματικό δέντρο', () => {
    expect(blockers(measure({}))).toEqual([]);
  });

  it('υγιής κόσμος: οι κάτοχοι μετρούνται, σχόλιο και ορισμός δεν είναι χρήση', () => {
    const result = measured({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBe(2);
  });

  it('Μ1: αναφορά στη συλλογή έξω από τον κάτοχο', () => {
    const result = measured({ 'src/server/rogue.ts': `export const r = (db) => db.collection(COLLECTIONS.PUBLIC_CATALOG_MODELS).doc('x').set({});` });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/server/rogue.ts', line: 1 })]);
  });

  it('Μ2: κλήση φυλαγμένης συνάρτησης έξω από τον κάτοχο', () => {
    const result = measured({ 'src/app/page.tsx': `export const r = (i) => projectPublicModel(i);` });
    expect(blockers(result).map((finding) => finding.state)).toEqual([STATES.OUTSIDE]);
  });

  it('Μ3: κλήση μέσω ονόματος χώρου πιάνεται επίσης', () => {
    const result = measured({ 'src/server/rogue.ts': `export const r = (m, i) => m.projectPublicModel(i);` });
    expect(blockers(result).map((finding) => finding.state)).toEqual([STATES.OUTSIDE]);
  });

  it('Μ3β: αναφορά ως τιμή πιάνεται, η εισαγωγή και η δήλωση όχι', () => {
    const registry = registryWith({ guards: [{ kind: 'reference', name: 'SHELF', owners: { [WRITER]: REASON } }] });
    const world = {
      [WRITER]: `export const a = () => reconcile(SHELF);`,
      'src/kind.ts': `export const SHELF = {};`,
      'src/type.ts': `import { SHELF } from './kind';`,
    };
    expect(blockers(measured(world, registry))).toEqual([]);
    const rogue = measured({ ...world, 'src/rogue.ts': `export const r = () => reconcile(SHELF);` }, registry);
    expect(blockers(rogue)).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/rogue.ts' })]);
  });

  it('Μ4: δηλωμένος κάτοχος που δεν το κάνει πια', () => {
    const result = measured({ [WRITER]: `export const doc = (input) => projectPublicModel(input);` });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.SILENT_DECLARATION, file: WRITER })]);
  });

  it('Μ5: δήλωση χωρίς λόγο', () => {
    const registry = registryWith({ guards: [{ kind: 'call', name: 'projectPublicModel', owners: { [WRITER]: 'γιατί' } }] });
    expect(blockers(measured({}, registry)).map((finding) => finding.state)).toEqual([STATES.NO_REASON]);
  });

  it('Μ6: δηλωμένο αρχείο που δεν υπάρχει', () => {
    const registry = registryWith({ guards: [{ kind: 'call', name: 'projectPublicModel', owners: { 'src/gone.ts': REASON } }] });
    const states = blockers(measured({}, registry)).map((finding) => finding.state);
    expect(states).toContain(STATES.SOURCE_DRIFT);
  });
});

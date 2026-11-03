/**
 * CHECK 3.113 — η πύλη του ενός γραφέα της υπεργολαβίας (ADR-928).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο, ΜΕ παρονομαστή (ο σαρωτής είδε τους κατόχους). Οι υπόλοιπες = κάθε κρίση κοκκινίζει σε
 * δικό της fixture, δίπλα σε δίδυμα που ΔΕΝ πρέπει να κοκκινίσουν (σχόλιο · ορισμός · άλλη συλλογή).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING, REGISTRY_FILE, MCP_ACCESS_CONTROL } = require('../check-subcontract-authority');

const STORE = 'src/server/subcontracts/subcontract-store.server.ts';
const WRITER = 'src/server/subcontracts/clause-library-writer.server.ts';
const REASON = 'Ο ένας γραφέας: CAS, διάκριση καθηκόντων και ίχνος μετά το commit.';
const MCP_OK = `const WRITE_ALLOWED_COLLECTIONS = new Set([\n  'tasks', // subcontract_clauses σε σχόλιο δεν μετρά\n]);`;

const registryWith = (over = {}) => ({
  guards: [
    { kind: 'member', name: 'COLLECTIONS.SUBCONTRACT_CLAUSES', owners: { [STORE]: REASON } },
    { kind: 'call', name: 'runSubcontractTransaction', owners: { [WRITER]: REASON } },
  ],
  ...over,
});

const HEALTHY = {
  [STORE]: `export const ref = (db, id) => db.collection(COLLECTIONS.SUBCONTRACT_CLAUSES).doc(id);
export async function runSubcontractTransaction(ctx, work) { return work(ctx); }`,
  [WRITER]: `export const create = (ctx) => runSubcontractTransaction(ctx, async () => null);`,
  'src/server/other.ts': `// COLLECTIONS.SUBCONTRACT_CLAUSES · runSubcontractTransaction — σχόλιο, όχι χρήση
export const other = (db) => db.collection(COLLECTIONS.CATALOG_ATTRIBUTES);`,
  [MCP_ACCESS_CONTROL]: MCP_OK,
};

function worldWith(files, registry) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-3-113-'));
  const codeFiles = Object.entries({ ...HEALTHY, ...files })
    .filter(([, text]) => text !== null)
    .map(([rel, text]) => {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text);
      return abs;
    })
    .filter((abs) => abs.includes(`${path.sep}src${path.sep}`));
  fs.writeFileSync(path.join(root, REGISTRY_FILE), JSON.stringify(registry));
  return { root, codeFiles };
}

const blockers = (result) => result.findings.filter((finding) => BLOCKING.includes(finding.state));
const measured = (files, registry = registryWith()) => measure({ ...worldWith(files, registry), registry });

describe('CHECK 3.113', () => {
  it('Μ0: πράσινη στο πραγματικό δέντρο — και ο σαρωτής ΕΙΔΕ τους κατόχους', () => {
    const result = measure({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBeGreaterThanOrEqual(8);
  });

  it('υγιής κόσμος: οι κάτοχοι μετρούνται, σχόλιο και ορισμός δεν είναι χρήση', () => {
    const result = measured({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBe(2);
  });

  it('Μ1: εγγραφή στη συλλογή έξω από τον γραφέα', () => {
    const result = measured({ 'src/server/rogue.ts': `export const r = (db) => db.collection(COLLECTIONS.SUBCONTRACT_CLAUSES).doc('x').set({});` });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/server/rogue.ts', line: 1 })]);
  });

  it('Μ2: αδήλωτος γραφέας που ανοίγει συναλλαγή', () => {
    const result = measured({ 'src/server/subcontracts/rogue-writer.server.ts': `export const w = (ctx) => runSubcontractTransaction(ctx, async () => 1);` });
    expect(blockers(result).map((finding) => finding.state)).toEqual([STATES.OUTSIDE]);
  });

  it('Μ3: δηλωμένος γραφέας που δεν ανοίγει πια συναλλαγή', () => {
    const result = measured({ [WRITER]: `export const create = () => null;` });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.SILENT_DECLARATION, file: WRITER })]);
  });

  it('Μ4: δήλωση χωρίς λόγο · δηλωμένο αρχείο που δεν υπάρχει', () => {
    const noReason = registryWith({ guards: [{ kind: 'call', name: 'runSubcontractTransaction', owners: { [WRITER]: 'γιατί' } }] });
    expect(blockers(measured({}, noReason)).map((finding) => finding.state)).toEqual([STATES.NO_REASON]);
    const gone = registryWith({ guards: [{ kind: 'call', name: 'runSubcontractTransaction', owners: { 'src/gone.ts': REASON } }] });
    expect(blockers(measured({}, gone)).map((finding) => finding.state)).toContain(STATES.SOURCE_DRIFT);
  });

  it('Μ5: συλλογή `subcontract_*` στη λίστα απευθείας εγγραφής του MCP', () => {
    const rogue = `const WRITE_ALLOWED_COLLECTIONS = new Set([\n  'tasks',\n  'subcontract_clauses',\n]);`;
    expect(blockers(measured({ [MCP_ACCESS_CONTROL]: rogue }))).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: MCP_ACCESS_CONTROL })]);
  });

  it('Μ6: χωρίς λίστα MCP η πύλη ΑΡΝΕΙΤΑΙ — δεν λέει «καθαρό» στα τυφλά', () => {
    expect(blockers(measured({ [MCP_ACCESS_CONTROL]: 'export const nothing = 1;' })).map((finding) => finding.state)).toEqual([STATES.SOURCE_DRIFT]);
  });
});

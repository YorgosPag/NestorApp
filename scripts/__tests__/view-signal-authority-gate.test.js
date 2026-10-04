/**
 * CHECK 3.99 — η πύλη του ενός γραφέα σημάτων όψεων (ADR-905 §8 Ε2).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο. Μ1–Μ7 = κάθε κριτήριο κοκκινίζει σε δικό του fixture, και ένα
 * fixture-δίδυμο που δεν πρέπει να κοκκινίσει (κείμενο σε σχόλιο ≠ κλήση).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING } = require('../check-view-signal-authority');

const WRITER = 'src/services/signal-writer.ts';
const CLIENT_REF = 'src/lib/client-ref.ts';
const CASE = 'src/services/case.service.ts';

const REGISTRY = {
  writer: WRITER,
  clientRef: CLIENT_REF,
  signalFunctions: ['signalViewsInTx', 'signalCaseChangeInTx'],
  caseWriters: { [CASE]: { calls: ['signalCaseChangeInTx'], min: 2, why: 'άνοιγμα + εντολή' } },
};

const HEALTHY = {
  [WRITER]: `export function signalViewsInTx(tx, db, views) { for (const v of views) tx.set(ref(COLLECTIONS.CONVEYANCE_VIEW_SIGNALS, v), {}, { merge: true }); }
export function signalCaseChangeInTx(tx, db, change, viewers) { signalViewsInTx(tx, db, viewers); }`,
  [CLIENT_REF]: `// ΠΟΤΕ setDoc( εδώ — μόνο ανάγνωση.
export const ref = (db, id) => doc(db, COLLECTIONS.CONVEYANCE_VIEW_SIGNALS, id);`,
  [CASE]: `export async function open(tx, db) { tx.create(x); signalCaseChangeInTx(tx, db, a, b); }
export async function command(tx, db) { tx.set(x); signalCaseChangeInTx(tx, db, a, b); }`,
  'src/services/unrelated.ts': `// signalViewsInTx( αναφέρεται σε σχόλιο — δεν είναι κλήση
export const x = 1;`,
};

function world(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vsa-'));
  const files = { ...HEALTHY, ...overrides };
  const codeFiles = [];
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
    codeFiles.push(abs);
  }
  return measure({ root, codeFiles, registry: REGISTRY });
}

const blockingStates = (result) => result.findings.filter((f) => BLOCKING.includes(f.state)).map((f) => f.state).sort();

describe('Μ0 — πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  it('καμία μπλοκάρουσα παραβίαση · ένας γραφέας · κάθε δηλωμένος γραφέας της υπόθεσης μετρήθηκε', () => {
    const result = measure();
    expect(blockingStates(result)).toEqual([]);
    expect(result.tally[STATES.WRITER]).toBe(1);
    expect(result.tally[STATES.CLIENT_REF]).toBe(1);
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.view-signal-authority.json'), 'utf8'));
    expect(result.tally[STATES.CASE_WRITER]).toBe(Object.keys(registry.caseWriters).length);
  });
});

describe('fixtures', () => {
  it('υγιής κόσμος ⇒ πράσινο (σχόλια που ΟΝΟΜΑΖΟΥΝ κλήσεις δεν μετράνε)', () => {
    expect(blockingStates(world())).toEqual([]);
  });

  it('Μ1 Κ1 — δεύτερο αρχείο ονομάζει τη συλλογή σημάτων ⇒ ⛔', () => {
    const result = world({ 'src/services/rogue.ts': 'export const r = (db) => db.collection(COLLECTIONS.CONVEYANCE_VIEW_SIGNALS);' });
    expect(blockingStates(result)).toEqual([STATES.COLLECTION_OUTSIDE]);
  });

  it('Μ2 Κ2 — αδήλωτος καλών συνάρτησης σήματος ⇒ ⛔ (το μητρώο μένει πλήρες)', () => {
    const result = world({ 'src/services/new-writer.ts': 'export function f(tx, db) { signalCaseChangeInTx(tx, db, a, b); }' });
    expect(blockingStates(result)).toEqual([STATES.UNDECLARED_CALLER]);
  });

  it('Μ3 Κ2 — δηλωμένος γραφέας που «ξέχασε» ένα σήμα ⇒ ⛔', () => {
    const result = world({ [CASE]: 'export async function open(tx, db) { tx.create(x); signalCaseChangeInTx(tx, db, a, b); }\nexport async function command(tx) { tx.set(x); }' });
    expect(blockingStates(result)).toEqual([STATES.MISSING_SIGNAL]);
  });

  it('Μ4 Κ2 — δηλωμένος γραφέας χωρίς ΚΑΜΙΑ κλήση (ούτε περνά το προφίλτρο) ⇒ ⛔, όχι σιωπή', () => {
    expect(blockingStates(world({ [CASE]: 'export const nothing = 1;' }))).toEqual([STATES.MISSING_SIGNAL]);
  });

  it('Μ5 Κ3 — η αναφορά του client γράφει ⇒ ⛔', () => {
    const result = world({ [CLIENT_REF]: `export const w = (db, id) => setDoc(doc(db, COLLECTIONS.CONVEYANCE_VIEW_SIGNALS, id), {});` });
    expect(blockingStates(result)).toEqual([STATES.CLIENT_WRITES]);
  });

  it('Μ6 Κ4 — ο γραφέας αποκτά δεύτερη μορφή εγγραφής (`tx.update`) ⇒ ⛔', () => {
    const result = world({ [WRITER]: `${HEALTHY[WRITER]}\nexport function reset(tx) { tx.update(ref(COLLECTIONS.CONVEYANCE_VIEW_SIGNALS), { revision: 0 }); }` });
    expect(blockingStates(result)).toEqual([STATES.SECOND_WRITE_FORM]);
  });

  it('Μ7 — δηλωμένο αρχείο που δεν υπάρχει ⇒ ⛔ source-drift', () => {
    expect(blockingStates(world({ [CASE]: null }))).toEqual([STATES.SOURCE_DRIFT]);
  });
});
